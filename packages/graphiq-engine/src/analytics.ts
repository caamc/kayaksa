// CDR analytics. Every function takes normalised records and returns plain JSON, so results can
// cross a Web Worker boundary or be stored as a report. Times are bucketed in the case time zone.
// All results are analytical leads that need human verification against the original records.
import type { CallType, CdrRecord, Tower } from "./types";
import { localParts, isoWeek } from "./time";
import { isdOf } from "./reference";
import { tacOf } from "./msisdn";

export interface Options {
  tz: string;
  nightStart: number; nightEnd: number;        // night = hours >= nightStart or < nightEnd
  businessStart: number; businessEnd: number;  // business hours on Monday to Saturday
  shortSec: number;                            // answered calls up to this many seconds are "short"
  repeatN: number; repeatWindowMin: number;    // N or more calls between the same pair within the window
  colocWindowMin: number;                      // two numbers at the same cell within this many minutes
  silentHours: number;                         // gaps longer than this are silent periods
  circularWindowH: number;                     // A->B->C->A within this many hours
  zThreshold: number;                          // daily-volume anomaly threshold
  newSince?: number;                           // "new numbers" first contacted at or after this time
  limit: number;                               // cap on list lengths
}
export const DEFAULTS: Options = { tz: "Asia/Kolkata", nightStart: 22, nightEnd: 6, businessStart: 9, businessEnd: 18, shortSec: 10, repeatN: 3, repeatWindowMin: 60, colocWindowMin: 30, silentHours: 24, circularWindowH: 24, zThreshold: 2.5, limit: 200 };

export const isVoice = (t: CallType) => t === "MO" || t === "MT" || t === "MISSED";
export const isSms = (t: CallType) => t === "SMS-MO" || t === "SMS-MT";
export const isOut = (t: CallType) => t === "MO" || t === "SMS-MO";
export const isIn = (t: CallType) => t === "MT" || t === "SMS-MT" || t === "MISSED";

interface Local { day: string; h: number; wd: number; month: string; week: string }
const cache = new WeakMap<CdrRecord, Local>();
const cacheTz = { tz: "" };
export function local(r: CdrRecord, tz: string): Local {
  if (cacheTz.tz !== tz) { cacheTz.tz = tz; }
  let l = cache.get(r);
  if (l && (l as any).tz === tz) return l;
  const p = localParts(r.ts, tz);
  const p2 = (n: number) => String(n).padStart(2, "0");
  l = { day: `${p.y}-${p2(p.mo)}-${p2(p.d)}`, h: p.h, wd: p.wd, month: `${p.y}-${p2(p.mo)}`, week: isoWeek(r.ts, tz) };
  (l as any).tz = tz;
  cache.set(r, l);
  return l;
}
const isNight = (h: number, o: Options) => (o.nightStart > o.nightEnd ? h >= o.nightStart || h < o.nightEnd : h >= o.nightStart && h < o.nightEnd);
const opt = (o?: Partial<Options>): Options => ({ ...DEFAULTS, ...(o || {}) });
const top = <T>(arr: T[], n: number, key: (x: T) => number) => [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);

// ------------------------------------------------------------------ overview and per-number summary

export function overview(records: CdrRecord[]) {
  const byType: Record<string, number> = {};
  const targets = new Map<string, number>();
  const nums = new Set<string>();
  let from = Infinity, to = -Infinity, dur = 0;
  for (const r of records) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    targets.set(r.a, (targets.get(r.a) || 0) + 1);
    nums.add(r.a); if (r.b) nums.add(r.b);
    if (r.ts < from) from = r.ts;
    if (r.ts > to) to = r.ts;
    if (isVoice(r.type)) dur += r.dur;
  }
  return { records: records.length, byType, targets: [...targets.entries()].sort((a, b) => b[1] - a[1]).map(([number, n]) => ({ number, n })), distinctNumbers: nums.size, from: records.length ? from : null, to: records.length ? to : null, voiceSeconds: dur };
}

export interface ContactRow { a: string; b: string; total: number; out: number; in: number; smsOut: number; smsIn: number; missed: number; dur: number; first: number; last: number; days: number }

