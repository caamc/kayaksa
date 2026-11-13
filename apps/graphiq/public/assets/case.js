// One case: overview dashboard, import, records and search, analytics, link chart, timeline and
// map, reports, evidence, notes, audit and settings.
import { $, api, esc, html, raw, ico, toast, dialog, confirmDialog, setBusy, fmtDateTime, fmtBytes } from "/_shared/js/ui.js";
import * as E from "/vendor/graphiq-engine.mjs";
import { S, dn, fmtTs, statusBadge, crumbs, loading, go, isDark, verifyChain, auditTable } from "/assets/app.js";
import { run } from "/assets/engine.js";
import { exhibitCard, bind, download } from "/assets/chartkit.js";
import { importTab } from "/assets/import.js";
import { exportReport, REPORT_FORMATS } from "/assets/reports.js";

const TABS = [["overview", "Overview"], ["import", "Import"], ["search", "Records and search"], ["analytics", "Analytics"], ["graph", "Link chart"], ["map", "Timeline and map"], ["reports", "Reports"], ["evidence", "Evidence"], ["notes", "Notes and bookmarks"], ["audit", "Audit"], ["settings", "Settings"]];
export const C = { id: null, k: null, records: [], loadedFor: null, towers: [], watch: [], pendingFilter: null };
const ev = (action, detail) => api(`/api/cases/${C.id}/events`, { body: { action, detail } }).catch(() => {});
export const caseEvent = ev;
const TZ = () => C.k?.tz || "Asia/Kolkata";
export const ctxTheme = () => (isDark() ? "dark" : "light");

export async function refreshCase() {
  const r = await api(`/api/cases/${C.id}`);
  Object.assign(C, { k: r.case, members: r.members, imports: r.imports, counts: r.counts, me: r.me });
  return r;
}

/** Loads every record of the case into memory and into the analysis worker (paged, 5,000 at a time). */
export async function loadRecords(force = false, onProgress) {
  if (!force && C.loadedFor === C.id + ":" + C.k.records) return C.records;
  const out = [];
  let after = 0;
  for (;;) {
    const r = await api(`/api/cases/${C.id}/records?after=${after}&limit=5000${after ? "" : "&purpose=analysis"}`);
    for (const row of r.rows) { const o = {}; r.fields.forEach((f, i) => { if (row[i] !== null && row[i] !== undefined) o[f] = row[i]; }); out.push(o); }
    onProgress?.(out.length, r.total);
    if (!r.next) break;
    after = r.next;
  }
  C.records = out;
  await run("load", { records: out });
  C.loadedFor = C.id + ":" + C.k.records;
  const w = await api(`/api/cases/${C.id}/watchlist`).catch(() => ({ entries: [] }));
  C.watch = w.entries;
  const cells = [...new Set(out.flatMap((r) => [r.cell, r.lastCell]).filter(Boolean))];
  C.towers = [];
  for (let i = 0; i < cells.length; i += 1500) C.towers.push(...(await api(`/api/towers?cells=${encodeURIComponent(cells.slice(i, i + 1500).join(","))}`)).towers);
  return out;
}

export async function renderCase(view, id, tab) {
  if (C.id !== id) Object.assign(C, { id, records: [], loadedFor: null, pendingFilter: null });
  loading(view);
  await refreshCase();
  const k = C.k;
  crumbs([{ label: "Cases", href: "#/cases" }, { label: k.title, href: `#/case/${id}` }, { label: TABS.find((t) => t[0] === tab)?.[1] || "" }]);
  view.innerHTML = html`<div class="page-head"><div><span class="eyebrow">Case</span><h1>${k.title}</h1>
    <div class="legal-strip">${statusBadge(k.status)}<span><b>${k.legalBasisLabel}</b></span><span>Ref. <b>${k.refNo}</b> dated ${k.refDate}</span><span>Authority: ${k.authority}</span><span>Supervisor: ${k.supervisor}</span><span>${k.records.toLocaleString("en-IN")} records</span><span>Time zone ${k.tz}</span></div></div></div>
    ${k.status === "pending" ? raw(`<p class="note warn">This case is waiting for approval by a user with the Approver role. Data cannot be imported until it is approved (four-eyes rule).</p>`) : ""}
    ${k.status === "rejected" ? raw(`<p class="note danger">This case was rejected${k.decisionNote ? `: ${esc(k.decisionNote)}` : ""}. Open a new case with a corrected legal basis.</p>`) : ""}
    ${k.settings?.retentionDue ? raw(`<p class="note danger">The retention date (${esc(k.retainUntil)}) has passed. An Admin should securely delete this case or extend the date with a recorded reason.</p>`) : ""}
    <nav class="tabs" aria-label="Case sections">${TABS.map(([t, l]) => raw(`<a href="#/case/${esc(id)}/${t}" class="${t === tab ? "on" : ""}"${t === tab ? ' aria-current="page"' : ""}>${esc(l)}</a>`))}</nav><div id="tab"></div>`;
  const el = $("#tab");
  const fn = { overview, import: importTab, search, analytics, graph, map: mapTab, reports, evidence, notes, audit: auditTab, settings }[tab] || overview;
  await fn(el, C);
}

async function needData(el, text) {
  if (!C.k.records) { el.innerHTML = `<div class="empty"><h3>No records yet</h3><p>${C.k.status === "approved" ? `Import call records on the <a href="#/case/${C.id}/import">Import</a> tab.` : "Records can be imported once the case is approved."}</p></div>`; return false; }
  if (C.loadedFor !== C.id + ":" + C.k.records) {
    el.innerHTML = `<div class="loading"><span class="spinner"></span> <span id="lp">${esc(text || "Loading records for analysis…")}</span></div>`;
    await loadRecords(false, (n, t) => { const p = $("#lp"); if (p) p.textContent = `Loading records for analysis: ${n.toLocaleString("en-IN")} of ${t.toLocaleString("en-IN")}`; });
  }
  return true;
}

const drillTo = (f) => { C.pendingFilter = f; go(`#/case/${C.id}/search`); };
function drill(f) {
  if (f.day) { const [y, m, d] = f.day.split("-").map(Number); return drillTo({ from: E.zonedToUtc(y, m, d, 0, 0, 0, TZ()), to: E.zonedToUtc(y, m, d, 23, 59, 59, TZ()) + 999 }); }
  drillTo(f);
}
function mountExhibits(el, list) {
  el.innerHTML = "";
  for (const x of list) el.append(exhibitCard(x, { onDrill: drill, onExport: (kind, e) => ev("chart.exported", { chart: e.eyebrow, format: kind }) }));
}

// ------------------------------------------------------------------ overview / dashboard

async function overview(el) {
  const k = C.k;
  const workflow = { imported: C.imports.length ? 1 : 0, validated: C.imports.length ? 1 : 0, analysed: Math.min(1, (C.counts.analyses || 0) / 3), reviewed: Math.min(1, (C.counts.notes + C.counts.bookmarks) / 5), reported: C.counts.exports ? 1 : 0 };
  const intro = html`<div class="grid-2"><section class="card stack"><h2>Case details</h2><table class="table"><tbody>
      <tr><th>Legal basis</th><td>${k.legalBasisLabel}: ${k.legalText}</td></tr><tr><th>Reference</th><td>${k.refNo}, ${k.refDate}, ${k.authority}</td></tr>
      <tr><th>Opened</th><td>${k.createdByName}, ${fmtDateTime(k.createdAt)}</td></tr><tr><th>Approved</th><td>${k.decidedByName ? `${k.decidedByName}, ${fmtDateTime(k.decidedAt)}` : "Not yet"}</td></tr>
      <tr><th>Members</th><td>${C.members.map((m) => `${m.name} (${m.role})`).join(", ")}</td></tr><tr><th>Retention</th><td>${k.retainUntil || "No date set"}</td></tr></tbody></table></section>
    <section class="card stack"><h2>Imports</h2>${C.imports.length ? raw(`<div class="table-wrap"><table class="table"><thead><tr><th>File</th><th>Layout</th><th class="num">Records</th><th>SHA-256</th></tr></thead><tbody>${C.imports.map((i) => `<tr><td>${esc(i.file_name)}</td><td class="small">${esc(i.layout || "")}</td><td class="num">${i.records}</td><td class="code-hash">${esc((i.sha256 || "").slice(0, 16))}…</td></tr>`).join("")}</tbody></table></div>`) : raw(`<p class="muted">Nothing imported yet.</p>`)}</section></div>`;
  if (!C.k.records) { el.innerHTML = intro + `<div class="section" id="wf"></div>`; mountExhibits($("#wf"), [{ id: "wf", eyebrow: "Case workflow", title: "", svg: E.charts.chevrons([{ label: "Import", done: 0 }, { label: "Validate", done: 0 }, { label: "Analyse", done: 0 }, { label: "Review", done: 0 }, { label: "Report", done: 0 }], { eyebrow: "Case workflow", title: k.status === "approved" ? "The case is approved and ready for import" : "The case is waiting for approval", theme: ctxTheme(), width: 960 }) }]); return; }
  if (!(await needData(el))) return;
  const val = C.imports.reduce((a, i) => { const v = i.validation || {}; a.rows += v.rows || 0; a.imported += v.imported || 0; a.rejected += v.rejected || 0; a.duplicates += v.duplicates || 0; return a; }, { rows: 0, imported: 0, rejected: 0, duplicates: 0 });
  const flagged = C.records.filter((r) => C.watch.some((w) => w.list === "black" && (w.number === r.b || w.number === r.a))).length;
  const draw = async () => {
    const ex = await run("exhibits", { ctx: { tz: TZ(), theme: ctxTheme(), width: 760, validation: val.rows ? val : undefined, flagged, inScope: C.records.length, workflow, watchlist: C.watch } });
    const box = $("#dash"); if (!box) return;
    const cards = ex.find((x) => x.id === "cards");
    box.innerHTML = `<div class="kpis" id="kpis"></div><div class="section"><h2>Dashboard</h2><p class="lead muted">Headlines are computed from the case data. Click a mark to see the records behind it.</p><div class="exhibits" id="exs"></div></div>`;
    $("#kpis").innerHTML = cards.svg; bind($("#kpis"), drill);
    const pick = ["Case workflow", "Screening funnel", "Top contacts", "Daily volume", "Activity heat map", "Contact quadrant", "Device periods", "Chronology"];
    mountExhibits($("#exs"), ex.filter((x) => pick.some((p) => x.eyebrow.includes(p))).concat(ex.filter((x) => x.id === "scorecard")));
  };
  el.innerHTML = `<div id="dash"><div class="loading"><span class="spinner"></span> Building the dashboard…</div></div><div class="section">${intro}</div>`;
  await draw();
  const re = () => draw(); addEventListener("gq-theme", re); addEventListener("gq-leave", () => removeEventListener("gq-theme", re), { once: true });
}

