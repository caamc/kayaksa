// Certification journeys and the Launch monitor. Both start with suggested plans (clearly marked as
// estimates) that administrators edit. Nothing here claims a certification is held until an
// administrator records it as achieved.
import { Hono } from "hono";
import { readJson, str } from "../../../packages/core/src/http";
import { audit } from "../../../packages/core/src/session";
import { Env, User, atLeast, uid } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const ops = new Hono<V>();
const now = () => new Date().toISOString();
const addDays = (d: string | Date, n: number) => new Date(new Date(d).getTime() + n * 86400_000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const admin = (c: any) => atLeast(c.get("user"), "admin");
const num = (v: any) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);

// ------------------------------------------------------------------ certifications
const JOURNEYS: Record<string, [string, number][]> = {
  "ISO/IEC 27001:2022": [["Scope and gap assessment", 21], ["Risk assessment and Statement of Applicability", 30], ["Policies and controls in place", 60], ["Internal audit", 14], ["Management review", 7], ["Stage 1 audit", 14], ["Stage 2 audit and certification", 21]],
  "ISO 9001:2015": [["Process mapping and gap assessment", 14], ["Quality manual and procedures", 30], ["Run the system and keep records", 45], ["Internal audit and management review", 14], ["Certification audit", 21]],
  "ISO/IEC 27701:2025": [["Privacy gap assessment", 14], ["Records of processing and privacy controls", 45], ["Internal audit", 10], ["Certification audit (with 27001)", 21]],
  "ISO/IEC 42001:2023": [["AI system inventory and impact assessment", 21], ["AI policy, roles and controls", 45], ["Internal audit", 10], ["Certification audit", 21]],
  "ISO 22301:2019": [["Business impact analysis", 21], ["Continuity plans and recovery tests", 45], ["Exercise and internal audit", 14], ["Certification audit", 21]],
  "ISO 37301:2021": [["Compliance obligations register", 21], ["Policies, whistleblowing and training", 45], ["Internal audit", 10], ["Certification audit", 21]],
  "SOC 2 Type I": [["Readiness assessment", 30], ["Remediation", 45], ["Select a licensed CPA firm", 14], ["Type I examination", 30]],
  "SOC 2 Type II": [["Observation window", 180], ["Type II examination", 45]],
  "SOC 1 Type II (only if clients rely on it for financial reporting)": [["Confirm client need", 14], ["Control objectives and readiness", 45], ["Observation window", 180], ["Type II examination", 45]],
  "PCI DSS v4.0.1 SAQ A (Razorpay hosted checkout)": [["Confirm card data never touches Kayak servers", 7], ["Complete SAQ A and quarterly checks", 14], ["Attestation of Compliance to Razorpay", 7]],
  "VAPT by a CERT-In empanelled auditor": [["Scope and rules of engagement", 5], ["Testing", 15], ["Remediation", 15], ["Re-test and certificate", 7]],
  "DPDP Act readiness assessment": [["Data map", 21], ["Notices and consent flows", 21], ["Security safeguards and breach response", 30], ["Independent review", 14]],
  "UAE PDPL readiness (Federal Decree-Law 45 of 2021)": [["Data map for UAE users", 14], ["Notices, consent and transfer safeguards", 21], ["Independent review", 14]],
  "DPIIT Startup India recognition": [["Prepare documents and innovation write-up", 7], ["Apply on the Startup India portal", 3], ["Respond to queries", 21]],
  "Convert OPC to private limited (for DPIIT)": [["Board and shareholder approvals", 14], ["Add a second director and member", 14], ["File INC-6 with the ROC", 7], ["Fresh certificate of incorporation", 21]],
  "Register the partnership firm (for DPIIT)": [["Form 1 to the Registrar of Firms, Maharashtra", 7], ["Registrar's acknowledgement", 30]],
  "Trade mark registration": [["Clearance search", 7], ["File application", 7], ["Examination and reply", 180], ["Publication and opposition window", 120], ["Registration", 60]],
  "eSign Service Provider empanelment (CCA)": [["Eligibility and gap assessment", 30], ["Infrastructure and audit readiness", 120], ["Application to the CCA", 30], ["Audit and empanelment", 120]],
  "Udyam (MSME) registration": [["File on the Udyam portal", 1]],
  "EU GDPR applicability and compliance": [["Test whether GDPR applies (EU offering or monitoring)", 14], ["Article 27 EU representative, if it applies", 21], ["Records of processing, transfer safeguards (SCCs) and notices", 30], ["Independent review", 14]],
  "CERT-In Directions, 2022 compliance": [["Name the CERT-In point of contact", 3], ["Six-hour incident reporting procedure and drill", 14], ["180-day log retention in India and NTP time sync on every system", 21], ["Annual attestation by the IT and Security Administrator", 7]],
};
// The certification and registration roadmap. Topped up, never overwritten: anything already
// tracked keeps its own dates and progress.
const SEED_CERTS: [string, string, string, number, number][] = [
  // entity, standard, body, start offset (days), estimated cost (INR, planning estimate)
  ["Kayak Strategic Advisors", "DPDP Act readiness assessment", "Independent reviewer", 0, 100000],
  ["Kayak Strategic Advisors", "ISO/IEC 27001:2022", "Accredited certification body (to be selected)", 0, 350000],
  ["Kayak Strategic Advisors", "ISO/IEC 27701:2025", "Accredited certification body (to be selected)", 120, 200000],
  ["Kayak Strategic Advisors", "ISO 9001:2015", "Accredited certification body (to be selected)", 60, 150000],
  ["Kayak Strategic Advisors", "ISO/IEC 42001:2023", "Accredited certification body (to be selected)", 180, 250000],
  ["Kayak Strategic Advisors", "ISO 22301:2019", "Accredited certification body (to be selected)", 240, 200000],
  ["Kayak Strategic Advisors", "VAPT by a CERT-In empanelled auditor", "CERT-In empanelled auditor", 14, 250000],
  ["Kayak Strategic Advisors", "PCI DSS v4.0.1 SAQ A (Razorpay hosted checkout)", "Self-assessment, shared with Razorpay", 0, 0],
  ["Kayak Strategic Advisors", "DPIIT Startup India recognition", "DPIIT", 0, 0],
  ["Kayak Strategic Advisors", "Udyam (MSME) registration", "Ministry of MSME", 0, 0],
  ["Kayak Innovations", "Convert OPC to private limited (for DPIIT)", "Registrar of Companies", 0, 25000],
  ["Kayak Innovations", "DPIIT Startup India recognition", "DPIIT", 60, 0],
  ["Kayak Innovations", "Trade mark registration", "Trade Marks Registry", 0, 60000],
  ["Kayak Technology Solutions", "Register the partnership firm (for DPIIT)", "Registrar of Firms, Maharashtra", 0, 5000],
  ["Kayak Technology Solutions", "DPIIT Startup India recognition", "DPIIT", 40, 0],
  ["Kayak Technology Solutions", "SOC 2 Type I", "Licensed CPA firm", 60, 800000],
  ["Kayak Technology Solutions", "SOC 2 Type II", "Licensed CPA firm", 180, 1200000],
  ["Kayak Technology Solutions", "SOC 1 Type II (only if clients rely on it for financial reporting)", "Licensed CPA firm", 270, 900000],
  ["NexaPair", "VAPT by a CERT-In empanelled auditor", "CERT-In empanelled auditor", 0, 150000],
  ["NexaPair", "UAE PDPL readiness (Federal Decree-Law 45 of 2021)", "Independent reviewer", 30, 100000],
  ["SayUsNow", "VAPT by a CERT-In empanelled auditor", "CERT-In empanelled auditor", 30, 150000],
  ["Kayak Strategic Advisors", "ISO 37301:2021", "Accredited certification body (to be selected)", 210, 200000],
  ["Kayak Strategic Advisors", "EU GDPR applicability and compliance", "Independent reviewer", 30, 150000],
  ["Kayak Strategic Advisors", "CERT-In Directions, 2022 compliance", "Internal, with the VAPT auditor's review", 0, 0],
  ["NexaPair", "ISO/IEC 42001:2023", "Accredited certification body (to be selected)", 240, 150000],
  ["DocuVow", "eSign Service Provider empanelment (CCA)", "Controller of Certifying Authorities", 60, 0],
];
async function seedCerts(db: D1Database) {
  // ISO/IEC 27701:2025 replaced the 2019 edition (published October 2025; 2019 certificates end October 2028).
  await db.prepare("UPDATE certifications SET standard = 'ISO/IEC 27701:2025' WHERE standard = 'ISO/IEC 27701:2019' AND status = 'planned'").run().catch(() => {});
  const { results: have } = await db.prepare("SELECT entity, standard FROM certifications").all<any>();
  const seen = new Set(have.map((r: any) => `${r.entity}|${r.standard}`));
  const stmts: D1PreparedStatement[] = [];
  for (const [entity, standard, body, off, cost] of SEED_CERTS) {
    if (seen.has(`${entity}|${standard}`)) continue;
    const id = uid(), start = addDays(new Date(), off);
    let d = start;
    const steps = JOURNEYS[standard] || [];
    steps.forEach(([t, days], i) => { d = addDays(d, days); stmts.push(db.prepare("INSERT INTO cert_steps (cert_id, ord, title, days, owner, due_date) VALUES (?,?,?,?,?,?)").bind(id, i, t, days, "Anuj", d)); });
    stmts.push(db.prepare("INSERT INTO certifications (id, entity, standard, body, status, owner, start_date, target_date, cost_est, notes, created_at, updated_at) VALUES (?,?,?,?, 'planned', 'Anuj', ?, ?, ?, ?, ?, ?)").bind(id, entity, standard, body, start, d, cost, "Suggested plan and planning estimate. Confirm dates and quotes before relying on them.", now(), now()));
  }
  if (stmts.length) await db.batch(stmts);
}
ops.get("/certs", async (c) => {
  await seedCerts(c.env.DB);
  const [{ results: certs }, { results: steps }] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM certifications ORDER BY entity, target_date").all<any>(),
    c.env.DB.prepare("SELECT * FROM cert_steps ORDER BY cert_id, ord").all<any>(),
  ]);
  const t = today();
  return c.json({ journeys: Object.keys(JOURNEYS), certs: certs.map((x: any) => {
    const st = steps.filter((s: any) => s.cert_id === x.id);
    const days = st.reduce((a: number, s: any) => a + s.days, 0) || 1;
    const doneDays = st.filter((s: any) => s.done_at).reduce((a: number, s: any) => a + s.days, 0);
    const remaining = st.filter((s: any) => !s.done_at).reduce((a: number, s: any) => a + s.days, 0);
    const forecast = x.achieved_date || addDays(t, remaining);
    const late = st.filter((s: any) => !s.done_at && s.due_date && s.due_date < t);
    return { ...x, steps: st, progress: Math.round((doneDays / days) * 100), remainingDays: remaining, forecast, slipDays: x.target_date ? Math.round((Date.parse(forecast) - Date.parse(x.target_date)) / 86400_000) : 0, overdue: late.map((s: any) => ({ title: s.title, owner: s.owner, due: s.due_date })) };
  }) });
});
ops.post("/certs", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 8192);
  const entity = str(b.entity, 80), standard = str(b.standard, 120);
  if (!entity || !standard) return c.json({ error: "Choose the entity and the standard." }, 400);
  const id = uid(), start = date(b.start_date) || today();
  let d = start; const stmts: D1PreparedStatement[] = [];
  (JOURNEYS[standard] || [["Plan", 14], ["Implement", 60], ["Audit", 21]]).forEach(([t, days]: any, i: number) => { d = addDays(d, days); stmts.push(c.env.DB.prepare("INSERT INTO cert_steps (cert_id, ord, title, days, owner, due_date) VALUES (?,?,?,?,?,?)").bind(id, i, t, days, str(b.owner, 60) || null, d)); });
  stmts.push(c.env.DB.prepare("INSERT INTO certifications (id, entity, standard, body, status, owner, start_date, target_date, cost_est, notes, created_at, updated_at) VALUES (?,?,?,?, 'planned', ?, ?, ?, ?, ?, ?, ?)").bind(id, entity, standard, str(b.body, 120), str(b.owner, 60), start, date(b.target_date) || d, num(b.cost_est), str(b.notes, 1000), now(), now()));
  await c.env.DB.batch(stmts);
  await audit(c, c.env.DB, c.get("user").id, "certs.added", { entity, standard });
  return c.json({ id });
});
ops.post("/certs/:id", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 8192);
  const st = ["planned", "in_progress", "audit", "certified", "lapsed", "dropped"].includes(b.status) ? b.status : null;
  await c.env.DB.prepare("UPDATE certifications SET status = COALESCE(?, status), owner = COALESCE(?, owner), target_date = COALESCE(?, target_date), achieved_date = COALESCE(?, achieved_date), expiry_date = COALESCE(?, expiry_date), cost_est = COALESCE(?, cost_est), cost_actual = COALESCE(?, cost_actual), body = COALESCE(?, body), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?")
    .bind(st, str(b.owner, 60) || null, date(b.target_date), date(b.achieved_date), date(b.expiry_date), b.cost_est != null ? num(b.cost_est) : null, b.cost_actual != null ? num(b.cost_actual) : null, str(b.body, 120) || null, b.notes != null ? str(b.notes, 1000) : null, now(), c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "certs.updated", { id: c.req.param("id"), status: st });
  if (st === "certified") await postUpdate(c.env.DB, "milestone", "Certification achieved", `A certification journey was marked as achieved.`);
  return c.json({ ok: true });
});
ops.post("/certs/:id/delete", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  await c.env.DB.batch([c.env.DB.prepare("DELETE FROM cert_steps WHERE cert_id = ?").bind(c.req.param("id")), c.env.DB.prepare("DELETE FROM certifications WHERE id = ?").bind(c.req.param("id"))]);
  return c.json({ ok: true });
});
ops.post("/cert-steps/:id", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 4096);
  await c.env.DB.prepare("UPDATE cert_steps SET done_at = CASE WHEN ? = 1 THEN COALESCE(done_at, ?) WHEN ? = 0 THEN NULL ELSE done_at END, owner = COALESCE(?, owner), due_date = COALESCE(?, due_date), evidence = COALESCE(?, evidence) WHERE id = ?")
    .bind(b.done === true ? 1 : b.done === false ? 0 : 2, now(), b.done === true ? 1 : b.done === false ? 0 : 2, str(b.owner, 60) || null, date(b.due_date), b.evidence != null ? str(b.evidence, 500) : null, c.req.param("id")).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ launch monitor