export function contacts(records: CdrRecord[], o?: Partial<Options>): ContactRow[] {
  const opts = opt(o);
  const m = new Map<string, ContactRow & { _d: Set<string> }>();
  for (const r of records) {
    if (!r.b) continue;
    const k = r.a + "|" + r.b;
    let c = m.get(k);
    if (!c) { c = { a: r.a, b: r.b, total: 0, out: 0, in: 0, smsOut: 0, smsIn: 0, missed: 0, dur: 0, first: r.ts, last: r.ts, days: 0, _d: new Set() }; m.set(k, c); }
    c.total++;
    if (r.type === "MO") c.out++; else if (r.type === "MT") c.in++; else if (r.type === "SMS-MO") c.smsOut++; else if (r.type === "SMS-MT") c.smsIn++; else if (r.type === "MISSED") c.missed++;
    if (isVoice(r.type)) c.dur += r.dur;
    if (r.ts < c.first) c.first = r.ts;
    if (r.ts > c.last) c.last = r.ts;
    c._d.add(local(r, opts.tz).day);
  }
  return [...m.values()].map(({ _d, ...c }) => ({ ...c, days: _d.size })).sort((a, b) => b.total - a.total || b.dur - a.dur);
}

export interface SummaryRow {
  number: string; records: number; callsOut: number; callsIn: number; smsOut: number; smsIn: number; missed: number; data: number;
  durTotal: number; durAvg: number; durMin: number; durMax: number; uniqueContacts: number; inOutRatio: number | null;
  first: number; last: number; activeDays: number; imeis: number; cells: number;
  mostContacted: { b: string; n: number; dur: number }[]; leastContacted: { b: string; n: number; dur: number }[];
}

export function summaryByNumber(records: CdrRecord[], o?: Partial<Options>): SummaryRow[] {
  const opts = opt(o);
  const by = new Map<string, CdrRecord[]>();
  for (const r of records) { let l = by.get(r.a); if (!l) by.set(r.a, (l = [])); l.push(r); }
  const all = contacts(records, opts);
  const out: SummaryRow[] = [];
  for (const [number, rs] of [...by.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, opts.limit)) {
    let callsOut = 0, callsIn = 0, smsOut = 0, smsIn = 0, missed = 0, data = 0, durTotal = 0, durMin = Infinity, durMax = 0, answered = 0, first = Infinity, last = -Infinity;
    const days = new Set<string>(), imeis = new Set<string>(), cells = new Set<string>();
    for (const r of rs) {
      if (r.type === "MO") callsOut++; else if (r.type === "MT") callsIn++; else if (r.type === "SMS-MO") smsOut++; else if (r.type === "SMS-MT") smsIn++; else if (r.type === "MISSED") missed++; else if (r.type === "DATA") data++;
      if ((r.type === "MO" || r.type === "MT") && r.dur > 0) { durTotal += r.dur; answered++; durMin = Math.min(durMin, r.dur); durMax = Math.max(durMax, r.dur); }
      first = Math.min(first, r.ts); last = Math.max(last, r.ts);
      days.add(local(r, opts.tz).day);
      if (r.imei) imeis.add(r.imei);
      if (r.cell) cells.add(r.cell);
    }
    const mine = all.filter((c) => c.a === number);
    const outN = callsOut + smsOut, inN = callsIn + smsIn + missed;
    out.push({
      number, records: rs.length, callsOut, callsIn, smsOut, smsIn, missed, data, durTotal, durAvg: answered ? Math.round(durTotal / answered) : 0,
      durMin: answered ? durMin : 0, durMax, uniqueContacts: mine.length, inOutRatio: outN ? Math.round((inN / outN) * 100) / 100 : null,
      first, last, activeDays: days.size, imeis: imeis.size, cells: cells.size,
      mostContacted: mine.slice(0, 10).map((c) => ({ b: c.b, n: c.total, dur: c.dur })),
      leastContacted: [...mine].sort((a, b) => a.total - b.total || a.dur - b.dur).slice(0, 10).map((c) => ({ b: c.b, n: c.total, dur: c.dur })),
    });
  }
  return out;
}

// ------------------------------------------------------------------ time patterns