// ------------------------------------------------------------------ records and search

const TYPE_LABEL = { MO: "Outgoing call", MT: "Incoming call", "SMS-MO": "SMS sent", "SMS-MT": "SMS received", MISSED: "Missed call", DATA: "Data session", OTHER: "Other" };

async function search(el) {
  const f0 = C.pendingFilter || {}; C.pendingFilter = null;
  const dt = (ms) => (ms ? E.localDateTime(ms, TZ()).slice(0, 16).replace(" ", "T") : "");
  const { filters } = await api(`/api/filters?case=${C.id}`);
  el.innerHTML = html`<section class="card stack"><div class="row between"><h2>Ask a question</h2><span class="ai-label">${S.me.ai ? "AI-assisted, verify before use" : "Rule-based reading"}</span></div>
    <div class="ask"><input class="input" id="q" placeholder="For example: outgoing calls from 9800000101 after 10pm in February 2026 longer than 5 minutes" aria-label="Question"><button class="btn btn-primary" id="askb">${ico("spark")} Turn into a filter</button></div>
    <p class="small muted" id="qnote">Kayak AI only ever proposes a filter; you see it below before anything is searched.</p></section>
  <form id="ff" class="card stack section"><h2>Filters</h2><div class="filter-form">
    <div class="field wide"><label for="numbers">Numbers (bulk: one per line or separated by commas)</label><textarea class="textarea" id="numbers" style="min-height:60px">${(f0.numbers || []).join("\n")}</textarea></div>
    <div class="field"><label for="side">Match numbers as</label><select class="select input" id="side"><option value="any">A or B party</option><option value="a"${f0.side === "a" ? " selected" : ""}>A party (target)</option><option value="b"${f0.side === "b" ? " selected" : ""}>B party</option></select></div>
    <div class="field"><label for="from">From</label><input class="input" type="datetime-local" id="from" value="${dt(f0.from)}"></div>
    <div class="field"><label for="to">To</label><input class="input" type="datetime-local" id="to" value="${dt(f0.to)}"></div>
    <div class="field"><label for="timeFrom">Time of day from</label><input class="input" type="time" id="timeFrom" value="${f0.timeFrom || ""}"></div>
    <div class="field"><label for="timeTo">Time of day to</label><input class="input" type="time" id="timeTo" value="${f0.timeTo || ""}"></div>
    <div class="field"><label for="durMin">Duration at least (s)</label><input class="input" type="number" min="0" id="durMin" value="${f0.durMin ?? ""}"></div>
    <div class="field"><label for="durMax">Duration at most (s)</label><input class="input" type="number" min="0" id="durMax" value="${f0.durMax ?? ""}"></div>
    <div class="field"><label for="imei">IMEI contains</label><input class="input" id="imei" value="${f0.imei || ""}"></div>
    <div class="field"><label for="imsi">IMSI contains</label><input class="input" id="imsi" value="${f0.imsi || ""}"></div>
    <div class="field"><label for="cell">Cell ID or CGI contains</label><input class="input" id="cell" value="${f0.cell || ""}"></div>
    <div class="field wide"><span class="label">Call types</span><div class="types">${E.CALL_TYPES.map((t) => raw(`<label><input type="checkbox" name="type" value="${t}"${(f0.types || []).includes(t) ? " checked" : ""}> ${esc(TYPE_LABEL[t])}</label>`))}</div></div>
    <div class="field wide"><span class="label">Days of the week</span><div class="types">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => raw(`<label><input type="checkbox" name="wd" value="${i}"${(f0.weekdays || []).includes(i) ? " checked" : ""}> ${d}</label>`))}</div></div>
  </div><div class="row between"><div class="row"><select class="select input" id="saved" style="min-width:200px" aria-label="Saved filters"><option value="">Saved filters…</option>${filters.map((f) => raw(`<option value="${esc(f.id)}">${esc(f.name)}</option>`))}</select><button type="button" class="btn btn-ghost btn-sm" id="savef">Save this filter</button></div>
    <div class="row"><button type="reset" class="btn btn-ghost">Clear</button><button class="btn btn-primary" type="submit">${ico("search")} Search</button></div></div></form>
  <div id="res" class="section"></div>`;
  const read = () => {
    const v = (id) => $("#" + id).value.trim();
    const ts = (s) => { if (!s) return undefined; const [d, t] = s.split("T"); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = (t || "0:0").split(":").map(Number); return E.zonedToUtc(y, m, dd, h, mi, 0, TZ()); };
    return E.cleanFilter({ numbers: v("numbers").split(/[\s,;]+/).filter(Boolean), side: v("side"), from: ts(v("from")), to: ts(v("to")), timeFrom: v("timeFrom"), timeTo: v("timeTo"), durMin: v("durMin"), durMax: v("durMax"), imei: v("imei"), imsi: v("imsi"), cell: v("cell"),
      types: [...el.querySelectorAll("[name=type]:checked")].map((x) => x.value), weekdays: [...el.querySelectorAll("[name=wd]:checked")].map((x) => +x.value) }, C.k.cc);
  };
  const fill = (f) => {
    $("#numbers").value = (f.numbers || []).join("\n"); $("#side").value = f.side || "any"; $("#from").value = dt(f.from); $("#to").value = dt(f.to);
    for (const id of ["timeFrom", "timeTo", "imei", "imsi", "cell"]) $("#" + id).value = f[id] || ""; $("#durMin").value = f.durMin ?? ""; $("#durMax").value = f.durMax ?? "";
    for (const x of el.querySelectorAll("[name=type]")) x.checked = (f.types || []).includes(x.value);
    for (const x of el.querySelectorAll("[name=wd]")) x.checked = (f.weekdays || []).includes(+x.value);
  };
  let offset = 0, last = null;
  const doSearch = async (source = "form") => {
    const f = read(); last = f;
    $("#res").innerHTML = `<div class="loading"><span class="spinner"></span> Searching…</div>`;
    try {
      const r = await api(`/api/cases/${C.id}/search`, { body: { filter: f, limit: 200, offset, source } });
      const rows = r.rows.map((row) => Object.fromEntries(r.fields.map((k, i) => [k, row[i]])));
      $("#res").innerHTML = html`<div class="row between"><p><b>${r.total.toLocaleString("en-IN")}</b> records match ${r.described}.</p><div class="row">
        ${C.me.canExport ? raw(`<button class="btn btn-ghost btn-sm" data-exp="csv">${ico("download")} CSV</button><button class="btn btn-ghost btn-sm" data-exp="xlsx">${ico("download")} XLSX</button>`) : ""}
        ${offset ? raw(`<button class="btn btn-ghost btn-sm" data-pg="-1">Previous</button>`) : ""}${offset + 200 < r.total ? raw(`<button class="btn btn-ghost btn-sm" data-pg="1">Next 200</button>`) : ""}</div></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Date and time</th><th>A party</th><th>Type</th><th>B party</th><th class="num">Duration</th><th>Cell</th><th>IMEI</th><th>Source</th><th></th></tr></thead><tbody>
        ${rows.map((x) => raw(`<tr><td>${esc(fmtTs(x.ts, TZ()))}</td><td class="mono">${esc(dn(x.a))}</td><td>${esc(TYPE_LABEL[x.type] || x.type)}</td><td class="mono"><button class="numlink" data-num="${esc(x.b || "")}">${esc(dn(x.b))}</button></td><td class="num">${esc(E.fmtDuration(x.dur))}</td><td class="mono small">${esc(x.cell || "")}</td><td class="mono small">${esc(x.imei || "")}</td><td class="small">${esc(x.src ? `${x.src}:${x.row}` : "")}</td><td>${C.me.canAnnotate ? `<button class="btn btn-quiet btn-sm" data-bm="${x.id}" aria-label="Bookmark this record">${ico("pin")}</button>` : ""}</td></tr>`))}
        </tbody></table></div>`;
      $("#res").onclick = async (e) => {
        const pg = e.target.closest("[data-pg]"); if (pg) { offset = Math.max(0, offset + 200 * +pg.dataset.pg); return doSearch(); }
        const n = e.target.closest("[data-num]"); if (n?.dataset.num) { fill({ numbers: [n.dataset.num] }); offset = 0; return doSearch(); }
        const bm = e.target.closest("[data-bm]"); if (bm) return bookmark({ recordId: +bm.dataset.bm });
        const ex = e.target.closest("[data-exp]"); if (ex) return exportRows(last, ex.dataset.exp);
      };
    } catch (err) { $("#res").innerHTML = `<p class="note danger">${esc(err.message)}</p>`; }
  };
  $("#ff").onsubmit = (e) => { e.preventDefault(); offset = 0; doSearch(); };
  $("#ff").onreset = () => setTimeout(() => fill({}), 0);
  $("#askb").onclick = async () => {
    const q = $("#q").value.trim(); if (!q) return;
    setBusy($("#askb"), true, "Reading…");
    try { const r = await api(`/api/cases/${C.id}/ai/query`, { body: { q } }); fill(r.filter); $("#qnote").innerHTML = `<span class="ai-label">${esc(r.label)}</span> Proposed filter: <b>${esc(r.described)}</b>. ${esc(r.note || "")} Check the filters below, then search.`; }
    catch (err) { toast(err.message, "err"); }
    setBusy($("#askb"), false);
  };
  $("#saved").onchange = (e) => { const f = filters.find((x) => x.id === e.target.value); if (f) { fill(f.filter); offset = 0; doSearch("saved"); } };
  $("#savef").onclick = async () => {
    const name = prompt("Name this filter"); if (!name) return;
    try { await api("/api/filters", { body: { name, caseId: C.id, filter: read() } }); toast("Filter saved."); } catch (err) { toast(err.message, "err"); }
  };
  if (Object.keys(f0).length) doSearch("drill");
}

