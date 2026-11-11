// Kayak Learn commerce: orders, Razorpay payments, GST invoices and enrolments. Shared by
// learn.kayaksa.com (learners buy) and internal.kayaksa.com (staff record bank payments, refund).
import { PRICING, priceOf, tax, rupees, STATES, type ItemKind } from "./pricing";

export interface PayEnv {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  KAYAK_GSTIN?: string;
}

export const gatewayReady = (env: PayEnv) => !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
export async function hmacHex(secret: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}
export function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export interface Buyer { name: string; email: string; org?: string; gstin?: string; address?: string; state: string }

export function checkBuyer(b: Buyer): string | null {
  if (!b.name || b.name.length < 2) return "Add the name to appear on the invoice.";
  if (!STATES.includes(b.state)) return "Choose your state, or Outside India.";
  if (b.gstin && !GSTIN_RE.test(b.gstin)) return "That GSTIN does not look right. It has 15 characters, for example 27ABCDE1234F1Z5.";
  if (b.gstin && !b.org) return "Add the registered business name for the GSTIN.";
  return null;
}

export async function createOrder(db: D1Database, userId: string, kind: ItemKind, refId: string, buyer: Buyer) {
  const p = priceOf(kind, refId);
  if (!p) throw Object.assign(new Error("That course is not on sale."), { status: 404 });
  const t = tax(p.offer, buyer.state);
  const id = "ord_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  await db.prepare(`INSERT INTO orders (id, user_id, kind, ref_id, title, list_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, buyer_name, buyer_email, buyer_org, buyer_gstin, buyer_address, buyer_state, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'created',?)`)
    .bind(id, userId, kind, refId, p.title, p.list, t.taxable, t.cgst, t.sgst, t.igst, t.total, buyer.name, buyer.email, buyer.org || null, buyer.gstin || null, buyer.address || null, buyer.state, new Date().toISOString()).run();
  return { id, price: p, tax: t };
}

export async function razorpayOrder(env: PayEnv, orderId: string, amountPaise: number, notes: Record<string, string>) {
  const r = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: orderId, notes }),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw Object.assign(new Error("The payment service did not respond. Please try again in a minute."), { status: 502 });
  return j.id as string;
}

