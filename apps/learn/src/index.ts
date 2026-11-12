// learn.kayaksa.com — paid professional learning on ethics, compliance, risk, governance and AI.
// Anyone can browse the catalogue; an enrolment opens a course for 12 months with a verifiable certificate.
import { shield, pruneSecurity } from "../../../packages/core/src/shield";
import { Hono } from "hono";
import { statsBeacon } from "../../../packages/core/src/stats";
import { securityHeaders, sameOrigin, HttpError, readJson, str, email as cleanEmail, rateLimit, clientIp } from "../../../packages/core/src/http";
import { hashPassword, verifyPassword, passwordProblems, randomToken, sha256hex } from "../../../packages/core/src/crypto";
import { createSession, readSession, endSession, endAllSessions, audit, SessionConfig } from "../../../packages/core/src/session";
import { mailEnabled, mailHtml, sendMail, MailEnv } from "../../../packages/core/src/mail";
import { learnApi } from "../../../packages/learnkit/src/routes";
import { getCatalog } from "../../../packages/learnkit/src/catalog";
import { PRICING } from "../../../packages/learnkit/src/pricing";
import { entitlements, type PayEnv } from "../../../packages/learnkit/src/commerce";
import { payApi, invoicePage, razorpayWebhook } from "./pay";

interface Env extends MailEnv, PayEnv {
  LEARN_SALES_TO?: string;
  DB: D1Database;
  ASSETS: Fetcher;
  SITE_URL: string;
}
type C = { Bindings: Env };

const SESSION: SessionConfig = { cookie: "__Host-kl_sid", fullTtlHours: 24 * 30, idleMinutes: 60 * 24 * 14, preTtlMinutes: 10 };
const GENERIC = "Email or password is not correct.";
const app = new Hono<C>();

// Razorpay Checkout runs in an iframe from checkout.razorpay.com.
app.use("*", securityHeaders({ script: ["https://checkout.razorpay.com"], frame: ["https://api.razorpay.com", "https://checkout.razorpay.com"], connect: ["https://api.razorpay.com", "https://lumberjack.razorpay.com"], img: ["https://cdn.razorpay.com"] }));
app.post("/hooks/razorpay", razorpayWebhook);
// Cookieless page statistics, read by the internal dashboards.
app.post("/api/a", (c) => statsBeacon(c, c.env.DB, "kayak-learn"));
app.use("*", shield("learn", (e) => e.DB, { allowGoodBots: true }));
app.use("/api/*", sameOrigin());
app.onError((e: any, c) => {
  const status = e instanceof HttpError ? e.status : e?.status || 500;
  if (status >= 500) console.error("learn error", e?.stack || e);
  return c.json({ error: status >= 500 ? "Something went wrong on our side. Please try again." : e.message }, status);
});

const site = (c: any) => (c.env.SITE_URL || new URL(c.req.url).origin).replace(/\/$/, "");
async function currentUser(c: any) {
  const s = await readSession(c, c.env.DB, SESSION, "full");
  if (!s) return null;
  return c.env.DB.prepare("SELECT id, email, name, organisation, verified, created_at FROM users WHERE id = ?").bind(s.user_id).first();
}

async function issueToken(db: D1Database, userId: string, kind: "verify" | "reset", hours: number) {
  const t = randomToken(32);
  await db.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = ? AND used_at IS NULL").bind(userId, kind).run();
  await db.prepare("INSERT INTO tokens (token_hash, kind, user_id, expires_at, created_at) VALUES (?,?,?,?,?)")
    .bind(await sha256hex(t), kind, userId, new Date(Date.now() + hours * 3_600_000).toISOString(), new Date().toISOString()).run();
  return t;
}
async function takeToken(db: D1Database, token: string, kind: "verify" | "reset") {
  if (!token || token.length > 100) return null;
  const h = await sha256hex(token);
  const row = await db.prepare("SELECT * FROM tokens WHERE token_hash = ? AND kind = ?").bind(h, kind).first<any>();
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now()) return null;
  await db.prepare("UPDATE tokens SET used_at = ? WHERE token_hash = ?").bind(new Date().toISOString(), h).run();
  return row.user_id as string;
}
async function sendVerify(c: any, u: { id: string; email: string; name: string }) {
  const t = await issueToken(c.env.DB, u.id, "verify", 72);
  const url = `${site(c)}/#/confirm?t=${t}`;
  await sendMail(c.env, u.email, "Confirm your email for Kayak Learn", mailHtml({
    site: "LEARN", title: `Welcome, ${u.name.split(" ")[0]}`,
    intro: "Thank you for joining Kayak Learn. Confirm your email address so that we can issue certificates in your name.",
    action: { label: "Confirm my email", url }, outro: "This link works once and expires in 72 hours. If you did not create an account, ignore this email.",
  }));
}

