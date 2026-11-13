// Kayak GraphIQ app shell: navigation, the case list, new case (legal gate), approvals, global
// search, towers and reference data, users, audit, About and the chart gallery.
import { $, api, esc, html, raw, ico, toast, initTheme, toggleTheme, dialog, confirmDialog, setBusy, fmtDateTime } from "/_shared/js/ui.js";
import * as E from "/vendor/graphiq-engine.mjs";
import { renderCase } from "/assets/case.js";
import { renderAbout, renderGallery } from "/assets/about.js";
import { run } from "/assets/engine.js";
import { download } from "/assets/chartkit.js";

initTheme();
export const S = { me: null };
const app = $("#app");
export const dn = (n) => E.displayMsisdn(n || "");
export const fmtTs = (ms, tz = "Asia/Kolkata") => (ms ? E.localDateTime(ms, tz) : "");
export const statusBadge = (s) => raw(`<span class="status ${esc(s)}">${esc({ pending: "Awaiting approval", approved: "Approved", rejected: "Rejected", closed: "Closed", deleted: "Deleted" }[s] || s)}</span>`);
export const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

async function boot() {
  try { S.me = await api("/api/me"); } catch (e) { app.innerHTML = `<div class="content"><p class="note danger">${esc(e.message)}</p></div>`; return; }
  shell();
  addEventListener("hashchange", route);
  route();
}

function shell() {
  const m = S.me, p = m.perms;
  app.className = "gq";
  app.innerHTML = `
  <aside class="rail" aria-label="Main">
    <a class="rail-logo" href="#/cases"><img src="/assets/brand/GraphIQ_Logo_Reversed.svg" alt="Kayak GraphIQ"></a>
    <nav id="nav">
      <a href="#/cases" data-n="cases">${ico("folder")} Cases</a>
      ${p.createCase ? `<a href="#/new" data-n="new">${ico("plus")} New case</a>` : ""}
      ${p.approve ? `<a href="#/approvals" data-n="approvals">${ico("check")} Approvals${m.pendingApprovals ? `<span class="count">${m.pendingApprovals}</span>` : ""}</a>` : ""}
      <a href="#/search" data-n="search">${ico("search")} Search all cases</a>
      <a href="#/reference" data-n="reference">${ico("pin")} Towers and reference</a>
      <div class="sect">Governance</div>
      <a href="#/audit" data-n="audit">${ico("shield")} Audit log</a>
      ${p.manageUsers ? `<a href="#/users" data-n="users">${ico("users")} Users and roles</a>` : ""}
      <div class="sect">Help</div>
      <a href="#/about" data-n="about">${ico("book")} About and features</a>
      <a href="#/gallery" data-n="gallery">${ico("grid")} Chart gallery</a>
    </nav>
    <div class="rail-foot">For lawfully obtained data only.<br>Kayak GraphIQ, designed and developed by <b>Kayak Strategic Advisors</b>.</div>
  </aside>
  <div class="main">
    <header class="top">
      <button class="btn btn-quiet btn-sm menu-btn" id="menu" aria-label="Open the menu">${ico("menu")}</button>
      <div class="crumbs" id="crumbs"></div>
      <div class="who"><span class="name">${esc(m.user.name)}</span><span class="role">${esc(m.user.role)}</span>
        <button class="btn btn-quiet btn-sm" id="theme" aria-label="Switch light or dark theme">${ico("moon")}</button>
        <button class="btn btn-quiet btn-sm" id="out" aria-label="Sign out">${ico("logout")}</button></div>
    </header>
    <main class="content" id="view" tabindex="-1"></main>
  </div>`;
  $("#theme").onclick = () => { toggleTheme(); window.dispatchEvent(new Event("gq-theme")); };
  $("#out").onclick = async () => { await api("/api/auth/logout", { body: {} }).catch(() => {}); location.href = "/login"; };
  $("#menu").onclick = () => app.classList.toggle("nav-open");
  $("#nav").onclick = () => app.classList.remove("nav-open");
}