async function exportRows(filter, fmt) {
  const r = await api(`/api/cases/${C.id}/search`, { body: { filter, limit: 1000, offset: 0, source: "export" } });
  const head = ["Date and time", "A party", "Type", "B party", "Duration (s)", "Cell", "Last cell", "IMEI", "IMSI", "Source file", "Row"];
  const rows = r.rows.map((row) => { const x = Object.fromEntries(r.fields.map((k, i) => [k, row[i]])); return [fmtTs(x.ts, TZ()), x.a, x.type, x.b || "", x.dur, x.cell || "", x.lastCell || "", x.imei || "", x.imsi || "", x.src || "", x.row ?? ""]; });
  const note = [["Kayak GraphIQ search export - " + r.described], [E.DISCLAIMER], []];
  if (fmt === "csv") download(new Blob([E.toCsv([...note, head, ...rows])], { type: "text/csv" }), "graphiq-search.csv");
  else download(new Blob([await run("xlsx", { sheets: [{ name: "Records", rows: [head, ...rows] }, { name: "About", rows: [["Kayak GraphIQ search export"], [r.described], [E.DISCLAIMER]] }] })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "graphiq-search.xlsx");
  ev("records.exported", { format: fmt, records: rows.length, filter: r.described });
  if (r.total > 1000) toast("The first 1,000 records were exported. Narrow the filter or use a report for more.");
}

async function bookmark({ recordId, number }) {
  await dialog({ title: "Bookmark as evidence", body: `<div class="field"><label for="bt">Tag</label><input class="input" id="bt" value="Evidence" list="tags"><datalist id="tags"><option>Evidence</option><option>Meeting point</option><option>Key contact</option><option>Device change</option><option>To verify</option></datalist></div><div class="field"><label for="bn">Note</label><textarea class="textarea" id="bn" style="min-height:70px"></textarea></div>`,
    actions: [{ id: "x", label: "Cancel" }, { id: "ok", label: "Bookmark", kind: "primary", handler: async (d) => { await api(`/api/cases/${C.id}/bookmarks`, { body: { recordId, number, tag: d.querySelector("#bt").value, note: d.querySelector("#bn").value } }); toast("Bookmarked."); } }] });
}

// ------------------------------------------------------------------ analytics

const T = (cols, rows, numeric = []) => `<div class="table-wrap"><table class="table"><thead><tr>${cols.map((c, i) => `<th${numeric.includes(i) ? ' class="num"' : ""}>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((v, i) => `<td${numeric.includes(i) ? ' class="num"' : ""}>${v && v.__raw ? v.html : esc(v)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${cols.length}" class="muted">None found.</td></tr>`}</tbody></table></div>`;
const N = (n) => raw(`<button class="numlink mono" data-num="${esc(n)}">${esc(dn(n))}</button>`);

async function analytics(el) {
  if (!(await needData(el))) return;
  const s0 = C.k.settings?.analytics || {};
  el.innerHTML = html`<details class="card" style="margin-bottom:18px"><summary><b>Settings</b> <span class="muted small">night hours, short calls, meeting window and more</span></summary><form id="opt" class="filter-form" style="margin-top:12px">
    ${[["nightStart", "Night starts (hour)", 22], ["nightEnd", "Night ends (hour)", 6], ["businessStart", "Business hours start", 9], ["businessEnd", "Business hours end", 18], ["shortSec", "Short call up to (s)", 10], ["repeatN", "Repeated: calls", 3], ["repeatWindowMin", "Repeated: within (min)", 60], ["colocWindowMin", "Meeting window (min)", 30], ["silentHours", "Silent period (hours)", 24], ["circularWindowH", "Circular chain within (hours)", 24], ["zThreshold", "Anomaly z-score", 2.5]].map(([k, l, d]) => raw(`<div class="field"><label for="o-${k}">${esc(l)}</label><input class="input" type="number" step="any" id="o-${k}" data-k="${k}" value="${s0[k] ?? d}"></div>`))}
    <div class="field"><label for="o-target">Focus number for exhibits</label><select class="select input" id="o-target"><option value="">Busiest target</option>${[...new Set(C.records.map((r) => r.a))].slice(0, 200).map((a) => raw(`<option value="${esc(a)}">${esc(dn(a))}</option>`))}</select></div>
    <div class="field"><button class="btn btn-primary" type="submit">Recalculate</button></div></form></details><div id="an"><div class="loading"><span class="spinner"></span> Analysing ${C.records.length.toLocaleString("en-IN")} records…</div></div>`;
  const draw = async () => {
    const opts = { tz: TZ() };
    for (const i of el.querySelectorAll("[data-k]")) opts[i.dataset.k] = Number(i.value);
    const [A, co, ex] = await Promise.all([run("analyse", { opts, watchlist: C.watch }), run("coLocation", { opts, towers: C.towers }), run("exhibits", { ctx: { tz: TZ(), theme: ctxTheme(), width: 760, target: $("#o-target").value || undefined, watchlist: C.watch, nightThreshold: 0.25 } })]);
    ev("analytics.viewed", { records: C.records.length });
    const t = (ms) => fmtTs(ms, TZ());
    const sec = (id, title, lead, body) => `<section class="section" id="s-${id}"><h2>${esc(title)}</h2>${lead ? `<p class="lead muted">${esc(lead)}</p>` : ""}${body}</section>`;
    const sum = A.summary;
    const groups = [...new Set(ex.map((x) => x.group))];
    $("#an").innerHTML = `<p class="verify-note">Every result below is an analytical lead computed from the loaded records. Verify against the original operator records before relying on it.</p>
      <nav class="pill-row" style="margin:14px 0" aria-label="Jump to">${["summary:Summary", "exhibits:Exhibits", "contacts:Contacts", "time:Time patterns", "patterns:Call patterns", "relations:Relationships", "devices:Devices", "location:Towers and meetings", "roaming:Roaming and ISD", "lists:Watchlist", "anomalies:Anomalies", "dump:Tower dump"].map((x) => { const [a, b] = x.split(":"); return `<a class="chip" href="#s-${a}" onclick="event.preventDefault();document.getElementById('s-${a}').scrollIntoView()">${b}</a>`; }).join("")}</nav>
      ${sec("summary", "Per-number summary", "Calls and SMS in and out, talk time and contacts for each target number.", E.charts.financialTable(["Number", "Records", "Calls out", "Calls in", "SMS out", "SMS in", "Missed", "Talk minutes", "Avg call (s)", "Longest (s)", "Contacts", "In/out ratio"], sum.map((s) => [dn(s.number), s.records, s.callsOut, s.callsIn, s.smsOut, s.smsIn, s.missed, Math.round(s.durTotal / 60), s.durAvg, s.durMax, s.uniqueContacts, s.inOutRatio ?? ""]), { highlight: 0, totals: false, drill: (i) => ({ numbers: [sum[i].number] }) }) + T(["Number", "First record", "Last record", "Active days", "Handsets", "Cells", "Most contacted", "Least contacted"], sum.map((s) => [N(s.number), t(s.first), t(s.last), s.activeDays, s.imeis, s.cells, s.mostContacted.slice(0, 3).map((x) => `${dn(x.b)} (${x.n})`).join(", "), s.leastContacted.slice(0, 3).map((x) => `${dn(x.b)} (${x.n})`).join(", ")])))}
      <section class="section" id="s-exhibits"><h2>Exhibits</h2><p class="lead muted">Charts in Kayak exhibit style. Headlines are generated from the numbers. Click a mark to drill down; download any chart as SVG or PNG.</p><div class="pill-row" id="exg">${["All", ...groups].map((g, i) => `<button class="chip btnlike${i ? "" : " on"}" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div><div class="exhibits section" id="exs"></div></section>
      ${sec("contacts", "Contacts", "Every A and B pair, most frequent first.", T(["A party", "B party", "Total", "Out", "In", "SMS out", "SMS in", "Missed", "Talk time", "Days", "First", "Last"], A.contacts.slice(0, 300).map((c) => [N(c.a), N(c.b), c.total, c.out, c.in, c.smsOut, c.smsIn, c.missed, E.fmtDuration(c.dur), c.days, t(c.first), t(c.last)]), [2, 3, 4, 5, 6, 7, 9]))}
      ${sec("time", "Time patterns", "", `<div class="grid-3">${[["Day", A.time.day], ["Night", A.time.night], ["Weekdays", A.time.weekdays], ["Weekends", A.time.weekend], ["Business hours", A.time.business], ["Outside business hours", A.time.outside]].map(([l, v]) => `<div class="card kpi"><b>${v.toLocaleString("en-IN")}</b><span>${l} (${A.overview.records ? Math.round((v / A.overview.records) * 100) : 0}%)</span></div>`).join("")}</div>
        <div class="grid-2 section"><div>${T(["Peak hour", "Records"], A.time.peakHours.map((p) => [`${String(p.h).padStart(2, "0")}:00`, p.n]), [1])}</div><div>${T(["Month", "Records"], Object.entries(A.time.monthly).sort().map(([m, n]) => [m, n]), [1])}</div></div>
        <h3 class="section">First and last record of each day</h3>${T(["Number", "Day", "Records", "First", "First with", "First cell", "Last", "Last with", "Last cell"], A.firstLast.slice(0, 300).map((x) => [N(x.a), x.day, x.n, t(x.first).slice(11), dn(x.firstB), x.firstCell, t(x.last).slice(11), dn(x.lastB), x.lastCell]), [2])}`)}
      ${sec("patterns", "Call patterns", "", `<div class="grid-2"><div><h3>Short calls (${A.short.count})</h3>${T(["A party", "B party", "Short calls"], A.short.pairs.slice(0, 50).map((x) => [N(x.a), N(x.b), x.n]), [2])}</div><div><h3>One-way contact</h3>${T(["A party", "B party", "Direction", "Records"], A.oneWay.slice(0, 50).map((x) => [N(x.a), N(x.b), x.direction, x.n]), [3])}</div>
        <div><h3>Repeated calls in a short window</h3>${T(["A party", "B party", "Most in window", "Window start", "Total"], A.repeated.slice(0, 50).map((x) => [N(x.a), N(x.b), x.max, t(x.at), x.total]), [2, 4])}</div><div><h3>Overlapping calls (possible conference or call waiting)</h3>${T(["Number", "First call with", "Second call with", "At", "Overlap (s)"], A.overlapping.slice(0, 50).map((x) => [N(x.a), N(x.b1), N(x.b2), t(x.t2), x.overlapSec]), [4])}</div>
        <div><h3>New numbers (first contact in the last 7 days of data)</h3>${T(["A party", "New contact", "First contact", "Records"], A.newNumbers.slice(0, 50).map((x) => [N(x.a), N(x.b), t(x.first), x.n]), [3])}</div><div><h3>Silent periods</h3>${T(["Number", "From", "To", "Hours"], A.silent.slice(0, 50).map((x) => [N(x.a), t(x.from), t(x.to), x.hours]), [3])}</div></div>`)}
      ${sec("relations", "Relationships", "", `<div class="grid-2"><div><h3>Numbers common to two or more targets</h3>${T(["Number", "Targets", "Records"], A.common.slice(0, 80).map((x) => [N(x.b), x.targets.map(dn).join(", "), x.n]), [2])}</div><div><h3>Target to target</h3>${T(["A party", "B party", "Total", "Talk time", "First", "Last"], A.targetToTarget.map((x) => [N(x.a), N(x.b), x.total, E.fmtDuration(x.dur), t(x.first), t(x.last)]), [2])}</div>
        <div><h3>Circular communication (A to B to C to A)</h3>${T(["Chain", "Started", "Completed"], A.circular.map((x) => [x.path.map(dn).join(" > "), t(x.start), t(x.end)]))}</div></div>`)}
      ${sec("devices", "Devices and identities", "TAC is the first 8 digits of the IMEI; looking up the handset model needs the GSMA TAC database, which is licensed and not bundled.", `<div class="grid-2"><div><h3>One IMEI, several SIMs</h3>${T(["IMEI", "TAC", "SIMs"], A.imei.oneImeiManySims.map((x) => [x.imei, x.tac, x.sims.map((s) => `${dn(s.id)} (${t(s.first).slice(0, 10)} to ${t(s.last).slice(0, 10)})`).join("; ")]))}</div><div><h3>One SIM, several handsets</h3>${T(["Number", "IMEIs"], A.imei.oneSimManyImeis.map((x) => [N(x.msisdn), x.imeis.map((s) => `${s.id} (${t(s.first).slice(0, 10)} to ${t(s.last).slice(0, 10)})`).join("; ")]))}</div></div>
        <h3 class="section">Device-change timeline</h3>${T(["Number", "IMEI", "From", "To", "Records"], A.imei.timeline.flatMap((x) => x.segments.slice(0, 30).map((s) => [N(x.msisdn), s.imei, t(s.from), t(s.to), s.n])).slice(0, 300), [4])}
        <h3 class="section">IMSI, number and IMEI mapping</h3>${T(["Number", "IMSI", "Network (from IMSI)", "IMEI", "Records", "First", "Last"], A.imei.mapping.slice(0, 300).map((x) => { const n = E.imsiNetwork(x.imsi); return [N(x.msisdn), x.imsi, n ? `${n.mcc}-${n.mnc}${n.operator ? ` ${n.operator} ${n.circle}` : ""}` : "", x.imei, x.n, t(x.first), t(x.last)]; }), [4])}`)}
      ${sec("location", "Towers and possible meeting points", "Likely day and night locations are the most used cells in those hours. Two numbers at the same cell (or, with the tower master, the same mast) within the window are possible meeting points: a cell can cover several kilometres, so this is not proof of a meeting.", `<div class="grid-2"><div><h3>Likely day and night locations</h3>${T(["Number", "Day cell", "Night cell", "Distinct cells"], A.towers.byNumber.map((x) => [N(x.a), x.likelyDay, x.likelyNight, x.distinct]), [3])}</div><div><h3>Most common movements</h3>${T(["Number", "From", "To", "Times"], A.towers.transitions.slice(0, 50).map((x) => [N(x.a), x.from, x.to, x.n]), [3])}</div></div>
        <h3 class="section">Possible meeting points${C.towers.length ? " (tower master: matching by mast)" : ""}</h3>${T(["Number 1", "Number 2", "Cell or site", "Time 1", "Time 2", "Gap (min)", "Observations", ""], co.slice(0, 200).map((x) => [N(x.a1), N(x.a2), x.cell, t(x.t1), t(x.t2), x.gapMin, x.n, C.me.canAnnotate ? raw(`<button class="btn btn-quiet btn-sm" data-bmn="${esc(x.a2)}" title="Bookmark">${ico("pin")}</button>`) : ""]), [5, 6])}`)}
      ${sec("roaming", "Roaming and international calls", "", `<div class="grid-2"><div>${T(["Number", "Network or circle", "Records", "First", "Last"], A.roaming.roaming.map((x) => [N(x.a), x.network, x.n, t(x.first), t(x.last)]), [2])}</div><div>${T(["Country", "Code", "Numbers", "Records", "Talk time"], A.roaming.isd.map((x) => [x.country, "+" + x.code, x.numbers.map(dn).join(", "), x.n, E.fmtDuration(x.dur)]), [3])}</div></div>`)}
      ${sec("lists", "Watchlist hits", "Numbers on this case's black list (of interest) and white list (known and benign, such as service numbers). Manage the lists in Settings.", T(["Number", "List", "Label", "Records", "First", "Last", "Targets in contact"], A.watchlist.map((x) => [N(x.number), x.list === "black" ? "Black list" : "White list", x.label, x.n, t(x.first), t(x.last), x.targets.map(dn).join(", ")]), [3]))}
      ${sec("anomalies", "Anomalies", "Days whose volume is far from the number's own average (z-score), and night hours that the number rarely uses.", `<div class="grid-2"><div>${T(["Number", "Day", "Records", "Usual", "z"], A.anomalies.days.map((x) => [N(x.a), x.day, x.n, x.mean, x.z]), [2, 3, 4])}</div><div>${T(["Number", "Hour", "Records", "Share of its activity"], A.anomalies.hours.map((x) => [N(x.a), `${String(x.hour).padStart(2, "0")}:00`, x.n, x.share + "%"]), [2])}</div></div>`)}
      ${sec("dump", "Tower dump analysis", "Numbers seen at two or more cells. Import each tower dump as its own file; a number common to several dumps or towers is a lead.", T(["Number", "Cells", "Records"], A.towerDump.slice(0, 200).map((x) => [N(x.number), x.groups.join(", "), x.n]), [2]))}`;
    const showG = (g) => { mountExhibits($("#exs"), ex.filter((x) => g === "All" || x.group === g)); for (const b of el.querySelectorAll("[data-g]")) b.classList.toggle("on", b.dataset.g === g); };
    showG("All");
    $("#exg").onclick = (e) => { const b = e.target.closest("[data-g]"); if (b) showG(b.dataset.g); };
  };
  el.onclick = (e) => { const n = e.target.closest("[data-num]"); if (n && !e.target.closest(".exhibit")) drillTo({ numbers: [n.dataset.num] }); const b = e.target.closest("[data-bmn]"); if (b) bookmark({ number: b.dataset.bmn }); };
  $("#opt").onsubmit = async (e) => { e.preventDefault(); $("#an").innerHTML = `<div class="loading"><span class="spinner"></span> Recalculating…</div>`; const a = {}; for (const i of el.querySelectorAll("[data-k]")) a[i.dataset.k] = Number(i.value); if (C.me.canAnnotate) api(`/api/cases/${C.id}`, { method: "PATCH", body: { settings: { analytics: a } } }).catch(() => {}); await draw(); };
  await draw();
  const re = () => draw(); addEventListener("gq-theme", re); addEventListener("gq-leave", () => removeEventListener("gq-theme", re), { once: true });
}

// ------------------------------------------------------------------ link chart

let cyMod;
async function graph(el) {
  if (!(await needData(el))) return;
  cyMod ||= (await import("/vendor/cytoscape.esm.min.mjs")).default;
  el.innerHTML = html`<div class="graph-wrap"><div><div class="row" style="margin-bottom:10px">
      <input class="input" id="gs" placeholder="Find a number" style="max-width:220px" aria-label="Find a number">
      <label class="small">Minimum contacts <input class="input" type="number" id="gmin" value="2" min="1" style="width:70px;min-height:36px"></label>
      <label class="small">Size by <select class="select" id="gsize"><option value="degree">Degree</option><option value="betweenness">Betweenness</option><option value="closeness">Closeness</option><option value="calls">Calls</option></select></label>
      <label class="small">Layout <select class="select" id="glay"><option value="cose">Force</option><option value="concentric">Concentric</option><option value="circle">Circle</option><option value="breadthfirst">Tree</option></select></label>
      <label class="check small"><input type="checkbox" id="gsms" checked> SMS</label><label class="check small"><input type="checkbox" id="gwhite" checked> Hide white list</label>
      <button class="btn btn-ghost btn-sm" id="gpng">${ico("download")} PNG</button><button class="btn btn-ghost btn-sm" id="greset">Show all</button></div>
    <div id="cy" role="img" aria-label="Link chart of numbers and their contacts"></div><p class="small muted" style="margin-top:6px">Nodes are numbers (targets outlined in saffron), edges are contacts weighted by calls and SMS. Colours are communities found by the Louvain method. Double-click a node to expand its network; click to see its measures.</p></div>
    <aside class="graph-side"><div class="card stack" id="gdet"><h3>Network</h3><p class="muted" id="gsum">Building…</p></div><div class="card stack"><h3>Most central</h3><div id="gtop"></div></div></aside></div>`;
  let cy, G;
  const palette = ["#17807E", "#2D6A9F", "#6E8A3A", "#5E4B78", "#B4472F", "#5DB2AB", "#9C630E", "#1F4B5F"];
  const draw = async (sub) => {
    const white = new Set($("#gwhite").checked ? C.watch.filter((w) => w.list === "white").map((w) => w.number) : []);
    G = sub || (await run("graph", { opts: { minContacts: +$("#gmin").value || 1, includeSms: $("#gsms").checked, maxNodes: 600 } }));
    const nodes = G.nodes.filter((n) => !white.has(n.id)), ids = new Set(nodes.map((n) => n.id));
    const by = $("#gsize").value, mx = Math.max(1e-9, ...nodes.map((n) => n[by]));
    cy?.destroy();
    const dark = isDark();
    cy = cyMod({ container: $("#cy"), wheelSensitivity: 0.25, elements: [
      ...nodes.map((n) => ({ data: { id: n.id, label: dn(n.id), size: 16 + 44 * Math.sqrt(n[by] / mx), color: palette[(n.community - 1) % palette.length], target: n.target ? 1 : 0 } })),
      ...G.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ data: { id: e.source + "~" + e.target, source: e.source, target: e.target, w: Math.min(10, 1 + Math.log2(e.weight)), calls: e.calls, sms: e.sms } })),
    ], style: [
      { selector: "node", style: { "background-color": "data(color)", width: "data(size)", height: "data(size)", label: "data(label)", "font-size": 9, color: dark ? "#E8F0EF" : "#0E2F3C", "text-valign": "bottom", "text-margin-y": 3, "min-zoomed-font-size": 7 } },
      { selector: "node[target = 1]", style: { "border-width": 4, "border-color": "#EE9B1E", "font-weight": "bold", "font-size": 11 } },
      { selector: "edge", style: { width: "data(w)", "line-color": dark ? "#2A5566" : "#B9C9CF", "curve-style": "haystack", opacity: 0.8 } },
      { selector: ".dim", style: { opacity: 0.12 } }, { selector: "node:selected", style: { "border-width": 5, "border-color": "#EE9B1E" } },
    ], layout: { name: $("#glay").value, animate: false, nodeRepulsion: 9000, idealEdgeLength: 70, padding: 20 } });
    $("#gsum").textContent = `${nodes.length} numbers, ${cy.edges().length} links, ${G.communities} communities.`;
    const topBy = (k) => [...nodes].sort((a, b) => b[k] - a[k]).slice(0, 5).map((n) => `<li><button class="numlink" data-gn="${esc(n.id)}">${esc(dn(n.id))}</button> <span class="muted small">${k} ${n[k]}</span></li>`).join("");
    $("#gtop").innerHTML = `<p class="small muted">Degree</p><ol>${topBy("degree")}</ol><p class="small muted">Betweenness (brokers)</p><ol>${topBy("betweenness")}</ol><p class="small muted">Closeness</p><ol>${topBy("closeness")}</ol>`;
    cy.on("tap", "node", (e) => detail(e.target.id()));
    cy.on("dbltap", "node", async (e) => draw(await run("ego", { graph: G, id: e.target.id(), hops: 2 })));
  };
  const detail = (id) => {
    const n = G.nodes.find((x) => x.id === id); if (!n) return;
    cy.elements().removeClass("dim"); const nb = cy.getElementById(id).closedNeighborhood(); cy.elements().not(nb).addClass("dim");
    const info = E.lookupNumber(id);
    $("#gdet").innerHTML = html`<h3>${dn(id)}</h3><p class="small muted">${info.kind}${info.operator ? `, ${info.operator} ${info.circle} (original series)` : ""}${info.country && info.country !== "India" ? `, ${info.country}` : ""}</p>
      <table class="table"><tbody><tr><th>Target</th><td>${n.target ? "Yes" : "No"}</td></tr><tr><th>Contacts (degree)</th><td>${n.degree}</td></tr><tr><th>Betweenness</th><td>${n.betweenness}</td></tr><tr><th>Closeness</th><td>${n.closeness}</td></tr><tr><th>Calls / SMS</th><td>${n.calls} / ${n.sms}</td></tr><tr><th>Talk time</th><td>${E.fmtDuration(n.dur)}</td></tr><tr><th>Community</th><td>${n.community}</td></tr></tbody></table>
      <div class="row"><button class="btn btn-ghost btn-sm" data-gsearch="${id}">Show records</button>${C.me.canAnnotate ? raw(`<button class="btn btn-ghost btn-sm" data-gbm="${esc(id)}">Bookmark</button>`) : ""}</div>`;
  };
  el.onclick = (e) => { const a = e.target.closest("[data-gn]"); if (a) { cy.getElementById(a.dataset.gn).select(); cy.center(cy.getElementById(a.dataset.gn)); detail(a.dataset.gn); } const s = e.target.closest("[data-gsearch]"); if (s) drillTo({ numbers: [s.dataset.gsearch] }); const b = e.target.closest("[data-gbm]"); if (b) bookmark({ number: b.dataset.gbm }); };
  for (const id of ["gmin", "gsize", "glay", "gsms", "gwhite"]) $("#" + id).onchange = () => draw();
  $("#greset").onclick = () => draw();
  $("#gs").onkeydown = (e) => { if (e.key !== "Enter") return; const q = E.normaliseMsisdn(e.target.value).value || e.target.value; const n = cy.getElementById(q); if (n.length) { n.select(); cy.animate({ center: { eles: n }, zoom: 1.6 }); detail(q); } else toast("That number is not in the chart (try a lower minimum).", "err"); };
  $("#gpng").onclick = () => { fetch(cy.png({ full: true, scale: 2, bg: isDark() ? "#0C2733" : "#FFFFFF" })).then((r) => r.blob()).then((b) => download(b, "graphiq-link-chart.png")); ev("chart.exported", { chart: "link chart", format: "png" }); };
  await draw();
  ev("graph.viewed", { nodes: G.nodes.length });
}

