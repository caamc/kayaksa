// Import: bulk upload of CSV, TXT, XLSX, JSON, XML, HTML and PDF files, automatic column
// recognition, a mapping editor with saved templates, validation before anything is stored, then
// upload of the original file as evidence and of the normalised records in batches.
import { $, api, esc, html, raw, ico, toast, setBusy, fmtBytes } from "/_shared/js/ui.js";
import * as E from "/vendor/graphiq-engine.mjs";
import { run } from "/assets/engine.js";
import { C, refreshCase, loadRecords, uploadEvidence, caseEvent } from "/assets/case.js";
import { dn } from "/assets/app.js";

const FIELDS = ["ignore", "a", "b", "calling", "called", "date", "time", "datetime", "endtime", "dur", "type", "imei", "imsi", "cell", "lastCell", "lac", "lat", "lon", "roam", "op", "cellAddr"];
let files = [];
let templates = [];

export async function importTab(el) {
  if (C.k.status !== "approved") {
    el.innerHTML = `<div class="empty"><h3>Import is locked</h3><p>${C.k.status === "pending" ? "This case is waiting for approval by a user with the Approver role. Under the four-eyes rule, no data can be imported until a second person has approved the legal basis." : `This case is ${esc(C.k.status)}; data cannot be imported.`}</p></div>`;
    return;
  }
  if (!C.me.canImport) { el.innerHTML = `<p class="note">Your role can view this case but not import data.</p>`; return; }
  files = [];
  templates = (await api("/api/templates")).templates;
  el.innerHTML = html`<div class="stack">
    <label class="drop" id="drop" tabindex="0"><input type="file" id="fi" multiple hidden accept=".csv,.txt,.tsv,.xlsx,.xls,.json,.xml,.html,.htm,.pdf,.gqcase">
      <b>Drop call records here, or choose files</b><br><span class="small muted">CSV, TXT, XLSX, JSON, XML, HTML tables and text-based PDF tables, several files at once. Airtel, Jio, Vi and BSNL style layouts and most generic exports are recognised automatically; check the mapping before importing. Files are read in your browser; the original is then stored as encrypted evidence with its SHA-256.</span></label>
    <div class="row"><label class="small">Time zone of these files <input class="input" id="itz" value="${C.k.tz}" style="width:180px;min-height:36px"></label><label class="small">Default country code <input class="input" id="icc" value="${C.k.cc}" style="width:70px;min-height:36px"></label></div>
    <div id="files" class="stack"></div>
    <div class="row end" id="go" hidden><span class="muted small" id="gosum"></span><button class="btn btn-primary" id="imp">${ico("upload")} Import checked files</button></div>
    <div id="prog"></div></div>`;
  if (C.k.records) await loadRecords();
  await run("resetSeen", {});
  const drop = $("#drop");
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); add([...e.dataTransfer.files]); };
  drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#fi").click(); } };
  $("#fi").onchange = (e) => add([...e.target.files]);
  $("#imp").onclick = importAll;
}

async function add(list) {
  for (const file of list) {
    const key = crypto.randomUUID();
    const f = { key, file, name: file.name, status: "reading" };
    files.push(f);
    renderFiles();
    try {
      if (/\.gqcase$/i.test(file.name)) { await restore(f); continue; }
      const bytes = await file.arrayBuffer();
      let r;
      if (/\.pdf$/i.test(file.name) || new Uint8Array(bytes.slice(0, 4)).join() === "37,80,68,70") r = await run("pdfTable", { key, items: await pdfItems(bytes) });
      else r = await run("read", { key, name: file.name, bytes }, [bytes]);
      Object.assign(f, r, { status: "mapped", mapping: { ...r.detection.mapping, tz: $("#itz").value || C.k.tz, cc: $("#icc").value || "91" } });
      const tpl = templates.find((t) => sameHeaders(t.mapping.headers, r.detection.headers));
      if (tpl) { f.mapping = { ...f.mapping, ...tpl.mapping, cols: tpl.mapping.cols, headerRow: f.mapping.headerRow }; f.template = tpl.name; }
      await check(f);
    } catch (e) { f.status = "error"; f.error = e.message; }
    renderFiles();
  }
}
const sameHeaders = (a, b) => a?.length && a.length === b.length && a.every((h, i) => E.normHeader(h) === E.normHeader(b[i]));