export const isDark = () => (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
export const crumbs = (parts) => ($("#crumbs").innerHTML = parts.map((p) => (p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : esc(p.label))).join(" / "));
export const loading = (el, text = "Loading…") => (el.innerHTML = `<div class="loading"><span class="spinner"></span> ${esc(text)}</div>`);

async function route() {
  const view = $("#view");
  const [, page, id, tab] = location.hash.split("/");
  for (const a of document.querySelectorAll("#nav a")) a.classList.toggle("on", a.dataset.n === (page === "case" ? "cases" : page || "cases"));
  window.dispatchEvent(new Event("gq-leave"));
  view.focus({ preventScroll: true });
  scrollTo(0, 0);
  try {
    if (!page || page === "cases") return await casesPage(view);
    if (page === "new") return newCase(view);
    if (page === "approvals") return await approvals(view);
    if (page === "case") return await renderCase(view, id, tab || "overview");
    if (page === "search") return searchAll(view);
    if (page === "reference") return await reference(view);
    if (page === "users") return await users(view);
    if (page === "audit") return await auditPage(view);
    if (page === "about") return renderAbout(view);
    if (page === "gallery") return renderGallery(view);
    view.innerHTML = `<p class="empty">Page not found.</p>`;
  } catch (e) {
    view.innerHTML = `<div class="note danger">${esc(e.message)}</div>`;
  }
}

// ------------------------------------------------------------------ cases

async function casesPage(view) {
  crumbs([{ label: "Cases" }]);
  loading(view);
  const { cases } = await api("/api/cases");
  const p = S.me.perms;
  view.innerHTML = `<div class="page-head"><div><span class="eyebrow">Kayak GraphIQ</span><h1>Your cases</h1><p class="sub">Cases you are assigned to. Each case holds records obtained under one legal basis; data can be imported only after an Approver has approved the case.</p></div>
    ${p.createCase ? `<a class="btn btn-primary" href="#/new">${ico("plus")} New case</a>` : ""}</div>
    ${cases.length ? `<div class="grid-3">${cases.map((k) => html`<article class="card case-card"><div class="row between">${statusBadge(k.status)}<span class="small muted">${k.records.toLocaleString("en-IN")} records</span></div>
      <h3><a href="#/case/${k.id}">${k.title}</a></h3><div class="meta"><span>${k.legalBasisLabel}</span><span>Ref. ${k.refNo}</span><span>${k.members} member${k.members === 1 ? "" : "s"}</span></div>
      <div class="meta"><span>Opened by ${k.createdByName || ""} on ${fmtDateTime(k.createdAt)}</span>${k.retainUntil ? html`<span>Retain until ${k.retainUntil}</span>` : ""}</div></article>`).join("")}</div>`
    : `<div class="empty"><h3>No cases yet</h3><p>${p.createCase ? "Open a case to start. You will need the legal basis, reference number and date, issuing authority and the approving supervisor." : "An Admin or Analyst assigns people to cases. Ask them to add you."}</p></div>`}`;
}

function newCase(view, prefill = {}) {
  crumbs([{ label: "Cases", href: "#/cases" }, { label: "New case" }]);
  if (!S.me.perms.createCase) { view.innerHTML = `<p class="note warn">Only Admins and Analysts can open cases.</p>`; return; }
  const bases = S.me.legalBases;
  view.innerHTML = html`<div class="page-head"><div><span class="eyebrow">Legal gate</span><h1>Open a case</h1><p class="sub">GraphIQ is for lawfully obtained data only. A case records the legal basis for holding the records; a different person with the Approver role must approve it before any data can be imported.</p></div></div>
  <div class="note warn" style="margin-bottom:18px"><b>Lawful-use notice.</b> In India, call detail records (CDR), subscriber details (SDR/CAF), IP detail records (IPDR) and tower data may be obtained only through lawful process: under the Telecommunications Act 2023 and the rules made under it, the Information Technology Act 2000, or a requisition or order under the Bharatiya Nagarik Suraksha Sanhita 2023 - or as a customer's own corporate telecom records, or with the subscriber's written consent. Processing the personal data in them must comply with the Digital Personal Data Protection Act 2023 (lawful purpose, purpose limitation, security safeguards, retention only as long as needed). Do not load records you do not have the right to hold for this case. GraphIQ does not look people up in data brokers or social media.</div>
  <form id="f" class="card stack" novalidate>
    <div class="form-grid">
      <div class="field"><label for="title">Case title</label><input class="input" id="title" name="title" required maxlength="140" value="${prefill.title || ""}" placeholder="For example: FIR 123/2026 - cheating complaint"></div>
      <div class="field"><label for="tz">Time zone of the records</label><input class="input" id="tz" name="tz" value="${prefill.tz || "Asia/Kolkata"}" list="tzs"><datalist id="tzs"><option>Asia/Kolkata</option><option>UTC</option><option>Asia/Dubai</option><option>Europe/London</option><option>Asia/Singapore</option></datalist></div>
    </div>
    <div class="field"><label for="description">What the case is about (optional)</label><textarea class="textarea" id="description" name="description" maxlength="2000" style="min-height:70px">${prefill.description || ""}</textarea></div>
    <fieldset class="stack" style="border:1px solid var(--line);padding:16px"><legend class="label" style="padding:0 6px">Legal basis</legend>
      <div class="form-grid">
        <div class="field"><label for="legalBasis">Basis</label><select class="select input" id="legalBasis" name="legalBasis" required><option value="">Choose…</option>${Object.entries(bases).map(([k, v]) => raw(`<option value="${k}"${prefill.legalBasis === k ? " selected" : ""}>${esc(v)}</option>`))}</select></div>
        <div class="field"><label for="refNo">Reference number</label><input class="input" id="refNo" name="refNo" required maxlength="120" value="${prefill.refNo || ""}" placeholder="Order, notice or agreement number"></div>
        <div class="field"><label for="refDate">Reference date</label><input class="input" type="date" id="refDate" name="refDate" required value="${prefill.refDate || ""}"></div>
        <div class="field"><label for="authority">Issuing authority</label><input class="input" id="authority" name="authority" required maxlength="200" value="${prefill.authority || ""}" placeholder="Court, officer or organisation"></div>
        <div class="field"><label for="supervisor">Approving supervisor</label><input class="input" id="supervisor" name="supervisor" required maxlength="120" value="${prefill.supervisor || ""}" placeholder="Name and designation"></div>
        <div class="field"><label for="retainUntil">Keep the data until (optional)</label><input class="input" type="date" id="retainUntil" name="retainUntil" value="${prefill.retainUntil || ""}"><span class="hint">After this date the case is flagged for secure deletion.</span></div>
      </div>
      <div class="field"><label for="legalText">Describe the legal basis</label><textarea class="textarea" id="legalText" name="legalText" required minlength="10" maxlength="2000" placeholder="For example: production order of the Chief Judicial Magistrate dated …, directing the operator to provide CDRs of the listed numbers for 1 Feb to 31 Mar 2026">${prefill.legalText || ""}</textarea></div>
    </fieldset>
    <label class="check"><input type="checkbox" id="lawful"> <span>I confirm the records for this case were or will be obtained lawfully, under the basis above, and will be used only for this case.</span></label>
    <label class="check"><input type="checkbox" id="notice"> <span>I have read the lawful-use notice above (version ${S.me.notice}).</span></label>
    <p class="error" id="err" hidden></p>
    <div class="row end"><a class="btn btn-ghost" href="#/cases">Cancel</a><button class="btn btn-primary" type="submit">Open case and request approval</button></div>
  </form>`;
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    b.noticeAccepted = $("#notice").checked; b.lawfulConfirmed = $("#lawful").checked; b.restoredFrom = prefill.restoredFrom;
    const btn = e.target.querySelector("[type=submit]"); setBusy(btn, true, "Opening…");
    try { const r = await api("/api/cases", { body: b }); toast("Case opened. It now needs an Approver's approval."); go(`#/case/${r.id}`); }
    catch (err) { $("#err").textContent = err.message; $("#err").hidden = false; setBusy(btn, false); }
  };
}
export { newCase };