// ------------------------------------------------------------------ timeline and map

async function mapTab(el) {
  if (!(await needData(el))) return;
  const targets = [...new Set(C.records.map((r) => r.a))];
  const tw = E.towerIndex(C.towers);
  const located = (r) => (r.lat != null && r.lon != null ? { lat: r.lat, lon: r.lon, address: "" } : tw(r.cell));
  el.innerHTML = html`<section class="card stack"><div class="row between"><h2>Timeline</h2><label class="small">Number <select class="select" id="tnum">${targets.map((a) => raw(`<option value="${esc(a)}">${esc(dn(a))}</option>`))}</select></label></div><div id="tl"></div></section>
    <section class="card stack section"><div class="row between"><h2>Map</h2><div class="row"><span class="small muted" id="mcount"></span>${C.me.canExport ? raw(`<button class="btn btn-ghost btn-sm" id="kml">${ico("download")} KML</button>`) : ""}</div></div>
    ${C.towers.length || C.records.some((r) => r.lat != null) ? raw(`<div id="map" role="region" aria-label="Map of cells and movement"></div><p class="small muted">Map data © OpenStreetMap contributors. Cell positions are the mast location from the tower master, not the handset's position.</p>`) : raw(`<p class="note">No coordinates yet. Import a tower master on <a href="#/reference">Towers and reference</a> (cell ID, latitude, longitude), or import records that include latitude and longitude.</p>`)}</section>`;
  let map, layer;
  const draw = () => {
    const a = $("#tnum").value, rs = C.records.filter((r) => r.a === a).sort((x, y) => x.ts - y.ts);
    // Swimlane timeline: one lane per call type, a tick per record
    const W = 1100, lanes = ["MO", "MT", "SMS-MO", "SMS-MT", "MISSED", "DATA", "OTHER"].filter((t) => rs.some((r) => r.type === t)), H = 40 + lanes.length * 34 + 30;
    const lo = rs[0]?.ts || 0, hi = rs[rs.length - 1]?.ts || 1, X = (t) => 130 + ((t - lo) / Math.max(1, hi - lo)) * (W - 150);
    const th = E.charts.THEMES[ctxTheme()];
    let s = `<svg class="swim" viewBox="0 0 ${W} ${H}" role="img" aria-label="Timeline of records for ${esc(dn(a))}" font-family="Archivo, Arial, sans-serif"><rect width="${W}" height="${H}" fill="${th.bg}"/>`;
    for (let i = 0; i <= 5; i++) { const tt = lo + ((hi - lo) * i) / 5; s += `<line x1="${X(tt)}" x2="${X(tt)}" y1="20" y2="${H - 24}" stroke="${th.grid}"/><text x="${X(tt)}" y="${H - 8}" font-size="10" fill="${th.muted}" text-anchor="${i === 5 ? "end" : "middle"}">${esc(fmtTs(tt, TZ()).slice(0, 10))}</text>`; }
    lanes.forEach((ty, i) => { const y = 40 + i * 34; s += `<text x="10" y="${y + 4}" font-size="11" fill="${th.text}">${esc(TYPE_LABEL[ty])}</text><line x1="130" x2="${W - 20}" y1="${y}" y2="${y}" stroke="${th.grid}"/>`;
      for (const r of rs.filter((x) => x.type === ty).slice(0, 4000)) s += `<rect x="${X(r.ts) - 1}" y="${y - 9}" width="2.5" height="18" fill="${th.series[i % 4]}" class="gq-mark" tabindex="-1" data-tip="${esc(`${fmtTs(r.ts, TZ())} ${TYPE_LABEL[r.type]} ${dn(r.b)} ${E.fmtDuration(r.dur)}${r.cell ? ` cell ${r.cell}` : ""}`)}" data-drill="${esc(JSON.stringify({ numbers: [r.b] }))}"/>`; });
    $("#tl").innerHTML = s + "</svg>";
    bind($("#tl"), drill);
    if (!$("#map") || !window.L) return;
    if (!map) { map = L.map("map", { scrollWheelZoom: false }); L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map); }
    layer?.remove(); layer = L.layerGroup().addTo(map);
    const pts = [], seen = new Map();
    for (const r of rs) { const p = located(r); if (!p) continue; pts.push([p.lat, p.lon]); const k = r.cell || `${p.lat},${p.lon}`; const e = seen.get(k) || { p, n: 0, first: r.ts, last: r.ts, cell: r.cell }; e.n++; e.last = r.ts; seen.set(k, e); }
    for (const e of seen.values()) L.circleMarker([e.p.lat, e.p.lon], { radius: 5 + Math.min(14, Math.sqrt(e.n) * 1.5), color: "#0E2F3C", weight: 1.5, fillColor: "#17807E", fillOpacity: 0.75 }).bindPopup(`<b>${esc(e.cell || "Location")}</b><br>${esc(e.p.address || "")}<br>${e.n} records<br>${esc(fmtTs(e.first, TZ()))} to ${esc(fmtTs(e.last, TZ()))}`).addTo(layer);
    if (pts.length > 1) L.polyline(pts, { color: "#EE9B1E", weight: 2, opacity: 0.7 }).addTo(layer);
    $("#mcount").textContent = `${pts.length} of ${rs.length} records located, ${seen.size} places`;
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.2)); else map.setView([22.5, 79], 4);
    C.kmlFor = { a, rs, located, seen };
  };
  $("#tnum").onchange = draw;
  const kml = $("#kml"); if (kml) kml.onclick = () => {
    const { a, rs, located: loc, seen } = C.kmlFor;
    const points = [...seen.values()].map((e) => ({ name: e.cell || "Location", lat: e.p.lat, lon: e.p.lon, description: `${e.n} records for ${dn(a)}`, when: e.first }));
    const coords = rs.map(loc).filter(Boolean).map((p) => [p.lat, p.lon]);
    download(new Blob([E.toKml(points, { name: `Movement of ${dn(a)}`, coords })], { type: "application/vnd.google-earth.kml+xml" }), `graphiq-${a.replace(/\D/g, "")}.kml`);
    ev("kml.exported", { number: a, places: points.length });
  };
  await new Promise((r) => setTimeout(r, 30));
  draw();
  ev("map.viewed", { towers: C.towers.length });
}

