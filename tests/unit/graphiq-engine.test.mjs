// Unit tests for packages/graphiq-engine, run with `node --test tests/unit/`.
// The engine is bundled with esbuild to a temporary ES module first (it is TypeScript).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(tmpdir(), `gq-engine-test-${process.pid}.mjs`);
buildSync({ entryPoints: [new URL("../../packages/graphiq-engine/src/index.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error" });
const E = await import(out);
const FX = (n) => new Uint8Array(readFileSync(new URL(`../fixtures/graphiq/${n}`, import.meta.url)));
const TZ = "Asia/Kolkata";
const T1 = "+919800000101", T2 = "+919800000102", T3 = "+919800000103", T4 = "+919415000104", T5 = "+919800000105";

async function load(name) {
  const { table, format } = await E.readTable(name, FX(name));
  const det = E.detectMapping(table, { tz: TZ });
  const res = E.normaliseTable(table, det.mapping, { src: name });
  return { ...res, det, format };
}

test("MSISDN normalisation covers Indian and international forms", () => {
  for (const v of ["9800000101", "09800000101", "919800000101", "+91 98000 00101", "0091-98000-00101", "9.800000101E9", "9800000101.0"]) assert.equal(E.normaliseMsisdn(v).value, T1, v);
  assert.equal(E.normaliseMsisdn("00447700900123").value, "+447700900123");
  assert.equal(E.normaliseMsisdn("VM-HDFCBK").kind, "alpha");
  assert.equal(E.normaliseMsisdn("121").kind, "short");
  assert.equal(E.normaliseMsisdn("01123456789").value, "+911123456789");
  assert.equal(E.lookupNumber("+911123456789").city, "Delhi");
  assert.equal(E.lookupNumber("+447700900123").country, "United Kingdom");
  assert.equal(E.lookupNumber("+919415000104").operator, "BSNL");
  assert.match(E.lookupNumber("+919415000104").note, /ported|MNP/);
});

test("IMEI check digit and TAC", () => {
  assert.equal(E.cleanImei("490154203237518").valid, true);
  assert.equal(E.cleanImei("490154203237519").valid, false);
  assert.equal(E.cleanImei("49015420323751").value, "490154203237518"); // missing check digit restored
  assert.equal(E.tacOf("490154203237518"), "49015420");
});

test("dates, times, durations and time zones", () => {
  assert.deepEqual(E.parseDate("03/04/2026").date, { y: 2026, mo: 4, d: 3 });
  assert.deepEqual(E.parseDate("03/04/2026", "mdy").date, { y: 2026, mo: 3, d: 4 });
  assert.deepEqual(E.parseDate("14-Mar-26 7:05 PM").time, { h: 19, mi: 5, s: 0 });
  assert.equal(E.parseDate("31/02/2026"), null);
  assert.equal(E.parseDuration("00:01:15"), 75);
  assert.equal(E.parseDuration("1m 15s"), 75);
  assert.equal(E.zonedToUtc(2026, 3, 14, 19, 0, 0, TZ), Date.UTC(2026, 2, 14, 13, 30));
  assert.equal(E.localTime(Date.UTC(2026, 2, 14, 13, 30), TZ), "19:00:00");
  assert.equal(E.guessDateOrder(["12/25/2026", "01/02/2026"]), "mdy");
  assert.equal(E.normaliseType("SMS-IN"), "SMS-MT");
  assert.equal(E.normaliseType("SMO"), "SMS-MO");
  assert.equal(E.normaliseType("Missed Call"), "MISSED");
  assert.equal(E.normaliseType("GPRS"), "DATA");
  assert.equal(E.normaliseType("O"), "MO");
});

test("auto-recognises each synthetic operator layout", async () => {
  const a = await load("SYNTHETIC_airtel_style_T1.csv");
  assert.match(a.det.layout, /Airtel-style/);
  assert.equal(a.det.mapping.headerRow, 3); // blank lines are dropped by the parser
  assert.equal(a.det.confidence, 1);
  assert.equal(a.validation.targets[0], T1);
  assert.equal(a.validation.duplicates, 5);
  assert.equal(a.validation.errors["bad-date"], 2);
  assert.equal(a.validation.errors["no-b-party"], 1);
  assert.ok(a.records.some((r) => r.b === "+447700900123"));
  const j = await load("SYNTHETIC_jio_style_T2.csv");
  assert.match(j.det.layout, /Jio-style/);
  assert.equal(j.det.mapping.parties, "calling-called");
  assert.ok(j.records.every((r) => r.a === T2), "incoming calls are swapped so the target is always A");
  assert.ok(j.records.some((r) => r.type === "MISSED") && j.records.some((r) => r.type === "DATA"));
  const v = await load("SYNTHETIC_vi_style_T3.txt");
  assert.match(v.det.layout, /Vi-style/);
  assert.ok(v.records.some((r) => r.roam === "Maharashtra"));
  assert.ok(v.records.some((r) => r.dur > 60));
  const b = await load("SYNTHETIC_bsnl_style_T4.xlsx");
  assert.equal(b.format, "xlsx");
  assert.match(b.det.layout, /BSNL-style/);
  assert.ok(b.records.length > 100 && b.records.every((r) => r.a === T4));
  const first = b.records[0];
  assert.equal(E.localDate(first.ts, TZ).slice(0, 7), "2026-02", "Excel serial dates are read");
  const js = await load("SYNTHETIC_generic_T5.json");
  assert.equal(js.format, "json");
  assert.ok(js.records.filter((r) => r.a === T5).length > 50);
  const x = await load("SYNTHETIC_generic_T6.xml");
  assert.equal(x.format, "xml");
  assert.ok(x.records.length > 50);
  const h = await load("SYNTHETIC_tower_dump.html");
  assert.equal(h.format, "html");
  assert.ok(h.records.length > 5);
});

async function all() {
  const names = ["SYNTHETIC_airtel_style_T1.csv", "SYNTHETIC_jio_style_T2.csv", "SYNTHETIC_vi_style_T3.txt", "SYNTHETIC_bsnl_style_T4.xlsx", "SYNTHETIC_generic_T5.json", "SYNTHETIC_generic_T6.xml"];
  const sets = []; for (const n of names) sets.push((await load(n)).records);
  return E.mergeRecords(sets);
}

test("merge removes duplicates across files", async () => {
  const { records, duplicates } = await all();
  assert.ok(duplicates >= 6, `cross-file duplicates found: ${duplicates}`);
  assert.ok(records.length > 1400);
});

test("analytics find the planted patterns", async () => {
  const { records } = await all();
  const o = { tz: TZ };
  const s = E.summaryByNumber(records, o).find((x) => x.number === T1);
  assert.ok(s.callsOut > 0 && s.callsIn > 0 && s.uniqueContacts >= 8 && s.durMax >= 420);
  const co = E.coLocation(records, o);
  assert.ok(co.some((c) => [c.a1, c.a2].sort().join() === [T1, T5].sort().join() && c.cell === "404-10-1201-31001"), "T1 and T5 meeting point");
  const im = E.imeiAnalysis(records, o);
  assert.ok(im.oneSimManyImeis.some((x) => x.msisdn === T1), "T1 changed handset");
  assert.ok(im.oneImeiManySims.some((x) => x.sims.map((s) => s.id).includes(T3) && x.sims.map((s) => s.id).includes(T4)), "one IMEI, two SIMs");
  assert.equal(im.timeline.find((t) => t.msisdn === T1).changes >= 1, true);
  const circ = E.circular(records, o);
  assert.ok(circ.some((c) => new Set(c.path).size === 3 && [T1, T2, T3].every((t) => c.path.includes(t))), "circular chain");
  assert.ok(E.targetToTarget(records, o).some((c) => c.a === T1 && c.b === T2));
  const silent = E.silentPeriods(records, o);
  assert.ok(silent.some((x) => x.a === T2 && x.hours >= 72), "T2 silence");
  const an = E.anomalies(records, o);
  assert.ok(an.days.some((d) => d.a === T2 && d.day === "2026-03-10"), "T2 burst day");
  const tp = E.timeProfile(records.filter((r) => r.a === T3), o);
  assert.ok(tp.night > tp.day * 0.8, "T3 mostly at night");
  assert.ok(E.roamingAndIsd(records, o).isd.some((x) => x.country === "United Kingdom"));
  assert.ok(E.overlappingCalls(records, o).some((x) => x.a === T1));
  assert.ok(E.commonNumbers(records, o).some((c) => c.b === "+919800001005" && c.targets.length >= 3));
  const dump = E.towerDump(records, o);
  assert.ok(dump.length > 0);
  // Cross-operator meeting via the tower master (same site, different cell IDs)
  const towers = (await E.readTable("t.csv", FX("SYNTHETIC_tower_master.csv"))).table;
  const det = E.detectMapping(towers);
  assert.ok(det.mapping.cols.cell !== undefined && det.mapping.cols.lat !== undefined);
  const tw = towers.slice(det.mapping.headerRow + 1).map((r) => ({ cell: r[det.mapping.cols.cell], lat: +r[det.mapping.cols.lat], lon: +r[det.mapping.cols.lon] }));
  const cross = E.coLocation(records, { tz: TZ, keyOf: E.siteKey(tw) });
  assert.ok(cross.some((c) => [c.a1, c.a2].sort().join() === [T1, T2].sort().join() && c.cell.startsWith("site 28.63")), "T1 (Airtel) and T2 (Jio) on the same mast");
  const full = E.analyseAll(records, o);
  assert.ok(full.summary.length >= 5 && full.time.hourly.length === 24);
});

test("graph metrics and communities", async () => {
  const { records } = await all();
  const g = E.buildGraph(records);
  assert.ok(g.nodes.length > 30 && g.edges.length > 30);
  const t1 = g.nodes.find((n) => n.id === T1);
  assert.ok(t1.target && t1.degree >= 8 && t1.betweenness > 0 && t1.closeness > 0);
  assert.ok(g.communities >= 2);
  const ego = E.egoNetwork(g, T1, 1);
  assert.ok(ego.nodes.length >= 9);
  const flow = E.callFlow(records, T1);
  assert.ok(flow.incoming.length && flow.outgoing.length);
});

test("filters: memory, SQL and plain-English questions", async () => {
  const { records } = await all();
  const f = E.cleanFilter({ numbers: ["9800000101"], timeFrom: "22:00", timeTo: "06:00", types: ["MO", "BAD"], durMin: "60" });
  assert.deepEqual(f.types, ["MO"]);
  assert.equal(f.numbers[0], T1);
  const hits = E.applyFilter(records, f, TZ);
  assert.ok(hits.length > 0 && hits.every((r) => r.dur >= 60));
  const sql = E.filterToSql(f, 330);
  assert.match(sql.where, /a IN \(\?\) OR b IN \(\?\)/);
  const q = E.parseQuestion("outgoing calls from 9800000101 after 10pm in February 2026 longer than 5 minutes", { tz: TZ });
  assert.deepEqual(q.filter.numbers, [T1]);
  assert.equal(q.filter.side, "a");
  assert.deepEqual(q.filter.types, ["MO"]);
  assert.equal(q.filter.timeFrom, "22:00");
  assert.equal(q.filter.durMin, 300);
  assert.equal(E.localDate(q.filter.from, TZ), "2026-02-01");
  assert.equal(E.localDate(q.filter.to, TZ), "2026-02-28");
  const q2 = E.parseQuestion("sms at night on weekends", { tz: TZ });
  assert.deepEqual(q2.filter.weekdays, [0, 6]);
  assert.ok(q2.filter.types.includes("SMS-MO"));
});

test("reports, exports, KML and XLSX round trip", async () => {
  const { records } = await all();
  for (const k of E.REPORT_KINDS) {
    const r = E.buildReport(k.id, records, { caseTitle: "Synthetic case", tz: TZ });
    assert.ok(r.sections.length >= 2, k.id);
    assert.match(r.disclaimer, /human verification/);
    assert.match(E.reportToHtml(r), /Requires human verification/);
    assert.ok(E.reportToCsv(r).includes(r.title));
  }
  assert.equal(E.toCsv([["=1+1", "a,b"]]), "'=1+1,\"a,b\"\r\n", "CSV formula injection is neutralised");
  const xl = await E.writeXlsx([{ name: "S", rows: [["a", "b"], [1, "x & y"]] }]);
  const back = await E.readXlsx(xl);
  assert.deepEqual(back[0].rows, [["a", "b"], ["1", "x & y"]]);
  assert.match(E.toKml([{ name: "c", lat: 28.6, lon: 77.2 }]), /<coordinates>77.2,28.6,0<\/coordinates>/);
});

test("encrypted case bundle", async () => {
  const data = await E.encryptBundle({ hello: "world" }, "a long test passphrase");
  assert.deepEqual(await E.decryptBundle(data, "a long test passphrase"), { hello: "world" });
  await assert.rejects(E.decryptBundle(data, "the wrong passphrase!"), /Wrong passphrase/);
  data[data.length - 1] ^= 1;
  await assert.rejects(E.decryptBundle(data, "a long test passphrase"));
});

test("PDF text items become table rows", () => {
  const items = [
    { str: "A Party", x: 10, y: 700, w: 40, page: 1 }, { str: "B Party", x: 120, y: 700, w: 40, page: 1 }, { str: "Date", x: 230, y: 700, w: 25, page: 1 },
    { str: "9800000101", x: 10, y: 680, w: 60, page: 1 }, { str: "9800001001", x: 120, y: 680, w: 60, page: 1 }, { str: "01/02/2026", x: 230, y: 680, w: 60, page: 1 },
  ];
  assert.deepEqual(E.pdfItemsToTable(items), [["A Party", "B Party", "Date"], ["9800000101", "9800001001", "01/02/2026"]]);
});

test("exhibit charts render valid SVG in both themes with derived action titles", async () => {
  const { records } = await all();
  for (const th of ["dark", "light"]) {
    const ex = E.buildExhibits(records, { tz: TZ, theme: th, validation: { rows: 1700, imported: 1600, rejected: 3, duplicates: 97 }, flagged: 12, workflow: { imported: 1, validated: 1, analysed: 0.5, reviewed: 0, reported: 0 } });
    assert.ok(ex.length >= 25, `exhibits: ${ex.length}`);
    for (const x of ex) {
      if (!x.html) {
        assert.match(x.svg, /^<svg[^>]+viewBox/, x.id);
        assert.ok(x.svg.includes("requires human verification"), `${x.id} has the verification note`);
        assert.ok(x.svg.includes("Source:"), `${x.id} has a source line`);
        assert.ok(!/NaN|undefined|Infinity/.test(x.svg), `${x.id} has no bad numbers: ${x.title}`);
        assert.equal((x.svg.match(/<svg/g) || []).length, (x.svg.match(/<\/svg>/g) || []).length);
      }
      assert.ok(x.title && !/NaN|undefined/.test(x.title), x.title);
    }
    const top = ex.find((x) => x.eyebrow.includes("Top contacts"));
    const c = E.contacts(records.filter((r) => r.a === T1), { tz: TZ })[0];
    assert.ok(top.title.includes(E.displayMsisdn(c.b)), "the action title names the computed top contact");
  }
  const cards = ["value", "delta", "sparkline", "progress", "benchmark", "minibar", "alert", "dark"].map((k) => E.charts.metricCard({ kind: k, label: "Test", value: 42, series: [1, 3, 2], target: 50, benchmark: 30, alert: "Above threshold", delta: -3 }));
  assert.ok(cards.every((s) => s.startsWith("<svg") && !s.includes("NaN")));
  assert.match(E.charts.financialTable(["Number", "Change"], [["x", -5], ["y", 3]], { totals: true }), /\(5\)/);
});