export function timeProfile(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const hourly = new Array(24).fill(0), weekday = new Array(7).fill(0);
  const heat = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const daily: Record<string, number> = {}, weekly: Record<string, number> = {}, monthly: Record<string, number> = {};
  let day = 0, night = 0, weekend = 0, weekdayN = 0, business = 0, outside = 0;
  for (const r of records) {
    const l = local(r, opts.tz);
    hourly[l.h]++; weekday[l.wd]++; heat[l.wd][l.h]++;
    daily[l.day] = (daily[l.day] || 0) + 1; weekly[l.week] = (weekly[l.week] || 0) + 1; monthly[l.month] = (monthly[l.month] || 0) + 1;
    if (isNight(l.h, opts)) night++; else day++;
    if (l.wd === 0 || l.wd === 6) weekend++; else weekdayN++;
    if (l.wd !== 0 && l.h >= opts.businessStart && l.h < opts.businessEnd) business++; else outside++;
  }
  const peakHours = hourly.map((n, h) => ({ h, n })).sort((a, b) => b.n - a.n).filter((x) => x.n > 0).slice(0, 3);
  return { hourly, weekday, heat, daily, weekly, monthly, day, night, weekend, weekdays: weekdayN, business, outside, peakHours };
}

/** First and last record of each day per target (with the cell, when known). */
export function firstLastPerDay(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const m = new Map<string, { a: string; day: string; n: number; first: CdrRecord; last: CdrRecord }>();
  for (const r of records) {
    const k = r.a + "|" + local(r, opts.tz).day;
    const e = m.get(k);
    if (!e) m.set(k, { a: r.a, day: local(r, opts.tz).day, n: 1, first: r, last: r });
    else { e.n++; if (r.ts < e.first.ts) e.first = r; if (r.ts > e.last.ts) e.last = r; }
  }
  return [...m.values()].sort((x, y) => (x.a === y.a ? x.day.localeCompare(y.day) : x.a.localeCompare(y.a))).map((e) => ({
    a: e.a, day: e.day, n: e.n, first: e.first.ts, firstB: e.first.b, firstCell: e.first.cell || "", last: e.last.ts, lastB: e.last.b, lastCell: e.last.lastCell || e.last.cell || "",
  }));
}

export function shortCalls(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const rs = records.filter((r) => (r.type === "MO" || r.type === "MT") && r.dur > 0 && r.dur <= opts.shortSec);
  const pairs = new Map<string, { a: string; b: string; n: number }>();
  for (const r of rs) { const k = r.a + "|" + r.b; const p = pairs.get(k) || { a: r.a, b: r.b, n: 0 }; p.n++; pairs.set(k, p); }
  return { count: rs.length, pairs: top([...pairs.values()], opts.limit, (p) => p.n) };
}

export function oneWay(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  return contacts(records, opts).filter((c) => c.total >= 2 && ((c.out + c.smsOut > 0 && c.in + c.smsIn + c.missed === 0) || (c.out + c.smsOut === 0 && c.in + c.smsIn + c.missed > 0)))
    .map((c) => ({ a: c.a, b: c.b, direction: c.out + c.smsOut > 0 ? "outgoing only" : "incoming only", n: c.total, first: c.first, last: c.last })).slice(0, opts.limit);
}

/** Pairs with `repeatN` or more calls inside any `repeatWindowMin` window. */
export function repeatedCalls(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const by = new Map<string, number[]>();
  for (const r of records) if (isVoice(r.type) && r.b) { const k = r.a + "|" + r.b; let l = by.get(k); if (!l) by.set(k, (l = [])); l.push(r.ts); }
  const out: { a: string; b: string; max: number; at: number; total: number }[] = [];
  const w = opts.repeatWindowMin * 60000;
  for (const [k, ts] of by) {
    if (ts.length < opts.repeatN) continue;
    ts.sort((x, y) => x - y);
    let best = 0, at = 0;
    for (let i = 0, j = 0; i < ts.length; i++) { while (ts[i] - ts[j] > w) j++; if (i - j + 1 > best) { best = i - j + 1; at = ts[j]; } }
    if (best >= opts.repeatN) { const [a, b] = k.split("|"); out.push({ a, b, max: best, at, total: ts.length }); }
  }
  return top(out, opts.limit, (x) => x.max);
}