function fyOf(d: Date) {
  const ist = new Date(d.getTime() + 5.5 * 3_600_000);
  const y = ist.getUTCFullYear(), start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/** Marks an order paid (idempotent), numbers the invoice and opens the courses for 12 months. */
export async function fulfil(db: D1Database, orderId: string, how: { method: "razorpay" | "bank" | "manual"; paymentId?: string; by?: string; note?: string }) {
  const o = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first<any>();
  if (!o) throw Object.assign(new Error("Order not found."), { status: 404 });
  if (o.status === "paid") return o;
  const now = new Date();
  const fy = fyOf(now);
  const seq = await db.prepare("INSERT INTO invoice_seq (fy, n) VALUES (?, 1) ON CONFLICT(fy) DO UPDATE SET n = n + 1 RETURNING n").bind(fy).first<{ n: number }>();
  const invoice = `KL/${fy}/${String(seq!.n).padStart(5, "0")}`; // 14 characters (GST rule 46 allows 16)
  const upd = await db.prepare("UPDATE orders SET status = 'paid', method = ?, gateway_payment_id = COALESCE(?, gateway_payment_id), invoice_no = ?, paid_at = ?, note = COALESCE(?, note) WHERE id = ? AND status != 'paid'")
    .bind(how.method, how.paymentId || null, invoice, now.toISOString(), how.note || null, orderId).run();
  if (!upd.meta.changes) return db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first<any>();
  const p = priceOf(o.kind, o.ref_id)!;
  const until = new Date(now); until.setMonth(until.getMonth() + PRICING.accessMonths);
  for (const cid of p.courses) {
    await db.prepare(`INSERT INTO enrolments (user_id, course_id, order_id, granted_by, created_at, expires_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(user_id, course_id) DO UPDATE SET order_id = excluded.order_id, expires_at = MAX(enrolments.expires_at, excluded.expires_at), revoked_at = NULL`)
      .bind(o.user_id, cid, orderId, how.by || null, now.toISOString(), until.toISOString()).run();
  }
  return db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first<any>();
}

export async function refund(db: D1Database, orderId: string, by: string, note: string) {
  const o = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first<any>();
  if (!o || o.status !== "paid") throw Object.assign(new Error("Only paid orders can be refunded."), { status: 400 });
  await db.batch([
    db.prepare("UPDATE orders SET status = 'refunded', refunded_at = ?, note = ? WHERE id = ?").bind(new Date().toISOString(), `${note} (by ${by})`.slice(0, 500), orderId),
    db.prepare("UPDATE enrolments SET revoked_at = ? WHERE order_id = ? AND revoked_at IS NULL").bind(new Date().toISOString(), orderId),
  ]);
}

export async function entitlements(db: D1Database, userId: string): Promise<Set<string>> {
  const { results } = await db.prepare("SELECT course_id FROM enrolments WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?").bind(userId, new Date().toISOString()).all<any>();
  return new Set(results.map((r: any) => r.course_id));
}

// ---------------------------------------------------------------- invoice
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function words(n: number): string {
  if (n === 0) return "Zero";
  const two = (x: number) => (x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? " " + ONES[x % 10] : ""));
  const three = (x: number) => (x >= 100 ? ONES[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x));
  const parts: string[] = [];
  const cr = Math.floor(n / 1e7), lk = Math.floor((n % 1e7) / 1e5), th = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
  if (cr) parts.push(three(cr) + " Crore"); if (lk) parts.push(two(lk) + " Lakh"); if (th) parts.push(two(th) + " Thousand"); if (rest) parts.push(three(rest));
  return parts.join(" ");
}
export const amountInWords = (paise: number) => `Rupees ${words(Math.floor(paise / 100))}${paise % 100 ? ` and ${words(paise % 100)} Paise` : ""} Only`;