async function pdfItems(bytes) {
  const pdfjs = await import("/vendor/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  const items = [];
  for (let p = 1; p <= Math.min(doc.numPages, 500); p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items) if (it.str) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, page: p });
  }
  if (!items.length) throw new Error("No text found in this PDF. Scanned PDFs need OCR, which GraphIQ does not do yet; ask the operator for CSV or XLSX.");
  return items;
}

async function check(f) {
  f.status = "checking"; renderFiles();
  const r = await run("normalise", { key: f.key, mapping: f.mapping, src: f.name });
  f.validation = r.validation; f.preview = r.preview; f.status = "checked"; f.include = r.validation.imported > 0;
}

function renderFiles() {
  const box = $("#files"); if (!box) return;
  box.innerHTML = files.map((f) => {
    if (f.status === "error") return `<div class="file-card"><div class="hd"><b>${esc(f.name)}</b><span class="badge danger">Not readable</span></div><p class="note danger">${esc(f.error)}</p></div>`;
    if (f.status === "reading" || f.status === "checking") return `<div class="file-card"><div class="loading"><span class="spinner"></span> ${f.status === "reading" ? "Reading" : "Checking"} ${esc(f.name)}…</div></div>`;
    if (f.status === "restored") return `<div class="file-card"><div class="hd"><b>${esc(f.name)}</b><span class="badge ok">Encrypted case export</span></div><p>${esc(f.summary)}</p></div>`;
    if (f.status === "done") return `<div class="file-card"><div class="hd"><b>${esc(f.name)}</b><span class="badge ok">Imported</span></div><p class="small muted">${f.stored.toLocaleString("en-IN")} records stored. Evidence SHA-256 <span class="code-hash">${esc(f.sha)}</span></p></div>`;
    const d = f.detection, v = f.validation, cols = f.mapping.cols, byCol = {};
    for (const [k, i] of Object.entries(cols)) byCol[i] = k;
    const headers = d.headers.length ? d.headers : (f.sample[0] || []).map((_, i) => `Column ${i + 1}`);
    const body = f.sample.slice(d.mapping.headerRow + 1, d.mapping.headerRow + 6);
    return html`<div class="file-card" data-key="${f.key}">
      <div class="hd"><div><b>${f.name}</b> <span class="small muted">${fmtBytes(f.file.size)} · ${(f.format || "").toUpperCase()} · ${f.rows.toLocaleString("en-IN")} rows${f.sheets ? ` · sheets: ${f.sheets.join(", ")}` : ""}</span></div>
        <div class="row"><span class="badge ${d.confidence === 1 ? "ok" : "warn"}">${d.layout}</span>${f.template ? raw(`<span class="badge accent">Template: ${esc(f.template)}</span>`) : ""}<label class="check small"><input type="checkbox" data-inc ${f.include ? "checked" : ""}> Import</label><button class="btn btn-quiet btn-sm" data-rm>Remove</button></div></div>
      ${d.missing.length ? raw(`<p class="note warn small">Not found automatically: ${esc(d.missing.map((m) => E.FIELD_LABELS[m]).join(", "))}. Set them below.</p>`) : ""}
      <details ${d.confidence < 1 ? "open" : ""}><summary class="small"><b>Column mapping</b> (header row ${d.mapping.headerRow + 1})</summary>
        <div class="map-grid" style="margin-top:10px">${headers.map((h, i) => raw(`<label>${esc(h || `Column ${i + 1}`)}<select data-col="${i}" class="${byCol[i] ? "set" : ""}">${FIELDS.map((fl) => `<option value="${fl}"${(byCol[i] || "ignore") === fl ? " selected" : ""}>${esc(E.FIELD_LABELS[fl])}</option>`).join("")}</select></label>`))}</div>
        <div class="row" style="margin-top:10px"><label class="small">Numbers <select class="select" data-parties><option value="target-other"${f.mapping.parties === "target-other" ? " selected" : ""}>A party is the target</option><option value="calling-called"${f.mapping.parties === "calling-called" ? " selected" : ""}>Calling / called (swap for incoming)</option></select></label>
          <label class="small">Dates <select class="select" data-order>${["dmy:Day first (03/04 = 3 April)", "mdy:Month first (03/04 = 4 March)", "ymd:Year first"].map((o) => { const [k, l] = o.split(":"); return raw(`<option value="${k}"${f.mapping.dateOrder === k ? " selected" : ""}>${esc(l)}</option>`); })}</select></label>
          <select class="select" data-tpl aria-label="Apply a template"><option value="">Apply a template…</option>${templates.map((t) => raw(`<option value="${esc(t.id)}">${esc(t.name)}</option>`))}</select>
          <button class="btn btn-ghost btn-sm" data-recheck>Check again</button><button class="btn btn-quiet btn-sm" data-savetpl>Save as template</button></div>
        <div class="table-wrap" style="margin-top:10px"><table class="table preview"><thead><tr>${headers.map((h) => raw(`<th>${esc(h)}</th>`))}</tr></thead><tbody>${body.map((r) => raw(`<tr>${headers.map((_, i) => `<td>${esc(r[i] ?? "")}</td>`).join("")}</tr>`))}</tbody></table></div></details>
      ${v ? raw(`<div class="vsum"><span>Rows <b>${v.rows.toLocaleString("en-IN")}</b></span><span class="good">Ready to import <b>${v.imported.toLocaleString("en-IN")}</b></span><span class="${v.rejected ? "bad" : ""}">Rejected <b>${v.rejected}</b></span><span class="${v.duplicates ? "warnb" : ""}">Duplicates removed <b>${v.duplicates}</b></span><span>Numbers <b>${v.distinctNumbers}</b></span><span>Targets <b>${esc(v.targets.slice(0, 3).map(dn).join(", ") || "none")}</b></span><span>Period <b>${esc(v.from ? `${E.localDate(v.from, f.mapping.tz)} to ${E.localDate(v.to, f.mapping.tz)}` : "-")}</b></span></div>
        ${Object.keys(v.errors).length || Object.keys(v.warnings).length ? `<details><summary class="small"><b>Invalid or missing values</b> (${Object.entries({ ...v.errors, ...v.warnings }).map(([k, n]) => `${esc(k)}: ${n}`).join(", ")})</summary><div class="table-wrap"><table class="table preview"><thead><tr><th>Row</th><th>Problem</th><th>Detail</th></tr></thead><tbody>${v.samples.map((s) => `<tr><td>${s.row}</td><td>${esc(s.kind)}</td><td>${esc(s.detail)}</td></tr>`).join("")}</tbody></table></div></details>` : ""}`) : ""}
    </div>`;
  }).join("");
  const ready = files.filter((f) => f.status === "checked" && f.include);
  $("#go").hidden = !ready.length;
  $("#gosum").textContent = `${ready.length} file(s), ${ready.reduce((n, f) => n + f.validation.imported, 0).toLocaleString("en-IN")} records`;
  box.onchange = async (e) => {
    const card = e.target.closest("[data-key]"); if (!card) return;
    const f = files.find((x) => x.key === card.dataset.key);
    if (e.target.matches("[data-inc]")) { f.include = e.target.checked; return renderFiles(); }
    if (e.target.matches("[data-col]")) { const i = +e.target.dataset.col; for (const [k, v] of Object.entries(f.mapping.cols)) if (v === i) delete f.mapping.cols[k]; if (e.target.value !== "ignore") f.mapping.cols[e.target.value] = i; }
    if (e.target.matches("[data-parties]")) f.mapping.parties = e.target.value;
    if (e.target.matches("[data-order]")) f.mapping.dateOrder = e.target.value;
    if (e.target.matches("[data-tpl]")) { const t = templates.find((x) => x.id === e.target.value); if (t) { f.mapping = { ...f.mapping, cols: { ...t.mapping.cols }, parties: t.mapping.parties, dateOrder: t.mapping.dateOrder }; f.template = t.name; } }
    await check(f); renderFiles();
  };
  box.onclick = async (e) => {
    const card = e.target.closest("[data-key]"); if (!card) return;
    const f = files.find((x) => x.key === card.dataset.key);
    if (e.target.closest("[data-rm]")) { await run("forget", { key: f.key }); files = files.filter((x) => x !== f); return renderFiles(); }
    if (e.target.closest("[data-recheck]")) { f.mapping.tz = $("#itz").value || f.mapping.tz; f.mapping.cc = $("#icc").value || f.mapping.cc; await check(f); return renderFiles(); }
    if (e.target.closest("[data-savetpl]")) {
      const name = prompt("Template name", f.detection.layout.replace(/ \(.*/, "") + " custom"); if (!name) return;
      try { await api("/api/templates", { body: { name, mapping: { ...f.mapping, headers: f.detection.headers } } }); templates = (await api("/api/templates")).templates; toast("Template saved. Files with the same headers will use it."); } catch (err) { toast(err.message, "err"); }
    }
  };
}

async function importAll() {
  const btn = $("#imp");
  const ready = files.filter((f) => f.status === "checked" && f.include);
  setBusy(btn, true, "Importing…");
  const prog = $("#prog");
  try {
    for (const f of ready) {
      prog.innerHTML = `<p class="small">Sealing ${esc(f.name)} as evidence…</p><div class="progress big"><i style="width:2%"></i></div>`;
      const evd = await uploadEvidence(f.file, "source", `Source file, ${f.detection.layout}`);
      const imp = await api(`/api/cases/${C.id}/imports`, { body: { fileName: f.name, format: f.format, layout: f.detection.layout, sha256: evd.sha256, size: f.file.size, evidenceId: evd.id, mapping: f.mapping, validation: f.validation } });
      const recs = await run("takeRecords", { key: f.key });
      for (let i = 0; i < recs.length; i += 2000) {
        await api(`/api/cases/${C.id}/imports/${imp.id}/rows`, { body: { rows: recs.slice(i, i + 2000) } });
        prog.innerHTML = `<p class="small">Storing ${esc(f.name)}: ${Math.min(recs.length, i + 2000).toLocaleString("en-IN")} of ${recs.length.toLocaleString("en-IN")}</p><div class="progress big"><i style="width:${Math.round(((i + 2000) / recs.length) * 100)}%"></i></div>`;
      }
      const done = await api(`/api/cases/${C.id}/imports/${imp.id}/complete`, { body: {} });
      Object.assign(f, { status: "done", stored: done.records, sha: evd.sha256 });
      renderFiles();
    }
    prog.innerHTML = `<p class="note ok">Import complete. <a href="#/case/${C.id}/overview">Open the dashboard</a> or <a href="#/case/${C.id}/analytics">the analytics</a>.</p>`;
    await refreshCase(); C.loadedFor = null;
  } catch (e) { prog.innerHTML = `<p class="note danger">${esc(e.message)}</p>`; }
  setBusy(btn, false);
  $("#go").hidden = true;
}

/** An encrypted case export: decrypt in the browser and load its records into this (approved) case. */
async function restore(f) {
  const pass = prompt(`Passphrase for ${f.name}`);
  if (!pass) { files = files.filter((x) => x !== f); return renderFiles(); }
  const bytes = await f.file.arrayBuffer();
  const b = await run("decrypt", { bytes, pass }, [bytes]);
  if (b.format !== "graphiq-case") throw new Error("This file is not a GraphIQ case export.");
  const recs = b.records.map((row) => { const o = {}; b.fields.forEach((k, i) => { if (row[i] !== null && row[i] !== undefined && k !== "id") o[k] = row[i]; }); return o; });
  if (!confirm(`Load ${recs.length.toLocaleString("en-IN")} records from the export of "${b.case.title}" (ref. ${b.case.refNo}) into this case? Only do this if this case's legal basis covers them.`)) { files = files.filter((x) => x !== f); return renderFiles(); }
  const evd = await uploadEvidence(f.file, "source", `Encrypted case export of ${b.case.title}`);
  const imp = await api(`/api/cases/${C.id}/imports`, { body: { fileName: f.name, format: "gqcase", layout: `Restored from export of ${b.case.title}`, sha256: evd.sha256, size: f.file.size, evidenceId: evd.id, mapping: {}, validation: { rows: recs.length, imported: recs.length, rejected: 0, duplicates: 0 } } });
  for (let i = 0; i < recs.length; i += 2000) await api(`/api/cases/${C.id}/imports/${imp.id}/rows`, { body: { rows: recs.slice(i, i + 2000) } });
  await api(`/api/cases/${C.id}/imports/${imp.id}/complete`, { body: {} });
  for (const n of b.notes || []) await api(`/api/cases/${C.id}/notes`, { body: { kind: n.kind, body: n.body, source: n.source || `Restored from export of ${b.case.title}` } }).catch(() => {});
  if (b.watchlist?.length) for (const list of ["black", "white"]) { const nums = b.watchlist.filter((w) => w.list === list).map((w) => w.number); if (nums.length) await api(`/api/cases/${C.id}/watchlist`, { body: { numbers: nums, list, label: "Restored" } }).catch(() => {}); }
  Object.assign(f, { status: "restored", summary: `${recs.length.toLocaleString("en-IN")} records, ${(b.notes || []).length} notes and ${(b.watchlist || []).length} watchlist entries restored from the export of "${b.case.title}" made ${b.exportedAt}.` });
  await refreshCase(); C.loadedFor = null;
  caseEvent("analytics.viewed", { restoredFrom: b.case.id });
}