// ---------------------------------------------------------------- auth
const auth = new Hono<C>();

auth.get("/state", async (c) => {
  const u = await currentUser(c);
  return c.json({ signedIn: !!u, user: u ? { name: u.name, email: u.email, organisation: u.organisation, verified: !!u.verified } : null, mail: mailEnabled(c.env) });
});

auth.post("/signup", async (c) => {
  const b = await readJson<any>(c, 4096);
  const ip = clientIp(c);
  if (!(await rateLimit(c.env.DB, `signup:${ip}`, 8, 3600))) return c.json({ error: "Too many sign-ups from this network. Try again in an hour." }, 429);
  const e = cleanEmail(b.email);
  const name = str(b.name, 80).replace(/\s+/g, " ");
  const org = str(b.organisation, 120);
  const pw = typeof b.password === "string" ? b.password : "";
  if (!name || name.length < 2) return c.json({ error: "Enter your full name as it should appear on certificates." }, 400);
  if (!e) return c.json({ error: "Enter a valid email address." }, 400);
  if (b.consent !== true) return c.json({ error: "Please accept the privacy notice to create an account." }, 400);
  const probs = passwordProblems(pw, e);
  if (probs.length) return c.json({ error: probs.join(" ") }, 400);
  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(e).first();
  if (exists) return c.json({ error: "An account with this email already exists. Sign in, or reset your password." }, 409);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const verified = mailEnabled(c.env) ? 0 : 1; // Without email we cannot verify; accounts are usable at once.
  await c.env.DB.prepare("INSERT INTO users (id, email, name, organisation, pw_hash, verified, consent_at, created_at, last_login) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, e, name, org, await hashPassword(pw), verified, now, now, now).run();
  await createSession(c, c.env.DB, SESSION, id, "full");
  await audit(c, c.env.DB, id, "learner.signed_up");
  if (!verified) await sendVerify(c, { id, email: e, name });
  return c.json({ ok: true, verified: !!verified });
});

auth.post("/login", async (c) => {
  const b = await readJson<any>(c, 4096);
  const e = cleanEmail(b.email);
  const pw = typeof b.password === "string" ? b.password : "";
  const ip = clientIp(c);
  if (!(await rateLimit(c.env.DB, `login-ip:${ip}`, 30, 900)) || (e && !(await rateLimit(c.env.DB, `login-email:${e}`, 12, 900))))
    return c.json({ error: "Too many attempts. Wait 15 minutes and try again." }, 429);
  if (!e || !pw) return c.json({ error: GENERIC }, 400);
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(e).first<any>();
  if (u?.locked_until && Date.parse(u.locked_until) > Date.now()) {
    await verifyPassword(pw, null);
    return c.json({ error: "This account is locked for 15 minutes after too many failed attempts." }, 423);
  }
  const ok = await verifyPassword(pw, u?.pw_hash);
  if (!u || !ok) {
    if (u) {
      const failed = (u.failed || 0) + 1;
      const lock = failed >= 8 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
      await c.env.DB.prepare("UPDATE users SET failed = ?, locked_until = ? WHERE id = ?").bind(lock ? 0 : failed, lock, u.id).run();
    }
    return c.json({ error: GENERIC }, 401);
  }
  await c.env.DB.prepare("UPDATE users SET failed = 0, locked_until = NULL, last_login = ? WHERE id = ?").bind(new Date().toISOString(), u.id).run();
  await createSession(c, c.env.DB, SESSION, u.id, "full");
  return c.json({ ok: true });
});

auth.post("/logout", async (c) => {
  await endSession(c, c.env.DB, SESSION, "full");
  return c.json({ ok: true });
});

auth.post("/forgot", async (c) => {
  const b = await readJson<any>(c, 2048);
  const e = cleanEmail(b.email);
  if (!(await rateLimit(c.env.DB, `forgot:${clientIp(c)}`, 6, 3600))) return c.json({ error: "Too many requests. Try again later." }, 429);
  if (!mailEnabled(c.env)) return c.json({ error: "Password reset by email is not switched on yet. Write to learn@kayaksa.com from your registered address and we will help." }, 503);
  const u = e ? await c.env.DB.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(e).first<any>() : null;
  if (u) {
    const t = await issueToken(c.env.DB, u.id, "reset", 1);
    await sendMail(c.env, u.email, "Reset your Kayak Learn password", mailHtml({
      site: "LEARN", title: "Reset your password", intro: "We received a request to reset the password for your Kayak Learn account.",
      action: { label: "Choose a new password", url: `${site(c)}/#/reset?t=${t}` }, outro: "This link works once and expires in one hour. If you did not ask for it, you can ignore this email.",
    }));
  }
  return c.json({ ok: true }); // Same answer either way, so emails cannot be enumerated.
});

auth.post("/reset", async (c) => {
  const b = await readJson<any>(c, 4096);
  const pw = typeof b.password === "string" ? b.password : "";
  const uid = await takeToken(c.env.DB, str(b.token, 100), "reset");
  if (!uid) return c.json({ error: "This link has expired or has already been used. Ask for a new one." }, 410);
  const u = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(uid).first<any>();
  const probs = passwordProblems(pw, u?.email);
  if (probs.length) return c.json({ error: probs.join(" ") }, 400);
  await c.env.DB.prepare("UPDATE users SET pw_hash = ?, verified = 1, failed = 0, locked_until = NULL WHERE id = ?").bind(await hashPassword(pw), uid).run();
  await endAllSessions(c.env.DB, uid);
  await createSession(c, c.env.DB, SESSION, uid, "full");
  await audit(c, c.env.DB, uid, "learner.password_reset");
  return c.json({ ok: true });
});

auth.post("/confirm", async (c) => {
  const b = await readJson<any>(c, 2048);
  const uid = await takeToken(c.env.DB, str(b.token, 100), "verify");
  if (!uid) return c.json({ error: "This link has expired or has already been used. Sign in and ask for a new one." }, 410);
  await c.env.DB.prepare("UPDATE users SET verified = 1 WHERE id = ?").bind(uid).run();
  return c.json({ ok: true });
});

auth.post("/resend", async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ error: "Sign in first." }, 401);
  if (u.verified) return c.json({ ok: true, verified: true });
  if (!(await rateLimit(c.env.DB, `resend:${u.id}`, 3, 3600))) return c.json({ error: "We have already sent a few links. Check your spam folder, or try again in an hour." }, 429);
  await sendVerify(c, u);
  return c.json({ ok: true });
});

