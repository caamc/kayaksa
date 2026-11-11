// Checkout for Kayak Learn. Razorpay handles card, UPI and net-banking payments; Kayak never sees
// card details. Until the Razorpay keys are added, learners can still place an order, and the team
// sends a payment link or bank details and records the payment from the internal portal.
import { Hono } from "hono";
import { readJson, str, rateLimit } from "../../../packages/core/src/http";
import { auditFull } from "../../../packages/core/src/shield";
import { mailEnabled, mailHtml, sendMail } from "../../../packages/core/src/mail";
import { createOrder, razorpayOrder, fulfil, checkBuyer, gatewayReady, hmacHex, safeEq, invoiceHtml, type PayEnv } from "../../../packages/learnkit/src/commerce";
import { priceOf, tax, rupees, PRICING } from "../../../packages/learnkit/src/pricing";

export function payApi(currentUser: (c: any) => Promise<any>, site: (c: any) => string) {
  const pay = new Hono<any>();

  pay.get("/config", (c) => c.json({ gateway: gatewayReady(c.env), keyId: c.env.RAZORPAY_KEY_ID || null, gstRate: PRICING.gstRate }));

  pay.get("/quote", (c) => {
    const p = priceOf(c.req.query("kind") === "path" ? "path" : "course", str(c.req.query("id"), 60));
    if (!p) return c.json({ error: "Not on sale." }, 404);
    return c.json({ price: p, tax: tax(p.offer, str(c.req.query("state"), 60) || "Maharashtra") });
  });

  pay.post("/order", async (c) => {
    const u = await currentUser(c);
    if (!u) return c.json({ error: "Sign in to enrol." }, 401);
    if (!u.verified && mailEnabled(c.env)) return c.json({ error: "Confirm your email address first. We sent you a link when you joined; you can send it again from My account." }, 403);
    if (!(await rateLimit(c.env.DB, `order:${u.id}`, 15, 3600))) return c.json({ error: "Too many attempts. Please try again in an hour." }, 429);
    const b = await readJson<any>(c, 8192);
    const kind = b.kind === "path" ? "path" : "course";
    const buyer = { name: str(b.name, 100), email: u.email, org: str(b.org, 160), gstin: str(b.gstin, 15).toUpperCase(), address: str(b.address, 300), state: str(b.state, 60) };
    const bad = checkBuyer(buyer);
    if (bad) return c.json({ error: bad }, 400);
    if (b.terms !== true) return c.json({ error: "Please accept the terms of sale and refund policy." }, 400);
    const { id, price, tax: t } = await createOrder(c.env.DB, u.id, kind, str(b.id, 60), buyer);
    await auditFull(c, c.env.DB, u.id, "learn.order_created", { order: id, item: `${kind}:${b.id}`, total: t.total });
    if (gatewayReady(c.env)) {
      const gw = await razorpayOrder(c.env, id, t.total, { kayak_order: id, item: `${kind}:${b.id}` });
      await c.env.DB.prepare("UPDATE orders SET gateway_order_id = ? WHERE id = ?").bind(gw, id).run();
      return c.json({ mode: "gateway", orderId: id, gatewayOrderId: gw, keyId: c.env.RAZORPAY_KEY_ID, amount: t.total, title: price.title, name: buyer.name, email: u.email });
    }
    // No gateway yet: the order waits for a payment link or bank transfer.
    await c.env.DB.prepare("UPDATE orders SET status = 'requested' WHERE id = ?").bind(id).run();
    if (mailEnabled(c.env)) {
      const to = c.env.LEARN_SALES_TO || "learn@kayaksa.com";
      c.executionCtx.waitUntil(Promise.all([
        sendMail(c.env, to, `Kayak Learn order ${id}: ${price.title} (${rupees(t.total)})`, mailHtml({ site: "LEARN", title: "A new Kayak Learn order", intro: `<b>${buyer.org || buyer.name}</b> (${u.email}) ordered <b>${price.title}</b> for ${rupees(t.total)} including GST. Send a payment link or bank details within one working day, then record the payment in the internal portal.`, action: { label: "Open Kayak Learn sales", url: "https://internal.kayaksa.com/app#/sales" } })),
        sendMail(c.env, u.email, `Your Kayak Learn order: ${price.title}`, mailHtml({ site: "LEARN", title: "Thank you for your order", intro: `We have received your order for <b>${price.title}</b> (${rupees(t.total)} including GST). Our team will email you a secure payment link within one working day. Your course opens as soon as the payment is received.`, action: { label: "View my purchases", url: `${site(c)}/#/purchases` } })),
      ]).then(() => {}));
    }
    return c.json({ mode: "request", orderId: id });
  });

  // Called by the browser after Razorpay Checkout succeeds.
  pay.post("/verify", async (c) => {
    const u = await currentUser(c);
    if (!u) return c.json({ error: "Sign in again to finish." }, 401);
    const b = await readJson<any>(c, 4096);
    const o = await c.env.DB.prepare("SELECT * FROM orders WHERE gateway_order_id = ? AND user_id = ?").bind(str(b.razorpay_order_id, 60), u.id).first() as any;
    if (!o) return c.json({ error: "Order not found." }, 404);
    const sig = await hmacHex(c.env.RAZORPAY_KEY_SECRET || "", `${o.gateway_order_id}|${str(b.razorpay_payment_id, 60)}`);
    if (!c.env.RAZORPAY_KEY_SECRET || !safeEq(sig, str(b.razorpay_signature, 128))) {
      await auditFull(c, c.env.DB, u.id, "learn.payment_signature_failed", { order: o.id });
      return c.json({ error: "We could not confirm this payment. If money left your account, write to learn@kayaksa.com with order " + o.id + "." }, 400);
    }
    const done = await fulfil(c.env.DB, o.id, { method: "razorpay", paymentId: str(b.razorpay_payment_id, 60) });
    await auditFull(c, c.env.DB, u.id, "learn.order_paid", { order: o.id, invoice: done.invoice_no });
    if (mailEnabled(c.env)) c.executionCtx.waitUntil(sendMail(c.env, u.email, `Payment received: ${o.title}`, mailHtml({ site: "LEARN", title: "You're enrolled", intro: `Payment of ${rupees(o.total_paise)} received for <b>${o.title}</b>. Invoice ${done.invoice_no}. Your access runs for ${PRICING.accessMonths} months.`, action: { label: "Start learning", url: `${site(c)}/#/${o.kind}/${o.ref_id}` } })).then(() => {}));
    return c.json({ ok: true, invoice: done.invoice_no, kind: o.kind, ref: o.ref_id });
  });

  pay.get("/orders", async (c) => {
    const u = await currentUser(c);
    if (!u) return c.json({ orders: [], enrolments: [] });
    const [o, e] = await c.env.DB.batch([
      c.env.DB.prepare("SELECT id, kind, ref_id, title, total_paise, status, invoice_no, created_at, paid_at FROM orders WHERE user_id = ? AND status != 'created' ORDER BY created_at DESC").bind(u.id),
      c.env.DB.prepare("SELECT course_id, expires_at FROM enrolments WHERE user_id = ? AND revoked_at IS NULL").bind(u.id),
    ]);
    return c.json({ orders: o.results, enrolments: e.results });
  });

  return pay;
}

