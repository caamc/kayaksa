// Generates the SYNTHETIC call detail records used by the GraphIQ tests and demos.
// Every number, IMEI, IMSI and cell ID here is invented. Layouts imitate the general shape of
// Indian operator exports (title block, column names, call-type codes) without copying any real
// file. Deterministic (seeded), so the tests can assert exact planted patterns:
//   - T1 and T5 at the same cell within 20 minutes on 2026-03-14 (possible meeting point, same operator)
//   - T1 and T2 at the same site (different operators; same tower-master location) on 2026-03-14
//   - T1 changes handset on 2026-03-01 (IMEI A to B); one IMEI used by T3 and then T4
//   - circular chain T1 -> T2 -> T3 -> T1 on 2026-03-05; direct T1 <-> T2 contact
//   - T2 silent from 2026-02-20 to 2026-02-23 and a burst of calls on 2026-03-10
//   - T3 mostly calls at night, roams in Maharashtra in March; T1 calls a UK drama-range number
//   - duplicates within and across files, a few invalid rows, overlapping calls
// Run: node tests/fixtures/graphiq/generate.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { buildSync } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const engPath = join(tmpdir(), `gq-engine-gen-${process.pid}.mjs`);
buildSync({ entryPoints: [new URL("../../../packages/graphiq-engine/src/index.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "neutral", outfile: engPath, logLevel: "error" });
const E = await import(engPath);

let seed = 20260314;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const p2 = (n) => String(n).padStart(2, "0");

const T = { T1: "9800000101", T2: "9800000102", T3: "9800000103", T4: "9415000104", T5: "9800000105", T6: "9800000106" };
const C = Array.from({ length: 30 }, (_, i) => `98000010${p2(i + 1)}`); // contacts 9800001001..9800001030
const UK = "+447700900123"; // UK Ofcom range reserved for drama: never a real subscriber
const imei = (body14) => body14 + E.luhnDigit(body14);
const IMEI = { A: imei("35000011111111"), B: imei("35000022222222"), S: imei("86000033333333"), T2: imei("35000044444444"), T5: imei("35000055555555"), T6: imei("35000066666666") };
const IMSI = { T1: "404100000000101", T2: "405872000000102", T3: "404200000000103", T4: "404550000000104", T5: "404100000000105", T6: "404100000000106" };
const CELLS = {
  airtel: ["404-10-1201-31001", "404-10-1201-31002", "404-10-1202-31010", "404-10-1203-31020", "404-10-1204-31030"],
  jio: ["405-872-2201-41001", "405-872-2201-41002", "405-872-2203-41020"],
  vi: ["404-20-3301-51001", "404-20-3302-51002", "404-20-3303-51003", "404-27-3401-52001"],
  bsnl: [["1101", "60001"], ["1101", "60002"], ["1102", "60010"]],
};

// Events in IST wall-clock time
const ev = [];
const at = (y, mo, d, h, mi, s = 0) => ({ y, mo, d, h, mi, s });
const push = (a, b, type, t, dur, extra = {}) => ev.push({ a, b, type, t, dur, ...extra });
const days = []; for (let d = 1; d <= 59; d++) { const x = new Date(Date.UTC(2026, 1, d)); days.push([x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]); }

function routine(who, contacts, perDay, opts = {}) {
  for (const [y, mo, d] of days) {
    if (opts.skip?.(y, mo, d)) continue;
    const n = int(Math.max(0, perDay - 3), perDay + 3);
    for (let i = 0; i < n; i++) {
      const night = opts.nightBias && rnd() < opts.nightBias;
      const h = night ? pick([22, 23, 0, 1, 2]) : int(8, 21);
      const type = pick(["MO", "MO", "MT", "MT", "SMS-MO", "SMS-MT", "MISSED", ...(opts.data ? ["DATA"] : [])]);
      const b = rnd() < 0.55 ? contacts[Math.floor(Math.pow(rnd(), 2) * Math.min(5, contacts.length))] : pick(contacts);
      const dur = type === "MO" || type === "MT" ? (rnd() < 0.12 ? int(1, 9) : int(15, 900)) : 0;
      push(who, b, type, at(y, mo, d, h, int(0, 59), int(0, 59)), dur, opts.extra?.(y, mo, d) || {});
    }
  }
}

routine(T.T1, [C[0], C[1], C[4], C[5], C[6], C[7], C[8], C[9]], 7, { extra: (y, mo, d) => ({ imei: mo === 2 ? IMEI.A : IMEI.B, cell: pick(CELLS.airtel.slice(1)) }) });
routine(T.T2, [C[0], C[1], C[10], C[11], C[12], C[13]], 6, { skip: (y, mo, d) => mo === 2 && d >= 20 && d <= 23, extra: () => ({ imei: IMEI.T2, cell: pick(CELLS.jio.slice(1)) }), data: true });
routine(T.T3, [C[4], C[14], C[15], C[16], C[17]], 5, { nightBias: 0.6, extra: (y, mo, d) => ({ imei: IMEI.S, cell: mo === 3 && d >= 10 && d <= 16 ? CELLS.vi[3] : pick(CELLS.vi.slice(0, 3)), roam: mo === 3 && d >= 10 && d <= 16 ? "Maharashtra" : "" }) });
routine(T.T4, [C[4], C[18], C[19], C[20]], 4, { extra: () => ({ imei: IMEI.S }) });
routine(T.T5, [C[0], C[21], C[22], C[23]], 3, { extra: () => ({ imei: IMEI.T5, cell: pick(CELLS.airtel.slice(2)) }) });
routine(T.T6, [C[24], C[25], C[26]], 2, { extra: () => ({ imei: IMEI.T6 }) });

// Planted patterns
push(T.T1, T.T5, "MO", at(2026, 3, 14, 19, 2), 64, { imei: IMEI.B, cell: CELLS.airtel[0] });
push(T.T5, T.T1, "MT", at(2026, 3, 14, 19, 2), 64, { imei: IMEI.T5, cell: CELLS.airtel[0] });
push(T.T5, C[21], "MO", at(2026, 3, 14, 19, 18), 120, { imei: IMEI.T5, cell: CELLS.airtel[0] });
push(T.T2, C[10], "MO", at(2026, 3, 14, 19, 10), 95, { imei: IMEI.T2, cell: CELLS.jio[0] });
for (let k = 0; k < 4; k++) push(T.T1, T.T2, k % 2 ? "MT" : "MO", at(2026, 2, 3 + k * 7, 12, 30), int(60, 300), { imei: k < 3 ? IMEI.A : IMEI.B, cell: CELLS.airtel[1] });
for (let k = 0; k < 4; k++) push(T.T2, T.T1, k % 2 ? "MO" : "MT", at(2026, 2, 3 + k * 7, 12, 30), 0, { imei: IMEI.T2, cell: CELLS.jio[1] });
push(T.T1, T.T2, "MO", at(2026, 3, 5, 9, 0), 120, { imei: IMEI.B, cell: CELLS.airtel[2] });
push(T.T2, T.T3, "MO", at(2026, 3, 5, 11, 0), 180, { imei: IMEI.T2, cell: CELLS.jio[1] });
push(T.T3, T.T1, "MO", at(2026, 3, 5, 14, 0), 200, { imei: IMEI.S, cell: CELLS.vi[0] });
for (let i = 0; i < 40; i++) push(T.T2, pick([C[10], C[11], C[12]]), pick(["MO", "MT"]), at(2026, 3, 10, int(9, 22), int(0, 59), int(0, 59)), int(10, 200), { imei: IMEI.T2, cell: CELLS.jio[2] });
push(T.T1, UK, "MO", at(2026, 2, 27, 23, 41), 420, { imei: IMEI.A, cell: CELLS.airtel[3] });
push(T.T1, C[5], "MO", at(2026, 3, 20, 10, 0), 600, { imei: IMEI.B, cell: CELLS.airtel[1] });
push(T.T1, C[6], "MT", at(2026, 3, 20, 10, 4), 120, { imei: IMEI.B, cell: CELLS.airtel[1] }); // overlaps the call above
// IMEI shared: T4 only from 2026-03-01 on (T3 used it before) - adjust T4 events to after that date
for (const e of ev) if (e.a === T.T4 && e.t.mo === 2) e.imei = imei("35000077777777");

ev.sort((x, y) => Date.UTC(x.t.y, x.t.mo - 1, x.t.d, x.t.h, x.t.mi, x.t.s) - Date.UTC(y.t.y, y.t.mo - 1, y.t.d, y.t.h, y.t.mi, y.t.s));
const of = (who) => ev.filter((e) => e.a === who);
const dmy = (t, sep = "/") => `${p2(t.d)}${sep}${p2(t.mo)}${sep}${t.y}`;
const hms = (t) => `${p2(t.h)}:${p2(t.mi)}:${p2(t.s)}`;
const csv = (rows) => rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\r\n") + "\r\n";
const out = (name, data) => { writeFileSync(join(here, name), data); console.log("wrote", name); };
mkdirSync(here, { recursive: true });

// 1. Airtel-style CSV: title block, Target / B Party, IN/OUT codes, duplicates and bad rows
{
  const AT = { MO: "OUT", MT: "IN", "SMS-MO": "SMS-OUT", "SMS-MT": "SMS-IN", MISSED: "MISSED", DATA: "GPRS" };
  const rows = [["SYNTHETIC TEST DATA - NOT REAL RECORDS"], ["Call Detail Records for Target No: 9800000101"], ["Period: 01/02/2026 to 31/03/2026"], [],
    ["Target No", "Call Type", "TOC", "B Party No", "LRN No", "Date", "Time", "Dur(s)", "First Cell ID", "First Cell ID Address", "Last Cell ID", "IMEI", "IMSI", "Roaming Nw", "Circle"]];
  const list = of(T.T1);
  for (const e of list) rows.push([T.T1, AT[e.type], "", e.b.startsWith("+") ? e.b.replace("+", "00") : e.b, "", dmy(e.t), hms(e.t), e.dur, e.cell, "Synthetic Site " + e.cell.slice(-5), e.cell, e.imei, IMSI.T1, e.roam || "", "Delhi"]);
  for (const e of list.slice(10, 15)) rows.push([T.T1, AT[e.type], "", e.b, "", dmy(e.t), hms(e.t), e.dur, e.cell, "", e.cell, e.imei, IMSI.T1, "", "Delhi"]); // duplicates
  rows.push([T.T1, "OUT", "", C[0], "", "31/02/2026", "10:00:00", 30, CELLS.airtel[1], "", "", IMEI.B, IMSI.T1, "", "Delhi"]); // impossible date
  rows.push([T.T1, "OUT", "", C[0], "", "not a date", "", 30, CELLS.airtel[1], "", "", IMEI.B, IMSI.T1, "", "Delhi"]);
  rows.push([T.T1, "IN", "", "", "", "12/03/2026", "10:00:00", 30, CELLS.airtel[1], "", "", IMEI.B, IMSI.T1, "", "Delhi"]); // no B party
  out("SYNTHETIC_airtel_style_T1.csv", csv(rows));
}
// 2. Jio-style CSV: calling/called parties (swapped for incoming), MO/MT/SMO/SMT, termination time
{
  const JT = { MO: "MO", MT: "MT", "SMS-MO": "SMO", "SMS-MT": "SMT", MISSED: "MT-MISSED", DATA: "DATA" };
  const rows = [["Calling Party Telephone Number", "Called Party Telephone Number", "Call Forwarding", "LRN Called No", "Call Date", "Call Time", "Call Termination Time", "Call Duration", "First Cell ID", "Last Cell ID", "Call Type", "IMEI", "IMSI", "Roaming circle"]];
  for (const e of of(T.T2)) {
    const inc = ["MT", "SMS-MT", "MISSED"].includes(e.type);
    const end = new Date(Date.UTC(e.t.y, e.t.mo - 1, e.t.d, e.t.h, e.t.mi, e.t.s) + e.dur * 1000);
    rows.push([inc ? e.b : "91" + T.T2, inc ? "91" + T.T2 : e.b, "", "", `${p2(e.t.d)}-${p2(e.t.mo)}-${e.t.y}`, hms(e.t), `${p2(end.getUTCHours())}:${p2(end.getUTCMinutes())}:${p2(end.getUTCSeconds())}`, e.dur, e.cell, e.cell, JT[e.type], e.imei, IMSI.T2, ""]);
  }
  out("SYNTHETIC_jio_style_T2.csv", "# SYNTHETIC TEST DATA - NOT REAL RECORDS\r\n" + csv(rows));
}
// 3. Vi-style pipe-delimited TXT: ISO date-time, hh:mm:ss durations, CGI, roaming
{
  const VT = { MO: "Outgoing", MT: "Incoming", "SMS-MO": "SMS Outgoing", "SMS-MT": "SMS Incoming", MISSED: "Missed Call", DATA: "Data" };
  const lines = ["MSISDN|OTHER_PARTY|CALL_TYPE|START_TIME|DURATION|CGI|IMEI|IMSI|ROAMING"];
  for (const e of of(T.T3)) lines.push([`+91${T.T3}`, e.b, VT[e.type], `${e.t.y}-${p2(e.t.mo)}-${p2(e.t.d)} ${hms(e.t)}`, `${p2(Math.floor(e.dur / 3600))}:${p2(Math.floor(e.dur / 60) % 60)}:${p2(e.dur % 60)}`, e.cell, e.imei, IMSI.T3, e.roam || "N"].join("|"));
  out("SYNTHETIC_vi_style_T3.txt", "SYNTHETIC TEST DATA - NOT REAL RECORDS\n" + lines.join("\n") + "\n");
}
// 4. BSNL-style XLSX: Excel serial dates, LAC + cell ID, O/I codes
{
  const BT = { MO: "O", MT: "I", "SMS-MO": "SMS-O", "SMS-MT": "SMS-I", MISSED: "MISSED", DATA: "DATA" };
  const serial = (t) => Math.round((Date.UTC(t.y, t.mo - 1, t.d) / 86_400_000 + 25569) * 1) ;
  const rows = [["SYNTHETIC TEST DATA - NOT REAL RECORDS"], ["Calling Number", "Called Number", "Date", "Time", "Duration", "Call Type", "LAC", "Cell Id", "IMEI", "IMSI"]];
  for (const e of of(T.T4)) { const [lac, ci] = pick(CELLS.bsnl); const inc = ["MT", "SMS-MT", "MISSED"].includes(e.type); rows.push([inc ? e.b : "0" + T.T4, inc ? "0" + T.T4 : e.b, serial(e.t), hms(e.t), e.dur, BT[e.type], lac, ci, e.imei, IMSI.T4]); }
  out("SYNTHETIC_bsnl_style_T4.xlsx", await E.writeXlsx([{ name: "CDR", rows }]));
}
// 5. JSON (generic export), including records that duplicate the Airtel file (cross-file duplicates)
{
  const recs = of(T.T5).map((e) => ({ subscriber: { msisdn: "+91" + T.T5 }, other_party: e.b, start: `${e.t.y}-${p2(e.t.mo)}-${p2(e.t.d)}T${hms(e.t)}+05:30`, duration_sec: e.dur, direction: e.type, imei: e.imei, imsi: IMSI.T5, cell_id: e.cell }));
  for (const e of of(T.T1).slice(0, 6)) recs.push({ subscriber: { msisdn: "+91" + T.T1 }, other_party: e.b, start: `${e.t.y}-${p2(e.t.mo)}-${p2(e.t.d)}T${hms(e.t)}+05:30`, duration_sec: e.dur, direction: e.type, imei: e.imei, imsi: IMSI.T1, cell_id: e.cell });
  out("SYNTHETIC_generic_T5.json", JSON.stringify({ note: "SYNTHETIC TEST DATA - NOT REAL RECORDS", records: recs }, null, 1));
}
// 6. XML
{
  const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = of(T.T6).map((e) => `  <record>\n    <aParty>${T.T6}</aParty>\n    <bParty>${x(e.b)}</bParty>\n    <callDate>${dmy(e.t, "-")}</callDate>\n    <callTime>${hms(e.t)}</callTime>\n    <duration>${e.dur}</duration>\n    <callType>${e.type}</callType>\n    <imei>${e.imei}</imei>\n  </record>`).join("\n");
  out("SYNTHETIC_generic_T6.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<!-- SYNTHETIC TEST DATA - NOT REAL RECORDS -->\n<cdrExport>\n${body}\n</cdrExport>\n`);
}
// 7. HTML table (operator portal style): a small tower dump for two cells on 2026-03-14
{
  const rows = ev.filter((e) => e.cell && (e.cell === CELLS.airtel[0] || e.cell === CELLS.airtel[1]) && e.t.mo === 3 && e.t.d >= 13 && e.t.d <= 15);
  const tr = rows.map((e) => `<tr><td>${e.a}</td><td>${e.b}</td><td>${dmy(e.t)} ${hms(e.t)}</td><td>${e.dur}</td><td>${e.type}</td><td>${e.cell}</td></tr>`).join("\n");
  out("SYNTHETIC_tower_dump.html", `<!doctype html><html><head><title>SYNTHETIC tower dump</title></head><body><p>SYNTHETIC TEST DATA - NOT REAL RECORDS</p><table border="1"><tr><th>MSISDN</th><th>Other Party</th><th>Date Time</th><th>Duration</th><th>Call Type</th><th>Cell ID</th></tr>\n${tr}\n</table></body></html>\n`);
}
// 8. Tower master (synthetic coordinates around Delhi and Mumbai). Airtel 31001 and Jio 41001 share one site.
{
  const rows = [["cell_id", "latitude", "longitude", "address", "azimuth"]];
  const base = [[28.6315, 77.2167], [28.6129, 77.2295], [28.5355, 77.391], [28.4595, 77.0266], [28.7041, 77.1025]];
  CELLS.airtel.forEach((c, i) => rows.push([c, base[i][0], base[i][1], `Synthetic site A${i + 1}, New Delhi`, 120]));
  rows.push([CELLS.jio[0], base[0][0], base[0][1], "Synthetic site A1, New Delhi (shared mast)", 240]);
  rows.push([CELLS.jio[1], 28.6448, 77.2167, "Synthetic site J2, New Delhi", 0]);
  rows.push([CELLS.jio[2], 28.6692, 77.4538, "Synthetic site J3, Ghaziabad", 0]);
  CELLS.vi.forEach((c, i) => rows.push([c, i === 3 ? 19.076 : 28.62 + i * 0.03, i === 3 ? 72.8777 : 77.2 + i * 0.02, i === 3 ? "Synthetic site, Mumbai" : `Synthetic site V${i + 1}, Delhi`, 0]));
  out("SYNTHETIC_tower_master.csv", "# SYNTHETIC TEST DATA - invented coordinates\r\n" + csv(rows));
}
console.log(`events: ${ev.length}`);
