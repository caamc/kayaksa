// Roles and responsibilities: who answers for what, with reporting lines, authorities and the
// statutory roles (Company Secretary, Data Protection and Grievance Officer, finance) called out.
import { $, $$, api, esc, html, raw, ico, toast, dialog } from "/_shared/js/ui.js";

export async function render(main, ctx) {
  const { roles, users } = await api("/api/people/roles");
  const by = Object.fromEntries(roles.map((r) => [r.id, r]));
  const kids = (id) => roles.filter((r) => (r.reports_to || null) === id);
  const node = (r) => `<li><button type="button" class="org-node${r.statutory ? " stat" : ""}" data-role="${esc(r.id)}"><b>${esc(r.title)}</b><span>${r.holders.length ? esc(r.holders.map((h) => h.name || h.email).join(", ")) : "<i>Vacant</i>"}</span></button>${kids(r.id).length ? `<ul>${kids(r.id).map(node).join("")}</ul>` : ""}</li>`;
  const roots = roles.filter((r) => !r.reports_to || !by[r.reports_to]);
  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">HR and administration</span><h1>Roles and responsibilities</h1><p class="lead">Who answers for what at Kayak. Roles marked with a saffron edge are required by law or regulation.</p></div>
      ${ctx.me.can.admin ? html`<button class="btn btn-primary" id="add">${ico("plus")} Add a role</button>` : ""}</div>
    <section class="card org"><ul class="org-tree">${raw(roots.map(node).join(""))}</ul></section>
    <section class="grid wide" id="cards"></section></div>`);
  $("#cards").innerHTML = roles.map((r) => `<article class="card stack-sm role-card${r.statutory ? " stat" : ""}" id="role-${esc(r.id)}">
    <div class="row between"><h3>${esc(r.title)}</h3>${r.statutory ? `<span class="badge accent">Statutory</span>` : ""}</div>
    <p class="muted" style="margin:0">${esc(r.purpose)}</p>
    <div class="small"><b>Held by:</b> ${r.holders.length ? esc(r.holders.map((h) => h.name || h.email).join(", ")) : "Vacant"}${r.reports_to && by[r.reports_to] ? ` · <b>Reports to:</b> ${esc(by[r.reports_to].title)}` : ""}</div>
    <div><div class="label">Responsibilities</div><ul class="plain small">${r.responsibilities.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    ${r.kpis.length ? `<div><div class="label">Measures</div><p class="small muted" style="margin:0">${esc(r.kpis.join(" · "))}</p></div>` : ""}
    ${r.authorities.length ? `<div><div class="label">Authorities</div><p class="small muted" style="margin:0">${esc(r.authorities.join(" · "))}</p></div>` : ""}
    ${ctx.me.can.admin ? `<div><button class="btn btn-quiet btn-sm" data-edit="${esc(r.id)}">${ico("edit")} Edit</button></div>` : ""}</article>`).join("");
  $$("[data-role]").forEach((b) => (b.onclick = () => document.getElementById("role-" + b.dataset.role)?.scrollIntoView({ behavior: "smooth", block: "center" })));
  $$("[data-edit]").forEach((b) => (b.onclick = () => edit(by[b.dataset.edit])));
  $("#add")?.addEventListener("click", () => edit({ responsibilities: [], kpis: [], authorities: [], holders: [] }));

  function edit(r) {
    const held = new Set(r.holders.map((h) => h.user_id));
    dialog({
      title: r.id ? `Edit ${r.title}` : "Add a role", wide: true,
      body: `<form class="form-grid" id="rf">
        <div class="field"><label>Title</label><input class="input" name="title" required value="${esc(r.title || "")}"></div>
        <div class="field"><label>Reports to</label><select class="select" name="reports_to"><option value="">Nobody (top of the tree)</option>${roles.filter((x) => x.id !== r.id).map((x) => `<option value="${esc(x.id)}"${r.reports_to === x.id ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></div>
        <div class="field" style="grid-column:1/-1"><label>Purpose</label><input class="input" name="purpose" value="${esc(r.purpose || "")}"></div>
        <div class="field" style="grid-column:1/-1"><label>Responsibilities (one per line)</label><textarea class="textarea" name="responsibilities" rows="5">${esc(r.responsibilities.join("\n"))}</textarea></div>
        <div class="field"><label>Measures (one per line)</label><textarea class="textarea" name="kpis" rows="3">${esc(r.kpis.join("\n"))}</textarea></div>
        <div class="field"><label>Authorities (one per line)</label><textarea class="textarea" name="authorities" rows="3">${esc(r.authorities.join("\n"))}</textarea></div>
        <fieldset class="field" style="grid-column:1/-1"><legend class="label">Held by</legend><div class="row" style="flex-wrap:wrap">${users.map((u) => `<label class="check"><input type="checkbox" name="h" value="${esc(u.id)}"${held.has(u.id) ? " checked" : ""}> ${esc(u.name || u.email)}</label>`).join("")}</div></fieldset>
        <label class="check"><input type="checkbox" name="statutory"${r.statutory ? " checked" : ""}> Required by law or regulation</label></form>`,
      actions: [...(r.id ? [{ id: "d", label: "Delete", kind: "danger", handler: async () => { await api(`/api/people/roles/${encodeURIComponent(r.id)}/delete`, { body: {} }); toast("Deleted."); render(main, ctx); } }] : []), { id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (d) => {
        const f = d.querySelector("#rf"), v = Object.fromEntries(new FormData(f));
        await api("/api/people/roles", { body: { ...v, id: r.id, statutory: !!v.statutory, holders: [...f.querySelectorAll('[name="h"]:checked')].map((i) => i.value), sort: r.sort } });
        toast("Saved."); render(main, ctx);
      } }],
    });
  }
}
