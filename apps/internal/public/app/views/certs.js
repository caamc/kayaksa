import { api, esc, ico, toast, dialog, confirmDialog } from "/_shared/js/ui.js";
import { gantt, fmt } from "/app/charts.js";

// Certification journeys for Kayak, its affiliates and its tools: steps, owners, dates, cost, and
// a forecast against the target date.
const ST = { planned: ["Planned", ""], in_progress: ["In progress", "amber"], audit: ["At audit", "amber"], certified: ["Certified", "green"], lapsed: ["Lapsed", "red"], dropped: ["Dropped", "done"] };
const COL = { "Kayak Strategic Advisors": "#17807E", "Kayak Innovations": "#EE9B1E", "Kayak Technology Solutions": "#2D6A9F", NexaPair: "#0B5654", SayUsNow: "#5E4B78", DocuVow: "#9C630E" };

export async function render(main, { me }) {
  const d = await api("/api/ops/certs");
  const certs = d.certs;
  const entities = [...new Set(certs.map((c) => c.entity))];
  const late = certs.filter((c) => c.slipDays > 0 && c.status !== "certified");
  const est = certs.reduce((a, c) => a + (c.cost_est || 0), 0), spent = certs.reduce((a, c) => a + (c.cost_actual || 0), 0);
  main.innerHTML = `<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Governance</span><h1>Certification journeys</h1><p class="lead">Every certification Kayak, its affiliates and its tools are working towards: the steps, who owns each, how long it should take, what it costs, and whether it will land on time.</p></div>
      ${me.can.admin ? `<button class="btn btn-primary" id="add">${ico("plus")} Add a journey</button>` : ""}</div>
    <div class="note small">The starting plans are suggestions with planning estimates of cost. Confirm dates and quotes with the certifying body before relying on them. Nothing is shown as certified until an administrator records it.</div>
    <section class="kpis">
      <div class="kpi2"><span class="t">Journeys</span><b>${certs.length}</b><small>${entities.length} entities and tools</small></div>
      <div class="kpi2"><span class="t">Certified</span><b>${certs.filter((c) => c.status === "certified").length}</b><small>recorded by an administrator</small></div>
      <div class="kpi2"><span class="t">Forecast late</span><b>${late.length}</b><small>${late.length ? esc(late.map((c) => c.standard).slice(0, 2).join(", ")) : "all on track"}</small></div>
      <div class="kpi2"><span class="t">Budget, estimated</span><b>₹${fmt(est / 100000, 1)} L</b><small>₹${fmt(spent / 100000, 1)} L spent so far</small></div>
    </section>
    <div class="panel2"><h3>Timeline <small>saffron line is today; filled part is progress</small></h3>${gantt(certs.map((c) => ({ label: c.standard, sub: c.entity, start: c.start_date || c.created_at.slice(0, 10), end: c.target_date || c.forecast, progress: c.progress, color: COL[c.entity] || "#3E5563" })))}</div>
    ${entities.map((e) => `<section class="stack-sm"><h2 style="font-size:1.15rem;display:flex;gap:8px;align-items:center"><i style="width:12px;height:12px;background:${COL[e] || "#3E5563"};display:inline-block"></i>${esc(e)}</h2>
      <div class="dgrid">${certs.filter((c) => c.entity === e).map((c) => `<article class="panel2 s6">
        <h3><span>${esc(c.standard)}</span><span class="rag ${ST[c.status]?.[1] || ""}">${esc(ST[c.status]?.[0] || c.status)}</span></h3>
        <div class="row wrap-row small muted"><span>${esc(c.body || "")}</span><span>Owner: ${esc(c.owner || "–")}</span><span>Target: ${c.target_date ? new Date(c.target_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–"}</span><span>Forecast: ${new Date(c.forecast).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${c.slipDays > 0 && c.status !== "certified" ? ` <b class="danger">(${c.slipDays} days late)</b>` : ""}</span><span>Est. ₹${fmt(c.cost_est || 0)}</span></div>
        <ul class="kc-bars"><li><span class="lb">Progress</span><span class="tr"><i style="width:${c.progress}%;background:${COL[c.entity] || "#17807E"}"></i></span><b>${c.progress}%</b></li></ul>
        <ol class="steps-plain">${c.steps.map((s) => `<li class="row between" style="gap:8px"><label class="row" style="gap:8px;min-width:0"><input type="checkbox" data-step="${s.id}" ${s.done_at ? "checked" : ""} ${me.can.admin ? "" : "disabled"}> <span style="${s.done_at ? "text-decoration:line-through;color:var(--faint)" : ""}">${esc(s.title)}</span></label><span class="small ${!s.done_at && s.due_date < new Date().toISOString().slice(0, 10) ? "danger" : "muted"}">${s.days} d · ${s.due_date ? new Date(s.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</span></li>`).join("")}</ol>
        ${c.overdue.length ? `<p class="small danger">Overdue: ${c.overdue.map((o) => `${esc(o.title)} (${esc(o.owner || "no owner")})`).join("; ")}</p>` : ""}
        ${me.can.admin ? `<div class="row"><button class="btn btn-ghost btn-sm" data-edit="${c.id}">${ico("edit")} Update</button></div>` : ""}
      </article>`).join("")}</div></section>`).join("")}
  </div>`;
  main.querySelectorAll("[data-step]").forEach((cb) => cb.addEventListener("change", async () => { await api(`/api/ops/cert-steps/${cb.dataset.step}`, { body: { done: cb.checked } }); render(main, { me }); }));
  main.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
    const c = certs.find((x) => x.id === b.dataset.edit);
    dialog({ title: `${c.standard} · ${c.entity}`, body: `<div class="stack-sm">
      <div class="field"><label>Status</label><select class="input" id="st">${Object.entries(ST).map(([k, v]) => `<option value="${k}" ${k === c.status ? "selected" : ""}>${v[0]}</option>`).join("")}</select></div>
      <div class="field"><label>Owner</label><input class="input" id="ow" value="${esc(c.owner || "")}"></div>
      <div class="field"><label>Certifying body</label><input class="input" id="bd" value="${esc(c.body || "")}"></div>
      <div class="row"><div class="field"><label>Target date</label><input class="input" type="date" id="td" value="${esc(c.target_date || "")}"></div><div class="field"><label>Achieved</label><input class="input" type="date" id="ad" value="${esc(c.achieved_date || "")}"></div><div class="field"><label>Expires</label><input class="input" type="date" id="ed" value="${esc(c.expiry_date || "")}"></div></div>
      <div class="row"><div class="field"><label>Estimated cost (₹)</label><input class="input" type="number" id="ce" value="${c.cost_est || 0}"></div><div class="field"><label>Spent (₹)</label><input class="input" type="number" id="ca" value="${c.cost_actual || 0}"></div></div>
      <div class="field"><label>Notes</label><textarea class="input" id="nt" rows="3">${esc(c.notes || "")}</textarea></div></div>`,
      actions: [{ id: "del", label: "Delete" }, { id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (dl) => {
        const v = (id) => dl.querySelector(id).value;
        await api(`/api/ops/certs/${c.id}`, { body: { status: v("#st"), owner: v("#ow"), body: v("#bd"), target_date: v("#td"), achieved_date: v("#ad"), expiry_date: v("#ed"), cost_est: v("#ce"), cost_actual: v("#ca"), notes: v("#nt") } });
        toast("Saved."); render(main, { me });
      } }],
    }).then(async (r) => { if (r === "del" && (await confirmDialog("Delete this journey?", `${c.standard} for ${c.entity}, with its steps.`, "Delete", true))) { await api(`/api/ops/certs/${c.id}/delete`, { body: {} }); render(main, { me }); } });
  }));
  main.querySelector("#add")?.addEventListener("click", () => dialog({ title: "Add a certification journey", body: `<div class="stack-sm">
      <div class="field"><label>Entity or tool</label><input class="input" id="en" list="ents" placeholder="Kayak Strategic Advisors"><datalist id="ents">${Object.keys(COL).map((e) => `<option>${esc(e)}</option>`).join("")}</datalist></div>
      <div class="field"><label>Standard</label><input class="input" id="sd" list="stds" placeholder="ISO/IEC 27001:2022"><datalist id="stds">${d.journeys.map((j) => `<option>${esc(j)}</option>`).join("")}</datalist><span class="hint">A known standard loads its suggested steps and durations.</span></div>
      <div class="row"><div class="field"><label>Start</label><input class="input" type="date" id="sdt"></div><div class="field"><label>Owner</label><input class="input" id="ow"></div><div class="field"><label>Estimated cost (₹)</label><input class="input" type="number" id="ce"></div></div></div>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Add", kind: "primary", handler: async (dl) => {
      const v = (id) => dl.querySelector(id).value;
      await api("/api/ops/certs", { body: { entity: v("#en"), standard: v("#sd"), start_date: v("#sdt"), owner: v("#ow"), cost_est: v("#ce") } });
      toast("Added."); render(main, { me });
    } }] }));
}
