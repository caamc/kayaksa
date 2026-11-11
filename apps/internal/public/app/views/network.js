import { $, $$, api, esc, html, ico, toast, dialog, confirmDialog, fmtDate } from "/_shared/js/ui.js";
import { SECTORS, CLUSTERS } from "/app/views/data.js";
import { bars, donut } from "/app/charts.js";

const GL = { client: "Clients", bp_consulting: "Business Partners: Consulting", bp_vendor: "Business Partners: Vendors", senior_advisor: "Senior Advisors", affiliate: "Group and affiliates" };
const STAGE = { introduced: "Introduced", meeting: "Meeting held", proposal: "Proposal sent", won: "Won", lost: "Lost", parked: "Parked" };
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

const STATUS = { active: ["Active", "ok"], prospect: ["Prospect", "accent"], paused: ["Paused", "warn"], ended: ["Ended", ""] };

export async function render(main, ctx) {
  const { me } = ctx;
  const [{ partners }, { kinds, groups }, stats] = await Promise.all([api("/api/network"), api("/api/network/meta"), api("/api/grow/network/stats").catch(() => null)]);
  let f = { q: "", kind: "", status: "", sector: "", grp: ctx.rest?.[0] && GL[ctx.rest[0]] ? ctx.rest[0] : "" };
  const sectors = [...new Set([...partners.flatMap((p) => p.sectors)])].sort();

  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayak Network</span><h1>Clients, partners and advisors</h1><p class="lead">Everyone Kayak works with, in four groups, with the referrals that pass between us. Treat this directory as confidential.</p></div>
      <div class="row"><a class="btn btn-ghost" href="/api/network/export.csv">${ico("download")} Export CSV</a>${me.can.admin ? html`<button class="btn btn-ghost" id="mail">${ico("send")} Email a group</button>` : ""}${me.can.edit ? html`<button class="btn btn-ghost" id="addref">${ico("plus")} Record a referral</button><button class="btn btn-primary" id="add">${ico("plus")} Add to the network</button>` : ""}</div></div>
    <nav class="chips" aria-label="Network groups" id="grps"></nav>
    <section class="grid" id="kpis"></section>
    <section id="refs"></section>
    <h2 class="h3" style="margin-top:8px">Directory</h2>
    <div class="toolbar">
      <label class="search"><span class="sr-only">Search partners</span>${ico("search")}<input class="input" id="q" placeholder="Search name, service, city, contact…"></label>
      <select class="select" id="kind" aria-label="Type"><option value="">All types</option>${kinds.map((k) => html`<option>${k}</option>`)}</select>
      <select class="select" id="status" aria-label="Status"><option value="">Any status</option>${Object.entries(STATUS).map(([k, [l]]) => html`<option value="${k}">${l}</option>`)}</select>
      <select class="select" id="sector" aria-label="Sector"><option value="">All sectors</option>${sectors.map((s) => html`<option>${s}</option>`)}</select>
    </div>
    <div id="list"></div>
  </div>`);

  const kpi = () => {
    const cnt = (g) => partners.filter((p) => p.grp === g).length;
    $("#grps").innerHTML = [["", `All ${partners.length}`], ...groups.map((g) => [g, `${GL[g]} ${cnt(g)}`])].map(([g, l]) => `<button type="button" class="chip${f.grp === g ? " on" : ""}" data-g="${g}">${esc(l)}</button>`).join("");
    $$("#grps [data-g]").forEach((b) => (b.onclick = () => { f.grp = b.dataset.g; kpi(); draw(); }));
    const t = stats?.totals || {};
    $("#kpis").innerHTML = [["Clients", cnt("client")], ["Consulting partners", cnt("bp_consulting")], ["Vendors", cnt("bp_vendor")], ["Senior advisors", cnt("senior_advisor")], ["Referrals in / out", `${t.in || 0} / ${t.out || 0}`], ["Won from referrals", inr(t.wonValue)], ["Conversion", t.conversion == null ? "—" : t.conversion + "%"], ["Referral fees due", inr(t.feesDue)]]
      .map(([l, n]) => `<div class="card flat kpi"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("");
    if (!stats) { $("#refs").innerHTML = ""; return; }
    const R = stats.referrals.filter((r) => !f.grp || r.grp === f.grp);
    $("#refs").innerHTML = `<div class="grid wide">
      <div class="card stack-sm"><h3>Referral pipeline</h3>${bars(stats.stages.filter((x) => x.n).map((x) => [STAGE[x.stage], x.n]), { beacon: 3 })}<p class="small muted">Open pipeline ${inr(t.pipeline)} · ${t.open || 0} open</p></div>
      <div class="card stack-sm"><h3>Network by group</h3>${donut(stats.groups.filter((g) => g.total).map((g) => [GL[g.id], g.total]))}</div>
      <div class="card stack-sm"><h3>Top relationships</h3>${stats.leaders.length ? `<table class="table"><thead><tr><th>Who</th><th class="num">In</th><th class="num">Out</th><th class="num">Won</th></tr></thead><tbody>${stats.leaders.map((l) => `<tr><td>${esc(l.partner)}<br><span class="small muted">${esc(GL[l.grp] || "")}</span></td><td class="num">${l.in}</td><td class="num">${l.out}</td><td class="num">${inr(l.value)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted small">No referrals recorded yet.</p>`}</div>
    </div>
    ${R.length ? `<div class="card stack-sm" style="margin-top:16px"><h3>Referrals${f.grp ? `: ${esc(GL[f.grp])}` : ""}</h3><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Partner</th><th>Direction</th><th>Opportunity</th><th>Stage</th><th class="num">Value</th><th class="num">Fee</th><th></th></tr></thead><tbody>${R.map((r) => `<tr><td>${esc(fmtDate(r.referred_on))}</td><td>${esc(r.partner)}</td><td>${r.direction === "in" ? "To Kayak" : "From Kayak"}</td><td>${esc(r.opportunity)}${r.client ? `<br><span class="small muted">${esc(r.client)}</span>` : ""}</td><td><span class="badge ${r.status === "won" ? "ok" : r.status === "lost" ? "" : "accent"}">${esc(STAGE[r.status])}</span></td><td class="num">${inr(r.value_inr)}</td><td class="num">${r.fee_pct ? `${r.fee_pct}%${r.fee_paid ? " paid" : ""}` : "—"}</td><td>${me.can.edit ? `<button class="btn btn-quiet btn-sm" data-ref="${esc(r.id)}" aria-label="Edit referral">${ico("edit")}</button>` : ""}</td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
    $$("[data-ref]").forEach((b) => (b.onclick = () => refEdit(stats.referrals.find((r) => r.id === b.dataset.ref))));
  };
  const refEdit = (r = {}) => dialog({
    title: r.id ? "Edit referral" : "Record a referral", wide: true,
    body: `<form class="form-grid" id="rf">
      <div class="field" style="grid-column:1/-1"><label>Partner, client or advisor</label><select class="select" name="partner_id" required>${partners.map((p) => `<option value="${esc(p.id)}"${r.partner_id === p.id ? " selected" : ""}>${esc(p.name)} (${esc(GL[p.grp] || "")})</option>`).join("")}</select></div>
      <div class="field"><label>Direction</label><select class="select" name="direction"><option value="in"${r.direction !== "out" ? " selected" : ""}>They referred work to Kayak</option><option value="out"${r.direction === "out" ? " selected" : ""}>Kayak referred work to them</option></select></div>
      <div class="field"><label>Stage</label><select class="select" name="status">${Object.entries(STAGE).map(([k, l]) => `<option value="${k}"${(r.status || "introduced") === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Opportunity</label><input class="input" name="opportunity" value="${esc(r.opportunity || "")}" required placeholder="For example: vendor due diligence for a pharma acquisition"></div>
      <div class="field"><label>End client</label><input class="input" name="client" value="${esc(r.client || "")}"></div>
      <div class="field"><label>Cluster</label><select class="select" name="cluster"><option value="">—</option>${CLUSTERS.map((c) => `<option${r.cluster === c.short ? " selected" : ""}>${esc(c.short)}</option>`).join("")}</select></div>
      <div class="field"><label>Value (₹)</label><input class="input" type="number" min="0" name="value_inr" value="${esc(r.value_inr || "")}"></div>
      <div class="field"><label>Referral fee (%)</label><input class="input" type="number" min="0" max="50" step="0.5" name="fee_pct" value="${esc(r.fee_pct || "")}"></div>
      <div class="field"><label>Referred on</label><input class="input" type="date" name="referred_on" value="${esc(r.referred_on || new Date().toISOString().slice(0, 10))}"></div>
      <div class="field"><label>Owner at Kayak</label><input class="input" name="owner" value="${esc(r.owner || me.name || "")}"></div>
      <label class="check" style="grid-column:1/-1"><input type="checkbox" name="fee_paid"${r.fee_paid ? " checked" : ""}> Referral fee settled</label>
      <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea class="textarea" name="notes">${esc(r.notes || "")}</textarea></div>
      <p class="small muted" style="grid-column:1/-1">Referral fees to professionals must be lawful for their profession (for example, advocates and chartered accountants may not share fees with non-members). Record the agreement in the notes.</p></form>`,
    actions: [...(r.id && me.can.admin ? [{ id: "d", label: "Delete", kind: "danger", handler: async () => { await api(`/api/grow/referrals/${encodeURIComponent(r.id)}/delete`, { body: {} }); toast("Deleted."); render(main, ctx); } }] : []), { id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (d) => {
      const v = Object.fromEntries(new FormData(d.querySelector("#rf"))); v.fee_paid = !!v.fee_paid;
      await api("/api/grow/referrals", { body: { ...v, id: r.id } }); toast("Referral saved."); render(main, ctx);
    } }],
  });
  const mail = () => dialog({
    title: "Email a group", wide: true,
    body: `<form class="stack-sm" id="mf"><div class="field"><label>Group</label><select class="select" name="grp">${groups.map((g) => `<option value="${g}"${f.grp === g ? " selected" : ""}>${esc(GL[g])}</option>`).join("")}</select></div>
      <div class="field"><label>Subject</label><input class="input" name="subject" maxlength="160" required></div>
      <div class="field"><label>Message</label><textarea class="textarea" name="body" rows="8" required placeholder="Each person receives their own email, addressed by first name."></textarea></div>
      <p class="small muted">Only active contacts with an email address, who have not opted out, receive it. Each email says how to stop receiving them. Contacts who reply "unsubscribe" should be marked as opted out.</p><div id="mprev" class="small"></div></form>`,
    actions: [{ id: "p", label: "Preview recipients", handler: async (d) => {
      const v = Object.fromEntries(new FormData(d.querySelector("#mf")));
      const { recipients } = await api("/api/grow/network/mail", { body: { ...v, subject: v.subject || "-", body: v.body || "-", preview: true } });
      d.querySelector("#mprev").innerHTML = recipients.length ? `<b>${recipients.length} recipient${recipients.length === 1 ? "" : "s"}:</b> ${recipients.map((r) => esc(`${r.name} (${r.org})`)).join(", ")}` : "Nobody in this group can receive email yet.";
      return false;
    } }, { id: "c", label: "Cancel" }, { id: "s", label: "Send", kind: "primary", handler: async (d) => {
      const v = Object.fromEntries(new FormData(d.querySelector("#mf")));
      const r = await api("/api/grow/network/mail", { body: v }); toast(`Sent ${r.sent}${r.skipped ? `, ${r.skipped} not sent` : ""}.`);
    } }],
  });
  const draw = () => {
    const q = f.q.toLowerCase();
    const list = partners.filter((p) => (!f.grp || p.grp === f.grp) && (!f.kind || p.kind === f.kind) && (!f.status || p.status === f.status) && (!f.sector || p.sectors.includes(f.sector)) &&
      (!q || [p.name, p.kind, p.city, p.country, p.contact_name, p.contact_email, p.notes, ...p.sectors, ...p.services].join(" ").toLowerCase().includes(q)));
    $("#list").innerHTML = list.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Group and type</th><th>Sectors and services</th><th>Location</th><th>Contact</th><th>Status</th><th></th></tr></thead><tbody>${list.map((p) => {
          const [sl, sk] = STATUS[p.status] || [p.status, ""];
          return `<tr><td><b>${esc(p.name)}</b>${p.website ? `<br><a class="small" href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>` : ""}</td>
            <td>${esc(GL[p.grp] || "")}<br><span class="small muted">${esc(p.kind)}</span></td><td class="small">${esc(p.sectors.join(", ") || "—")}<br><span class="muted">${esc(p.services.join(", "))}</span></td>
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
      <div class="field"><label>Group</label><select class="select" name="grp">${groups.map((g) => `<option value="${g}"${(p.grp || f.grp || "bp_consulting") === g ? " selected" : ""}>${esc(GL[g])}</option>`).join("")}</select></div>
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
      <label class="check" style="grid-column:1/-1"><input type="checkbox" name="email_opt_out"${p.email_opt_out ? " checked" : ""}> Does not want group emails</label>
      <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea class="textarea" name="notes">${esc(p.notes || "")}</textarea></div></form>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (d) => {
      const v = Object.fromEntries(new FormData(d.querySelector("#pf")));
      v.email_opt_out = !!v.email_opt_out;
      await api("/api/network", { body: { ...v, id: p.id } }); toast("Saved."); render(main, ctx);
    } }],
  });

  ["q", "kind", "status", "sector"].forEach((k) => ($("#" + k).oninput = (e) => { f[k] = e.target.value; draw(); }));
  $("#add")?.addEventListener("click", () => edit());
  $("#addref")?.addEventListener("click", () => refEdit());
  $("#mail")?.addEventListener("click", mail);
  kpi(); draw();
}