async function approvals(view) {
  crumbs([{ label: "Approvals" }]);
  loading(view);
  const { cases } = await api("/api/approvals");
  view.innerHTML = `<div class="page-head"><div><span class="eyebrow">Four-eyes approval</span><h1>Cases awaiting approval</h1><p class="sub">Check the legal basis and reference against the underlying order, notice, agreement or consent before approving. You cannot approve a case you opened.</p></div></div>
  ${cases.length ? cases.map((k) => html`<article class="card stack" style="margin-bottom:16px"><div class="row between"><h3>${k.title}</h3>${statusBadge(k.status)}</div>
    <table class="table"><tbody>
      <tr><th>Legal basis</th><td>${k.legalBasisLabel}</td></tr><tr><th>Description</th><td>${k.legalText}</td></tr>
      <tr><th>Reference</th><td>${k.refNo}, dated ${k.refDate}</td></tr><tr><th>Issuing authority</th><td>${k.authority}</td></tr>
      <tr><th>Approving supervisor named</th><td>${k.supervisor}</td></tr><tr><th>Opened by</th><td>${k.createdByName} on ${fmtDateTime(k.createdAt)}</td></tr>
      <tr><th>Notice acknowledged</th><td>${k.noticeVersion}</td></tr></tbody></table>
    ${k.own ? raw(`<p class="note warn">You opened this case, so another Approver must decide it.</p>`) : raw(`<div class="stack-sm"><label class="check"><input type="checkbox" data-chk="${k.id}"> <span>I have checked the legal basis and reference for this case.</span></label>
      <textarea class="textarea" data-note="${k.id}" placeholder="Note (required when rejecting)" style="min-height:60px"></textarea>
      <div class="row end"><button class="btn btn-danger" data-dec="reject" data-id="${k.id}">Reject</button><button class="btn btn-primary" data-dec="approve" data-id="${k.id}">Approve</button></div></div>`)}</article>`).join("")
    : `<div class="empty"><h3>Nothing to approve</h3><p>New cases appear here.</p></div>`}`;
  view.onclick = async (e) => {
    const b = e.target.closest("[data-dec]"); if (!b) return;
    const id = b.dataset.id;
    try {
      await api(`/api/cases/${id}/decision`, { body: { decision: b.dataset.dec, note: view.querySelector(`[data-note="${id}"]`).value, checked: view.querySelector(`[data-chk="${id}"]`).checked } });
      toast(b.dataset.dec === "approve" ? "Case approved. Data can now be imported." : "Case rejected.");
      S.me = await api("/api/me"); shell(); route();
    } catch (err) { toast(err.message, "err"); }
  };
}

