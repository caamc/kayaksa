// Automatic column recognition. Operators name the same column many ways ("B Party No",
// "Other Party", "TO/FROM", "Called Party Telephone Number"...). Each header is matched against
// ordered synonym rules; the header row is found even when the file starts with a title block.
import type { Detection, Field, Mapping } from "./types";
import { guessDateOrder, parseDate, parseDuration, parseTime } from "./time";

export const FIELD_LABELS: Record<Field, string> = {
  a: "A party (target)", b: "B party (other number)", target: "Target number", calling: "Calling number", called: "Called number",
  date: "Date", time: "Time", datetime: "Date and time", endtime: "End time", dur: "Duration", type: "Call type", imei: "IMEI", imsi: "IMSI",
  cell: "First cell ID / CGI", lastCell: "Last cell ID", lac: "LAC", lat: "Latitude", lon: "Longitude", roam: "Roaming", op: "Operator",
  cellAddr: "Cell address", ignore: "Ignore",
};

export const normHeader = (h: string) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Order matters: the first rule that matches wins.
const RULES: [Field, RegExp][] = [
  ["ignore", /\blrn\b|forward|\bsr\s*no\b|^s\s*no$|^sl\s*no$|^serial|^sno$|^#$|sms\s*cent|\bsmsc\b|^circle$|^service\s*provider\s*circle$/],
  ["endtime", /(end|termination|release|disconnect|stop)\s*(date\s*)?(and\s*)?time|^end$/],
  ["imei", /imei/],
  ["imsi", /imsi/],
  ["lastCell", /last.*(cell|cgi|tower|site|bts)|(cell|cgi).*last|end\s*cell/],
  ["cellAddr", /(cell|site|tower|bts|cgi).*(address|location|addr|name|place)|^address$|^location$|^tower\s*location/],
  ["lat", /^lat\b|latitude/],
  ["lon", /^(lon|long|lng)\b|longitude/],
  ["lac", /^lac\b|location\s*area/],
  ["cell", /cell|cgi|tower|site\s*id|^site$|\bbts\b|ecgi|^ci$/],
  ["roam", /roam|visited\s*(network|circle)/],
  ["op", /^operator|network\s*operator|^tsp$|service\s*provider|carrier|^network$/],
  ["dur", /dur|duration|call\s*sec|seconds|^secs?$|usage\s*(sec|time)|talk\s*time/],
  ["type", /(call|record|event|service|usage|traffic)\s*type|direction|^type$|in\s*out|call\s*dir|^cdr\s*type$|^mo\s*mt$/],
  ["datetime", /date\s*(and\s*)?time|datetime|timestamp|^start$|start\s*date\s*time|event\s*time|call\s*start/],
  ["date", /date|^day$/],
  ["time", /time|^hour$/],
  ["b", /to\s*from|from\s*to|other|b\s*party|^bparty|^b\s*(no|num|number|msisdn)|second\s*party|^contact|counter\s*party|^party\s*b/],
  ["calling", /calling|originat|^from|caller|^source\s*(no|number|msisdn)?$|^a\s*number\s*calling/],
  ["called", /called|dialled|dialed|terminating|^to$|^to\s*(no|number)|destination|recipient|^dest/],
  ["target", /target|msisdn|subscriber|a\s*party|^aparty|^a\s*(no|num|number)$|mobile\s*(no|number)|phone\s*(no|number)|^number$|^party\s*a|^user\s*number/],
];

export function fieldFor(header: string): Field | null {
  const h = normHeader(header);
  if (!h) return null;
  for (const [f, re] of RULES) if (re.test(h)) return f;
  return null;
}

// Header signatures of typical layouts. A guide only: formats change between operators and over time.
const LAYOUTS: { name: string; keys: string[] }[] = [
  { name: "Airtel-style (Target / B Party, IN/OUT)", keys: ["target no", "b party no", "call type", "first cell id"] },
  { name: "Jio-style (Calling / Called party, MO/MT)", keys: ["calling party telephone number", "called party telephone number", "call termination time"] },
  { name: "Vi-style (MSISDN / Other party, CGI)", keys: ["msisdn", "other party", "cgi"] },
  { name: "BSNL-style (Calling / Called number, LAC)", keys: ["calling number", "called number", "lac", "cell id"] },
];

/** Finds the header row and maps each column to a field. */
export function detectMapping(table: string[][], opts: { tz?: string; cc?: string } = {}): Detection {
  let headerRow = -1, best = 0;
  for (let r = 0; r < Math.min(30, table.length); r++) {
    const fields = new Set(table[r].map(fieldFor).filter((f) => f && f !== "ignore"));
    if (fields.size > best) { best = fields.size; headerRow = r; }
  }
  const cols: Mapping["cols"] = {};
  let headers: string[] = [];
  if (headerRow >= 0 && best >= 3) {
    headers = table[headerRow];
    headers.forEach((h, i) => {
      const f = fieldFor(h);
      if (!f || f === "ignore") return;
      let field: Field = f;
      if (field === "target" && cols.target !== undefined && cols.b === undefined) field = "b";
      if (cols[field] === undefined) cols[field] = i;
    });
  } else {
    headerRow = -1;
    headers = (table[0] || []).map((_, i) => `Column ${i + 1}`);
    Object.assign(cols, guessByContent(table.slice(0, 50)));
  }
  // Party layout
  let parties: Mapping["parties"] = "target-other";
  if (cols.target !== undefined) { cols.a = cols.target; delete cols.target; }
  if (cols.a === undefined && cols.calling !== undefined && cols.called !== undefined) parties = "calling-called";
  else {
    if (cols.a === undefined && cols.calling !== undefined) { cols.a = cols.calling; delete cols.calling; }
    if (cols.b === undefined && cols.called !== undefined) { cols.b = cols.called; delete cols.called; }
    if (cols.b === undefined && cols.calling !== undefined) { cols.b = cols.calling; delete cols.calling; }
  }
  const body = table.slice(headerRow + 1, headerRow + 200);
  const dateCol = cols.date ?? cols.datetime ?? cols.time;
  const dateOrder = dateCol !== undefined ? guessDateOrder(body.map((r) => r[dateCol] || "")) : "dmy";
  const mapping: Mapping = { cols, headerRow, parties, dateOrder, tz: opts.tz || "Asia/Kolkata", cc: opts.cc || "91" };
  const need: Field[] = parties === "calling-called" ? ["calling", "called"] : ["a", "b"];
  const required: Field[] = [...need, cols.datetime !== undefined ? "datetime" : "date", "dur", "type"];
  const missing = required.filter((f) => cols[f] === undefined && !(f === "date" && cols.time !== undefined && looksDateTime(body, cols.time)));
  const used = new Set(Object.values(cols));
  const unmapped = headers.filter((_, i) => !used.has(i));
  const nh = new Set(headers.map(normHeader));
  let layout = "Generic layout";
  let bestL = 0;
  for (const L of LAYOUTS) {
    const hit = L.keys.filter((k) => nh.has(k)).length / L.keys.length;
    if (hit > bestL && hit >= 0.66) { bestL = hit; layout = L.name; }
  }
  if (headerRow < 0) layout = "No header row (columns guessed from content)";
  return { mapping, layout, confidence: (required.length - missing.length) / required.length, headers, unmapped, missing };
}

function looksDateTime(rows: string[][], col: number) {
  const s = rows.slice(0, 20).map((r) => r[col]).filter(Boolean);
  return s.length > 0 && s.filter((v) => parseDate(v)?.time).length >= s.length * 0.8;
}

/** No header row: guess from values (phone numbers, dates, times, small integers). */
function guessByContent(rows: string[][]): Mapping["cols"] {
  const cols: Mapping["cols"] = {};
  const width = Math.max(0, ...rows.map((r) => r.length));
  const share = (i: number, test: (v: string) => boolean) => { const v = rows.map((r) => r[i] || "").filter(Boolean); return v.length ? v.filter(test).length / v.length : 0; };
  const phones: number[] = [];
  for (let i = 0; i < width; i++) {
    if (share(i, (v) => /^\+?\d{10,13}$/.test(v.replace(/[\s-]/g, ""))) > 0.8) { phones.push(i); continue; }
    if (cols.imei === undefined && share(i, (v) => /^\d{14,16}$/.test(v)) > 0.8) { cols.imei = i; continue; }
    if (cols.datetime === undefined && cols.date === undefined && share(i, (v) => !!parseDate(v)?.time) > 0.8) { cols.datetime = i; continue; }
    if (cols.date === undefined && cols.datetime === undefined && share(i, (v) => !!parseDate(v)) > 0.8) { cols.date = i; continue; }
    if (cols.time === undefined && share(i, (v) => !!parseTime(v)) > 0.8) { cols.time = i; continue; }
    if (cols.type === undefined && share(i, (v) => /^(mo|mt|in|out|incoming|outgoing|sms[\s_-]?(in|out|mo|mt)|smo|smt|moc|mtc)$/i.test(v)) > 0.8) { cols.type = i; continue; }
    if (cols.dur === undefined && share(i, (v) => parseDuration(v) !== null && /^\d{1,5}$|^\d+:\d{2}(:\d{2})?$/.test(v)) > 0.8) { cols.dur = i; continue; }
  }
  if (phones[0] !== undefined) cols.a = phones[0];
  if (phones[1] !== undefined) cols.b = phones[1];
  return cols;
}