/** /invoice/:id — the learner's own invoice or receipt as a printable page. */
export async function invoicePage(c: any, currentUser: (c: any) => Promise<any>) {
  const u = await currentUser(c);
  if (!u) return c.redirect("/#/purchases", 302);
  const o = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").bind(String(c.req.param("id")).slice(0, 40), u.id).first();
  if (!o) return c.text("Not found", 404);
  return c.html(invoiceHtml(o, c.env as PayEnv));
}

// Razorpay webhook (/hooks/razorpay): the source of truth when the browser closes before /verify.
export async function razorpayWebhook(c: any) {
    const raw = await c.req.text();
    if (!c.env.RAZORPAY_WEBHOOK_SECRET) return c.json({ error: "not configured" }, 503);
    const sig = await hmacHex(c.env.RAZORPAY_WEBHOOK_SECRET, raw);
    if (!safeEq(sig, c.req.header("X-Razorpay-Signature") || "")) return c.json({ error: "bad signature" }, 400);
    const ev = JSON.parse(raw);
    const pmt = ev?.payload?.payment?.entity;
    if ((ev.event === "payment.captured" || ev.event === "order.paid") && pmt?.order_id) {
      const o = await c.env.DB.prepare("SELECT id FROM orders WHERE gateway_order_id = ?").bind(pmt.order_id).first() as any;
      if (o) await fulfil(c.env.DB, o.id, { method: "razorpay", paymentId: pmt.id });
    }
    if (ev.event === "payment.failed" && pmt?.order_id) await c.env.DB.prepare("UPDATE orders SET status = 'failed' WHERE gateway_order_id = ? AND status = 'created'").bind(pmt.order_id).run();
    return c.json({ ok: true });
  }
