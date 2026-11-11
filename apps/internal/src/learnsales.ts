// Kayak Learn sales: orders from learn.kayaksa.com, bank-transfer payments recorded by staff,
// refunds, and a GST-ready export. Administrators only; reads and writes LEARN_DB.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { readJson, str } from "../../../packages/core/src/http";
import { fulfil, refund } from "../../../packages/learnkit/src/commerce";
import { Env, User, atLeast } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const learnSales = new Hono<V>();
const db = (c: any): D1Database => {
  const d = c.env.LEARN_DB;
  if (!d) throw Object.assign(new Error("The Kayak Learn database is not connected to the portal yet."), { status: 503 });
  return d;
};
learnSales.use("*", async (c, next) => (atLeast(c.get("user"), "admin") ? next() : c.json({ error: "Administrators only." }, 403)));

learnSales.get("/", async (c) => {
  const status = str(c.req.query("status"), 20);
  const { results } = await db(c).prepare(`SELECT id, title, buyer_name, buyer_org, buyer_email, buyer_gstin, buyer_state, total_paise, taxable_paise, status, method, invoice_no, created_at, paid_at FROM orders WHERE status != 'created' ${status ? "AND status = ?" : ""} ORDER BY created_at DESC LIMIT 500`).bind(...(status ? [status] : [])).all().catch(() => ({ results: [] as any[] }));
  const month = new Date().toISOString().slice(0, 7);
  const sum = await db(c).prepare("SELECT COUNT(*) n, COALESCE(SUM(taxable_paise),0) rev FROM orders WHERE status = 'paid' AND substr(paid_at,1,7) = ?").bind(month).first<any>().catch(() => ({ n: 0, rev: 0 }));
  const waiting = (results as any[]).filter((r) => r.status === "requested").length;
  return c.json({ orders: results, month: { paid: sum?.n || 0, revenue: sum?.rev || 0 }, waiting });
});

learnSales.post("/:id/paid", async (c) => {
  const b = await readJson<any>(c, 2048);
  const ref = str(b.reference, 80);
  if (!ref) return c.json({ error: "Add the bank or UTR reference for the payment." }, 400);
  const o = await fulfil(db(c), c.req.param("id"), { method: "bank", paymentId: ref, by: c.get("user").email, note: str(b.note, 300) || undefined });
  await audit(c, c.env.DB, c.get("user").id, "learn.payment_recorded", { order: o.id, invoice: o.invoice_no, reference: ref });
  return c.json({ ok: true, invoice: o.invoice_no });
});

learnSales.post("/:id/refund", async (c) => {
  const b = await readJson<any>(c, 2048);
  const note = str(b.note, 300);
  if (!note) return c.json({ error: "Say why the order is refunded." }, 400);
  await refund(db(c), c.req.param("id"), c.get("user").email, note);
  await audit(c, c.env.DB, c.get("user").id, "learn.order_refunded", { order: c.req.param("id"), note });
  return c.json({ ok: true, note: "Access removed. Issue the money back through Razorpay or the bank, and raise a credit note." });
});

learnSales.get("/export.csv", async (c) => {
  const { results } = await db(c).prepare("SELECT invoice_no, paid_at, id, buyer_name, buyer_org, buyer_gstin, buyer_state, title, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, method, gateway_payment_id, status FROM orders WHERE status IN ('paid','refunded') ORDER BY paid_at").all<any>();
  const r = (p: number) => (p / 100).toFixed(2);
  const cell = (v: any) => { const t = v == null ? "" : String(v); return /[",\n]/.test(t) || /^[=+\-@]/.test(t) ? `"${t.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : t; };
  const head = "Invoice,Date,Order,Buyer,Business,GSTIN,Place of supply,Item,SAC,Taxable,CGST,SGST,IGST,Total,Method,Payment reference,Status";
  const rows = results.map((o: any) => [o.invoice_no, o.paid_at?.slice(0, 10), o.id, o.buyer_name, o.buyer_org, o.buyer_gstin, o.buyer_state, o.title, "999293", r(o.taxable_paise), r(o.cgst_paise), r(o.sgst_paise), r(o.igst_paise), r(o.total_paise), o.method, o.gateway_payment_id, o.status].map(cell).join(","));
  await audit(c, c.env.DB, c.get("user").id, "learn.sales_exported", { rows: rows.length });
  return c.body("﻿" + head + "\n" + rows.join("\n"), 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="kayak-learn-sales-${new Date().toISOString().slice(0, 10)}.csv"` });
});