// ------------------------------------------------------------------ reports

async function reports(el) {
  if (!(await needData(el))) return;
  el.innerHTML = html`<p class="verify-note" style="margin-bottom:16px">Every report states that it is analytical output that requires human verification. Exports are recorded in the audit log.</p>
  <div class="grid-3">${E.REPORT_KINDS.map((k) => raw(`<article class="card stack"><h3>${esc(k.title)}</h3><p class="small muted">${esc({ summary: "Per-number summary, when activity happens, peak hours and unusual days.", frequency: "Every contact by frequency, repeated and one-way contact.", common: "Numbers shared by targets, target-to-target contact and circular chains.", imei: "Handsets, shared IMEIs, device changes and IMSI mapping.", tower: "Most used cells, day and night locations, movements and roaming.", timeline: "Chronology of records and silent periods.", meeting: "Two numbers at the same cell within the window, and overlapping calls." }[k.id])}</p>
    <div class="row"><button class="btn btn-ghost btn-sm" data-prev="${k.id}">Preview</button>${C.me.canExport ? REPORT_FORMATS.map((f) => `<button class="btn btn-quiet btn-sm" data-rep="${k.id}" data-fmt="${f}">${f.toUpperCase()}</button>`).join("") : ""}</div></article>`))}</div>
  ${C.me.canExport ? "" : raw(`<p class="note">Your role can preview reports but not export them.</p>`)}
  <section class="section card stack"><div class="row between"><h2>Draft case summary</h2><button class="btn btn-ghost" id="draft">${ico("spark")} Draft from computed statistics</button></div><div id="draftout"><p class="muted small">Kayak AI writes a short draft from statistics the engine computes; it never sees raw records and is told not to add facts.</p></div></section>
  <div id="prev" class="section"></div>`;
  el.onclick = async (e) => {
    const p = e.target.closest("[data-prev]");
    if (p) { const r = await run("report", { kind: p.dataset.prev, ctx: { caseTitle: C.k.title, caseRef: C.k.refNo, tz: TZ() } }); $("#prev").innerHTML = `<div class="card"><h2>${esc(r.title)}</h2><p class="note warn">${esc(r.disclaimer)}</p>${r.sections.map((s) => `<h3 class="section">${esc(s.heading)}</h3>${s.note ? `<p class="small muted">${esc(s.note)}</p>` : ""}${T(s.columns, s.rows.slice(0, 200))}`).join("")}</div>`; $("#prev").scrollIntoView(); return; }
    const b = e.target.closest("[data-rep]");
    if (b) { setBusy(b, true, "…"); try { await exportReport(b.dataset.rep, b.dataset.fmt, C); } catch (err) { toast(err.message, "err"); } setBusy(b, false); }
  };
  $("#draft").onclick = async () => {
    setBusy($("#draft"), true, "Drafting…");
    try { const r = await api(`/api/cases/${C.id}/ai/summary`, { body: {} }); $("#draftout").innerHTML = `<span class="ai-label">${esc(r.label)}</span><div style="white-space:pre-wrap;margin-top:10px" class="serif">${esc(r.draft)}</div>`; }
    catch (err) { toast(err.message, "err"); }
    setBusy($("#draft"), false);
  };
}

