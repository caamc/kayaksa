// Standardisation: raw table + column mapping -> normalised records, with a validation report.
// Numbers become E.164, times become UTC (from the operator's local time zone), call types are
// normalised, exact and near-exact duplicates are dropped, and every rejected or doubtful row is
// counted so the analyst can see what was not imported and why.
import type { CallType, CdrRecord, Issue, Mapping, Validation } from "./types";
import { cleanImei, normaliseMsisdn } from "./msisdn";
import { parseDate, parseDuration, parseTime, zonedToUtc, tzOffset as tzMinutes } from "./time";

const TYPE_RULES: [CallType, RegExp][] = [
  ["MISSED", /miss|unanswer|no\s*answer|not\s*answered/],
  ["DATA", /^(data|gprs|ps|internet|lte\s*data|4g\s*data|ipdr|packet|volte\s*data|edge|umts\s*data)$|data\s*session|gprs/],
  ["SMS-MO", /^(smo|smso|sms\s*o|mo\s*sms|sms\s*mo|sms\s*out|sms\s*outgoing|outgoing\s*sms|sms\s*orig\w*|sms\s*sent|sms\s*send|o\s*sms)$/],
  ["SMS-MT", /^(smt|smst|sms\s*t|sms\s*i|mt\s*sms|sms\s*mt|sms\s*in|sms\s*incoming|incoming\s*sms|sms\s*term\w*|sms\s*received|sms\s*recv|i\s*sms)$/],
  ["MO", /^(mo|moc|o|out|outgoing|outgoing\s*call|call\s*out|voice\s*out|voice\s*mo|orig\w*|dialled|call\s*o|volte\s*mo|mo\s*call|outgoing\s*voice)$/],
  ["MT", /^(mt|mtc|i|in|incoming|incoming\s*call|call\s*in|voice\s*in|voice\s*mt|term\w*|received|call\s*i|volte\s*mt|mt\s*call|incoming\s*voice)$/],
];