export function invoiceHtml(o: any, env: PayEnv & { SUPPLIER_ADDRESS?: string }) {
  const gstin = env.KAYAK_GSTIN || "";
  const isTax = !!gstin && o.status === "paid";
  const date = new Date(o.paid_at || o.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const row = (k: string, v: string) => `<tr><td>${k}</td><td class="r">${v}</td></tr>`;
  const disc = o.list_paise - o.taxable_paise;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${isTax ? "Tax invoice" : "Receipt"} ${esc(o.invoice_no || o.id)} · Kayak Learn</title>
<link rel="stylesheet" href="/_shared/css/kayak.css"><style>
body{background:#EEF4F1;margin:0;font:15px/1.55 var(--sans,Arial,sans-serif);color:#0E2F3C}.inv{max-width:820px;margin:24px auto;background:#fff;padding:40px clamp(18px,5vw,48px);border-top:6px solid #0E2F3C}
.top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;align-items:flex-start}h1{font:800 1.6rem/1.1 var(--display,Arial);margin:0 0 6px;letter-spacing:.02em}
.muted{color:#4E6470}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0}@media(max-width:600px){.grid{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse}th,td{padding:9px 6px;border-bottom:1px solid #D4DEE2;text-align:left;vertical-align:top}th{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#4E6470}.r{text-align:right;white-space:nowrap}
.tot td{font-weight:800;border-bottom:2px solid #0E2F3C}.bar{height:4px;background:#EE9B1E;width:64px;margin:10px 0 0}.acts{max-width:820px;margin:0 auto;padding:0 16px;display:flex;gap:10px;justify-content:flex-end}
.acts button,.acts a{font:600 14px Arial;padding:10px 16px;border:1px solid #0E2F3C;background:#0E2F3C;color:#fff;text-decoration:none;cursor:pointer}.acts a{background:#fff;color:#0E2F3C}
@media print{body{background:#fff}.inv{margin:0;box-shadow:none}.acts{display:none}}</style></head><body>
<div class="acts" style="margin-top:20px"><a href="/#/purchases">Back to my purchases</a><button type="button" data-print>Print or save as PDF</button></div>
<div class="inv"><div class="top"><div><img src="/_shared/logos/KayakLearn_Logo_FullColour.svg" alt="Kayak Learn" height="46"><div class="bar"></div></div>
<div style="text-align:right"><h1>${isTax ? "TAX INVOICE" : o.status === "paid" ? "PAYMENT RECEIPT" : "PRO FORMA"}</h1><div class="muted">${isTax ? "Original for recipient" : o.status === "paid" ? "A GST tax invoice follows separately" : "Not a tax invoice"}</div></div></div>
<div class="grid"><div><b>Kayak Strategic Advisors Private Limited</b><br><span class="muted">${esc(env.SUPPLIER_ADDRESS || "A/2, 314, Shah & Nahar Industrial Estate, Delisle Road, Mumbai 400013, Maharashtra")}</span><br>${gstin ? `GSTIN <b>${esc(gstin)}</b><br>` : ""}State: Maharashtra (27)<br>learn@kayaksa.com</div>
<div><table><tbody>${o.invoice_no ? row("Invoice no.", `<b>${esc(o.invoice_no)}</b>`) : ""}${row("Date", esc(date))}${row("Order", esc(o.id))}${o.gateway_payment_id ? row("Payment ref.", esc(o.gateway_payment_id)) : ""}${row("Place of supply", esc(o.buyer_state))}</tbody></table></div></div>
<div style="margin-bottom:24px"><div class="muted" style="font-size:.8rem;letter-spacing:.08em;text-transform:uppercase">Billed to</div><b>${esc(o.buyer_org || o.buyer_name)}</b>${o.buyer_org ? `<br>Attn: ${esc(o.buyer_name)}` : ""}<br>${o.buyer_address ? esc(o.buyer_address) + "<br>" : ""}${esc(o.buyer_email)}${o.buyer_gstin ? `<br>GSTIN <b>${esc(o.buyer_gstin)}</b>` : ""}</div>
<table><thead><tr><th>Description</th><th>SAC</th><th class="r">Amount</th></tr></thead><tbody>
<tr><td><b>${esc(o.title)}</b><br><span class="muted">Kayak Learn ${o.kind === "path" ? "learning path" : "course"}: online access for ${PRICING.accessMonths} months with assessment and certificate of participation</span></td><td>${PRICING.sac}</td><td class="r">${rupees(o.list_paise)}</td></tr>
${disc > 0 ? `<tr><td>Launch offer discount (${Math.round((disc / o.list_paise) * 100)}%)</td><td></td><td class="r">− ${rupees(disc)}</td></tr>` : ""}
${row("<b>Taxable value</b>", `<b>${rupees(o.taxable_paise)}</b>`).replace("<td class=\"r\">", "<td></td><td class=\"r\">")}
${o.cgst_paise ? row("CGST @ 9%", rupees(o.cgst_paise)).replace("<td class=\"r\">", "<td></td><td class=\"r\">") + row("SGST @ 9%", rupees(o.sgst_paise)).replace("<td class=\"r\">", "<td></td><td class=\"r\">") : row("IGST @ 18%", rupees(o.igst_paise)).replace("<td class=\"r\">", "<td></td><td class=\"r\">")}
<tr class="tot"><td>Total</td><td></td><td class="r">${rupees(o.total_paise)}</td></tr></tbody></table>
<p class="muted" style="margin-top:14px">${amountInWords(o.total_paise)}.<br>Tax payable on reverse charge: No.${o.status === "paid" ? ` Paid ${o.method === "razorpay" ? "online" : "by bank transfer"}.` : ""}</p>
<p class="muted" style="font-size:.85rem;margin-top:28px">This is a computer-generated document and needs no signature. Kayak Learn courses are for professional awareness and are not legal advice. Refunds follow the Kayak Learn terms at learn.kayaksa.com/#/terms.</p></div><script src="/assets/print.js"></script></body></html>`;
}