// ------------------------------------------------------------------ evidence

async function evidence(el) {
  const { evidence: list, maxBytes } = await api(`/api/cases/${C.id}/evidence`);
  el.innerHTML = html`<p class="muted">Original files and attachments. Each file's SHA-256 is computed in your browser and again on the server when it arrives; the file is stored encrypted (AES-256-GCM, a key for each case) and every upload, download and check is written to its chain of custody.</p>
  ${C.me.canAnnotate && C.k.status === "approved" ? raw(`<label class="drop section" id="edrop"><input type="file" id="efile" multiple hidden><b>Add attachments</b><br><span class="small muted">For example, the production order, the operator's certificate, or results of checks you already lawfully hold. Up to ${fmtBytes(maxBytes)} each. Source CDR files are added automatically when you import.</span></label>`) : ""}
  <div class="table-wrap section"><table class="table"><thead><tr><th>File</th><th>Kind</th><th class="num">Size</th><th>SHA-256</th><th>Added</th><th></th></tr></thead><tbody>${list.length ? list.map((x) => raw(`<tr><td>${esc(x.file_name)}${x.note ? `<br><span class="small muted">${esc(x.note)}</span>` : ""}</td><td>${x.kind === "source" ? "Source file" : "Attachment"}</td><td class="num">${fmtBytes(x.size)}</td><td class="code-hash">${esc(x.sha256)}</td><td>${esc(x.by_name || "")}<br><span class="small muted">${esc(fmtDateTime(x.created_at))}</span></td>
    <td><div class="row"><button class="btn btn-ghost btn-sm" data-ver="${esc(x.id)}">Verify integrity</button><button class="btn btn-quiet btn-sm" data-cus="${esc(x.id)}">Custody</button>${C.me.canExport ? `<a class="btn btn-quiet btn-sm" href="/api/cases/${esc(C.id)}/evidence/${esc(x.id)}/download">Download</a>` : ""}</div></td></tr>`)) : raw(`<tr><td colspan="6" class="muted">No evidence files yet.</td></tr>`)}</tbody></table></div><div id="cus"></div>`;
  el.onclick = async (e) => {
    const v = e.target.closest("[data-ver]");
    if (v) { setBusy(v, true, "Checking…"); try { const r = await api(`/api/cases/${C.id}/evidence/${v.dataset.ver}/verify`, { body: {} }); toast(r.ok ? "Integrity verified: the SHA-256 matches the value recorded at upload." : `Integrity check failed: ${r.reason}`, r.ok ? "ok" : "err"); v.textContent = r.ok ? "Verified" : "FAILED"; v.disabled = true; } catch (err) { toast(err.message, "err"); setBusy(v, false); } return; }
    const c = e.target.closest("[data-cus]");
    if (c) { const r = await api(`/api/cases/${C.id}/evidence/${c.dataset.cus}/custody`); $("#cus").innerHTML = `<section class="section card"><h3>Chain of custody</h3>${T(["When", "Who", "Action", "Detail"], r.custody.map((x) => [fmtDateTime(x.at), x.user_email || "", x.action, x.detail || ""]))}</section>`; }
  };
  $("#efile")?.addEventListener("change", async (e) => {
    for (const f of e.target.files) {
      try { await uploadEvidence(f, "attachment"); toast(`${f.name} added.`); } catch (err) { toast(`${f.name}: ${err.message}`, "err"); }
    }
    evidence(el);
  });
}

export async function uploadEvidence(file, kind = "source", note = "") {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha = await run("sha256", { bytes: bytes.buffer.slice(0) });
  const r = await fetch(`/api/cases/${C.id}/evidence`, { method: "PUT", body: bytes, credentials: "same-origin", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-Content-SHA256": sha, "X-Kind": kind, "X-Note": encodeURIComponent(note) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Upload failed (${r.status}).`);
  return { ...j, browserSha: sha };
}