// ------------------------------------------------------------------ search across cases

function searchAll(view) {
  crumbs([{ label: "Search all cases" }]);
  view.innerHTML = `<div class="page-head"><div><span class="eyebrow">Bulk number search</span><h1>Search all your cases</h1><p class="sub">Find which of your cases contain one or more numbers, as A or B party. Only cases you are assigned to are searched. Every search is recorded in the audit log.</p></div></div>
  <form id="f" class="card stack"><div class="field"><label for="nums">Numbers (one per line, or separated by commas)</label><textarea class="textarea" id="nums" placeholder="9800000101&#10;+91 98000 01005"></textarea></div><div class="row end"><button class="btn btn-primary" type="submit">${ico("search")} Search</button></div></form><div id="out" class="section"></div>`;
  $("#f").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button"); setBusy(btn, true, "Searching…");
    try {
      const r = await api("/api/search/global", { body: { numbers: $("#nums").value.split(/[\s,;]+/).filter(Boolean) } });
      const common = Object.entries(r.byNumber).filter(([, v]) => v.cases > 1);
      $("#out").innerHTML = `<p class="muted">${r.casesSearched} case(s) searched; ${r.hits.length} match(es).${common.length ? ` <b>${common.length} number(s) appear in more than one case.</b>` : ""}</p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Number</th><th>Case</th><th class="num">Records</th><th>First</th><th>Last</th></tr></thead><tbody>${r.hits.map((h) => `<tr><td class="mono">${esc(dn(h.number))}${r.byNumber[h.number].cases > 1 ? ' <span class="badge warn">in several cases</span>' : ""}</td><td><a href="#/case/${esc(h.caseId)}/search">${esc(h.caseTitle)}</a></td><td class="num">${h.records}</td><td>${esc(fmtTs(h.first))}</td><td>${esc(fmtTs(h.last))}</td></tr>`).join("") || `<tr><td colspan="5">No matches.</td></tr>`}</tbody></table></div>`;
    } catch (err) { toast(err.message, "err"); }
    setBusy(btn, false);
  };
}

