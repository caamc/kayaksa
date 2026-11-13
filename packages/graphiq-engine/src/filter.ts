// Search filters: one definition used by the browser (in memory), the Worker (SQL on D1 or any
// SQLite-compatible database) and the AI assistant (which may only ever produce a Filter).
import { CALL_TYPES, type CallType, type CdrRecord, type Filter } from "./types";
import { localParts } from "./time";
import { normaliseMsisdn } from "./msisdn";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Validates and normalises an untrusted filter (from a form, saved filter or the AI). */
export function cleanFilter(input: any, cc = "91"): Filter {
  const f: Filter = {};
  if (!input || typeof input !== "object") return f;
  if (Array.isArray(input.numbers)) {
    const nums = input.numbers.slice(0, 500).map((n: unknown) => String(n ?? "").trim()).filter(Boolean)
      .map((n: string) => normaliseMsisdn(n, cc).value || n.replace(/[^\w+]/g, "")).filter(Boolean);
    if (nums.length) f.numbers = [...new Set<string>(nums)];
  }
  if (["a", "b", "any"].includes(input.side)) f.side = input.side;
  const t = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v ? Date.parse(v) : NaN);
  const from = t(input.from), to = t(input.to);
  if (Number.isFinite(from)) f.from = from;
  if (Number.isFinite(to)) f.to = to;
  if (typeof input.timeFrom === "string" && HHMM.test(input.timeFrom)) f.timeFrom = input.timeFrom;
  if (typeof input.timeTo === "string" && HHMM.test(input.timeTo)) f.timeTo = input.timeTo;
  const n = (v: unknown) => (v === "" || v == null ? NaN : Number(v));
  if (Number.isFinite(n(input.durMin)) && n(input.durMin) >= 0) f.durMin = Math.round(n(input.durMin));
  if (Number.isFinite(n(input.durMax)) && n(input.durMax) >= 0) f.durMax = Math.round(n(input.durMax));
  if (Array.isArray(input.types)) { const ty = input.types.filter((x: any) => CALL_TYPES.includes(x)) as CallType[]; if (ty.length) f.types = [...new Set(ty)]; }
  for (const k of ["imei", "imsi", "cell"] as const) if (typeof input[k] === "string" && input[k].trim()) f[k] = input[k].trim().slice(0, 40);
  if (Array.isArray(input.weekdays)) { const w = input.weekdays.map(Number).filter((x: number) => x >= 0 && x <= 6); if (w.length) f.weekdays = [...new Set<number>(w)]; }
  return f;
}

const mins = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

export function matches(r: CdrRecord, f: Filter, tz = "Asia/Kolkata"): boolean {
  if (f.numbers?.length) {
    const side = f.side || "any";
    const hit = f.numbers.some((n) => (side !== "b" && r.a === n) || (side !== "a" && r.b === n));
    if (!hit) return false;
  }
  if (f.from !== undefined && r.ts < f.from) return false;
  if (f.to !== undefined && r.ts > f.to) return false;
  if (f.durMin !== undefined && r.dur < f.durMin) return false;
  if (f.durMax !== undefined && r.dur > f.durMax) return false;
  if (f.types?.length && !f.types.includes(r.type)) return false;
  if (f.imei && !(r.imei || "").includes(f.imei)) return false;
  if (f.imsi && !(r.imsi || "").includes(f.imsi)) return false;
  if (f.cell && !(r.cell || "").toUpperCase().includes(f.cell.toUpperCase()) && !(r.lastCell || "").toUpperCase().includes(f.cell.toUpperCase())) return false;
  if (f.timeFrom || f.timeTo || f.weekdays?.length) {
    const p = localParts(r.ts, tz);
    if (f.weekdays?.length && !f.weekdays.includes(p.wd)) return false;
    const m = p.h * 60 + p.mi;
    const a = f.timeFrom ? mins(f.timeFrom) : 0, b = f.timeTo ? mins(f.timeTo) : 24 * 60;
    if (a <= b ? m < a || m > b : m < a && m > b) return false;
  }
  return true;
}

export const applyFilter = (records: CdrRecord[], f: Filter, tz?: string) => records.filter((r) => matches(r, f, tz));

