// Exhibits: turns computed analytics into Kayak exhibit charts with action titles. Every title is
// built from the numbers it sits above (never written by hand or by AI), and every exhibit carries
// the verification note. Used by the case dashboard, the analytics pages and report exports.
import type { CdrRecord } from "./types";
import * as A from "./analytics";
import * as C from "./charts";
import { callFlow } from "./graph";
import { displayMsisdn as dn } from "./msisdn";
import { fmtDuration, localDate } from "./time";
import { lookupNumber } from "./reference";

export interface Exhibit { id: string; group: string; eyebrow: string; title: string; svg: string; html?: boolean; note?: string }
export interface ExhibitContext {
  tz: string; theme?: C.ThemeName; source?: string; width?: number;
  target?: string; eventDate?: number; nightThreshold?: number;
  validation?: { rows: number; imported: number; rejected: number; duplicates: number };
  inScope?: number; flagged?: number;
  workflow?: { imported: number; validated: number; analysed: number; reviewed: number; reported: number };
  watchlist?: A.ListEntry[];
}

const pc = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const days = (ms: number) => Math.round(ms / 86_400_000);

export function buildExhibits(records: CdrRecord[], ctx: ExhibitContext): Exhibit[] {
  const tz = ctx.tz, o = { tz }, th = ctx.theme || "dark", W = ctx.width || 720;
  const src = ctx.source || "Operator CDRs loaded into this case; Kayak GraphIQ analysis";
  const F = (fr: { eyebrow: string; title: string }, extra: object = {}) => ({ ...fr, source: src, theme: th, width: W, ...extra });
  const out: Exhibit[] = [];
  let n = 0;
  const add = (group: string, eyebrow: string, title: string, make: (fr: { eyebrow: string; title: string }) => string) => {
    const eb = `Exhibit ${++n} - ${eyebrow}`;
    out.push({ id: `ex${n}`, group, eyebrow: eb, title, svg: make({ eyebrow: eb, title }) });
  };
  if (!records.length) return out;

  const ov = A.overview(records);
  const target = ctx.target || ov.targets[0]?.number || records[0].a;
  const mine = records.filter((r) => r.a === target);
  const cons = A.contacts(mine, o);
  const tp = A.timeProfile(records, o);
  const total = records.length;
  const drillNum = (num: string) => ({ numbers: [num] });

  // KPI cards
  const daily = Object.entries(tp.daily).sort(([a], [b]) => a.localeCompare(b));
  const dvals = daily.map(([, v]) => v);
  const nightShare = total ? tp.night / total : 0;
  const thr = ctx.nightThreshold ?? 0.25;
  const voice = records.filter((r) => r.type === "MO" || r.type === "MT");
  const cards = [
    C.metricCard({ kind: "value", label: "Records", value: total, note: `${ov.targets.length} target number${ov.targets.length === 1 ? "" : "s"}` }, th),
    C.metricCard({ kind: "delta", label: "Last 7 days", value: sumLast(dvals, 7), delta: sumLast(dvals, 7) - sumLast(dvals.slice(0, -7), 7), deltaLabel: " vs previous 7 days" }, th),
    C.metricCard({ kind: "sparkline", label: "Records per day", value: dvals.length ? Math.round(total / dvals.length) : 0, unit: "avg", series: dvals.slice(-30) }, th),
    C.metricCard({ kind: "progress", label: "Imported rows kept", value: ctx.validation?.imported ?? total, target: ctx.validation?.rows ?? total }, th),
    C.metricCard({ kind: "benchmark", label: "Average call", value: voice.length ? Math.round(voice.reduce((s, r) => s + r.dur, 0) / voice.length) : 0, unit: "s", benchmark: median(voice.map((r) => r.dur)), benchmarkLabel: "median" }, th),
    C.metricCard({ kind: "minibar", label: "Latest day", value: dvals[dvals.length - 1] ?? 0, series: dvals.slice(-14), note: daily[daily.length - 1]?.[0] }, th),
    nightShare > thr
      ? C.metricCard({ kind: "alert", label: "Night activity", value: Math.round(nightShare * 100), unit: "%", alert: "Above night-call threshold" }, th)
      : C.metricCard({ kind: "value", label: "Night activity", value: Math.round(nightShare * 100), unit: "%", note: `Threshold ${Math.round(thr * 100)}%` }, th),
    C.metricCard({ kind: "dark", label: "Distinct numbers", value: ov.distinctNumbers, series: dvals.slice(-30) }, th),
  ];
  out.push({ id: "cards", group: "Dashboard", eyebrow: "Case KPIs", title: "Key measures", svg: cards.join(""), html: true });

  // Workflow chevrons
  if (ctx.workflow) {
    const w = ctx.workflow;
    const stages = [{ label: "Import", done: w.imported }, { label: "Validate", done: w.validated }, { label: "Analyse", done: w.analysed }, { label: "Review", done: w.reviewed }, { label: "Report", done: w.reported }];
    const cur = stages.find((s) => s.done < 1)?.label || "complete";
    add("Dashboard", "Case workflow", cur === "complete" ? "All five workflow stages are complete" : `The case is at the ${cur} stage`, (fr) => C.chevrons(stages, F(fr)));
  }

  // Funnel
  if (ctx.validation) {
    const v = ctx.validation, inScope = ctx.inScope ?? total, flagged = ctx.flagged ?? 0;
    const st = [{ label: "Rows received", value: v.rows }, { label: "Valid", value: v.rows - v.rejected }, { label: "After duplicates removed", value: v.imported }, { label: "In scope", value: inScope }, { label: "Flagged for review", value: flagged }];
    add("Dashboard", "Screening funnel", `${v.imported.toLocaleString("en-IN")} of ${v.rows.toLocaleString("en-IN")} rows were kept (${pc(v.imported, v.rows)}%); ${flagged.toLocaleString("en-IN")} records are flagged for review`, (fr) => C.funnel(st, F(fr, { highlight: 4 })));
  }

  // Top contacts
  if (cons.length) {
    const t = cons[0], share = pc(t.total, mine.length);
    add("Contacts", "Top contacts", `${dn(t.b)} accounts for ${share}% of ${dn(target)}'s records`, (fr) => C.bladeBars(cons.slice(0, 10).map((c) => ({ label: dn(c.b), value: c.total, drill: drillNum(c.b) })), F(fr, { highlight: 0 })));
    const top5 = cons.slice(0, 5).reduce((s, c) => s + c.total, 0);
    add("Contacts", "Contact share", `The top five contacts make up ${pc(top5, mine.length)}% of ${dn(target)}'s records`, (fr) => C.treemap(cons.slice(0, 20).map((c) => ({ label: dn(c.b), value: c.total, drill: drillNum(c.b) })), F(fr, { highlight: 0 })));
  }

  // Daily volume with average and peak
  if (daily.length > 1) {
    const mean = total / daily.length, pi = dvals.indexOf(Math.max(...dvals));
    add("Time", "Daily volume", `Peak of ${dvals[pi]} records on ${daily[pi][0]}, ${(dvals[pi] / mean).toFixed(1)} times the daily average`,
      (fr) => C.columnsRef(daily.map(([d, v]) => ({ label: d.slice(5), value: v, drill: { day: d } })), F(fr, { ref: mean, refLabel: `Daily average ${mean.toFixed(1)}`, callout: pi, calloutText: `Peak: ${daily[pi][0]} (${dvals[pi]})` })));
    const avgDur = daily.map(([d]) => { const v = voice.filter((r) => localDate(r.ts, tz) === d); return v.length ? v.reduce((s, r) => s + r.dur, 0) / v.length : 0; });
    const li = avgDur.indexOf(Math.max(...avgDur));
    add("Time", "Volume and call length", `Longest average call was on ${daily[li][0]} at ${fmtDuration(avgDur[li])}`, (fr) => C.combo(daily.map(([d, v], i) => ({ label: d.slice(5), bar: v, line: Math.round(avgDur[i]), drill: { day: d } })), F(fr, { barName: "Records", lineName: "Average call (s)" })));
    // Last-week share (action title in the requested style)
    const lastWeek = records.filter((r) => r.ts >= ov.to! - 7 * 86_400_000);
    const byLW = new Map<string, number>(); for (const r of lastWeek) byLW.set(r.a, (byLW.get(r.a) || 0) + 1);
    const lw = [...byLW.entries()].sort((a, b) => b[1] - a[1])[0];
    if (lw) add("Time", "Recent activity", `${dn(lw[0])} made ${pc(lw[1], lastWeek.length)}% of records in the last 7 days of the data`, (fr) => C.lineChart(ov.targets.slice(0, 4).map((t) => ({ name: dn(t.number), values: daily.map(([d]) => records.filter((r) => r.a === t.number && localDate(r.ts, tz) === d).length) })), daily.map(([d]) => d.slice(5)), F(fr, { highlight: ov.targets.findIndex((t) => t.number === lw[0]) })));
  }

  // Heat map hour x weekday
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let best = { d: 0, h: 0, v: -1 };
  tp.heat.forEach((row, d) => row.forEach((v, h) => { if (v > best.v) best = { d, h, v }; }));
  add("Time", "Activity heat map", `Activity peaks on ${wd[best.d]} at ${String(best.h).padStart(2, "0")}:00 (${best.v} records)`, (fr) => C.heatGrid(wd, [...Array(24).keys()].map((h) => String(h).padStart(2, "0")), tp.heat, F(fr, { drill: (r: number, c: number) => ({ weekdays: [r], timeFrom: `${String(c).padStart(2, "0")}:00`, timeTo: `${String(c).padStart(2, "0")}:59` }) })));
  add("Time", "Night share", `${Math.round(nightShare * 100)}% of activity happens at night (22:00 to 06:00)`, (fr) => C.waffle(nightShare, F(fr, { label: "of records at night", restLabel: "during the day" })));
  add("Time", "Thresholds", `Night activity is ${Math.round(nightShare * 100)}% against a ${Math.round(thr * 100)}% review threshold`, (fr) => C.bullets([
    { label: "Night share", value: nightShare * 100, target: thr * 100, unit: "%", ranges: [10, 25, 50] },
    { label: "Weekend share", value: pc(tp.weekend, total), target: 28.6, unit: "%", ranges: [20, 35, 60] },
    { label: "Outside business hours", value: pc(tp.outside, total), target: 50, unit: "%", ranges: [40, 60, 90] },
  ], F(fr)));

  // Call types by month (stacked and 100%)
  const months = Object.keys(tp.monthly).sort();
  const types = [["Voice", ["MO", "MT"]], ["SMS", ["SMS-MO", "SMS-MT"]], ["Data", ["DATA"]], ["Missed", ["MISSED"]]] as const;
  const mg = months.map((m) => ({ label: m, values: types.map(([, ts]) => records.filter((r) => (ts as readonly string[]).includes(r.type) && A.local(r, tz).month === m).length) }));
  const voiceShare = pc(records.filter((r) => r.type === "MO" || r.type === "MT").length, total);
  add("Types", "Call types", `Voice calls are ${voiceShare}% of all records`, (fr) => C.stackedBars(mg, types.map(([n]) => n), F(fr)));
  add("Types", "Call-type mix", `SMS share is ${pc(records.filter((r) => r.type.startsWith("SMS")).length, total)}% of records across ${months.length} month${months.length === 1 ? "" : "s"}`, (fr) => C.stackedBars(mg, types.map(([n]) => n), F(fr, { percent: true })));

  // In vs out per contact (grouped + diverging)
  if (cons.length) {
    const tops = cons.slice(0, 8);
    const inMost = tops.filter((c) => c.in + c.smsIn + c.missed > c.out + c.smsOut).length;
    add("Contacts", "Incoming and outgoing", `${inMost} of the top ${tops.length} contacts are mostly incoming`, (fr) => C.groupedBars(tops.map((c) => ({ label: dn(c.b).slice(-10), values: [c.in + c.smsIn + c.missed, c.out + c.smsOut], drill: drillNum(c.b) })), ["Incoming", "Outgoing"], F(fr)));
    const skew = [...tops].sort((a, b) => Math.abs((b.out + b.smsOut) - (b.in + b.smsIn + b.missed)) - Math.abs((a.out + a.smsOut) - (a.in + a.smsIn + a.missed)))[0];
    add("Contacts", "Balance", `${dn(skew.b)} is the most one-sided contact: ${skew.in + skew.smsIn + skew.missed} in, ${skew.out + skew.smsOut} out`, (fr) => C.diverging(tops.map((c) => ({ label: dn(c.b), left: c.in + c.smsIn + c.missed, right: c.out + c.smsOut, drill: drillNum(c.b) })), F(fr)));
    // Quadrant
    const q = cons.slice(0, 40).map((c) => ({ label: dn(c.b), x: c.total, y: Math.round(c.dur / 60), r: c.days, drill: drillNum(c.b) }));
    const xs = median(q.map((p) => p.x)), ys = median(q.map((p) => p.y));
    const key = q.filter((p) => p.x > xs && p.y > ys).length;
    add("Contacts", "Contact quadrant", `${key} contact${key === 1 ? " is" : "s are"} both frequent and long: likely key contacts to review first`, (fr) => C.quadrant(q, F(fr, { xLabel: "Records", yLabel: "Talk time (minutes)", xSplit: xs, ySplit: ys, highlight: q[0]?.label })));
  }

  // Period comparison: waterfall, dumbbell, slopegraph
  if (ov.from !== null && ov.to !== null && ov.to - ov.from > 2 * 86_400_000) {
    const split = ctx.eventDate ?? ov.from + (ov.to - ov.from) / 2;
    const before = A.contacts(mine.filter((r) => r.ts < split), o), after = A.contacts(mine.filter((r) => r.ts >= split), o);
    const bset = new Set(before.map((c) => c.b)), aset = new Set(after.map((c) => c.b));
    const added = [...aset].filter((x) => !bset.has(x)).length, lost = [...bset].filter((x) => !aset.has(x)).length;
    const sd = localDate(split, tz);
    add("Change", "Contact bridge", `${dn(target)} had ${bset.size} contacts before ${sd} and ${aset.size} after: ${added} new, ${lost} no longer seen`, (fr) => C.waterfall([{ label: `Before ${sd}`, value: bset.size, kind: "start" }, { label: "New contacts", value: added, kind: "delta" }, { label: "Contacts lost", value: -lost, kind: "delta" }, { label: `From ${sd}`, value: aset.size, kind: "total" }], F(fr)));
    const both = cons.slice(0, 10).map((c) => ({ label: dn(c.b), a: before.find((x) => x.b === c.b)?.total || 0, b: after.find((x) => x.b === c.b)?.total || 0, drill: drillNum(c.b) }));
    const mv = [...both].sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a))[0];
    if (mv) add("Change", "Before and after", `${mv.label} changed most around ${sd}: ${mv.a} records before, ${mv.b} after`, (fr) => C.dumbbell(both, F(fr, { aName: `Before ${sd}`, bName: `From ${sd}` })));
    const rank = (list: A.ContactRow[]) => new Map(list.map((c, i) => [c.b, i + 1]));
    const ra = rank(before), rb = rank(after);
    const sl = cons.slice(0, 8).filter((c) => ra.has(c.b) && rb.has(c.b)).map((c) => ({ label: dn(c.b), a: ra.get(c.b)!, b: rb.get(c.b)! }));
    if (sl.length >= 2) { const up = [...sl].sort((x, y) => (x.b - x.a) - (y.b - y.a))[0]; add("Change", "Rank change", `${up.label} moved from rank ${up.a} to rank ${up.b}`, (fr) => C.slopegraph(sl, F(fr, { aName: `Before ${sd}`, bName: `From ${sd}`, rank: true, highlight: up.label }))); }
  }

  // Towers: blade bars, Marimekko by time band
  const tw = A.towerAnalysis(mine, o);
  const tcells = tw.byNumber[0]?.cells || [];
  if (tcells.length) {
    add("Location", "Top cells", `Cell ${tcells[0].cell} carries ${pc(tcells[0].n, mine.filter((r) => r.cell).length)}% of ${dn(target)}'s located records`, (fr) => C.bladeBars(tcells.slice(0, 10).map((c) => ({ label: c.cell, value: c.n, drill: { cell: c.cell } })), F(fr, { highlight: 0 })));
    const bands: [string, number[]][] = [["Night 22-06", [22, 23, 0, 1, 2, 3, 4, 5]], ["Morning 06-12", [6, 7, 8, 9, 10, 11]], ["Afternoon 12-17", [12, 13, 14, 15, 16]], ["Evening 17-22", [17, 18, 19, 20, 21]]];
    const topCells = tcells.slice(0, 3).map((c) => c.cell);
    const cols = bands.map(([label, hs]) => {
      const rs = mine.filter((r) => r.cell && hs.includes(A.local(r, tz).h));
      return { label, parts: [...topCells.map((c) => ({ label: c, value: rs.filter((r) => r.cell === c).length })), { label: "Other cells", value: rs.filter((r) => !topCells.includes(r.cell!)).length }] };
    });
    const night = cols[0], nt = night.parts.reduce((s, p) => s + p.value, 0), nTop = [...night.parts].sort((a, b) => b.value - a.value)[0];
    if (nt) add("Location", "Cells by time band", `${nTop.label} carries ${pc(nTop.value, nt)}% of night-time located records`, (fr) => C.marimekko(cols, F(fr)));
  }

  // Devices: Gantt of IMEI periods, top IMEIs
  const im = A.imeiAnalysis(records, o);
  if (im.timeline.length) {
    const rows = im.timeline.slice(0, 10).map((t) => ({ label: dn(t.msisdn), spans: mergeSegments(t.segments).map((s, i) => ({ from: s.from, to: Math.max(s.to, s.from + 3_600_000), label: s.imei.slice(-6), highlight: i > 0 && t.changes > 0 && i === 1 })), milestones: t.segments.slice(1).map((s) => ({ at: s.from, label: `Switched to ${s.imei}` })) }));
    const most = im.timeline[0];
    add("Devices", "Device periods", most.changes ? `${dn(most.msisdn)} changed handset ${most.changes} time${most.changes === 1 ? "" : "s"}` : "No handset changes were recorded", (fr) => C.gantt(rows, F(fr, { fmtTime: (t: number) => localDate(t, tz) })));
    const counts = new Map<string, number>(); for (const r of records) if (r.imei) counts.set(r.imei, (counts.get(r.imei) || 0) + 1);
    const ti = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    add("Devices", "Top IMEIs", `IMEI ${ti[0][0]} appears in ${pc(ti[0][1], records.filter((r) => r.imei).length)}% of records with a handset`, (fr) => C.bladeBars(ti.map(([i, v]) => ({ label: i, value: v, drill: { imei: i } })), F(fr, { highlight: 0 })));
  }
  // Activity spans per target with a "today" line
  const spans = ov.targets.slice(0, 10).map((t) => { const rs = records.filter((r) => r.a === t.number); return { label: dn(t.number), spans: [{ from: Math.min(...rs.map((r) => r.ts)), to: Math.max(...rs.map((r) => r.ts)) }] }; });
  add("Time", "Activity spans", `Records cover ${days(ov.to! - ov.from!)} days for ${ov.targets.length} target number${ov.targets.length === 1 ? "" : "s"}`, (fr) => C.gantt(spans, F(fr, { today: Date.now(), todayLabel: "Today", fmtTime: (t: number) => localDate(t, tz) })));

  // Chronology
  const ev: { at: number; label: string; detail?: string; highlight?: boolean }[] = [{ at: ov.from!, label: "First record", detail: dn(records.reduce((a, r) => (r.ts < a.ts ? r : a)).a) }, { at: ov.to!, label: "Last record" }];
  if (daily.length) { const pi = dvals.indexOf(Math.max(...dvals)); ev.push({ at: Date.parse(daily[pi][0] + "T06:30:00Z"), label: "Peak day", detail: `${dvals[pi]} records`, highlight: true }); }
  const co = A.coLocation(records, o)[0];
  if (co) ev.push({ at: co.t1, label: "First possible meeting", detail: `${dn(co.a1)} and ${dn(co.a2)}` });
  const sw = im.timeline.find((t) => t.changes);
  if (sw) ev.push({ at: sw.segments[1].from, label: "Handset change", detail: dn(sw.msisdn) });
  const si = A.silentPeriods(records, o)[0];
  if (si) ev.push({ at: si.from, label: "Longest silence starts", detail: `${si.hours} hours` });
  add("Time", "Chronology", `${ev.length} key events between ${localDate(ov.from!, tz)} and ${localDate(ov.to!, tz)}`, (fr) => C.milestones(ev, F(fr, { fmtTime: (t: number) => localDate(t, tz) })));

  // Coverage (Harvey balls) per target
  const cov = ov.targets.slice(0, 8).map((t) => {
    const rs = records.filter((r) => r.a === t.number), q = (x: number) => Math.round((x / Math.max(1, rs.length)) * 4);
    return [rs.filter((r) => r.type !== "DATA").length ? 4 : 0, 0, q(rs.filter((r) => r.type === "DATA").length) || (rs.some((r) => r.type === "DATA") ? 1 : 0), q(rs.filter((r) => r.cell).length), q(rs.filter((r) => r.imei).length)];
  });
  add("Coverage", "Data coverage", `Cell IDs are present for ${pc(records.filter((r) => r.cell).length, total)}% of records; no subscriber details (SDR) are loaded`, (fr) => C.harvey(ov.targets.slice(0, 8).map((t) => dn(t.number)), ["CDR", "SDR", "IPDR", "Tower", "IMEI"], cov, F(fr, { notes: "SDR and IPDR are shown only when loaded; empty = not in this case" })));

  // Prioritisation: risk matrix and scorecard
  const common = new Set(A.commonNumbers(records, o).map((c) => c.b));
  const wl = new Set((ctx.watchlist || []).filter((w) => w.list === "black").map((w) => w.number));
  const coloc = new Set(A.coLocation(records, o).flatMap((c) => [c.a1, c.a2]));
  const allC = A.contacts(records, o).slice(0, 30);
  const maxT = Math.max(1, ...allC.map((c) => c.total));
  const risk = allC.slice(0, 12).map((c) => {
    const night = records.filter((r) => r.b === c.b && A.local(r, tz).h >= 22).length / Math.max(1, c.total);
    const signals = (common.has(c.b) ? 1 : 0) + (wl.has(c.b) ? 2 : 0) + (night > 0.3 ? 1 : 0) + (coloc.has(c.b) ? 1 : 0);
    return { label: dn(c.b), likelihood: 1 + Math.round((c.total / maxT) * 4), impact: Math.min(5, 1 + signals), drill: drillNum(c.b) };
  });
  add("Priorities", "Prioritisation", `${risk.filter((r) => r.likelihood * r.impact >= 12).length} contacts score high on both contact intensity and computed signals (indicative; analyst judgement required)`, (fr) => C.riskMatrix(risk, F(fr)));
  const sc = ov.targets.slice(0, 10).map((t) => {
    const rs = records.filter((r) => r.a === t.number), nShare = rs.filter((r) => { const h = A.local(r, tz).h; return h >= 22 || h < 6; }).length / Math.max(1, rs.length);
    const ch = im.timeline.find((x) => x.msisdn === t.number)?.changes || 0, wlh = rs.filter((r) => wl.has(r.b)).length;
    const signals = (nShare > thr ? 1 : 0) + (ch ? 1 : 0) + (wlh ? 2 : 0);
    const half = rs.length ? (rs[0].ts + rs[rs.length - 1].ts) / 2 : 0, a = rs.filter((r) => r.ts < half).length, b2 = rs.length - a;
    return { label: dn(t.number), cells: [rs.length, `${Math.round(nShare * 100)}%`, ch, wlh], status: (signals >= 2 ? "off" : signals === 1 ? "risk" : "on") as C.Status, trend: (b2 > a * 1.2 ? "up" : b2 < a * 0.8 ? "down" : "flat") as "up" | "down" | "flat", drill: { numbers: [t.number] } };
  });
  out.push({ id: "scorecard", group: "Priorities", eyebrow: "Per-target status", title: `${sc.filter((x) => x.status === "off").length} target number(s) show two or more review signals`, svg: C.scorecardTable(sc, ["Number", "Records", "Night share", "Handset changes", "Watchlist contacts"], { caption: "Status: green = few computed signals, amber = some, red = many. Signals are leads, not findings." }), html: true });
  const summ = A.summaryByNumber(records, o).slice(0, 12);
  const halfT = ov.from! + (ov.to! - ov.from!) / 2;
  const fin = summ.map((s) => { const rs = records.filter((r) => r.a === s.number); return [dn(s.number), s.records, s.callsOut, s.callsIn, s.smsOut + s.smsIn, Math.round(s.durTotal / 60), rs.filter((r) => r.ts >= halfT).length - rs.filter((r) => r.ts < halfT).length] as (string | number)[]; });
  out.push({ id: "fintable", group: "Priorities", eyebrow: "Per-number summary", title: `${fin[0] ? fin[0][0] : ""} has the most records (${fin[0]?.[1] ?? 0})`, svg: C.financialTable(["Number", "Records", "Calls out", "Calls in", "SMS", "Talk minutes", "Change, 2nd half vs 1st"], fin, { highlight: 0, totals: true, caption: "Negative changes are shown in brackets." }), html: true });

  // Flow and network
  const flow = callFlow(records, target, 7);
  if (flow.incoming.length || flow.outgoing.length) {
    const ti = flow.incoming.reduce((s, x) => s + x.value, 0), to = flow.outgoing.reduce((s, x) => s + x.value, 0);
    add("Network", "Call flow", `${dn(target)} received ${ti} and made ${to} calls and SMS`, (fr) => C.sankey(flow, F(fr, { label: (id: string) => (id.startsWith("+") ? dn(id) : id), drill: (id: string) => (id.startsWith("+") ? drillNum(id) : undefined) })));
  }
  const nodes = [...new Set([...ov.targets.slice(0, 4).map((t) => t.number), ...A.contacts(records, o).slice(0, 6).map((c) => c.b)])].slice(0, 9);
  const m = nodes.map((x) => nodes.map((y) => records.filter((r) => r.a === x && r.b === y).length));
  if (nodes.length >= 3) {
    let bi = 0, bj = 1, bv = -1; nodes.forEach((_, i) => nodes.forEach((_, j) => { if (i < j && m[i][j] + m[j][i] > bv) { bv = m[i][j] + m[j][i]; bi = i; bj = j; } }));
    add("Network", "Chord", `The strongest link is ${dn(nodes[bi])} and ${dn(nodes[bj])} (${bv} records)`, (fr) => C.chord(nodes, m, F(fr, { label: dn, highlight: bi })));
  }
  // Framework exhibits
  add("Method", "Investigation cycle", "Each finding goes through the same five-step loop before it is reported", (fr) => C.cycle(["Obtain lawfully", "Import and validate", "Analyse", "Verify with originals", "Report"], F(fr, { active: 3 })));
  add("Method", "Chain wheel", "Custody, audit and verification connect every step of the case", (fr) => C.cycle(["Legal basis", "Approval", "Evidence hash", "Analysis", "Audit log", "Report"], F(fr, { wheel: true, active: 0 })));
  add("Method", "Evidence strength", "Only the original operator records, with their certificate, are evidence; everything above is analysis", (fr) => C.pyramid([{ label: "Leads and hypotheses", detail: "Patterns to test; never findings on their own" }, { label: "Analytical patterns", detail: "Frequency, co-location, devices, timelines" }, { label: "Normalised records", detail: "Traceable to file and row, SHA-256 hashed" }, { label: "Original operator records", detail: "With the Section 63 BSA 2023 certificate", highlight: true }], F(fr)));
  void lookupNumber;
  return out;
}

function sumLast(a: number[], n: number) { return a.slice(-n).reduce((s, v) => s + v, 0); }
function median(a: number[]) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }
function mergeSegments(seg: { imei: string; from: number; to: number; n: number }[]) {
  const out: { imei: string; from: number; to: number }[] = [];
  for (const s of seg) { const p = out.find((x) => x.imei === s.imei && s.from - x.to < 6 * 3_600_000); if (p) p.to = Math.max(p.to, s.to); else out.push({ imei: s.imei, from: s.from, to: s.to }); }
  return out;
}