/** Calls that overlap in time on the same number: possible conference calls or call waiting. */
export function overlappingCalls(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const by = new Map<string, CdrRecord[]>();
  for (const r of records) if ((r.type === "MO" || r.type === "MT") && r.dur > 0) { let l = by.get(r.a); if (!l) by.set(r.a, (l = [])); l.push(r); }
  const out: { a: string; b1: string; b2: string; t1: number; t2: number; overlapSec: number }[] = [];
  for (const [a, rs] of by) {
    rs.sort((x, y) => x.ts - y.ts);
    let open: CdrRecord | null = null;
    for (const r of rs) {
      if (open && r.ts < open.ts + open.dur * 1000 && r.b !== open.b) {
        out.push({ a, b1: open.b, b2: r.b, t1: open.ts, t2: r.ts, overlapSec: Math.round((Math.min(open.ts + open.dur * 1000, r.ts + r.dur * 1000) - r.ts) / 1000) });
      }
      if (!open || r.ts + r.dur * 1000 > open.ts + open.dur * 1000) open = r;
    }
  }
  return out.sort((x, y) => x.t2 - y.t2).slice(0, opts.limit);
}

/** Directed cycles X->Y->Z->X in time order within the window (chain communication). */
export function circular(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const edges = new Map<string, Map<string, number[]>>();
  const add = (x: string, y: string, t: number) => { if (!x || !y || x === y) return; let m = edges.get(x); if (!m) edges.set(x, (m = new Map())); let l = m.get(y); if (!l) m.set(y, (l = [])); l.push(t); };
  for (const r of records) { if (isOut(r.type)) add(r.a, r.b, r.ts); else if (r.type === "MT" || r.type === "SMS-MT") add(r.b, r.a, r.ts); }
  for (const m of edges.values()) for (const l of m.values()) l.sort((a, b) => a - b);
  const w = opts.circularWindowH * 3_600_000;
  const out: { path: string[]; start: number; end: number }[] = [];
  const seen = new Set<string>();
  const firstAfter = (l: number[], t: number) => { let lo = 0, hi = l.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (l[mid] <= t) lo = mid + 1; else hi = mid; } return lo < l.length ? l[lo] : null; };
  for (const [x, mx] of edges) {
    for (const [y, txy] of mx) {
      const my = edges.get(y); if (!my) continue;
      for (const [z, tyz] of my) {
        if (z === x) continue;
        const tzx = edges.get(z)?.get(x); if (!tzx) continue;
        for (const t1 of txy) {
          const t2 = firstAfter(tyz, t1); if (t2 === null || t2 - t1 > w) continue;
          const t3 = firstAfter(tzx, t2); if (t3 === null || t3 - t1 > w) continue;
          const key = [x, y, z].sort().join("|");
          if (!seen.has(key)) { seen.add(key); out.push({ path: [x, y, z, x], start: t1, end: t3 }); }
          break;
        }
        if (out.length >= opts.limit) return out;
      }
    }
  }
  return out;
}

/** Contacts first seen at or after `newSince` (default: the last 7 days of the data). */
export function newNumbers(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const last = records.reduce((m, r) => Math.max(m, r.ts), 0);
  const since = opts.newSince ?? last - 7 * 86_400_000;
  return contacts(records, opts).filter((c) => c.first >= since).map((c) => ({ a: c.a, b: c.b, first: c.first, n: c.total })).sort((x, y) => x.first - y.first).slice(0, opts.limit);
}

export function silentPeriods(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const by = new Map<string, number[]>();
  for (const r of records) { let l = by.get(r.a); if (!l) by.set(r.a, (l = [])); l.push(r.ts); }
  const out: { a: string; from: number; to: number; hours: number }[] = [];
  for (const [a, ts] of by) {
    ts.sort((x, y) => x - y);
    for (let i = 1; i < ts.length; i++) { const g = ts[i] - ts[i - 1]; if (g >= opts.silentHours * 3_600_000) out.push({ a, from: ts[i - 1], to: ts[i], hours: Math.round(g / 360_000) / 10 }); }
  }
  return out.sort((x, y) => y.hours - x.hours).slice(0, opts.limit);
}

// ------------------------------------------------------------------ relationships