app.route("/api/auth", auth);

// ---------------------------------------------------------------- account (DPDP rights)
app.get("/api/account", async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ error: "Sign in first." }, 401);
  return c.json({ user: u });
});
app.post("/api/account", async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ error: "Sign in first." }, 401);
  const b = await readJson<any>(c, 4096);
  const name = str(b.name, 80).replace(/\s+/g, " ");
  if (name.length < 2) return c.json({ error: "Enter your full name." }, 400);
  await c.env.DB.prepare("UPDATE users SET name = ?, organisation = ? WHERE id = ?").bind(name, str(b.organisation, 120), u.id).run();
  if (typeof b.password === "string" && b.password) {
    const cur = await c.env.DB.prepare("SELECT pw_hash FROM users WHERE id = ?").bind(u.id).first<any>();
    if (!(await verifyPassword(String(b.current || ""), cur?.pw_hash))) return c.json({ error: "Your current password is not correct." }, 400);
    const probs = passwordProblems(b.password, u.email);
    if (probs.length) return c.json({ error: probs.join(" ") }, 400);
    await c.env.DB.prepare("UPDATE users SET pw_hash = ? WHERE id = ?").bind(await hashPassword(b.password), u.id).run();
  }
  return c.json({ ok: true });
});
app.get("/api/account/export", async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ error: "Sign in first." }, 401);
  const q = (sql: string) => c.env.DB.prepare(sql).bind(u.id).all().then((r) => r.results);
  const data = { account: u, progress: await q("SELECT course_id, lesson_id, done_at FROM learn_progress WHERE user_id = ?"), assessments: await q("SELECT course_id, score, passed, at FROM quiz_attempts WHERE user_id = ?"), certificates: await q("SELECT id, kind, ref_id, holder, title, issued_at FROM certificates WHERE user_id = ?"), enrolments: await q("SELECT course_id, created_at, expires_at, revoked_at FROM enrolments WHERE user_id = ?"), orders: await q("SELECT id, title, total_paise, status, invoice_no, buyer_name, buyer_org, buyer_gstin, buyer_state, created_at, paid_at FROM orders WHERE user_id = ?") };
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="kayak-learn-my-data.json"', "Cache-Control": "no-store" } });
});
app.post("/api/account/delete", async (c) => {
  const u = await currentUser(c);
  if (!u) return c.json({ error: "Sign in first." }, 401);
  const b = await readJson<any>(c, 2048);
  const cur = await c.env.DB.prepare("SELECT pw_hash FROM users WHERE id = ?").bind(u.id).first<any>();
  if (!(await verifyPassword(String(b.password || ""), cur?.pw_hash))) return c.json({ error: "Your password is not correct." }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM learn_progress WHERE user_id = ?").bind(u.id),
    c.env.DB.prepare("DELETE FROM quiz_attempts WHERE user_id = ?").bind(u.id),
    c.env.DB.prepare("DELETE FROM certificates WHERE user_id = ?").bind(u.id),
    c.env.DB.prepare("DELETE FROM enrolments WHERE user_id = ?").bind(u.id),
    // Paid orders and invoices are kept for eight years under GST and income-tax law; unpaid ones go now.
    c.env.DB.prepare("DELETE FROM orders WHERE user_id = ? AND status NOT IN ('paid','refunded')").bind(u.id),
    c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(u.id),
  ]);
  await audit(c, c.env.DB, null, "learner.deleted");
  await endSession(c, c.env.DB, SESSION, "full");
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- learning
app.route("/api/learn", learnApi({
  internal: false,
  learner: async (c) => {
    const u = await currentUser(c);
    return u ? { id: u.id, name: u.name, verified: !!u.verified } : null;
  },
  verifyBase: (c) => `${site(c)}/verify/`,
  entitlements: (c, l) => entitlements(c.env.DB, l.id),
}));
app.route("/api/pay", payApi(currentUser, site));
app.get("/invoice/:id", (c) => invoicePage(c, currentUser));
app.all("/api/*", (c) => c.json({ error: "Not found." }, 404));

// ---------------------------------------------------------------- public pages
const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
function shellPage(title: string, body: string, desc = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>${desc ? `<meta name="description" content="${esc(desc)}">` : ""}<link rel="icon" href="/_shared/logos/KayakLearn_Mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="/_shared/css/kayak.css"><link rel="stylesheet" href="/_shared/css/learn.css"><link rel="stylesheet" href="/assets/learn.css"></head>
<body><header class="lhead"><a class="ksa-logo" href="/"><img src="/_shared/logos/KayakLearn_Logo_FullColour.svg" alt="Kayak Learn" height="34"></a><nav class="lnav"><a href="/">Courses</a><a href="/verify">Verify a certificate</a></nav></header>
<main class="lmain">${body}</main>${footer()}</body></html>`;
}
const footer = () => `<footer class="lfoot"><div class="page"><div class="row between"><span>Kayak Learn is offered by Kayak Strategic Advisors Private Limited, Mumbai and Thane.</span><span><a href="/#/terms">Terms of sale and refunds</a> · <a href="/#/privacy">Privacy notice</a> · <a href="https://www.kayaksa.com">www.kayaksa.com</a></span></div><p class="small">Courses are for general awareness and are not legal advice. Regulatory references are reviewed periodically and are stated as at November 2026.</p></div></footer>`;

async function verifyHtml(c: any, id: string | null) {
  if (!id) {
    return shellPage("Verify a certificate · Kayak Learn", `<div class="page lesson"><div class="stack-sm"><span class="eyebrow">Certificate verification</span><h1>Verify a Kayak certificate</h1><p class="lead">Enter the certificate ID printed at the foot of the certificate, for example <code>KSA-7Q4M-2KXD</code>.</p></div>
      <form class="row" method="get" action="/verify/lookup"><input class="input" name="id" required maxlength="20" placeholder="KSA-XXXX-XXXX" style="flex:1 1 240px;text-transform:uppercase" aria-label="Certificate ID"><button class="btn btn-primary" type="submit">Verify</button></form></div>`, "Check that a Kayak Learn certificate of participation is genuine.");
  }
  const clean = id.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
  const row = await c.env.DB.prepare("SELECT id, kind, ref_id, holder, title, issued_at FROM certificates WHERE id = ?").bind(clean).first();
  if (!row) {
    return shellPage("Certificate not found · Kayak Learn", `<div class="page lesson"><div class="note danger stack-sm"><h2>No certificate with ID ${esc(clean)}</h2><p>Check the ID and try again. If you believe a certificate is genuine but it does not appear here, write to learn@kayaksa.com.</p></div><a class="btn btn-ghost" href="/verify">Try another ID</a></div>`);
  }
  const date = new Date(row.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return shellPage(`${row.holder} · Verified certificate · Kayak Learn`, `<div class="page lesson"><div class="verify-card stack">
    <span class="badge ok">Verified genuine</span><span class="eyebrow">Certificate of participation</span><h1>${esc(row.holder)}</h1>
    <p class="lead">completed the ${row.kind === "path" ? "learning path" : "course"} <b>${esc(row.title)}</b> on ${esc(date)}.</p>
    <dl class="kv"><dt>Certificate ID</dt><dd><code>${esc(row.id)}</code></dd><dt>Issued by</dt><dd>Kayak Strategic Advisors Private Limited</dd><dt>Type</dt><dd>${row.kind === "path" ? "Learning path" : "Course"}</dd></dl>
    <p class="small muted">A certificate of participation confirms that the holder completed every lesson and passed the assessment. It is not a professional qualification.</p></div></div>`, `Verified Kayak Learn certificate for ${row.holder}.`);
}
app.get("/verify", async (c) => c.html(await verifyHtml(c, null)));
app.get("/verify/lookup", (c) => c.redirect(`/verify/${encodeURIComponent((c.req.query("id") || "").trim().toUpperCase().slice(0, 20))}`, 302));
app.get("/verify/:id", async (c) => {
  const r = c.html(await verifyHtml(c, c.req.param("id")));
  return r;
});

// ---------------------------------------------------------------- course pages for search engines
// Every public course and path has its own address with the full outline, so it can be found and shared.
// The interactive course itself opens in the app (/#/course/<id>).
const LD = (o: object) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const rupee = (paise: number) => (paise / 100).toLocaleString("en-IN");
const publicCourses = () => getCatalog().courses.filter((x) => x.audience === "public");
const topicName = (id: string) => getCatalog().topics.find((t) => t.id === id)?.name || "";
const ORG = { "@type": "Organization", "@id": "https://www.kayaksa.com/#org", name: "Kayak Strategic Advisors Private Limited", url: "https://www.kayaksa.com/" };
function courseLd(base: string, x: any) {
  return {
    "@type": "Course", "@id": `${base}/courses/${x.id}#course`, name: x.title, description: x.summary, url: `${base}/courses/${x.id}`, inLanguage: "en-IN",
    provider: { "@type": "EducationalOrganization", name: "Kayak Learn", url: "https://learn.kayaksa.com/", parentOrganization: ORG },
    educationalLevel: x.level, about: topicName(x.topic), teaches: x.outcomes, timeRequired: `PT${x.minutes}M`, numberOfCredits: 0,
    educationalCredentialAwarded: "Kayak Learn certificate of completion (verifiable)", isAccessibleForFree: false,
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", courseWorkload: `PT${x.minutes}M`, inLanguage: "en" },
    offers: { "@type": "Offer", category: "Paid", price: (PRICING.offerPaise / 100).toFixed(2), priceCurrency: "INR", availability: "https://schema.org/InStock", url: `${base}/courses/${x.id}`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: (PRICING.offerPaise / 100).toFixed(2), priceCurrency: "INR", valueAddedTaxIncluded: false } },
  };
}
const SEO_HEAD = (canonical: string, title: string, desc: string) => `<link rel="canonical" href="${esc(canonical)}"><meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"><meta property="og:site_name" content="Kayak Learn"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="en_IN"><meta name="twitter:card" content="summary">`;
function seoPage(title: string, desc: string, canonical: string, body: string, ld: object) {
  return shellPage(title, body, desc).replace("</head>", `${SEO_HEAD(canonical, title, desc)}${LD(ld)}</head>`).replace('<html lang="en">', '<html lang="en-IN">');
}
app.get("/courses", (c) => {
  const base = site(c), cs = publicCourses();
  const title = "Online courses on ethics, compliance, risk, governance and AI | Kayak Learn";
  const desc = `${cs.length} assessed online courses with verifiable certificates: ethics and integrity, compliance, risk, corporate governance and responsible AI. ₹${rupee(PRICING.offerPaise)} plus GST per course, 12 months' access.`;
  const body = `<div class="page"><h1>Courses</h1><p class="lead">${esc(desc)}</p>${getCatalog().topics.filter((t) => cs.some((x) => x.topic === t.id)).map((t) => `<h2>${esc(t.name)}</h2><ul>${cs.filter((x) => x.topic === t.id).map((x) => `<li><a href="/courses/${x.id}"><b>${esc(x.title)}</b></a>: ${esc(x.summary)} (${x.minutes} minutes, ${esc(x.level)})</li>`).join("")}</ul>`).join("")}</div>`;
  return c.html(seoPage(title, desc, `${base}/courses`, body, { "@context": "https://schema.org", "@graph": [
    { "@type": "ItemList", name: "Kayak Learn courses", itemListElement: cs.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}/courses/${x.id}`, item: courseLd(base, x) })) },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Kayak Learn", item: `${base}/` }, { "@type": "ListItem", position: 2, name: "Courses", item: `${base}/courses` }] }] }));
});
app.get("/courses/:id", (c) => {
  const base = site(c), x = publicCourses().find((y) => y.id === c.req.param("id"));
  if (!x) return c.html(shellPage("Course not found | Kayak Learn", `<div class="page"><h1>Course not found</h1><p><a href="/courses">See all courses</a></p></div>`), 404);
  const title = `${x.title}: online course with certificate | Kayak Learn`;
  const desc = `${x.summary} ${x.minutes} minutes, ${x.level}, assessed, with a verifiable certificate. ₹${rupee(PRICING.offerPaise)} plus GST.`.slice(0, 300);
  const body = `<div class="page"><p><a href="/courses">Courses</a> › ${esc(topicName(x.topic))}</p><h1>${esc(x.title)}</h1><p class="lead">${esc(x.summary)}</p>
    <p>${x.minutes} minutes · ${esc(x.level)} · ${x.lessons.length} lessons · assessment (pass mark ${x.quiz.pass}%) · verifiable certificate · ${PRICING.accessMonths} months' access</p>
    <p><b>Launch offer ₹${rupee(PRICING.offerPaise)}</b> plus 18% GST (list price ₹${rupee(PRICING.listPaise)}).</p>
    <h2>What you will learn</h2><ul>${x.outcomes.map((o: string) => `<li>${esc(o)}</li>`).join("")}</ul>
    <h2>Lessons</h2><ol>${x.lessons.map((l: any) => `<li>${esc(l.title)} (${l.minutes} min)</li>`).join("")}</ol>
    <p><a class="btn btn-primary" href="/#/course/${x.id}">Start this course</a></p></div>`;
  return c.html(seoPage(title, desc, `${base}/courses/${x.id}`, body, { "@context": "https://schema.org", "@graph": [courseLd(base, x),
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Kayak Learn", item: `${base}/` }, { "@type": "ListItem", position: 2, name: "Courses", item: `${base}/courses` }, { "@type": "ListItem", position: 3, name: x.title, item: `${base}/courses/${x.id}` }] }] }));
});
const indexNowKey = async (host: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("indexnow:" + host)))].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
app.get("/:file{[0-9a-f]+\\.txt}", async (c) => (c.req.param("file") === `${await indexNowKey(new URL(c.req.url).hostname)}.txt` ? c.text(await indexNowKey(new URL(c.req.url).hostname)) : c.notFound()));

app.get("/robots.txt", (c) => c.text(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /invoice/\nSitemap: ${site(c)}/sitemap.xml\n`));
app.get("/sitemap.xml", (c) => {
  const base = site(c);
  const urls = [`${base}/`, `${base}/courses`, ...publicCourses().map((x) => `${base}/courses/${x.id}`), `${base}/verify`];
  return c.body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`, 200, { "Content-Type": "application/xml" });
});
app.get("/login", (c) => c.redirect("/#/", 302));
app.get("/healthz", (c) => c.json({ ok: true, site: "learn", courses: getCatalog().courses.length }));

app.get("/", (c) => c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url))));
app.all("*", async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status === 404) return c.html(shellPage("Page not found · Kayak Learn", `<div class="page lesson"><h1>Page not found</h1><p><a href="/">Back to all courses</a></p></div>`), 404);
  return res;
});

export default {
  fetch: app.fetch,
  async scheduled(_e: ScheduledEvent, env: Env) {
    await pruneSecurity(env.DB);
    await env.DB.prepare("DELETE FROM rate_limits").run();
  },
};