const SEED_LAUNCHES: [string, string, number, [string, string, number, number, string, string][]][] = [
  // app, url, target offset (days), items: [title, category, days, cost INR, owner, accountable]
  ["Kayak website, full launch", "https://www.kayaksa.com", 10, [
    ["Add RESEND_API_KEY and verify kayaksa.com in Resend", "Integrations", 1, 0, "Anuj", "Anuj"],
    ["Verify Google Search Console and Bing Webmaster Tools", "SEO", 1, 0, "Anuj", "Anuj"],
    ["Deep SEO pass and structured data", "SEO", 5, 0, "Kayak AI build team", "Anuj"],
    ["Create LinkedIn, X, YouTube and Instagram profiles", "Brand", 3, 0, "Anuj", "Anuj"],
    ["Turn on Cloudflare Bot Fight Mode", "Security", 1, 0, "Anuj", "Anuj"],
    ["Approve Kay's 12 seed answers", "Content", 1, 0, "Anuj", "Anuj"],
  ]],
  ["Kayak Learn, paid courses", "https://learn.kayaksa.com", 14, [
    ["Razorpay account, KYC and activation", "Payments", 7, 0, "Anuj", "Anuj"],
    ["Add Razorpay keys and webhook secret to GitHub", "Payments", 1, 0, "Anuj", "Anuj"],
    ["Add KAYAK_GSTIN", "Tax", 1, 0, "Anuj", "Anuj"],
    ["Confirm refund policy, GST-exclusive pricing and Grievance Officer", "Legal", 2, 0, "Anuj", "Anuj"],
    ["Live test purchase, invoice and refund", "Testing", 1, 10000, "Anuj", "Anuj"],
  ]],
  ["Kayak Meet, phone dial-out", "https://meet.kayaksa.com", 10, [
    ["Add Calls/Realtime Edit permission to the Cloudflare token", "Integrations", 1, 0, "Anuj", "Anuj"],
    ["Buy a Telnyx Algiers (+213) number", "Telephony", 3, 0, "Anuj", "Anuj"],
    ["Add TELNYX_API_KEY and TELNYX_NUMBER to GitHub", "Telephony", 1, 0, "Anuj", "Anuj"],
    ["Build and test dial-out", "Build", 3, 0, "Kayak AI build team", "Anuj"],
  ]],
  ["Kayak Stream, webinars", "", 45, [
    ["Design SFU and end-to-end encryption", "Build", 7, 0, "Kayak AI build team", "Anuj"],
    ["Build registration, rooms and recording", "Build", 15, 0, "Kayak AI build team", "Anuj"],
    ["Load test to 1,000 attendees", "Testing", 5, 0, "Kayak AI build team", "Anuj"],
  ]],
];
async function seedLaunches(db: D1Database) {
  const has = await db.prepare("SELECT COUNT(*) n FROM launches").first<any>();
  if (has?.n) return;
  const stmts: D1PreparedStatement[] = [];
  for (const [app, url, off, items] of SEED_LAUNCHES) {
    const id = uid(); let d = today();
    stmts.push(db.prepare("INSERT INTO launches (id, app, url, owner, target_date, status, notes, created_at, updated_at) VALUES (?,?,?, 'Anuj', ?, 'planned', 'Proposed date: confirm or change it.', ?, ?)").bind(id, app, url, addDays(new Date(), off), now(), now()));
    items.forEach(([t, cat, days, cost, owner, acc], i) => { d = addDays(d, days); stmts.push(db.prepare("INSERT INTO launch_items (launch_id, ord, title, category, days, cost, owner, accountable, due_date) VALUES (?,?,?,?,?,?,?,?,?)").bind(id, i, t, cat, days, cost, owner, acc, d)); });
  }
  await db.batch(stmts);
}
ops.get("/launches", async (c) => {
  await seedLaunches(c.env.DB);
  const [{ results: ls }, { results: items }] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM launches ORDER BY CASE status WHEN 'launched' THEN 1 ELSE 0 END, target_date").all<any>(),
    c.env.DB.prepare("SELECT * FROM launch_items ORDER BY launch_id, ord").all<any>(),
  ]);
  const t = today();
  return c.json({ launches: ls.map((l: any) => {
    const it = items.filter((i: any) => i.launch_id === l.id);
    const open = it.filter((i: any) => i.status !== "done");
    const allDays = it.reduce((a: number, i: any) => a + i.days, 0) || 1;
    const remaining = open.reduce((a: number, i: any) => a + i.days, 0);
    const forecast = l.launched_at ? l.launched_at.slice(0, 10) : addDays(t, remaining);
    const slip = Math.round((Date.parse(forecast) - Date.parse(l.target_date)) / 86400_000);
    const overdue = open.filter((i: any) => i.due_date && i.due_date < t);
    const blocked = open.filter((i: any) => i.status === "blocked");
    const rag = l.status === "launched" ? "done" : slip > 7 || blocked.length ? "red" : slip > 0 || overdue.length ? "amber" : "green";
    return { ...l, items: it, readiness: Math.round(((allDays - remaining) / allDays) * 100), remainingDays: remaining, forecast, slipDays: slip, costTotal: it.reduce((a: number, i: any) => a + i.cost, 0), costToComplete: open.reduce((a: number, i: any) => a + i.cost, 0), rag,
      daysToTarget: Math.round((Date.parse(l.target_date) - Date.parse(t)) / 86400_000),
      delayOwners: [...new Set([...overdue, ...blocked].map((i: any) => i.accountable || i.owner).filter(Boolean))], overdue: overdue.length, blocked: blocked.length };
  }) });
});
ops.post("/launches", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 4096);
  const app = str(b.app, 100), target = date(b.target_date);
  if (!app || !target) return c.json({ error: "Name the application and its launch date." }, 400);
  const id = uid();
  await c.env.DB.prepare("INSERT INTO launches (id, app, url, owner, target_date, status, notes, created_at, updated_at) VALUES (?,?,?,?,?, 'planned', ?, ?, ?)").bind(id, app, str(b.url, 200), str(b.owner, 60), target, str(b.notes, 1000), now(), now()).run();
  return c.json({ id });
});
ops.post("/launches/:id", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 4096);
  const st = ["planned", "launched", "on_hold"].includes(b.status) ? b.status : null;
  await c.env.DB.prepare("UPDATE launches SET status = COALESCE(?, status), target_date = COALESCE(?, target_date), owner = COALESCE(?, owner), launched_at = CASE WHEN ? = 'launched' THEN COALESCE(launched_at, ?) ELSE launched_at END, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?")
    .bind(st, date(b.target_date), str(b.owner, 60) || null, st, now(), b.notes != null ? str(b.notes, 1000) : null, now(), c.req.param("id")).run();
  if (st === "launched") { const l = await c.env.DB.prepare("SELECT app FROM launches WHERE id = ?").bind(c.req.param("id")).first<any>(); await postUpdate(c.env.DB, "launch", `Launched: ${l?.app}`, "Marked as launched in the Launch monitor."); }
  await audit(c, c.env.DB, c.get("user").id, "launch.updated", { id: c.req.param("id"), status: st });
  return c.json({ ok: true });
});
ops.post("/launches/:id/items", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 4096);
  const title = str(b.title, 200);
  if (!title) return c.json({ error: "Describe the task." }, 400);
  const mx = await c.env.DB.prepare("SELECT COALESCE(MAX(ord), -1) + 1 o FROM launch_items WHERE launch_id = ?").bind(c.req.param("id")).first<any>();
  await c.env.DB.prepare("INSERT INTO launch_items (launch_id, ord, title, category, days, cost, owner, accountable, due_date) VALUES (?,?,?,?,?,?,?,?,?)").bind(c.req.param("id"), mx?.o || 0, title, str(b.category, 40), Math.max(1, num(b.days)), Math.max(0, num(b.cost)), str(b.owner, 60), str(b.accountable, 60), date(b.due_date) || addDays(new Date(), Math.max(1, num(b.days)))).run();
  return c.json({ ok: true });
});
ops.post("/launch-items/:id", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 4096);
  const st = ["todo", "doing", "blocked", "done"].includes(b.status) ? b.status : null;
  if (b.delete) { await c.env.DB.prepare("DELETE FROM launch_items WHERE id = ?").bind(c.req.param("id")).run(); return c.json({ ok: true }); }
  await c.env.DB.prepare("UPDATE launch_items SET status = COALESCE(?, status), done_at = CASE WHEN ? = 'done' THEN COALESCE(done_at, ?) WHEN ? IS NOT NULL THEN NULL ELSE done_at END, owner = COALESCE(?, owner), accountable = COALESCE(?, accountable), due_date = COALESCE(?, due_date), days = COALESCE(?, days), cost = COALESCE(?, cost), blocker = COALESCE(?, blocker) WHERE id = ?")
    .bind(st, st, now(), st, str(b.owner, 60) || null, str(b.accountable, 60) || null, date(b.due_date), b.days != null ? Math.max(1, num(b.days)) : null, b.cost != null ? Math.max(0, num(b.cost)) : null, b.blocker != null ? str(b.blocker, 300) : null, c.req.param("id")).run();
  return c.json({ ok: true });
});

/** Posts an automatic item to Kayakers Update. */
export async function postUpdate(db: D1Database, kind: string, title: string, body: string) {
  await db.prepare("INSERT INTO updates (kind, title, body, by_user, auto, created_at) VALUES (?,?,?, 'Kayak Internal', 1, ?)").bind(kind, title, body, now()).run().catch(() => {});
}