// ------------------------------------------------------------------ towers and reference data

async function reference(view) {
  crumbs([{ label: "Towers and reference" }]);
  const t = await api("/api/towers?cells=none");
  view.innerHTML = `<div class="page-head"><div><span class="eyebrow">Offline reference data</span><h1>Towers and reference data</h1><p class="sub">${esc(E.REFERENCE_NOTE)}</p></div></div>
  <div class="grid-2">
   <section class="card stack"><h2>Tower master</h2><p class="muted">${t.total.toLocaleString("en-IN")} cells with coordinates. Import a CSV or XLSX with cell ID or CGI, latitude, longitude and (optionally) address and azimuth. Columns are recognised automatically. Used for the map, KML export and matching meeting points across operators (cells on the same mast).</p>
     ${S.me.perms.editTowers ? `<label class="drop" id="tdrop"><input type="file" id="tfile" accept=".csv,.txt,.xlsx,.json" hidden><b>Choose a tower master file</b><br><span class="small muted">CSV, TXT, XLSX or JSON</span></label>` : `<p class="note">Only Admins and Analysts can import towers.</p>`}<div id="tout"></div></section>
   <section class="card stack"><h2>Number lookup</h2><p class="muted">Country, number type, original operator and circle, or STD city. Nothing is looked up online.</p>
     <textarea class="textarea" id="lk" placeholder="One number per line"></textarea><div class="row end"><button class="btn btn-primary" id="lkb">Look up</button></div><div id="lko"></div></section>
  </div>
  <section class="section"><h2>Bundled tables</h2><div class="grid-3">
    <details class="card"><summary><b>International (ISD) codes</b> (${Object.keys(E.ISD).length})</summary><div class="table-wrap" style="max-height:300px"><table class="table"><tbody>${Object.entries(E.ISD).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<tr><td>+${k}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div></details>
    <details class="card"><summary><b>Indian STD codes</b> (${Object.keys(E.STD).length} major cities)</summary><div class="table-wrap" style="max-height:300px"><table class="table"><tbody>${Object.entries(E.STD).map(([k, v]) => `<tr><td>0${k}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div></details>
    <details class="card"><summary><b>Indian MCC/MNC</b> (${Object.keys(E.MCC_MNC).length}, indicative)</summary><div class="table-wrap" style="max-height:300px"><table class="table"><tbody>${Object.entries(E.MCC_MNC).map(([k, v]) => `<tr><td>${k}</td><td>${esc(v.operator)}</td><td>${esc(v.circle)}</td></tr>`).join("")}</tbody></table></div></details>
  </div></section>`;
  $("#lkb").onclick = () => {
    const rows = $("#lk").value.split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 500).map((s) => { const n = E.normaliseMsisdn(s).value || s; return E.lookupNumber(n); });
    $("#lko").innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Number</th><th>Type</th><th>Country</th><th>Operator / circle or city</th><th>Note</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="mono">${esc(dn(r.number))}</td><td>${esc(r.kind)}</td><td>${esc(r.country || "")}</td><td>${esc([r.operator, r.circle, r.city].filter(Boolean).join(", "))}</td><td class="small">${esc(r.note)}</td></tr>`).join("")}</tbody></table></div>`;
  };
  $("#tfile")?.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $("#tout").innerHTML = `<div class="loading"><span class="spinner"></span> Reading ${esc(f.name)}…</div>`;
    try {
      const { table } = await E.readTable(f.name, new Uint8Array(await f.arrayBuffer()));
      const d = E.detectMapping(table); const c = d.mapping.cols;
      if (c.cell === undefined || c.lat === undefined || c.lon === undefined) throw new Error("Could not find cell, latitude and longitude columns.");
      const rows = table.slice(d.mapping.headerRow + 1).map((r) => ({ cell: r[c.cell], lat: Number(r[c.lat]), lon: Number(r[c.lon]), address: c.cellAddr !== undefined ? r[c.cellAddr] : "", azimuth: "" }));
      let stored = 0, rejected = 0;
      for (let i = 0; i < rows.length; i += 5000) { const r = await api("/api/towers", { body: { rows: rows.slice(i, i + 5000), source: f.name } }); stored += r.stored; rejected += r.rejected; }
      $("#tout").innerHTML = `<p class="note ok">${stored} towers stored from ${esc(f.name)}${rejected ? `; ${rejected} rows without valid coordinates were skipped` : ""}.</p>`;
    } catch (err) { $("#tout").innerHTML = `<p class="note danger">${esc(err.message)}</p>`; }
  });
}

// ------------------------------------------------------------------ users and roles

async function users(view) {
  crumbs([{ label: "Users and roles" }]);
  const [{ users }, reg] = await Promise.all([api("/api/users"), api("/api/admin/cases")]);
  view.innerHTML = `<div class="page-head"><div><span class="eyebrow">Admin</span><h1>Users and roles</h1><p class="sub">People appear here after their first sign-in through Kayak Internal. New people start as Viewers with no cases. <b>Admin</b> manages users, case assignment, retention and deletion. <b>Approver</b> approves or rejects new cases (four-eyes). <b>Analyst</b> opens cases, imports, analyses and exports. <b>Viewer</b> reads the cases they are assigned to. Everyone sees only the cases they are assigned to.</p></div></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last seen</th></tr></thead><tbody>${users.map((u) => html`<tr><td>${u.name}</td><td>${u.email}</td><td><select class="select" data-role="${u.id}" aria-label="Role for ${u.name}">${["admin", "approver", "analyst", "viewer"].map((r) => raw(`<option value="${r}"${u.role === r ? " selected" : ""}>${r[0].toUpperCase() + r.slice(1)}</option>`))}</select></td><td><select class="select" data-status="${u.id}" aria-label="Status for ${u.name}"><option value="active"${u.status === "active" ? " selected" : ""}>Active</option><option value="disabled"${u.status === "disabled" ? " selected" : ""}>Disabled</option></select></td><td>${fmtDateTime(u.last_seen)}</td></tr>`).join("")}</tbody></table></div>
  <section class="section"><h2>Case register</h2><p class="lead">All cases, without their data. Assign people from a case's Settings tab (Admins can open any case's settings from here).</p>
  <div class="table-wrap"><table class="table"><thead><tr><th>Case</th><th>Status</th><th>Reference</th><th class="num">Records</th><th class="num">Members</th><th>Retain until</th><th></th></tr></thead><tbody>${reg.cases.map((k) => html`<tr><td>${k.title}</td><td>${statusBadge(k.status)}</td><td>${k.ref_no}</td><td class="num">${k.record_count}</td><td class="num">${k.members}</td><td>${k.retain_until || ""}</td><td>${k.status !== "deleted" ? raw(`<button class="btn btn-quiet btn-sm" data-join="${esc(k.id)}">Assign people</button>`) : ""}</td></tr>`).join("")}</tbody></table></div></section>`;
  view.onchange = async (e) => {
    const s = e.target; const id = s.dataset.role || s.dataset.status; if (!id) return;
    try { await api(`/api/users/${id}`, { method: "PATCH", body: s.dataset.role ? { role: s.value } : { status: s.value } }); toast("Saved."); } catch (err) { toast(err.message, "err"); users(view); }
  };
  view.onclick = async (e) => {
    const b = e.target.closest("[data-join]"); if (!b) return;
    const opts = users.filter((u) => u.status === "active").map((u) => `<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.role)})</option>`).join("");
    await dialog({ title: "Assign a person to the case", body: `<div class="field"><label for="who">Person</label><select class="select input" id="who">${opts}</select></div><p class="small muted">They will see this case's data according to their role. The assignment is recorded in the audit log.</p>`,
      actions: [{ id: "x", label: "Cancel" }, { id: "ok", label: "Assign", kind: "primary", handler: async (d) => { await api(`/api/cases/${b.dataset.join}/members`, { body: { userId: d.querySelector("#who").value } }); toast("Assigned."); } }] });
    users(view);
  };
}