export function normaliseType(raw: unknown): CallType | null {
  const s = String(raw ?? "").toLowerCase().replace(/[_\-/]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  for (const [t, re] of TYPE_RULES) if (re.test(s)) return t;
  if (/sms/.test(s)) return /in|mt|term|rece/.test(s) ? "SMS-MT" : "SMS-MO";
  if (/forward|cf|roam|ussd|conf/.test(s)) return "OTHER";
  return null;
}

const incoming = (t: CallType) => t === "MT" || t === "SMS-MT" || t === "MISSED";

export interface NormaliseOptions { src?: string; now?: number; dedupe?: boolean; seen?: Set<string> }

export interface NormaliseResult { records: CdrRecord[]; validation: Validation }

const num = (v: string | undefined) => { const n = Number(String(v ?? "").trim()); return v !== undefined && String(v).trim() !== "" && Number.isFinite(n) ? n : null; };

export function dedupeKey(r: CdrRecord) {
  // Near-exact duplicates: same parties, type and duration, start within the same 2-second slot.
  return `${r.a}|${r.b}|${r.type}|${r.dur}|${Math.floor(r.ts / 2000)}`;
}

export function normaliseTable(table: string[][], m: Mapping, opts: NormaliseOptions = {}): NormaliseResult {
  const c = m.cols;
  const now = opts.now ?? Date.now();
  const seen = opts.seen ?? new Set<string>();
  const out: CdrRecord[] = [];
  const v: Validation = { rows: 0, imported: 0, rejected: 0, duplicates: 0, warnings: {}, errors: {}, samples: [], from: null, to: null, targets: [], distinctNumbers: 0 };
  const perKind = new Map<string, number>();
  const note = (kind: string, row: number, detail: string, err: boolean) => {
    const bag = err ? v.errors : v.warnings;
    bag[kind] = (bag[kind] || 0) + 1;
    const n = perKind.get(kind) || 0;
    if (n < 5) v.samples.push({ row, kind, detail });
    perKind.set(kind, n + 1);
  };
  const at = (r: string[], f: keyof Mapping["cols"]) => (c[f] !== undefined ? r[c[f]!] : undefined);
  const nums = new Set<string>();
  const targetCount = new Map<string, number>();
  // For calling/called files without a type column, the target is the number seen most often.
  let inferredTarget = "";
  if (m.parties === "calling-called" && c.type === undefined) {
    const f = new Map<string, number>();
    for (const r of table.slice(m.headerRow + 1, m.headerRow + 2000)) for (const x of [at(r, "calling"), at(r, "called")]) { const n = normaliseMsisdn(x, m.cc).value; if (n) f.set(n, (f.get(n) || 0) + 1); }
    inferredTarget = [...f.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }
  for (let i = m.headerRow + 1; i < table.length; i++) {
    const r = table[i];
    const rowNo = i + 1;
    if (!r || r.every((x) => !x)) continue;
    // Repeated header rows (page breaks in operator exports) and footers
    if (m.headerRow >= 0 && r.join("|") === table[m.headerRow].join("|")) continue;
    v.rows++;
    // Time
    let ts: number | null = null;
    const dt = at(r, "datetime"), ds = at(r, "date"), tm = at(r, "time");
    let dp = dt ? parseDate(dt, m.dateOrder) : ds ? parseDate(ds, m.dateOrder) : tm ? parseDate(tm, m.dateOrder) : null;
    let tp = dp?.time ?? null;
    if (dp && !tp && tm && !dt) tp = parseTime(tm);
    if (dp && !tp && tm) { const t2 = parseDate(tm, m.dateOrder); tp = t2?.time ?? null; }
    if (dp) ts = zonedToUtc(dp.date.y, dp.date.mo, dp.date.d, tp?.h ?? 0, tp?.mi ?? 0, tp?.s ?? 0, m.tz);
    if (ts === null) { v.rejected++; note("bad-date", rowNo, `Date or time not recognised: "${[dt, ds, tm].filter(Boolean).join(" ")}"`, true); continue; }
    if (!tp) note("no-time", rowNo, "Date without a time of day; midnight assumed.", false);
    if (ts > now + 86_400_000) note("future-date", rowNo, "Date is in the future.", false);
    // Parties
    let type = normaliseType(at(r, "type"));
    let a = "", b = "";
    if (m.parties === "calling-called") {
      const calling = normaliseMsisdn(at(r, "calling"), m.cc), called = normaliseMsisdn(at(r, "called"), m.cc);
      if (!type && inferredTarget) type = called.value === inferredTarget ? "MT" : "MO";
      const inc = type ? incoming(type) : false;
      a = inc ? called.value : calling.value;
      b = inc ? calling.value : called.value;
      if (!(inc ? called : calling).valid || !(inc ? calling : called).valid) note("bad-number", rowNo, `Number not in a recognised format: "${at(r, "calling")}" / "${at(r, "called")}"`, false);
    } else {
      const A = normaliseMsisdn(at(r, "a"), m.cc), B = normaliseMsisdn(at(r, "b"), m.cc);
      a = A.value; b = B.value;
      if ((A.value && !A.valid) || (B.value && !B.valid)) note("bad-number", rowNo, `Number not in a recognised format: "${at(r, "a")}" / "${at(r, "b")}"`, false);
    }
    if (!type) {
      if (at(r, "type")) note("unknown-type", rowNo, `Call type "${at(r, "type")}" not recognised; recorded as OTHER.`, false);
      else note("no-type", rowNo, "No call type; recorded as OTHER.", false);
      type = "OTHER";
    }
    if (!a) { v.rejected++; note("no-a-party", rowNo, "A party (target) number is missing.", true); continue; }
    if (!b && type !== "DATA") { v.rejected++; note("no-b-party", rowNo, "B party (other number) is missing.", true); continue; }
    // Duration
    let dur = parseDuration(at(r, "dur"));
    if (dur === null || dur < 0) {
      const end = at(r, "endtime");
      const ep = end ? (parseDate(end, m.dateOrder) || (parseTime(end) ? { date: dp!.date, time: parseTime(end) } : null)) : null;
      if (ep?.time) { let e = zonedToUtc(ep.date.y, ep.date.mo, ep.date.d, ep.time.h, ep.time.mi, ep.time.s, m.tz); if (e < ts) e += 86_400_000; dur = Math.round((e - ts) / 1000); }
    }
    if (dur === null || dur < 0) { note("bad-duration", rowNo, `Duration "${at(r, "dur") ?? ""}" not recognised; 0 used.`, false); dur = 0; }
    if (dur > 6 * 3600 && type !== "DATA") note("long-duration", rowNo, "Call longer than six hours.", false);
    const rec: CdrRecord = { a, b, ts, dur, type, src: opts.src, row: rowNo };
    const imeiRaw = at(r, "imei");
    if (imeiRaw) { const im = cleanImei(imeiRaw); if (im.value) { rec.imei = im.value; if (!im.valid) note("bad-imei", rowNo, `IMEI "${imeiRaw}" fails the check digit.`, false); } }
    const imsi = String(at(r, "imsi") ?? "").replace(/\.0+$/, "").replace(/\D/g, "");
    if (imsi) rec.imsi = imsi;
    const cell = String(at(r, "cell") ?? "").trim();
    if (cell && !/^(0|na|null|-)$/i.test(cell)) rec.cell = cell.replace(/\s+/g, "");
    const lc = String(at(r, "lastCell") ?? "").trim();
    if (lc && !/^(0|na|null|-)$/i.test(lc)) rec.lastCell = lc.replace(/\s+/g, "");
    const lac = String(at(r, "lac") ?? "").trim();
    if (lac) rec.lac = lac;
    const lat = num(at(r, "lat")), lon = num(at(r, "lon"));
    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0)) { rec.lat = lat; rec.lon = lon; }
    const roam = String(at(r, "roam") ?? "").trim();
    if (roam && !/^(n|no|0|false|home|-|na)$/i.test(roam)) rec.roam = roam.slice(0, 60);
    const op = String(at(r, "op") ?? "").trim();
    if (op) rec.op = op.slice(0, 40);
    if (opts.dedupe !== false) {
      const k = dedupeKey(rec);
      if (seen.has(k)) { v.duplicates++; continue; }
      seen.add(k);
    }
    out.push(rec);
    nums.add(a); if (b) nums.add(b);
    targetCount.set(a, (targetCount.get(a) || 0) + 1);
    if (v.from === null || ts < v.from) v.from = ts;
    if (v.to === null || ts > v.to) v.to = ts;
  }
  v.imported = out.length;
  v.distinctNumbers = nums.size;
  v.targets = [...targetCount.entries()].sort((x, y) => y[1] - x[1]).filter(([, n]) => n >= Math.max(1, out.length * 0.05)).map(([k]) => k).slice(0, 20);
  return { records: out, validation: v };
}

/** Merges several sets, dropping duplicates across them. */
export function mergeRecords(sets: CdrRecord[][]): { records: CdrRecord[]; duplicates: number } {
  const seen = new Set<string>();
  const records: CdrRecord[] = [];
  let duplicates = 0;
  for (const s of sets) for (const r of s) { const k = dedupeKey(r); if (seen.has(k)) { duplicates++; continue; } seen.add(k); records.push(r); }
  records.sort((a, b) => a.ts - b.ts);
  return { records, duplicates };
}

/** Splits records by target number or by calendar month (in the case time zone). */
export function splitRecords(records: CdrRecord[], by: "target" | "month", tz = "Asia/Kolkata"): Record<string, CdrRecord[]> {
  const out: Record<string, CdrRecord[]> = {};
  for (const r of records) {
    let k = r.a;
    if (by === "month") { const off = new Date(r.ts + tzMinutes(r.ts, tz) * 60000); k = `${off.getUTCFullYear()}-${String(off.getUTCMonth() + 1).padStart(2, "0")}`; }
    (out[k] ||= []).push(r);
  }
  return out;
}