/** Numbers in contact with two or more targets. */
export function commonNumbers(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const m = new Map<string, Map<string, number>>();
  for (const r of records) { if (!r.b) continue; let t = m.get(r.b); if (!t) m.set(r.b, (t = new Map())); t.set(r.a, (t.get(r.a) || 0) + 1); }
  const targets = new Set(records.map((r) => r.a));
  return [...m.entries()].filter(([b, t]) => t.size >= 2 && !targets.has(b)).map(([b, t]) => ({ b, targets: [...t.keys()], n: [...t.values()].reduce((x, y) => x + y, 0) }))
    .sort((x, y) => y.targets.length - x.targets.length || y.n - x.n).slice(0, opts.limit);
}

/** Direct contact between two targets of the case. */
export function targetToTarget(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const targets = new Set(records.map((r) => r.a));
  return contacts(records, opts).filter((c) => targets.has(c.b)).slice(0, opts.limit);
}

// ------------------------------------------------------------------ devices and identities

export function imeiAnalysis(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const imeiSims = new Map<string, Map<string, { n: number; first: number; last: number }>>();
  const simImeis = new Map<string, Map<string, { n: number; first: number; last: number }>>();
  const bump = (m: Map<string, Map<string, { n: number; first: number; last: number }>>, k: string, v: string, t: number) => {
    let x = m.get(k); if (!x) m.set(k, (x = new Map()));
    const e = x.get(v); if (!e) x.set(v, { n: 1, first: t, last: t }); else { e.n++; e.first = Math.min(e.first, t); e.last = Math.max(e.last, t); }
  };
  const triples = new Map<string, { msisdn: string; imsi: string; imei: string; n: number; first: number; last: number }>();
  for (const r of records) {
    if (r.imei) { bump(imeiSims, r.imei, r.a, r.ts); bump(simImeis, r.a, r.imei, r.ts); }
    if (r.imei || r.imsi) {
      const k = `${r.a}|${r.imsi || ""}|${r.imei || ""}`;
      const e = triples.get(k);
      if (!e) triples.set(k, { msisdn: r.a, imsi: r.imsi || "", imei: r.imei || "", n: 1, first: r.ts, last: r.ts });
      else { e.n++; e.first = Math.min(e.first, r.ts); e.last = Math.max(e.last, r.ts); }
    }
  }
  const flat = (m: Map<string, { n: number; first: number; last: number }>) => [...m.entries()].map(([k, v]) => ({ id: k, ...v })).sort((a, b) => a.first - b.first);
  const oneImeiManySims = [...imeiSims.entries()].filter(([, s]) => s.size > 1).map(([imei, s]) => ({ imei, tac: tacOf(imei), sims: flat(s) }));
  const oneSimManyImeis = [...simImeis.entries()].filter(([, s]) => s.size > 1).map(([msisdn, s]) => ({ msisdn, imeis: flat(s) }));
  // Device-change timeline: consecutive records on a different IMEI start a new segment.
  const timeline: { msisdn: string; segments: { imei: string; from: number; to: number; n: number }[]; changes: number }[] = [];
  const bySim = new Map<string, CdrRecord[]>();
  for (const r of records) if (r.imei) { let l = bySim.get(r.a); if (!l) bySim.set(r.a, (l = [])); l.push(r); }
  for (const [msisdn, rs] of bySim) {
    rs.sort((x, y) => x.ts - y.ts);
    const seg: { imei: string; from: number; to: number; n: number }[] = [];
    for (const r of rs) { const s = seg[seg.length - 1]; if (s && s.imei === r.imei) { s.to = r.ts; s.n++; } else seg.push({ imei: r.imei!, from: r.ts, to: r.ts, n: 1 }); }
    timeline.push({ msisdn, segments: seg.slice(0, opts.limit), changes: seg.length - 1 });
  }
  const tacs = new Map<string, { tac: string; imeis: Set<string>; sims: Set<string> }>();
  for (const r of records) if (r.imei) { const t = tacOf(r.imei); let e = tacs.get(t); if (!e) tacs.set(t, (e = { tac: t, imeis: new Set(), sims: new Set() })); e.imeis.add(r.imei); e.sims.add(r.a); }
  return {
    oneImeiManySims, oneSimManyImeis, timeline: timeline.sort((a, b) => b.changes - a.changes),
    tacs: [...tacs.values()].map((t) => ({ tac: t.tac, imeis: t.imeis.size, sims: t.sims.size })).sort((a, b) => b.imeis - a.imeis).slice(0, opts.limit),
    mapping: [...triples.values()].sort((a, b) => a.msisdn.localeCompare(b.msisdn) || a.first - b.first).slice(0, opts.limit * 5),
  };
}

