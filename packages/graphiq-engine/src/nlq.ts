// Plain-English questions to a search Filter, by rules (no AI). Used offline, on-premise and as the
// fallback when Kayak AI is unavailable. Example: "calls from 9800000101 after 10pm in February 2026
// longer than 5 minutes".
import type { CallType, Filter } from "./types";
import { zonedToUtc } from "./time";
import { normaliseMsisdn } from "./msisdn";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function hour(s: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(s.trim());
  if (!m) return null;
  let h = +m[1];
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h < 24 ? h * 60 + +(m[2] || 0) : null;
}
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function parseQuestion(q: string, opts: { tz?: string; cc?: string; year?: number } = {}): { filter: Filter; understood: string[]; ignored: string } {
  const tz = opts.tz || "Asia/Kolkata", cc = opts.cc || "91";
  let s = " " + q.toLowerCase().replace(/[,;]/g, " ").replace(/\s+/g, " ") + " ";
  const f: Filter = {};
  const said: string[] = [];
  const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => { const m = re.exec(s); if (m) { fn(m); s = s.replace(m[0], " "); return true; } return false; };

  // Numbers (10+ digits, optional +); IMEI first (15-16 digits after "imei")
  take(/\bimei\s*(?:is|=|:)?\s*(\d{6,16})\b/, (m) => { f.imei = m[1]; said.push(`IMEI ${m[1]}`); });
  take(/\bimsi\s*(?:is|=|:)?\s*(\d{6,15})\b/, (m) => { f.imsi = m[1]; said.push(`IMSI ${m[1]}`); });
  take(/\b(?:cell|tower|cgi|site)\s*(?:id)?\s*(?:is|=|:)?\s*([\w-]{3,30})\b/, (m) => { f.cell = m[1].toUpperCase(); said.push(`cell ${m[1]}`); });
  const nums: string[] = [];
  s = s.replace(/(\+?\d[\d\s-]{8,16}\d)/g, (x) => { const n = normaliseMsisdn(x.replace(/[\s-]/g, ""), cc); if (n.valid) { nums.push(n.value); return " "; } return x; });
  if (nums.length) { f.numbers = [...new Set(nums)]; said.push(`numbers ${f.numbers.join(", ")}`); }
  if (/\b(from|by|made by|outgoing from)\b/.test(s) && nums.length === 1 && !/\bbetween\b.*\band\b/.test(q.toLowerCase())) f.side = "a";

  // Types
  const types = new Set<CallType>();
  if (/\b(sms|texts?|messages?)\b/.test(s)) { if (/\b(incoming|received)\b/.test(s)) types.add("SMS-MT"); else if (/\b(outgoing|sent)\b/.test(s)) types.add("SMS-MO"); else { types.add("SMS-MO"); types.add("SMS-MT"); } }
  if (/\bmissed\b/.test(s)) types.add("MISSED");
  if (/\b(data|internet|gprs)\b/.test(s)) types.add("DATA");
  if (/\bcalls?\b/.test(s) || (!types.size && /\b(incoming|outgoing)\b/.test(s))) {
    if (/\bincoming\b/.test(s)) types.add("MT"); else if (/\boutgoing\b/.test(s)) types.add("MO");
    else if (types.size === 0 && /\b(incoming|outgoing)\b/.test(s) === false && /\bcalls?\b/.test(s) && !/\b(all|records|activity)\b/.test(s)) { types.add("MO"); types.add("MT"); }
  }
  if (types.size) { f.types = [...types]; said.push(`type ${f.types.join(", ")}`); }

  // Duration
  take(/\b(?:longer than|more than|over|above|at least|>=?)\s*(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/, (m) => { f.durMin = +m[1] * (m[2][0] === "h" ? 3600 : m[2][0] === "m" ? 60 : 1); said.push(`duration at least ${f.durMin} s`); });
  take(/\b(?:shorter than|less than|under|below|at most|<=?)\s*(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/, (m) => { f.durMax = +m[1] * (m[2][0] === "h" ? 3600 : m[2][0] === "m" ? 60 : 1); said.push(`duration at most ${f.durMax} s`); });
  if (/\bshort calls?\b/.test(s) && f.durMax === undefined) { f.durMax = 10; f.durMin = 1; said.push("short calls (1 to 10 s)"); }

  // Time of day
  const T = "(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)";
  if (!take(new RegExp(`\\bbetween\\s+${T}\\s+(?:and|to|-)\\s+${T}`), (m) => { const a = hour(m[1]), b = hour(m[2]); if (a !== null && b !== null) { f.timeFrom = hhmm(a); f.timeTo = hhmm(b); said.push(`between ${f.timeFrom} and ${f.timeTo}`); } })) {
    take(new RegExp(`\\bafter\\s+${T}(?!\\d)`), (m) => { if (/\d{4}/.test(m[1])) return; const a = hour(m[1]); if (a !== null) { f.timeFrom = hhmm(a); f.timeTo = f.timeTo || "23:59"; said.push(`after ${f.timeFrom}`); } });
    take(new RegExp(`\\bbefore\\s+${T}(?!\\d)`), (m) => { const b = hour(m[1]); if (b !== null) { f.timeTo = hhmm(b); f.timeFrom = f.timeFrom || "00:00"; said.push(`before ${f.timeTo}`); } });
  }
  if (/\b(at night|night|late night|night-time)\b/.test(s) && !f.timeFrom) { f.timeFrom = "22:00"; f.timeTo = "06:00"; said.push("at night (22:00 to 06:00)"); }
  if (/\b(business hours|office hours|working hours)\b/.test(s) && !f.timeFrom) { f.timeFrom = "09:00"; f.timeTo = "18:00"; said.push("business hours (09:00 to 18:00)"); }
  if (/\bweekends?\b/.test(s)) { f.weekdays = [0, 6]; said.push("weekends"); }
  else { const wd = DAYS.map((d, i) => (new RegExp(`\\b${d}[a-z]*day\\b|\\b${d}\\b`).test(s) ? i : -1)).filter((i) => i >= 0); if (wd.length && wd.length < 7) { f.weekdays = wd; said.push(`on ${wd.map((w) => DAYS[w]).join(", ")}`); } }

  // Dates: "on 3 feb 2026", "from 1 feb 2026 to 10 feb 2026", "in march 2026", "in 2026"
  const D = "(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s+([a-z]{3,9})\\.?\\s*(\\d{4})?";
  const ymd = (d: string, mo: string, y?: string) => { const mi = MONTHS.indexOf(mo.slice(0, 3)); return mi < 0 ? null : { y: y ? +y : opts.year || new Date().getUTCFullYear(), mo: mi + 1, d: +d }; };
  const dayStart = (x: { y: number; mo: number; d: number }) => zonedToUtc(x.y, x.mo, x.d, 0, 0, 0, tz);
  const dayEnd = (x: { y: number; mo: number; d: number }) => zonedToUtc(x.y, x.mo, x.d, 23, 59, 59, tz) + 999;
  const iso = /(\d{4})-(\d{2})-(\d{2})/;
  if (!take(new RegExp(`\\b(?:from|between)\\s+${D}\\s+(?:to|and|until|till|-)\\s+${D}`), (m) => { const a = ymd(m[1], m[2], m[3] || m[6]), b = ymd(m[4], m[5], m[6]); if (a && b) { f.from = dayStart(a); f.to = dayEnd(b); said.push(`from ${a.y}-${a.mo}-${a.d} to ${b.y}-${b.mo}-${b.d}`); } })
    && !take(new RegExp(`\\b(?:from|between)\\s+${iso.source}\\s+(?:to|and|until|-)\\s+${iso.source}`), (m) => { f.from = dayStart({ y: +m[1], mo: +m[2], d: +m[3] }); f.to = dayEnd({ y: +m[4], mo: +m[5], d: +m[6] }); said.push(`from ${m[1]}-${m[2]}-${m[3]} to ${m[4]}-${m[5]}-${m[6]}`); })
    && !take(new RegExp(`\\bon\\s+${D}`), (m) => { const a = ymd(m[1], m[2], m[3]); if (a) { f.from = dayStart(a); f.to = dayEnd(a); said.push(`on ${a.y}-${a.mo}-${a.d}`); } })
    && !take(new RegExp(`\\bon\\s+${iso.source}`), (m) => { const a = { y: +m[1], mo: +m[2], d: +m[3] }; f.from = dayStart(a); f.to = dayEnd(a); said.push(`on ${m[1]}-${m[2]}-${m[3]}`); })
    && !take(/\b(?:in|during)\s+([a-z]{3,9})\s*(\d{4})?\b/, (m) => { const mi = MONTHS.indexOf(m[1].slice(0, 3)); if (mi < 0) return; const y = m[2] ? +m[2] : opts.year || new Date().getUTCFullYear(); f.from = dayStart({ y, mo: mi + 1, d: 1 }); const nd = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate(); f.to = dayEnd({ y, mo: mi + 1, d: nd }); said.push(`in ${m[1]} ${y}`); })) {
    take(/\b(?:in|during)\s+(\d{4})\b/, (m) => { f.from = dayStart({ y: +m[1], mo: 1, d: 1 }); f.to = dayEnd({ y: +m[1], mo: 12, d: 31 }); said.push(`in ${m[1]}`); });
  }
  if (!take(/\bafter\s+(\d{4})-(\d{2})-(\d{2})\b/, (m) => { f.from = dayStart({ y: +m[1], mo: +m[2], d: +m[3] }); said.push(`after ${m[1]}-${m[2]}-${m[3]}`); })) {}
  take(/\bbefore\s+(\d{4})-(\d{2})-(\d{2})\b/, (m) => { f.to = dayEnd({ y: +m[1], mo: +m[2], d: +m[3] }); said.push(`before ${m[1]}-${m[2]}-${m[3]}`); });
  const ignored = s.replace(/\b(show|me|all|the|calls?|sms|texts?|messages?|records?|of|with|and|to|from|by|for|that|were|was|which|incoming|outgoing|missed|made|received|find|list|any|in|on|at|a|an|between|number|numbers|night|weekends?|business|office|working|hours|short|data|internet|is|are|please)\b/g, " ").replace(/\s+/g, " ").trim();
  return { filter: f, understood: said, ignored };
}