// ------------------------------------------------------------------ audit log

async function auditPage(view) {
  crumbs([{ label: "Audit log" }]);
  const admin = S.me.perms.manageUsers;
  view.innerHTML = `<div class="page-head"><div><span class="eyebrow">Tamper-evident</span><h1>Audit log</h1><p class="sub">Every sign-in, view, search, import, export and change is written to a hash chain: each entry's SHA-256 covers the entry and the hash before it, so any change, removal or reordering breaks the chain from that point. Verify checks every entry.</p></div><button class="btn btn-primary" id="ver">${ico("shield")} Verify the audit chain</button></div>
  <div id="vres"></div>${admin ? `<div id="list" class="section"></div>` : `<p class="note">Case audit trails are on each case's Audit tab. The full log is visible to Admins.</p>`}`;
  $("#ver").onclick = () => verifyChain($("#vres"), $("#ver"));
  if (admin) {
    const { entries } = await api("/api/audit");
    $("#list").innerHTML = auditTable(entries, true);
  }
}
export async function verifyChain(out, btn, caseId) {
  setBusy(btn, true, "Verifying…");
  try {
    const r = await api(`/api/audit/verify${caseId ? `?case=${caseId}` : ""}`, { body: {} });
    out.innerHTML = r.ok ? `<p class="note ok"><span class="audit-ok">Chain intact.</span> All ${r.entries.toLocaleString("en-IN")} entries verified. Head hash <span class="code-hash">${esc(r.head)}</span></p>` : `<p class="note danger"><span class="audit-bad">Chain broken at entry ${r.brokenAt}.</span> ${esc(r.reason)} Report this to an administrator.</p>`;
  } catch (e) { out.innerHTML = `<p class="note danger">${esc(e.message)}</p>`; }
  setBusy(btn, false);
}
export const auditTable = (entries, showCase) => `<div class="table-wrap"><table class="table"><thead><tr><th class="num">#</th><th>When</th><th>Who</th>${showCase ? "<th>Case</th>" : ""}<th>Action</th><th>Detail</th><th>Hash</th></tr></thead><tbody>${entries.map((e) => `<tr><td class="num">${e.seq}</td><td>${esc(fmtDateTime(e.at))}</td><td>${esc(e.user_email || "system")}</td>${showCase ? `<td class="mono small">${esc((e.case_id || "").slice(0, 8))}</td>` : ""}<td><b>${esc(e.action)}</b></td><td class="small" style="max-width:420px;word-break:break-word">${esc(e.detail || "")}</td><td class="code-hash">${esc(e.hash.slice(0, 16))}…</td></tr>`).join("")}</tbody></table></div>`;

export { download, run };
boot();