// ------------------------------------------------------------------ towers and location

export function towerKey(cell: string) { return String(cell || "").toUpperCase().replace(/\s+/g, ""); }

/** Looks a cell up in the tower master: exact CGI first, then the last segment (cell ID). */
export function towerIndex(towers: Tower[]) {
  const exact = new Map<string, Tower>(), short = new Map<string, Tower>();
  for (const t of towers) { const k = towerKey(t.cell); exact.set(k, t); const s = k.split(/[-:/]/).pop()!; if (!short.has(s)) short.set(s, t); }
  return (cell?: string): Tower | null => { if (!cell) return null; const k = towerKey(cell); return exact.get(k) || short.get(k.split(/[-:/]/).pop()!) || null; };
}

export function towerAnalysis(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const per = new Map<string, Map<string, { n: number; day: number; night: number; first: number; last: number }>>();
  for (const r of records) {
    if (!r.cell) continue;
    let m = per.get(r.a); if (!m) per.set(r.a, (m = new Map()));
    const e = m.get(r.cell) || { n: 0, day: 0, night: 0, first: r.ts, last: r.ts };
    e.n++; if (isNight(local(r, opts.tz).h, opts)) e.night++; else e.day++;
    e.first = Math.min(e.first, r.ts); e.last = Math.max(e.last, r.ts);
    m.set(r.cell, e);
  }
  const byNumber = [...per.entries()].map(([a, m]) => {
    const cells = [...m.entries()].map(([cell, e]) => ({ cell, ...e })).sort((x, y) => y.n - x.n);
    const dayTop = [...cells].sort((x, y) => y.day - x.day)[0];
    const nightTop = [...cells].sort((x, y) => y.night - x.night)[0];
    return { a, cells: cells.slice(0, opts.limit), distinct: cells.length, likelyDay: dayTop?.day ? dayTop.cell : "", likelyNight: nightTop?.night ? nightTop.cell : "" };
  });
  // Movement: sequence of cell changes and the most common transitions
  const moves: { a: string; from: string; to: string; at: number }[] = [];
  const trans = new Map<string, { a: string; from: string; to: string; n: number }>();
  const by = new Map<string, CdrRecord[]>();
  for (const r of records) if (r.cell) { let l = by.get(r.a); if (!l) by.set(r.a, (l = [])); l.push(r); }
  for (const [a, rs] of by) {
    rs.sort((x, y) => x.ts - y.ts);
    let prev = "";
    for (const r of rs) {
      for (const c of [r.cell!, r.lastCell].filter(Boolean) as string[]) {
        if (prev && c !== prev) {
          moves.push({ a, from: prev, to: c, at: r.ts });
          const k = `${a}|${prev}|${c}`; const t = trans.get(k) || { a, from: prev, to: c, n: 0 }; t.n++; trans.set(k, t);
        }
        prev = c;
      }
    }
  }
  return { byNumber, moves: moves.slice(-opts.limit * 10), transitions: top([...trans.values()], opts.limit, (t) => t.n) };
}

/**
 * Possible meeting points: two different numbers recorded at the same cell within the window.
 * Same cell does not prove the same place (a cell can cover several kilometres).
 */