// ------------------------------------------------------------------ notes and bookmarks

async function notes(el) {
  const r = await api(`/api/cases/${C.id}/notes`);
  el.innerHTML = html`<div class="grid-2"><section class="stack">
    ${C.me.canAnnotate ? raw(`<form id="nf" class="card stack"><h2>Add a note</h2><div class="field"><label for="nk">Kind</label><select class="select input" id="nk"><option value="note">Case note</option><option value="osint">Open-source or third-party information (manual)</option></select></div>
      <div class="field"><label for="nb">Note</label><textarea class="textarea" id="nb" required></textarea></div>
      <div class="field" id="nsrc" hidden><label for="ns">Where it came from, and on what basis you hold it</label><input class="input" id="ns" maxlength="500" placeholder="For example: public court record viewed on 12 Mar 2026; copy attached as evidence"></div>
      <p class="note warn small" id="osintnote" hidden>Record only information you already lawfully hold. GraphIQ does not search data brokers or scrape social media, and it does not identify people; attach supporting files under Evidence.</p>
      <div class="row end"><button class="btn btn-primary">Save note</button></div></form>`) : ""}
    <div class="stack">${r.notes.length ? r.notes.map((n) => raw(`<article class="card stack-sm"><div class="row between"><span class="badge ${n.kind === "osint" ? "warn" : "accent"}">${n.kind === "osint" ? "OSINT (manual)" : "Note"}</span><span class="small muted">${esc(n.by_name || "")}, ${esc(fmtDateTime(n.created_at))}</span></div><p style="white-space:pre-wrap">${esc(n.body)}</p>${n.source ? `<p class="small muted">Source: ${esc(n.source)}</p>` : ""}${C.me.canAnnotate ? `<div class="row end"><button class="btn btn-quiet btn-sm" data-dn="${esc(n.id)}">Delete</button></div>` : ""}</article>`)) : raw(`<p class="muted">No notes yet.</p>`)}</div></section>
    <section class="card stack"><h2>Bookmarks and evidence tags</h2>${T(["Tag", "Record or number", "Note", "By", ""], r.bookmarks.map((b) => [b.tag, b.record_id ? `${fmtTs(b.ts, TZ())} ${dn(b.a)} ${b.type} ${dn(b.bparty)} ${E.fmtDuration(b.dur || 0)}` : dn(b.number), b.note || "", b.by_name || "", C.me.canAnnotate ? raw(`<button class="btn btn-quiet btn-sm" data-db="${esc(b.id)}">Remove</button>`) : ""]))}</section></div>`;
  $("#nk")?.addEventListener("change", (e) => { const o = e.target.value === "osint"; $("#nsrc").hidden = !o; $("#osintnote").hidden = !o; });
  $("#nf")?.addEventListener("submit", async (e) => { e.preventDefault(); try { await api(`/api/cases/${C.id}/notes`, { body: { kind: $("#nk").value, body: $("#nb").value, source: $("#ns").value } }); toast("Saved."); notes(el); } catch (err) { toast(err.message, "err"); } });
  el.onclick = async (e) => { const d = e.target.closest("[data-dn]"); if (d && (await confirmDialog("Delete note", "Delete this note? The deletion is recorded in the audit log.", "Delete", true))) { await api(`/api/cases/${C.id}/notes/${d.dataset.dn}`, { method: "DELETE" }); notes(el); } const b = e.target.closest("[data-db]"); if (b) { await api(`/api/cases/${C.id}/bookmarks/${b.dataset.db}`, { method: "DELETE" }); notes(el); } };
}

