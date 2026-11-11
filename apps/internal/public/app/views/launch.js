import { api, esc, ico, toast, dialog, confirmDialog } from "/_shared/js/ui.js";
import { gantt, fmt } from "/app/charts.js";

// Launch monitor: for each application, the launch date, what must finish first, how long it will
// take, what it will cost, whether it will land on time and, if not, who is accountable.
const RAG = { green: "On track", amber: "At risk", red: "Late", done: "Launched" };
const IST = { todo: "To do", doing: "In progress", blocked: "Blocked", done: "Done" };
const d8 = (s) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–");

export async function render(main, { me, query }) {
  const d = await api("/api/ops/launches");
  const L = d.launches;
  const tv = query?.get("tv") === "1";
  const totals = { cost: L.reduce((a, l) => a + l.costToComplete, 0), items: L.reduce((a, l) => a + l.items.filter((i) => i.status !== "done").length, 0), late: L.filter((l) => l.rag === "red").length, risk: L.filter((l) => l.rag === "amber").length };
  main.innerHTML = `<div class="page ${tv ? "tv" : ""}">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Launch monitor</span><h1>Every launch, and what stands in its way</h1><p class="lead">Readiness, the work left, the time it needs, the cost to finish, the forecast date and, where a launch is slipping, who is accountable.</p></div>
      <div class="row wrap-row"><a class="btn btn-ghost" href="#/launch?tv=1">${ico("eye")} Monitor mode</a>${me.can.admin ? `<button class="btn btn-primary" id="add">${ico("plus")} Add a launch</button>` : ""}</div></div>
    <section class="kpis">
      <div class="kpi2"><span class="t">Launches planned</span><b>${L.filter((l) => l.status !== "launched").length}</b><small>${L.filter((l) => l.status === "launched").length} launched</small></div>
      <div class="kpi2"><span class="t">Late</span><b class="${totals.late ? "danger" : ""}">${totals.late}</b><small>${totals.risk} more at risk</small></div>
      <div class="kpi2"><span class="t">Open tasks</span><b>${totals.items}</b><small>across all launches</small></div>
      <div class="kpi2"><span class="t">Cost to complete</span><b>₹${fmt(totals.cost)}</b><small>estimated</small></div>
    </section>
    <div class="panel2"><h3>Timeline <small>bar runs from today to the target; fill shows readiness</small></h3>${gantt(L.filter((l) => l.status !== "launched").map((l) => ({ label: l.app, sub: `${RAG[l.rag]} · forecast ${d8(l.forecast)}`, start: new Date().toISOString().slice(0, 10), end: l.target_date > l.forecast ? l.target_date : l.forecast, progress: l.readiness, color: l.rag === "red" ? "#B4472F" : l.rag === "amber" ? "#EE9B1E" : "#17807E" })))}</div>
    ${L.map((l) => `<article class="panel2" id="l-${l.id}">
      <div class="row between wrap-row"><div class="stack-sm"><h2 style="font-size:1.2rem">${esc(l.app)} <span class="rag ${l.rag}">${RAG[l.rag]}</span></h2>
        <span class="small muted">${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url.replace(/^https?:\/\//, ""))}</a> · ` : ""}Owner ${esc(l.owner || "–")} · ${esc(l.notes || "")}</span></div>
        ${me.can.admin ? `<div class="row"><button class="btn btn-ghost btn-sm" data-ledit="${l.id}">${ico("edit")} Edit</button><button class="btn btn-ghost btn-sm" data-item="${l.id}">${ico("plus")} Task</button></div>` : ""}</div>
      <div class="kpis">
        <div class="kpi2"><span class="t">Launch date</span><b style="font-size:1.25rem">${d8(l.target_date)}</b><small>${l.status === "launched" ? `launched ${d8(l.launched_at)}` : l.daysToTarget >= 0 ? `${l.daysToTarget} days to go` : `${-l.daysToTarget} days past`}</small></div>
        <div class="kpi2"><span class="t">Forecast</span><b style="font-size:1.25rem" class="${l.slipDays > 0 ? "danger" : ""}">${d8(l.forecast)}</b><small>${l.slipDays > 0 ? `${l.slipDays} days after target` : "on or before target"}</small></div>
        <div class="kpi2"><span class="t">Readiness</span><b style="font-size:1.25rem">${l.readiness}%</b><small>${l.remainingDays} working days of tasks left</small></div>
        <div class="kpi2"><span class="t">Cost</span><b style="font-size:1.25rem">₹${fmt(l.costToComplete)}</b><small>to complete · ₹${fmt(l.costTotal)} in total</small></div>
        <div class="kpi2"><span class="t">If it slips</span><b style="font-size:1.05rem">${l.delayOwners.length ? esc(l.delayOwners.join(", ")) : "–"}</b><small>${l.overdue} overdue · ${l.blocked} blocked</small></div>
      </div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Task</th><th>Category</th><th>Days</th><th>Cost (₹)</th><th>Owner</th><th>Accountable</th><th>Due</th><th>Status</th></tr></thead><tbody>
        ${l.items.map((i) => { const od = i.status !== "done" && i.due_date && i.due_date < new Date().toISOString().slice(0, 10); return `<tr class="${i.status === "done" ? "muted" : ""}"><td>${esc(i.title)}${i.blocker ? `<br><span class="small danger">${esc(i.blocker)}</span>` : ""}</td><td class="small">${esc(i.category || "")}</td><td>${i.days}</td><td>${fmt(i.cost)}</td><td class="small">${esc(i.owner || "")}</td><td class="small">${esc(i.accountable || "")}</td><td class="small ${od ? "danger" : ""}">${d8(i.due_date)}</td>
          <td>${me.can.admin ? `<select class="input input-sm" data-is="${i.id}">${Object.entries(IST).map(([k, v]) => `<option value="${k}" ${k === i.status ? "selected" : ""}>${v}</option>`).join("")}</select>` : esc(IST[i.status])}</td></tr>`; }).join("")}
      </tbody></table></div></article>`).join("")}
  </div>`;
  if (tv) { document.documentElement.requestFullscreen?.().catch(() => {}); setTimeout(() => { if (location.hash.includes("tv=1")) render(main, { me, query }); }, 60_000); }
  main.querySelectorAll("[data-is]").forEach((s) => s.addEventListener("change", async () => {
    let blocker;
    if (s.value === "blocked") { const r = await dialog({ title: "What is blocking it?", body: `<textarea class="input" id="bk" rows="3" placeholder="For example: waiting for Razorpay KYC approval"></textarea>`, actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: (dl) => { blocker = dl.querySelector("#bk").value; } }] }); if (r !== "s") return render(main, { me, query }); }
    await api(`/api/ops/launch-items/${s.dataset.is}`, { body: { status: s.value, blocker } }); render(main, { me, query });
  }));
  main.querySelectorAll("[data-item]").forEach((b) => b.addEventListener("click", () => dialog({ title: "Add a task", body: `<div class="stack-sm">
      <div class="field"><label>Task</label><input class="input" id="t"></div>
      <div class="row"><div class="field"><label>Category</label><input class="input" id="cat" placeholder="Build, Legal, Payments…"></div><div class="field"><label>Days</label><input class="input" type="number" id="dy" value="1" min="1"></div><div class="field"><label>Cost (₹)</label><input class="input" type="number" id="co" value="0"></div></div>
      <div class="row"><div class="field"><label>Owner</label><input class="input" id="ow"></div><div class="field"><label>Accountable if it slips</label><input class="input" id="ac"></div><div class="field"><label>Due</label><input class="input" type="date" id="du"></div></div></div>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Add", kind: "primary", handler: async (dl) => { const v = (x) => dl.querySelector(x).value; await api(`/api/ops/launches/${b.dataset.item}/items`, { body: { title: v("#t"), category: v("#cat"), days: v("#dy"), cost: v("#co"), owner: v("#ow"), accountable: v("#ac"), due_date: v("#du") } }); render(main, { me, query }); } }] })));
  main.querySelectorAll("[data-ledit]").forEach((b) => b.addEventListener("click", () => {
    const l = L.find((x) => x.id === b.dataset.ledit);
    dialog({ title: l.app, body: `<div class="stack-sm"><div class="row"><div class="field"><label>Launch date</label><input class="input" type="date" id="td" value="${l.target_date}"></div><div class="field"><label>Owner</label><input class="input" id="ow" value="${esc(l.owner || "")}"></div><div class="field"><label>Status</label><select class="input" id="st">${["planned", "on_hold", "launched"].map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select></div></div><div class="field"><label>Notes</label><textarea class="input" id="nt" rows="2">${esc(l.notes || "")}</textarea></div></div>`,
      actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (dl) => { const v = (x) => dl.querySelector(x).value; await api(`/api/ops/launches/${l.id}`, { body: { target_date: v("#td"), owner: v("#ow"), status: v("#st"), notes: v("#nt") } }); toast("Saved."); render(main, { me, query }); } }] });
  }));
  main.querySelector("#add")?.addEventListener("click", () => dialog({ title: "Add a launch", body: `<div class="stack-sm"><div class="field"><label>Application</label><input class="input" id="ap"></div><div class="row"><div class="field"><label>Launch date</label><input class="input" type="date" id="td"></div><div class="field"><label>Owner</label><input class="input" id="ow"></div></div><div class="field"><label>Address</label><input class="input" id="ur" placeholder="https://"></div></div>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Add", kind: "primary", handler: async (dl) => { const v = (x) => dl.querySelector(x).value; await api("/api/ops/launches", { body: { app: v("#ap"), target_date: v("#td"), owner: v("#ow"), url: v("#ur") } }); render(main, { me, query }); } }] }));
}
