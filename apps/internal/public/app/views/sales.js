import { $, $$, api, esc, html, ico, toast, dialog, fmtDateTime } from "/_shared/js/ui.js";

const ST = { requested: ["Awaiting payment", "warn"], paid: ["Paid", "ok"], failed: ["Failed", "danger"], refunded: ["Refunded", ""], cancelled: ["Cancelled", ""] };
const inr = (p) => "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export async function render(main) {
  const r = await api("/api/learnsales");
  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">learn.kayaksa.com</span><h1>Kayak Learn sales</h1><p class="lead">Orders, payments by bank transfer, refunds and the GST sales register.</p></div>
      <a class="btn btn-ghost" href="/api/learnsales/export.csv">${ico("download")} GST sales register (CSV)</a></div>
    <section class="grid"><div class="card flat kpi"><b>${r.waiting}</b><span>Orders awaiting payment</span></div><div class="card flat kpi"><b>${r.month.paid}</b><span>Paid this month</span></div><div class="card flat kpi"><b>${inr(r.month.revenue)}</b><span>Revenue this month, before GST</span></div></section>
    <div id="ol"></div></div>`);
  $("#ol").innerHTML = r.orders.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Buyer</th><th>Item</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
    ${r.orders.map((o) => `<tr><td class="nowrap">${fmtDateTime(o.created_at)}</td><td><b>${esc(o.buyer_org || o.buyer_name)}</b><br><span class="small muted">${esc(o.buyer_email)}${o.buyer_gstin ? " · GSTIN " + esc(o.buyer_gstin) : ""} · ${esc(o.buyer_state)}</span></td>
      <td>${esc(o.title)}<br><span class="small faint mono">${esc(o.id)}${o.invoice_no ? " · " + esc(o.invoice_no) : ""}</span></td><td class="num">${inr(o.total_paise)}</td>
      <td><span class="badge ${ST[o.status]?.[1] || ""}">${ST[o.status]?.[0] || esc(o.status)}</span></td>
      <td class="nowrap">${o.status === "requested" || o.status === "failed" ? `<button class="btn btn-primary btn-sm" data-paid="${esc(o.id)}">Record payment</button>` : ""}${o.status === "paid" ? `<button class="btn btn-ghost btn-sm" data-refund="${esc(o.id)}">Refund</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty"><p>No orders yet. They appear here as soon as a learner enrols on learn.kayaksa.com.</p></div>`;
  $$("[data-paid]").forEach((b) => (b.onclick = () => dialog({
    title: "Record a bank payment",
    body: `<p class="small muted">Do this only after the money is in Kayak's bank account. The learner's course opens straight away and the GST invoice is numbered.</p><div class="field"><label for="pr">Bank or UTR reference</label><input class="input" id="pr" maxlength="80"></div><div class="field"><label for="pn">Note (optional)</label><input class="input" id="pn" maxlength="300"></div>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "go", label: "Record and open the course", kind: "primary", handler: async (d) => { const x = await api(`/api/learnsales/${b.dataset.paid}/paid`, { body: { reference: $("#pr", d).value.trim(), note: $("#pn", d).value.trim() } }); toast(`Recorded. Invoice ${x.invoice}.`); render(main); } }],
  })));
  $$("[data-refund]").forEach((b) => (b.onclick = () => dialog({
    title: "Refund this order",
    body: `<p class="small muted">This removes the learner's access. Return the money through Razorpay or the bank and raise a GST credit note separately.</p><div class="field"><label for="rn">Reason</label><input class="input" id="rn" maxlength="300"></div>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "go", label: "Refund and remove access", kind: "danger", handler: async (d) => { const x = await api(`/api/learnsales/${b.dataset.refund}/refund`, { body: { note: $("#rn", d).value.trim() } }); toast(x.note, "ok", 8000); render(main); } }],
  })));
}
