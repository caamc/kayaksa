// Dates, times and time zones without any library. Operators send local times (India: IST,
// UTC+05:30); records are stored as UTC epoch milliseconds and shown in the case's time zone.

const MON: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const offCache = new Map<string, number>();
const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    dtfCache.set(tz, f);
  }
  return f;
}

/** Offset of `tz` from UTC in minutes at instant `utcMs` (cached per hour). */
export function tzOffset(utcMs: number, tz: string): number {
  if (!tz || tz === "UTC") return 0;
  const fixed = /^([+-])(\d{2}):?(\d{2})$/.exec(tz);
  if (fixed) return (fixed[1] === "-" ? -1 : 1) * (Number(fixed[2]) * 60 + Number(fixed[3]));
  const key = tz + "|" + Math.floor(utcMs / 3_600_000);
  const hit = offCache.get(key);
  if (hit !== undefined) return hit;
  const p: Record<string, number> = {};
  for (const x of dtf(tz).formatToParts(new Date(utcMs))) if (x.type !== "literal") p[x.type] = Number(x.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const off = Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
  if (offCache.size > 20000) offCache.clear();
  offCache.set(key, off);
  return off;
}

/** Converts a wall-clock time in `tz` to UTC epoch ms. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let off = tzOffset(guess, tz);
  let t = guess - off * 60000;
  const off2 = tzOffset(t, tz);
  if (off2 !== off) t = guess - off2 * 60000;
  return t;
}

/** Local calendar fields of a UTC instant in `tz`. */
export function localParts(utcMs: number, tz: string) {
  const t = utcMs + tzOffset(utcMs, tz) * 60000;
  const d = new Date(t);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: d.getUTCDay(), local: t };
}

const p2 = (n: number) => String(n).padStart(2, "0");
export const localDate = (utcMs: number, tz: string) => { const p = localParts(utcMs, tz); return `${p.y}-${p2(p.mo)}-${p2(p.d)}`; };
export const localTime = (utcMs: number, tz: string) => { const p = localParts(utcMs, tz); return `${p2(p.h)}:${p2(p.mi)}:${p2(p.s)}`; };
export const localDateTime = (utcMs: number, tz: string) => `${localDate(utcMs, tz)} ${localTime(utcMs, tz)}`;

/** Monday-based ISO week label, e.g. 2026-W07. */
export function isoWeek(utcMs: number, tz: string): string {
  const p = localParts(utcMs, tz);
  const date = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((date.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${p2(wk)}`;
}

export interface DateParts { y: number; mo: number; d: number }
export interface TimeParts { h: number; mi: number; s: number }

/** Excel serial date (1900 system) to calendar parts; fractional part is the time of day. */
export function excelSerial(n: number): { date: DateParts; time: TimeParts } {
  const ms = Math.round((n - 25569) * 86_400_000);
  const d = new Date(ms);
  return { date: { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate() }, time: { h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() } };
}

/** Parses a date (optionally with a time) using the given order for ambiguous numeric dates. */
export function parseDate(raw: string, order: "dmy" | "mdy" | "ymd" = "dmy"): { date: DateParts; time: TimeParts | null } | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // Excel serial number (from XLSX cells without a date format)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) { const x = excelSerial(n); return { date: x.date, time: n % 1 ? x.time : null }; }
  }
  let m: RegExpExecArray | null;
  let date: DateParts | null = null;
  let rest = "";
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(.*))?$/.exec(s))) {
    date = { y: +m[1], mo: +m[2], d: +m[3] }; rest = m[4] || "";
  } else if ((m = /^(\d{1,2})[-/.\s]([a-z]{3,9})[-/.\s,]*(\d{2,4})(?:[T\s,]+(.*))?$/i.exec(s))) {
    const mo = MON[m[2].toLowerCase().slice(0, m[2].length === 4 ? 4 : 3)] || MON[m[2].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    date = { y: yr(+m[3]), mo, d: +m[1] }; rest = m[4] || "";
  } else if ((m = /^([a-z]{3,9})[\s.-]+(\d{1,2}),?[\s.-]+(\d{4})(?:[T\s,]+(.*))?$/i.exec(s))) {
    const mo = MON[m[1].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    date = { y: +m[3], mo, d: +m[2] }; rest = m[4] || "";
  } else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T\s,]+(.*))?$/.exec(s))) {
    const a = +m[1], b = +m[2];
    const [d, mo] = order === "mdy" ? [b, a] : [a, b];
    date = { y: yr(+m[3]), mo, d }; rest = m[4] || "";
  } else if ((m = /^(\d{4})(\d{2})(\d{2})(?:[T\s]?(\d{2})(\d{2})(\d{2})?)?$/.exec(s))) {
    date = { y: +m[1], mo: +m[2], d: +m[3] };
    if (m[4]) return valid(date) ? { date, time: { h: +m[4], mi: +m[5], s: +(m[6] || 0) } } : null;
  }
  if (!date || !valid(date)) return null;
  const time = rest ? parseTime(rest.replace(/(Z|[+-]\d{2}:?\d{2})$/, "")) : null;
  if (rest && !time) return null;
  return { date, time };
}

const yr = (y: number) => (y < 100 ? (y < 70 ? 2000 + y : 1900 + y) : y);
const valid = (d: DateParts) => d.y >= 1990 && d.y <= 2100 && d.mo >= 1 && d.mo <= 12 && d.d >= 1 && d.d <= new Date(Date.UTC(d.y, d.mo, 0)).getUTCDate();

export function parseTime(raw: string): TimeParts | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  // Fraction of a day (Excel time cell)
  if (/^0?\.\d+$/.test(s)) { const t = Math.round(Number(s) * 86400); return { h: Math.floor(t / 3600) % 24, mi: Math.floor(t / 60) % 60, s: t % 60 }; }
  let m = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:[.,]\d+)?\s*(am|pm)?$/i.exec(s);
  if (!m) { const c = /^(\d{2})(\d{2})(\d{2})$/.exec(s); if (c) m = [s, c[1], c[2], c[3], undefined as any] as any; }
  if (!m) return null;
  let h = +m[1];
  const ap = m[4]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  const t = { h, mi: +m[2], s: +(m[3] || 0) };
  return t.h < 24 && t.mi < 60 && t.s < 61 ? t : null;
}

/** Duration in seconds from 75, "75", "00:01:15", "1:15", "1m 15s", "75 sec". */
export function parseDuration(raw: unknown): number | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  let m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(s);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = /^(\d+):(\d{1,2})$/.exec(s);
  if (m) return +m[1] * 60 + +m[2];
  m = /^(?:(\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+)\s*s(?:ec(?:ond)?s?)?)?$/.exec(s);
  if (m && (m[1] || m[2] || m[3])) return +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0);
  return null;
}

/** Guesses the date order from a sample of date strings. India writes day first by default. */
export function guessDateOrder(samples: string[]): "dmy" | "mdy" | "ymd" {
  let dmy = 0, mdy = 0, ymd = 0;
  for (const s of samples) {
    const t = String(s).trim();
    if (/^\d{4}[-/.]/.test(t) || /^\d{8}/.test(t)) { ymd++; continue; }
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]/.exec(t);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    else if (+m[2] > 12) mdy++;
  }
  if (ymd && !dmy && !mdy) return "ymd";
  return mdy > dmy ? "mdy" : "dmy";
}

export const fmtDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${p2(m)}:${p2(r)}` : `${m}:${p2(r)}`;
};