// ------------------------------------------------------------------ audit

async function auditTab(el) {
  const { entries } = await api(`/api/cases/${C.id}/audit`);
  el.innerHTML = `<div class="row between"><p class="muted">The latest 200 entries for this case. Entries are part of one hash chain shared by all cases; Verify checks every entry.</p><button class="btn btn-primary" id="ver">${ico("shield")} Verify the audit chain</button></div><div id="vres"></div>${auditTable(entries, false)}`;
  $("#ver").onclick = () => verifyChain($("#vres"), $("#ver"), C.id);
}

// ------------------------------------------------------------------ settings

async function settings(el) {
  const k = C.k, u = S.me.user, p = S.me.perms;
  const owner = k.createdBy === u.id || p.manageUsers;
  const [{ entries }, users] = await Promise.all([api(`/api/cases/${C.id}/watchlist`), owner && (p.createCase || p.manageUsers) ? api("/api/users").catch(() => ({ users: [] })) : { users: [] }]);
  el.innerHTML = html`<div class="grid-2">
  ${C.me.canAnnotate ? raw(`<form id="sf" class="card stack"><h2>Details</h2><div class="field"><label for="st">Title</label><input class="input" id="st" value="${esc(k.title)}"></div><div class="field"><label for="sd">Description</label><textarea class="textarea" id="sd" style="min-height:70px">${esc(k.description || "")}</textarea></div>
    <div class="form-grid"><div class="field"><label for="stz">Time zone</label><input class="input" id="stz" value="${esc(k.tz)}"></div><div class="field"><label for="sr">Keep the data until</label><input class="input" type="date" id="sr" value="${esc(k.retainUntil || "")}"></div></div><div class="row end"><button class="btn btn-primary">Save</button></div></form>`) : ""}
  <section class="card stack"><h2>People on this case</h2>${T(["Name", "Role", ""], C.members.map((m) => [m.name, m.role, owner && m.id !== k.createdBy ? raw(`<button class="btn btn-quiet btn-sm" data-rm="${esc(m.id)}">Remove</button>`) : ""]))}
    ${owner && users.users.length ? raw(`<div class="row"><select class="select input" id="addu" style="flex:1"><option value="">Add a person…</option>${users.users.filter((x) => x.status === "active" && !C.members.some((m) => m.id === x.id)).map((x) => `<option value="${esc(x.id)}">${esc(x.name)} (${esc(x.role)})</option>`).join("")}</select><button class="btn btn-ghost" id="addb">Add</button></div>`) : ""}</section>
  <section class="card stack"><h2>Watchlists</h2><p class="small muted">Black list: numbers of interest, flagged wherever they appear. White list: known, benign numbers (for example service numbers), hidden from the link chart on request.</p>
    ${C.me.canAnnotate ? raw(`<div class="form-grid"><textarea class="textarea" id="wn" placeholder="Numbers" style="min-height:60px"></textarea><div class="stack-sm"><select class="select input" id="wl"><option value="black">Black list</option><option value="white">White list</option></select><input class="input" id="wlab" placeholder="Label (optional)"><button class="btn btn-ghost" id="wadd">Add to list</button></div></div>`) : ""}
    ${T(["Number", "List", "Label", ""], entries.map((w) => [dn(w.number), w.list === "black" ? "Black" : "White", w.label || "", C.me.canAnnotate ? raw(`<button class="btn btn-quiet btn-sm" data-wrm="${esc(w.number)}">Remove</button>`) : ""]))}</section>
  <section class="card stack"><h2>Encrypted export and backup</h2><p class="small muted">Download the whole case (records, notes, bookmarks, watchlists and the evidence register) as one file encrypted with a passphrase you choose (AES-256-GCM). To restore, open a new case with its own legal basis, have it approved, then drop the .gqcase file on that case's Import tab. Evidence files themselves are not included; download them separately.</p>
    ${C.me.canExport ? raw(`<div class="row"><input class="input" type="password" id="pp" placeholder="Passphrase (12+ characters)" autocomplete="new-password" style="flex:1"><button class="btn btn-ghost" id="expb">${ico("lock")} Export case</button></div>`) : raw(`<p class="note">Your role cannot export.</p>`)}</section>
  ${owner ? raw(`<section class="card stack"><h2>Close or delete</h2><p class="small muted">Closing keeps the data read-only for analysis. Secure deletion removes all records, notes and encrypted evidence objects; the case entry stays as a tombstone and the deletion is written to the audit log.</p><div class="row"><button class="btn btn-ghost" id="close">Close case</button>${p.deleteCase ? `<button class="btn btn-danger" id="del">${ico("trash")} Securely delete</button>` : ""}</div></section>`) : ""}
  </div>`;
  $("#sf")?.addEventListener("submit", async (e) => { e.preventDefault(); try { await api(`/api/cases/${C.id}`, { method: "PATCH", body: { title: $("#st").value, description: $("#sd").value, tz: $("#stz").value, retainUntil: $("#sr").value } }); toast("Saved."); } catch (err) { toast(err.message, "err"); } });
  el.onclick = async (e) => {
    const t = e.target.closest("button"); if (!t) return;
    try {
      if (t.dataset.rm) { await api(`/api/cases/${C.id}/members/${t.dataset.rm}`, { method: "DELETE" }); await refreshCase(); return settings(el); }
      if (t.id === "addb" && $("#addu").value) { await api(`/api/cases/${C.id}/members`, { body: { userId: $("#addu").value } }); await refreshCase(); toast("Added."); return settings(el); }
      if (t.id === "wadd") { const r = await api(`/api/cases/${C.id}/watchlist`, { body: { numbers: $("#wn").value, list: $("#wl").value, label: $("#wlab").value } }); C.loadedFor = null; toast(`${r.added} number(s) added.`); return settings(el); }
      if (t.dataset.wrm) { await api(`/api/cases/${C.id}/watchlist/${encodeURIComponent(t.dataset.wrm)}`, { method: "DELETE" }); C.loadedFor = null; return settings(el); }
      if (t.id === "expb") {
        const pass = $("#pp").value; if (pass.length < 12) return toast("Use a passphrase of at least 12 characters.", "err");
        setBusy(t, true, "Encrypting…");
        const bundle = await api(`/api/cases/${C.id}/bundle`);
        const bytes = await run("encrypt", { payload: bundle, pass });
        download(new Blob([bytes], { type: "application/octet-stream" }), `${k.title.replace(/[^\w-]+/g, "_").slice(0, 40)}.gqcase`);
        ev("case.exported", { records: bundle.records.length, encrypted: "AES-256-GCM, PBKDF2-SHA256" });
        setBusy(t, false); $("#pp").value = ""; toast("Encrypted export downloaded. Keep the passphrase separately.");
      }
      if (t.id === "close" && (await confirmDialog("Close case", "Close this case? No more imports can be made; analysis stays available.", "Close case"))) { await api(`/api/cases/${C.id}/close`, { body: {} }); go(`#/case/${C.id}`); }
      if (t.id === "del") {
        await dialog({ title: "Securely delete this case", body: `<p>This permanently removes ${C.k.records.toLocaleString("en-IN")} records, all notes and bookmarks, and every encrypted evidence object. It cannot be undone. The audit log keeps a record of the deletion.</p><div class="field"><label for="dr">Reason</label><input class="input" id="dr" placeholder="For example: retention period ended"></div><div class="field"><label for="dc">Type the case title to confirm</label><input class="input" id="dc"></div>`,
          actions: [{ id: "x", label: "Cancel" }, { id: "ok", label: "Delete permanently", kind: "danger", handler: async (d) => { await api(`/api/cases/${C.id}/delete`, { body: { confirm: d.querySelector("#dc").value, reason: d.querySelector("#dr").value } }); toast("Case securely deleted."); go("#/cases"); } }] });
      }
    } catch (err) { setBusy(t, false); toast(err.message, "err"); }
  };
}