export function coLocation(records: CdrRecord[], o?: Partial<Options> & { numbers?: string[]; keyOf?: (cell: string) => string }) {
  const opts = opt(o);
  const keyOf = o?.keyOf || ((c: string) => c);
  const want = o?.numbers?.length ? new Set(o.numbers) : null;
  const byCell = new Map<string, { t: number; a: string }[]>();
  for (const r of records) {
    if (want && !want.has(r.a)) continue;
    const obs: [string | undefined, number][] = [[r.cell, r.ts], [r.lastCell, r.ts + r.dur * 1000]];
    for (const [c0, t] of obs) if (c0) { const c = keyOf(c0); let l = byCell.get(c); if (!l) byCell.set(c, (l = [])); l.push({ t, a: r.a }); }
  }
  const w = opts.colocWindowMin * 60000;
  const best = new Map<string, { a1: string; a2: string; cell: string; t1: number; t2: number; gapMin: number; n: number }>();
  for (const [cell, l] of byCell) {
    l.sort((x, y) => x.t - y.t);
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length && l[j].t - l[i].t <= w; j++) {
        if (l[j].a === l[i].a) continue;
        const [a1, a2] = [l[i].a, l[j].a].sort();
        const slot = Math.floor(l[i].t / (w || 1));
        const k = `${a1}|${a2}|${cell}|${slot}`;
        const gap = Math.round((l[j].t - l[i].t) / 60000);
        const e = best.get(k);
        if (!e) best.set(k, { a1, a2, cell, t1: l[i].t, t2: l[j].t, gapMin: gap, n: 1 });
        else { e.n++; if (gap < e.gapMin) { e.gapMin = gap; e.t1 = l[i].t; e.t2 = l[j].t; } }
      }
    }
  }
  return [...best.values()].sort((x, y) => x.t1 - y.t1).slice(0, opts.limit * 5);
}

/** Co-location key from a tower master: cells on the same mast (same coordinates to ~100 m) match across operators. */
export function siteKey(towers: Tower[]) {
  const find = towerIndex(towers);
  return (cell: string) => { const t = find(cell); return t ? `site ${t.lat.toFixed(3)},${t.lon.toFixed(3)}` : cell; };
}

