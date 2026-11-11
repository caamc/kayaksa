import { $, $$, api, esc, html, raw, ico, toast, fmtDateTime } from "/_shared/js/ui.js";

const TABS = [["overview", "Standards and status"], ["events", "Security events"], ["blocks", "Blocked visitors"], ["audit", "Audit trail"]];
const SITES = [["www", "www.kayaksa.com"], ["internal", "internal.kayaksa.com"], ["learn", "learn.kayaksa.com"]];
const SEV = { low: ["Low", ""], medium: ["Medium", "warn"], high: ["High", "danger"], critical: ["Critical", "danger"] };
const label = (k) => k.replace(/[._]/g, " ").replace(/^\w/, (x) => x.toUpperCase());

export async function render(main, ctx) {
  const tab = ctx.view === "audit" ? "audit" : TABS.some((t) => t[0] === ctx.rest[0]) ? ctx.rest[0] : "overview";
  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayak Shield</span><h1>Security</h1><p class="lead">The standards Kayak works to, what the firewall has stopped, and a full audit trail for every site.</p></div></div>
    <nav class="chips" aria-label="Security sections">${TABS.map(([id, l]) => raw(`<a class="chip${id === tab ? " on" : ""}" href="#/security/${id}">${esc(l)}</a>`))}</nav>
    <div id="sb"><div class="row muted"><span class="spinner"></span> Loading…</div></div></div>`);
  const box = $("#sb");
  try { await ({ overview, events, blocks, audit })[tab](box); }
  catch (e) { box.innerHTML = String(html`<div class="note danger">${e.message}</div>`); }
}

const pill = (st) => {
  const m = { on: ["In place", "ok"], attention: ["Needs attention", "warn"], edge: ["Cloudflare", "accent"], process: ["Process", ""] }[st] || [st, ""];
  return `<span class="badge ${m[1]}">${esc(m[0])}</span>`;
};

async function overview(box) {
  const o = await api("/api/security/overview");
  const sev = (s, k) => (s.severity || []).find((r) => r.severity === k)?.n || 0;
  box.innerHTML = `<div class="stack">
    <section class="grid">${o.sites.map((s) => `<div class="card flat kpi"><b>${s.connected ? (s.pending ? "—" : s.last24) : "—"}</b><span>${esc(SITES.find((x) => x[0] === s.site)[1])}: events, 24 h</span>
      ${s.connected && !s.pending ? `<small class="muted">${sev(s, "high") + sev(s, "critical")} serious this week · ${s.activeBlocks} blocked now</small>` : `<small class="muted">${s.pending ? "Starts after the next deploy" : "Not connected"}</small>`}</div>`).join("")}</section>
    <div class="note ${o.mail ? "" : "warn"} row between wrap-row"><span>${o.mail ? `Serious events are emailed straight away to ${o.directors.map(esc).join(", ")}.` : `Alerts are recorded here, but email is not switched on yet. Add <b>RESEND_API_KEY</b> to the GitHub secrets so the directors are emailed the moment something serious happens.`}</span>
      ${o.mail ? `<button class="btn btn-ghost btn-sm" id="test">${ico("send")} Send a test alert</button>` : ""}</div>
    ${o.standards.map((g) => `<div class="card stack-sm"><h3>${esc(g.area)}</h3><table class="table"><tbody>${g.items.map((i) => `<tr><td>${esc(i.what)}<br><span class="small faint">${esc(i.ref)}</span></td><td style="text-align:right;white-space:nowrap">${pill(i.status)}</td></tr>`).join("")}</tbody></table></div>`).join("")}
    <div class="card stack-sm"><h3>If something serious happens</h3><ol class="steps-plain">
      <li><b>Contain.</b> The firewall has already blocked the address for ${o.blockHours} hours. Lift or extend it under Blocked visitors.</li>
      <li><b>Assess within the hour.</b> Open the event, check the audit trail for that address and device signature, and decide whether data or accounts were affected.</li>
      <li><b>Report to CERT-In within six hours</b> if it is a reportable incident (for example unauthorised access, data breach, compromise of accounts, website defacement, or an attack on servers). Email incident@cert-in.org.in using the CERT-In incident form.</li>
      <li><b>Personal data breach.</b> Under the DPDP Act and Rules, inform the Data Protection Board and the affected people without delay, with what happened, the likely impact and what they can do.</li>
      <li><b>Record and learn.</b> Note the outcome and what changed, so the next review can check it.</li></ol>
      <p class="small muted">Security records are kept ${o.retentionDays} days, as the CERT-In Directions require. Staff and visitor audit entries are kept three years.</p></div>
  </div>`;
  $("#test")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try { toast((await api("/api/security/test-alert", { method: "POST" })).note); } catch (x) { toast(x.message, "danger"); }
    e.target.disabled = false;
  });
}

const siteSelect = (cur) => `<select id="site" aria-label="Site">${SITES.map(([v, l]) => `<option value="${v}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const detailText = (d) => { try { const o = JSON.parse(d || "{}"); return Object.entries(o).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · "); } catch { return d || ""; } };

async function events(box, st = { site: "internal", severity: "", q: "" }) {
  const r = await api(`/api/security/events?site=${st.site}&severity=${st.severity}&q=${encodeURIComponent(st.q)}`);
  box.innerHTML = `<div class="stack">
    <div class="row wrap-row">${siteSelect(st.site)}
      <select id="sev" aria-label="Severity"><option value="">All severities</option>${Object.entries(SEV).map(([k, v]) => `<option value="${k}"${k === st.severity ? " selected" : ""}>${v[0]}</option>`).join("")}</select>
      <input id="q" type="search" placeholder="Address, signature, path…" value="${esc(st.q)}" style="flex:1 1 220px"></div>
    ${r.events.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Event</th><th>Address</th><th>Signature</th><th>Path</th><th>Detail</th></tr></thead><tbody>
      ${r.events.map((e) => `<tr><td class="nowrap">${fmtDateTime(e.at)}</td><td><span class="badge ${SEV[e.severity]?.[1] || ""}">${esc(SEV[e.severity]?.[0] || e.severity)}</span> ${esc(label(e.kind))}</td><td class="mono">${esc(e.ip || "")}</td><td class="mono small">${esc(e.fp || "")}</td><td class="small">${esc(e.path || "")}</td><td class="small muted" title="${esc(e.ua || "")}">${esc(detailText(e.detail))}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty"><p>No security events${st.q || st.severity ? " match" : " yet"}. Quiet is good.</p></div>`}</div>`;
  const re = () => events(box, { site: $("#site").value, severity: $("#sev").value, q: $("#q").value.trim() });
  $("#site").onchange = re; $("#sev").onchange = re;
  $("#q").addEventListener("keydown", (e) => e.key === "Enter" && re());
}

async function blocks(box) {
  const r = await api("/api/security/blocks");
  const now = Date.now();
  box.innerHTML = r.blocks.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Site</th><th>Address</th><th>Signature</th><th>Why</th><th>Since</th><th>Until</th><th></th></tr></thead><tbody>
    ${r.blocks.map((b) => { const live = b.until > now && !b.lifted_at; return `<tr><td>${esc(b.site)}</td><td class="mono">${esc(b.ip || "")}</td><td class="mono small">${esc(b.fp || "")}</td><td>${esc(b.reason)}</td><td class="nowrap">${fmtDateTime(b.created_at)}</td>
      <td class="nowrap">${b.lifted_at ? `Lifted by ${esc(b.lifted_by || "")}` : live ? fmtDateTime(new Date(b.until).toISOString()) : "Expired"}</td>
      <td>${live ? `<button class="btn btn-ghost btn-sm" data-lift="${b.site}/${b.id}">Lift</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty"><p>No one has been blocked in the last day.</p></div>`;
  $$("[data-lift]", box).forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { toast((await api(`/api/security/blocks/${b.dataset.lift}/lift`, { method: "POST" })).note); blocks(box); } catch (e) { toast(e.message, "danger"); b.disabled = false; }
  }));
}

async function audit(box, st = { site: "internal", q: "", from: "", to: "" }) {
  const qs = `site=${st.site}&q=${encodeURIComponent(st.q)}&from=${st.from}&to=${st.to}`;
  const r = await api(`/api/security/audit?${qs}`);
  box.innerHTML = `<div class="stack">
    <div class="row wrap-row">${siteSelect(st.site)}
      <label class="row small">From <input id="from" type="date" value="${esc(st.from)}"></label><label class="row small">To <input id="to" type="date" value="${esc(st.to)}"></label>
      <input id="q" type="search" placeholder="Person, action, address…" value="${esc(st.q)}" style="flex:1 1 200px">
      <a class="btn btn-ghost btn-sm" href="/api/security/audit.csv?${qs}">${ico("download")} Export CSV</a></div>
    ${r.rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date and time</th><th>Who</th><th>Action</th><th>IP address</th><th>Device signature</th><th>Detail</th></tr></thead><tbody>
      ${r.rows.map((a) => `<tr><td class="nowrap" title="${esc(a.at)}">${fmtDateTime(a.at)}<br><span class="small faint mono">${esc(a.at)}</span></td><td>${esc(a.who || (st.site === "www" ? "Visitor" : "System"))}${a.email && a.email !== a.who ? `<br><span class="small muted">${esc(a.email)}</span>` : ""}</td>
        <td>${esc(label(a.action))}</td><td class="mono">${esc(a.ip || "")}</td><td class="mono small" title="${esc(a.ua || "")}">${esc(a.fp || "")}</td><td class="small muted">${esc(detailText(a.detail))}</td></tr>`).join("")}</tbody></table></div><p class="small muted">Showing the latest ${r.rows.length}. Export for the full range.</p>`
      : `<div class="empty"><p>No audit entries${st.q || st.from ? " match these filters" : " yet"}.</p></div>`}</div>`;
  const re = () => audit(box, { site: $("#site").value, q: $("#q").value.trim(), from: $("#from").value, to: $("#to").value });
  ["#site", "#from", "#to"].forEach((s) => ($(s).onchange = re));
  $("#q").addEventListener("keydown", (e) => e.key === "Enter" && re());
}
