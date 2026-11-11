import { api, esc, ico, toast, dialog, confirmDialog, fmtDateTime } from "/_shared/js/ui.js";
import { fmt, compact, bars } from "/app/charts.js";

// Client Tools and Client Tools Monitoring: what Kayak runs for each client, renewals and value,
// and the uptime and speed of every endpoint, checked every 15 minutes.
const DS = { prospect: ["Prospect", ""], pilot: ["Pilot", "amber"], live: ["Live", "green"], paused: ["Paused", "done"], ended: ["Ended", "done"] };
const pct = (v) => (v == null ? "–" : `${v >= 99.95 ? "100" : v.toFixed(2)}%`);

function strip(series) {
  if (!series.length) return `<span class="small muted">No checks yet</span>`;
  const max = Math.max(...series.map((s) => s[2] || 0), 1);
  return `<div class="upstrip" aria-label="Last ${series.length} checks">${series.map(([at, ok, ms]) => `<i class="${ok ? "" : "bad"}" style="--h:${ok ? Math.max(0.15, (ms || 0) / max) : 1}" title="${new Date(at).toLocaleString("en-IN")} · ${ok ? `${ms} ms` : "down"}"></i>`).join("")}</div>`;
}

export async function render(main, { me, rest }) {
  const tab = rest[0] === "monitoring" ? "monitoring" : "tools";
  const d = await api("/api/clienttools");
  const live = d.deployments.filter((x) => x.status === "live"), arr = live.reduce((a, x) => a + (x.value || 0), 0);
  const due = d.deployments.filter((x) => x.renewInDays != null && x.renewInDays <= 60 && x.status !== "ended");
  const openInc = d.incidents.filter((i) => !i.resolved_at);
  const up = d.monitors.filter((m) => m.last?.ok).length;
  main.innerHTML = `<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayak Solutions</span><h1>Client tools</h1><p class="lead">Every client deployment of NexaPair, SayUsNow, DocuVow, Kayak Learn and Kayak Meet, with renewals and value, and live monitoring of every endpoint our clients rely on.</p></div>
      <div class="seg"><a class="btn btn-sm ${tab === "tools" ? "btn-primary" : "btn-ghost"}" href="#/clienttools">Deployments</a><a class="btn btn-sm ${tab === "monitoring" ? "btn-primary" : "btn-ghost"}" href="#/clienttools/monitoring">Monitoring</a></div></div>
    <section class="kpis">
      <div class="kpi2"><span class="t">Live deployments</span><b>${live.length}</b><small>${d.deployments.filter((x) => x.status === "pilot").length} pilots</small></div>
      <div class="kpi2"><span class="t">Annual value, live</span><b>₹${compact(arr)}</b><small>as recorded</small></div>
      <div class="kpi2"><span class="t">Renewals in 60 days</span><b class="${due.length ? "warn" : ""}">${due.length}</b><small>${due.slice(0, 2).map((x) => esc(x.client)).join(", ")}</small></div>
      <div class="kpi2"><span class="t">Endpoints up</span><b class="${up < d.monitors.length ? "danger" : ""}">${up}/${d.monitors.length}</b><small>${openInc.length} open incident${openInc.length === 1 ? "" : "s"}</small></div>
    </section>
    ${tab === "tools" ? `
    <section class="tiles">${d.tools.map((t) => { const n = d.deployments.filter((x) => x.tool === t.id); return `<div class="tile" style="min-height:0;border-top:4px solid ${t.color}"><h3>${esc(t.name)}</h3><p>${esc(t.kind)}</p><p class="small"><b>${n.filter((x) => x.status === "live").length}</b> live · <b>${n.filter((x) => x.status === "pilot").length}</b> pilot${t.site ? ` · <a href="https://${esc(t.site)}" target="_blank" rel="noopener">${esc(t.site)}</a>` : ""}</p></div>`; }).join("")}</section>
    <div class="panel2"><h3>Deployments ${me.can.admin ? `<button class="btn btn-primary btn-sm" id="adddep">${ico("plus")} Add a deployment</button>` : ""}</h3>
      ${d.deployments.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Tool</th><th>Plan</th><th>Region</th><th>Seats</th><th>Status</th><th>Renewal</th><th>Annual value</th><th>Owner</th><th></th></tr></thead><tbody>${d.deployments.map((x) => `<tr><td><b>${esc(x.client)}</b>${x.url ? `<br><a class="small" href="${esc(x.url)}" target="_blank" rel="noopener">open</a>` : ""}</td><td>${esc(d.tools.find((t) => t.id === x.tool)?.name || x.tool)}</td><td>${esc(x.plan || "")}</td><td>${esc(x.region || "")}</td><td>${fmt(x.seats)}</td><td><span class="rag ${DS[x.status]?.[1]}">${DS[x.status]?.[0]}</span></td><td class="${x.renewInDays != null && x.renewInDays <= 60 ? "warn" : ""}">${x.renewal_date ? `${new Date(x.renewal_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}<br><span class="small">${x.renewInDays} days</span>` : "–"}</td><td>${x.value ? `₹${fmt(x.value)}` : "–"}</td><td class="small">${esc(x.owner || "")}</td><td>${me.can.admin ? `<button class="btn btn-quiet btn-sm" data-dep="${esc(x.id)}">${ico("edit")}</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No client deployments recorded yet. Add the first one when a pilot starts.</p>`}</div>` : `
    <div class="panel2"><h3>Endpoints <small>last check ${d.lastCheck ? fmtDateTime(d.lastCheck) : "never"} · every 15 minutes</small><span class="row"><button class="btn btn-ghost btn-sm" id="check">${ico("refresh")} Check now</button>${me.can.admin ? `<button class="btn btn-primary btn-sm" id="addmon">${ico("plus")} Add</button>` : ""}</span></h3>
      <div class="mons">${d.monitors.map((m) => `<div class="mon"><div class="row between"><span class="row" style="gap:8px"><span class="statusdot ${m.last ? (m.last.ok ? "ok" : "bad") : ""}"></span><b>${esc(m.name)}</b></span>${me.can.admin ? `<button class="btn btn-quiet btn-sm" data-delmon="${esc(m.id)}" aria-label="Remove">${ico("trash")}</button>` : ""}</div>
        <a class="small" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.url.replace(/^https:\/\//, ""))}</a>
        ${strip(m.series)}
        <div class="row wrap-row small"><span>24 h <b>${pct(m.up24)}</b></span><span>7 d <b>${pct(m.up7)}</b></span><span>30 d <b>${pct(m.up30)}</b></span><span>avg <b>${m.avg ?? "–"} ms</b></span><span>p95 <b>${m.p95 ?? "–"} ms</b></span></div></div>`).join("")}</div></div>
    <div class="dgrid"><div class="panel2 s6"><h3>Average response time <small>ms, last 30 days</small></h3>${bars(d.monitors.filter((m) => m.avg).map((m) => [m.name, m.avg]), { beacon: d.monitors.filter((m) => m.avg).reduce((bi, m, i, a) => (m.avg > a[bi].avg ? i : bi), 0) })}</div>
    <div class="panel2 s6"><h3>Incidents <small>opened after two failed checks in a row</small></h3>${d.incidents.length ? `<div class="tlist">${d.incidents.map((i) => `<div><span class="statusdot ${i.resolved_at ? "ok" : "bad"}"></span><span><b>${esc(i.title)}</b><br><span class="small muted">${fmtDateTime(i.started_at)}${i.resolved_at ? ` → resolved ${fmtDateTime(i.resolved_at)}` : " · open"}</span></span><span></span></div>`).join("")}</div>` : `<p class="small muted">No incidents. Everything has answered.</p>`}</div></div>`}
  </div>`;
  main.querySelector("#check")?.addEventListener("click", async (e) => { e.target.disabled = true; await api("/api/clienttools/check", { method: "POST" }); render(main, { me, rest }); });
  main.querySelector("#addmon")?.addEventListener("click", () => dialog({ title: "Monitor an endpoint", body: `<div class="stack-sm"><div class="field"><label>Name</label><input class="input" id="n"></div><div class="field"><label>Address</label><input class="input" id="u" placeholder="https://"></div><div class="field"><label>Tool</label><select class="input" id="t">${d.tools.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div></div>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Add", kind: "primary", handler: async (dl) => { await api("/api/clienttools/monitors", { body: { name: dl.querySelector("#n").value, url: dl.querySelector("#u").value, tool: dl.querySelector("#t").value } }); render(main, { me, rest }); } }] }));
  main.querySelectorAll("[data-delmon]").forEach((b) => b.addEventListener("click", async () => { if (await confirmDialog("Stop monitoring this endpoint?", "Its check history is removed.", "Remove", true)) { await api(`/api/clienttools/monitors/${b.dataset.delmon}/delete`, { body: {} }); render(main, { me, rest }); } }));
  const depForm = (x = {}) => dialog({ title: x.id ? `${x.client} · ${x.tool}` : "Add a deployment", body: `<div class="stack-sm">
      <div class="row"><div class="field"><label>Client</label><input class="input" id="cl" value="${esc(x.client || "")}"></div><div class="field"><label>Tool</label><select class="input" id="tl">${d.tools.map((t) => `<option value="${t.id}" ${t.id === x.tool ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></div></div>
      <div class="row"><div class="field"><label>Plan</label><input class="input" id="pl" value="${esc(x.plan || "")}"></div><div class="field"><label>Region</label><input class="input" id="rg" value="${esc(x.region || "")}" placeholder="India, UAE…"></div><div class="field"><label>Seats</label><input class="input" type="number" id="se" value="${x.seats || ""}"></div></div>
      <div class="row"><div class="field"><label>Status</label><select class="input" id="st">${Object.entries(DS).map(([k, v]) => `<option value="${k}" ${k === (x.status || "pilot") ? "selected" : ""}>${v[0]}</option>`).join("")}</select></div><div class="field"><label>Start</label><input class="input" type="date" id="sd" value="${x.start_date || ""}"></div><div class="field"><label>Renewal</label><input class="input" type="date" id="rd" value="${x.renewal_date || ""}"></div></div>
      <div class="row"><div class="field"><label>Annual value (₹)</label><input class="input" type="number" id="va" value="${x.value || ""}"></div><div class="field"><label>Owner</label><input class="input" id="ow" value="${esc(x.owner || "")}"></div></div>
      <div class="field"><label>Client's address for the tool</label><input class="input" id="ur" value="${esc(x.url || "")}" placeholder="https://"></div>
      <div class="field"><label>Notes</label><textarea class="input" id="nt" rows="2">${esc(x.notes || "")}</textarea></div></div>`,
    actions: [...(x.id ? [{ id: "del", label: "Delete" }] : []), { id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (dl) => { const v = (s) => dl.querySelector(s).value; await api("/api/clienttools/deployments", { body: { id: x.id, client: v("#cl"), tool: v("#tl"), plan: v("#pl"), region: v("#rg"), seats: v("#se"), status: v("#st"), start_date: v("#sd"), renewal_date: v("#rd"), value: v("#va"), owner: v("#ow"), url: v("#ur"), notes: v("#nt") } }); toast("Saved."); render(main, { me, rest }); } }] })
    .then(async (r) => { if (r === "del" && (await confirmDialog("Delete this deployment?", x.client, "Delete", true))) { await api(`/api/clienttools/deployments/${x.id}/delete`, { body: {} }); render(main, { me, rest }); } });
  main.querySelector("#adddep")?.addEventListener("click", () => depForm());
  main.querySelectorAll("[data-dep]").forEach((b) => b.addEventListener("click", () => depForm(d.deployments.find((x) => x.id === b.dataset.dep))));
}