/** Numbers seen in two or more groups (towers, or source files of a tower dump, or time windows). */
export function towerDump(records: CdrRecord[], o?: Partial<Options> & { groupBy?: "cell" | "src" | "cellWindow"; windowMin?: number; minGroups?: number }) {
  const opts = opt(o);
  const groupBy = o?.groupBy || "cell";
  const win = (o?.windowMin || 60) * 60000;
  const m = new Map<string, Map<string, number>>();
  for (const r of records) {
    const g = groupBy === "src" ? r.src || "" : groupBy === "cellWindow" ? `${r.cell || ""} @ ${new Date(Math.floor(r.ts / win) * win).toISOString().slice(0, 16)}Z` : r.cell || "";
    if (!g) continue;
    let x = m.get(r.a); if (!x) m.set(r.a, (x = new Map())); x.set(g, (x.get(g) || 0) + 1);
  }
  const min = o?.minGroups || 2;
  return [...m.entries()].filter(([, g]) => g.size >= min).map(([number, g]) => ({ number, groups: [...g.keys()].sort(), n: [...g.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.groups.length - a.groups.length || b.n - a.n).slice(0, opts.limit);
}

// ------------------------------------------------------------------ roaming, ISD, lists, anomalies

export function roamingAndIsd(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const roam = new Map<string, { a: string; network: string; n: number; first: number; last: number }>();
  const isd = new Map<string, { country: string; code: string; numbers: Set<string>; n: number; dur: number }>();
  for (const r of records) {
    if (r.roam) { const k = r.a + "|" + r.roam; const e = roam.get(k) || { a: r.a, network: r.roam, n: 0, first: r.ts, last: r.ts }; e.n++; e.first = Math.min(e.first, r.ts); e.last = Math.max(e.last, r.ts); roam.set(k, e); }
    if (r.b?.startsWith("+") && !r.b.startsWith("+91")) {
      const c = isdOf(r.b); const k = c?.code || "?";
      const e = isd.get(k) || { country: c?.country || "Unknown", code: k, numbers: new Set(), n: 0, dur: 0 };
      e.numbers.add(r.b); e.n++; if (isVoice(r.type)) e.dur += r.dur; isd.set(k, e);
    }
  }
  return { roaming: [...roam.values()].sort((a, b) => b.n - a.n).slice(0, opts.limit), isd: [...isd.values()].map((e) => ({ ...e, numbers: [...e.numbers] })).sort((a, b) => b.n - a.n) };
}

export interface ListEntry { number: string; list: "black" | "white"; label?: string }

export function watchlistHits(records: CdrRecord[], list: ListEntry[]) {
  const m = new Map(list.map((l) => [l.number, l]));
  const hits = new Map<string, { number: string; list: string; label: string; n: number; first: number; last: number; targets: Set<string> }>();
  for (const r of records) for (const x of [r.a, r.b]) {
    const l = m.get(x); if (!l) continue;
    const e = hits.get(x) || { number: x, list: l.list, label: l.label || "", n: 0, first: r.ts, last: r.ts, targets: new Set() };
    e.n++; e.first = Math.min(e.first, r.ts); e.last = Math.max(e.last, r.ts); if (x !== r.a) e.targets.add(r.a); hits.set(x, e);
  }
  return [...hits.values()].map((e) => ({ ...e, targets: [...e.targets] })).sort((a, b) => (a.list === b.list ? b.n - a.n : a.list === "black" ? -1 : 1));
}

/** Days with unusually high or low volume (z-score against the number's own days) and unusual hours. */
export function anomalies(records: CdrRecord[], o?: Partial<Options>) {
  const opts = opt(o);
  const by = new Map<string, CdrRecord[]>();
  for (const r of records) { let l = by.get(r.a); if (!l) by.set(r.a, (l = [])); l.push(r); }
  const days: { a: string; day: string; n: number; mean: number; z: number }[] = [];
  const hours: { a: string; hour: number; n: number; share: number }[] = [];
  for (const [a, rs] of by) {
    const d = new Map<string, number>();
    const h = new Array(24).fill(0);
    for (const r of rs) { const l = local(r, opts.tz); d.set(l.day, (d.get(l.day) || 0) + 1); h[l.h]++; }
    // Include silent days between the first and last day as zero.
    const keys = [...d.keys()].sort();
    if (keys.length >= 5) {
      const all: [string, number][] = [];
      for (let t = Date.parse(keys[0] + "T00:00:00Z"); t <= Date.parse(keys[keys.length - 1] + "T00:00:00Z"); t += 86_400_000) { const k = new Date(t).toISOString().slice(0, 10); all.push([k, d.get(k) || 0]); }
      const mean = all.reduce((s, [, n]) => s + n, 0) / all.length;
      const sd = Math.sqrt(all.reduce((s, [, n]) => s + (n - mean) ** 2, 0) / all.length);
      if (sd > 0) for (const [day, n] of all) { const z = (n - mean) / sd; if (Math.abs(z) >= opts.zThreshold) days.push({ a, day, n, mean: Math.round(mean * 10) / 10, z: Math.round(z * 100) / 100 }); }
    }
    const total = rs.length;
    if (total >= 20) h.forEach((n, hour) => { const share = n / total; if (n > 0 && share < 0.03 && isNight(hour, opts)) hours.push({ a, hour, n, share: Math.round(share * 1000) / 10 }); });
  }
  return { days: days.sort((x, y) => Math.abs(y.z) - Math.abs(x.z)).slice(0, opts.limit), hours: hours.slice(0, opts.limit) };
}

/** Everything the analytics screens show, in one call (run in a Web Worker for big cases). */
export function analyseAll(records: CdrRecord[], o?: Partial<Options> & { watchlist?: ListEntry[] }) {
  const opts = opt(o);
  return {
    options: opts,
    overview: overview(records),
    summary: summaryByNumber(records, opts),
    contacts: contacts(records, opts).slice(0, opts.limit * 5),
    time: timeProfile(records, opts),
    firstLast: firstLastPerDay(records, opts).slice(0, opts.limit * 5),
    short: shortCalls(records, opts),
    oneWay: oneWay(records, opts),
    repeated: repeatedCalls(records, opts),
    overlapping: overlappingCalls(records, opts),
    circular: circular(records, opts),
    newNumbers: newNumbers(records, opts),
    silent: silentPeriods(records, opts),
    common: commonNumbers(records, opts),
    targetToTarget: targetToTarget(records, opts),
    imei: imeiAnalysis(records, opts),
    towers: towerAnalysis(records, opts),
    coLocation: coLocation(records, opts),
    towerDump: towerDump(records, opts),
    roaming: roamingAndIsd(records, opts),
    watchlist: watchlistHits(records, o?.watchlist || []),
    anomalies: anomalies(records, opts),
  };
}
export type Analysis = ReturnType<typeof analyseAll>;