/**
 * SQL WHERE clause for the records table (columns a, b, ts, dur, type, imei, imsi, cell, last_cell).
 * Time-of-day and weekday use a fixed UTC offset (minutes) for the case time zone.
 */
export function filterToSql(f: Filter, offsetMin = 330): { where: string; params: (string | number)[] } {
  const w: string[] = [], p: (string | number)[] = [];
  if (f.numbers?.length) {
    const ph = f.numbers.map(() => "?").join(",");
    const side = f.side || "any";
    if (side === "a") { w.push(`a IN (${ph})`); p.push(...f.numbers); }
    else if (side === "b") { w.push(`b IN (${ph})`); p.push(...f.numbers); }
    else { w.push(`(a IN (${ph}) OR b IN (${ph}))`); p.push(...f.numbers, ...f.numbers); }
  }
  if (f.from !== undefined) { w.push("ts >= ?"); p.push(f.from); }
  if (f.to !== undefined) { w.push("ts <= ?"); p.push(f.to); }
  if (f.durMin !== undefined) { w.push("dur >= ?"); p.push(f.durMin); }
  if (f.durMax !== undefined) { w.push("dur <= ?"); p.push(f.durMax); }
  if (f.types?.length) { w.push(`type IN (${f.types.map(() => "?").join(",")})`); p.push(...f.types); }
  if (f.imei) { w.push("imei LIKE ?"); p.push(`%${f.imei.replace(/[%_]/g, "")}%`); }
  if (f.imsi) { w.push("imsi LIKE ?"); p.push(`%${f.imsi.replace(/[%_]/g, "")}%`); }
  if (f.cell) { w.push("(cell LIKE ? OR last_cell LIKE ?)"); const v = `%${f.cell.replace(/[%_]/g, "")}%`; p.push(v, v); }
  const localMin = `(((ts / 60000) + ${Math.round(offsetMin)}) % 1440)`;
  if (f.timeFrom || f.timeTo) {
    const a = f.timeFrom ? mins(f.timeFrom) : 0, b = f.timeTo ? mins(f.timeTo) : 1440;
    if (a <= b) { w.push(`${localMin} BETWEEN ? AND ?`); p.push(a, b); }
    else { w.push(`(${localMin} >= ? OR ${localMin} <= ?)`); p.push(a, b); }
  }
  if (f.weekdays?.length) { w.push(`((((ts / 60000) + ${Math.round(offsetMin)}) / 1440 + 4) % 7) IN (${f.weekdays.map(() => "?").join(",")})`); p.push(...f.weekdays); }
  return { where: w.length ? w.join(" AND ") : "1=1", params: p };
}

export function describeFilter(f: Filter, tz = "Asia/Kolkata"): string {
  const parts: string[] = [];
  const d = (t: number) => { const p = localParts(t, tz); return `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };
  if (f.numbers?.length) parts.push(`${f.side === "a" ? "A party" : f.side === "b" ? "B party" : "number"} ${f.numbers.slice(0, 5).join(", ")}${f.numbers.length > 5 ? ` and ${f.numbers.length - 5} more` : ""}`);
  if (f.from !== undefined || f.to !== undefined) parts.push(`dates ${f.from !== undefined ? d(f.from) : "start"} to ${f.to !== undefined ? d(f.to) : "end"}`);
  if (f.timeFrom || f.timeTo) parts.push(`between ${f.timeFrom || "00:00"} and ${f.timeTo || "24:00"}`);
  if (f.durMin !== undefined) parts.push(`at least ${f.durMin} s`);
  if (f.durMax !== undefined) parts.push(`at most ${f.durMax} s`);
  if (f.types?.length) parts.push(`type ${f.types.join(", ")}`);
  if (f.imei) parts.push(`IMEI contains ${f.imei}`);
  if (f.imsi) parts.push(`IMSI contains ${f.imsi}`);
  if (f.cell) parts.push(`cell contains ${f.cell}`);
  if (f.weekdays?.length) parts.push(`on ${f.weekdays.map((w) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w]).join(", ")}`);
  return parts.length ? parts.join("; ") : "all records";
}
