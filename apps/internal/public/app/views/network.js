import { $, $$, api, esc, html, ico, toast, dialog, confirmDialog, fmtDate } from "/_shared/js/ui.js";
import { SECTORS, CLUSTERS } from "/app/views/data.js";

const STATUS = { active: ["Active", "ok"], prospect: ["Prospect", "accent"], paused: ["Paused", "warn"], ended: ["Ended", ""] };

export async function render(main, ctx) {
  const { me } = ctx;
  const [{ partners }, { kinds }] = await Promise.all([api("/api/network"), api("/api/network/meta")]);
  let f = { q: "", kind: "", status: "", sector: "" };
  const sectors = [...new Set([...partners.flatMap((p) => p.sectors)])].sort();

  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayak Network</span><h1>Partners and associates</h1><p class="lead">The firms and experts we work alongside, with what they do, where, and who to call. Treat this directory as confidential.</p></div>
      <div class="row"><a class="btn btn-ghost" href="/api/network/export.csv">${ico("download")} Export CSV</a>${me.can.edit ? html`<button class="btn btn-primary" id="add">${ico("plus")} Add a partner</button>` : ""}</div></div>
    <section class="grid" id="kpis"></section>
    <div class="toolbar">
      <label class="search"><span class="sr-only">Search partners</span>${ico("search")}<input class="input" id="q" placeholder="Search name, service, city, contact…"></label>
      <select class="select" id="kind" aria-label="Type"><option value="">All types</option>${kinds.map((k) => html`<option>${k}</option>`)}</select>
      <select class="select" id="status" aria-label="Status"><option value="">Any status</option>${Object.entries(STATUS).map(([k, [l]]) => html`<option value="${k}">${l}</option>`)}</select>
      <select class="select" id="sector" aria-label="Sector"><option value="">All sectors</option>${sectors.map((s) => html`<option>${s}</option>`)}</select>
    </div>
    <div id="list"></div>
  </div>`);

  const kpi = () => {
    const by = (s) => partners.filter((p) => p.status === s).length;
    $("#kpis").innerHTML = [["Partners", partners.length], ["Active", by("active")], ["Prospects", by("prospect")], ["Countries", new Set(partners.map((p) => p.country)).size]]
      .map(([l, n]) => `<div class="card flat kpi"><b>${n}</b><span>${l}</span></div>`).join("");
  };
  const draw = () => {
    const q = f.q.toLowerCase();
    const list = partners.filter((p) => (!f.kind || p.kind === f.kind) && (!f.status || p.status === f.status) && (!f.sector || p.sectors.includes(f.sector)) &&
      (!q || [p.name, p.kind, p.city, p.country, p.contact_name, p.contact_email, p.notes, ...p.sectors, ...p.services].join(" ").toLowerCase().includes(q)));
    $("#list").innerHTML = list.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Partner</th><th>Type</th><th>Sectors and services</th><th>Location</th><th>Contact</th><th>Status</th><th></th></tr></thead><tbody>${list.map((p) => {
          const [sl, sk] = STATUS[p.status] || [p.status, ""];
          return `<tr><td><b>${esc(p.name)}</b>${p.website ? `<br><a class="small" href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>` : ""}</td>
            <td>${esc(p.kind)}</td><td class="small">${esc(p.sectors.join(", ") || "—")}<br><span class="muted">${esc(p.services.join(", "))}</span></td>
            <td>${esc([p.city, p.country].filter(Boolean).join(", "))}</td>
            <td class="small">${esc(p.contact_name || "—")}${p.contact_role ? `<br><span class="muted">${esc(p.contact_role)}</span>` : ""}${p.contact_email ? `<br><a href="mailto:${esc(p.contact_email)}">${esc(p.contact_email)}</a>` : ""}${p.contact_phone ? `<br>${esc(p.contact_phone)}` : ""}</td>
            <td><span class="badge ${sk}">${esc(sl)}</span>${p.nda_until ? `<br><span class="small muted">NDA to ${esc(fmtDate(p.nda_until))}</span>` : ""}</td>
            <td><div class="row" style="flex-wrap:nowrap"><button class="btn btn-quiet btn-sm" data-view="${esc(p.id)}" aria-label="Open ${esc(p.name)}">${ico("eye")}</button>${me.can.edit ? `<button class="btn btn-quiet btn-sm" data-edit="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">${ico("edit")}</button>` : ""}</div></td></tr>`;
        }).join("")}</tbody></table></div>`
      : `<div class="empty">${partners.length ? "No partners match these filters." : "No partners yet. Add the first one."}</div>`;
    $$("[data-view]", main).forEach((b) => (b.onclick = () => view(partners.find((p) => p.id === b.dataset.view))));
    $$("[data-edit]", main).forEach((b) => (b.onclick = () => edit(partners.find((p) => p.id === b.dataset.edit))));
  };

  const view = (p) => dialog({
    title: p.name, wide: true,
    body: `<div class="form-grid">${[["Type", p.kind], ["Status", STATUS[p.status]?.[0] || p.status], ["Location", [p.city, p.country].filter(Boolean).join(", ")], ["Website", p.website], ["Contact", [p.contact_name, p.contact_role].filter(Boolean).join(", ")], ["Email", p.contact_email], ["Phone", p.contact_phone], ["Working with us since", p.since], ["NDA valid until", p.nda_until], ["Rating", p.rating ? "★".repeat(p.rating) + "☆".repeat(5 - p.rating) : "Not rated"], ["Sectors", p.sectors.join(", ")], ["Services", p.services.join(", ")]]
      .map(([k, v]) => `<div><div class="label">${esc(k)}</div><div class="muted" style="word-break:break-word">${esc(v || "—")}</div></div>`).join("")}</div>${p.notes ? `<div><div class="label">Notes</div><p style="white-space:pre-wrap">${esc(p.notes)}</p></div>` : ""}
      <p class="small faint">Last updated ${esc(fmtDate(p.updated_at))}</p>`,
    actions: [...(me.can.admin ? [{ id: "del", label: "Delete", kind: "danger", handler: async () => {
      if (!(await confirmDialog("Delete this partner?", `${p.name} will be removed from the network.`, "Delete", true))) return false;
      await api(`/api/network/${encodeURIComponent(p.id)}`, { method: "DELETE" }); toast("Deleted."); render(main, ctx);
    } }] : []), ...(me.can.edit ? [{ id: "edit", label: "Edit", handler: () => { setTimeout(() => edit(p)); } }] : []), { id: "ok", label: "Close", kind: "primary" }],
  });

  const edit = (p = {}) => dialog({
    title: p.id ? `Edit ${p.name}` : "Add a partner", wide: true,
    body: `<form class="form-grid" id="pf">
      <div class="field" style="grid-column:1/-1"><label>Organisation or person</label><input class="input" name="name" value="${esc(p.name || "")}" required></div>
      <div class="field"><label>Type</label><select class="select" name="kind">${kinds.map((k) => `<option${p.kind === k ? " selected" : ""}>${esc(k)}</option>`).join("")}</select></div>
      <div class="field"><label>Status</label><select class="select" name="status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}"${(p.status || "active") === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="field"><label>Sectors (comma-separated)</label><input class="input" name="sectors" list="sl" value="${esc((p.sectors || []).join(", "))}"><datalist id="sl">${SECTORS.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></div>
      <div class="field"><label>Services (comma-separated)</label><input class="input" name="services" value="${esc((p.services || []).join(", "))}" placeholder="${esc(CLUSTERS.map((c) => c.short).slice(0, 3).join(", "))}"></div>
      <div class="field"><label>City</label><input class="input" name="city" value="${esc(p.city || "")}"></div>
      <div class="field"><label>Country</label><input class="input" name="country" value="${esc(p.country || "India")}"></div>
      <div class="field"><label>Website</label><input class="input" name="website" value="${esc(p.website || "")}"></div>
      <div class="field"><label>Contact person</label><input class="input" name="contact_name" value="${esc(p.contact_name || "")}"></div>
      <div class="field"><label>Contact role</label><input class="input" name="contact_role" value="${esc(p.contact_role || "")}"></div>
      <div class="field"><label>Contact email</label><input class="input" type="email" name="contact_email" value="${esc(p.contact_email || "")}"></div>
      <div class="field"><label>Contact phone</label><input class="input" name="contact_phone" value="${esc(p.contact_phone || "")}"></div>
      <div class="field"><label>Working with us since</label><input class="input" type="date" name="since" value="${esc(p.since || "")}"></div>
      <div class="field"><label>NDA valid until</label><input class="input" type="date" name="nda_until" value="${esc(p.nda_until || "")}"></div>
      <div class="field"><label>Rating</label><select class="select" name="rating">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}"${Number(p.rating || 0) === n ? " selected" : ""}>${n ? "★".repeat(n) : "Not rated"}</option>`).join("")}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea class="textarea" name="notes">${esc(p.notes || "")}</textarea></div></form>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (d) => {
      const v = Object.fromEntries(new FormData(d.querySelector("#pf")));
      await api("/api/network", { body: { ...v, id: p.id } }); toast("Saved."); render(main, ctx);
    } }],
  });

  ["q", "kind", "status", "sector"].forEach((k) => ($("#" + k).oninput = (e) => { f[k] = e.target.value; draw(); }));
  $("#add")?.addEventListener("click", () => edit());
  kpi(); draw();
}
