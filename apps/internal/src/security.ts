// Security module: Kayak Shield events and blocks across www, learn and internal, the full audit
// trail for each site, and the security standards Kayak works to. Administrators only.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { str } from "../../../packages/core/src/http";
import { forgetBlock, securityEvent, DIRECTORS, BLOCK_HOURS, RETENTION_DAYS } from "../../../packages/core/src/shield";
import { mailEnabled } from "../../../packages/core/src/mail";
import { Env, User, atLeast } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const security = new Hono<V>();

const SITES = ["www", "learn", "internal"] as const;
type S = (typeof SITES)[number];
const dbFor = (c: any, s: string): D1Database | undefined => (s === "www" ? c.env.WWW_DB : s === "learn" ? c.env.LEARN_DB : c.env.DB);
const site = (v: unknown): S => (SITES.includes(v as S) ? (v as S) : "internal");

security.use("*", async (c, next) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  await next();
});

// The controls Kayak runs, mapped to the standards they answer to. "auto" ones are checked live.
const STANDARDS = [
  { area: "Identity and access", items: [
    ["Password plus authenticator-app 2FA for every staff account", "ISO/IEC 27001:2022 A.5.17, A.8.5 · OWASP ASVS V2", "auto:2fa"],
    ["Account lock after repeated failures; login rate limits per address and per email", "OWASP ASVS V2.2 · CERT-In", "on"],
    ["Role-based access (SuperAdmin, Administrator, Editor, Employee), least privilege", "ISO/IEC 27001:2022 A.5.15, A.8.2", "on"],
    ["Sessions in secure, HTTP-only, same-site cookies; idle and absolute expiry", "OWASP ASVS V3", "on"],
  ] },
  { area: "Application and network", items: [
    ["HTTPS only with HSTS preload; strict Content Security Policy; no third-party scripts", "OWASP ASVS V14 · ISO/IEC 27001:2022 A.8.26", "on"],
    ["Kayak Shield: scrapers, scripted clients and vulnerability probes blocked for 4 hours", "OWASP Automated Threats · ISO/IEC 27001:2022 A.8.20, A.8.22", "on"],
    ["Verified search engines and AI assistants allowed on public sites only; all bots refused on internal", "Business need (visibility) · A.8.20", "on"],
    ["Same-origin checks on every write; request size limits; input validation", "OWASP Top 10 A01, A03, A04", "on"],
    ["Cloudflare edge: DDoS protection, TLS, and Bot Fight Mode", "ISO/IEC 27001:2022 A.8.20", "edge"],
  ] },
  { area: "Data protection", items: [
    ["API keys and passwords only in encrypted platform secrets, never in code", "ISO/IEC 27001:2022 A.8.24 · OWASP ASVS V6", "on"],
    ["Passwords hashed (PBKDF2); 2FA secrets encrypted at rest", "OWASP ASVS V2.4, V6", "on"],
    ["Consent, purpose limitation and data-principal rights on www and learn", "Digital Personal Data Protection Act, 2023 · DPDP Rules, 2025", "on"],
    ["Site statistics without cookies or network addresses", "DPDP Act 2023 (data minimisation)", "on"],
  ] },
  { area: "Logging and response", items: [
    ["Audit trail of every staff and visitor action with time, address, device signature and detail", "ISO/IEC 27001:2022 A.8.15", "on"],
    [`Security logs kept ${RETENTION_DAYS} days`, "CERT-In Directions, 28 Apr 2022, para (iv)", "on"],
    ["Serious events emailed to the directors within a minute", "ISO/IEC 27001:2022 A.5.24, A.6.8", "auto:mail"],
    ["Reportable incidents reported to CERT-In within 6 hours (incident@cert-in.org.in)", "CERT-In Directions, 28 Apr 2022, para (ii)", "process"],
    ["Clocks synchronised to NTP (Cloudflare edge)", "CERT-In Directions, para (i)", "on"],
  ] },
];

security.get("/overview", async (c) => {
  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const now = Date.now();
  const per: any[] = [];
  for (const s of SITES) {
    const d = dbFor(c, s);
    if (!d) { per.push({ site: s, connected: false }); continue; }
    try {
      const [sev, blocks, recent] = await d.batch([
        d.prepare("SELECT severity, COUNT(*) n FROM security_events WHERE at >= ? GROUP BY severity").bind(since7),
        d.prepare("SELECT COUNT(*) n FROM ip_blocks WHERE until > ? AND lifted_at IS NULL").bind(now),
        d.prepare("SELECT COUNT(*) n FROM security_events WHERE at >= ?").bind(since24),
      ]);
      per.push({ site: s, connected: true, severity: sev.results, activeBlocks: (blocks.results[0] as any)?.n || 0, last24: (recent.results[0] as any)?.n || 0 });
    } catch { per.push({ site: s, connected: true, pending: true }); }
  }
  const users = await c.env.DB.prepare("SELECT COUNT(*) n, SUM(totp_enabled) t FROM users WHERE status = 'active'").first<any>().catch(() => null);
  const auto: Record<string, boolean> = { "2fa": !!users && users.n === users.t, mail: mailEnabled(c.env) };
  const standards = STANDARDS.map((g) => ({ area: g.area, items: g.items.map(([what, ref, st]) => ({ what, ref, status: st.startsWith("auto:") ? (auto[st.slice(5)] ? "on" : "attention") : st })) }));
  return c.json({ sites: per, standards, directors: (c.env as any).SECURITY_ALERT_TO?.split(",") || DIRECTORS, mail: mailEnabled(c.env), blockHours: BLOCK_HOURS, retentionDays: RETENTION_DAYS });
});

security.get("/events", async (c) => {
  const s = site(c.req.query("site"));
  const d = dbFor(c, s);
  if (!d) return c.json({ events: [] });
  const sev = str(c.req.query("severity"), 10);
  const q = str(c.req.query("q"), 80);
  const where: string[] = [], args: any[] = [];
  if (sev) { where.push("severity = ?"); args.push(sev); }
  if (q) { where.push("(ip LIKE ? OR fp LIKE ? OR kind LIKE ? OR path LIKE ? OR ua LIKE ?)"); args.push(...Array(5).fill(`%${q}%`)); }
  const { results } = await d.prepare(`SELECT id, at, kind, severity, ip, fp, ua, path, user_id, detail FROM security_events ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 300`).bind(...args).all().catch(() => ({ results: [] }));
  return c.json({ events: results });
});

security.get("/blocks", async (c) => {
  const out: any[] = [];
  for (const s of SITES) {
    const d = dbFor(c, s);
    if (!d) continue;
    const { results } = await d.prepare("SELECT id, ip, fp, reason, created_at, until, lifted_at, lifted_by FROM ip_blocks WHERE until > ? ORDER BY id DESC LIMIT 200").bind(Date.now() - 86_400_000).all<any>().catch(() => ({ results: [] as any[] }));
    out.push(...results.map((r: any) => ({ ...r, site: s })));
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return c.json({ blocks: out });
});

security.post("/blocks/:site/:id/lift", async (c) => {
  const s = site(c.req.param("site"));
  const d = dbFor(c, s)!;
  const row = await d.prepare("SELECT ip, fp FROM ip_blocks WHERE id = ?").bind(Number(c.req.param("id"))).first<any>();
  if (!row) return c.json({ error: "Block not found." }, 404);
  await d.prepare("UPDATE ip_blocks SET lifted_at = ?, lifted_by = ? WHERE until > ? AND lifted_at IS NULL AND (id = ? OR fp = ? OR (ip IS NOT NULL AND ip = ?))").bind(new Date().toISOString(), c.get("user").email, Date.now(), Number(c.req.param("id")), row.fp, row.ip).run();
  forgetBlock(row.ip || "", row.fp);
  await audit(c, c.env.DB, c.get("user").id, "security.block_lifted", { site: s, ip: row.ip });
  return c.json({ ok: true, note: "Lifted. Other Cloudflare locations pick this up within a minute." });
});

// Full audit trail for one site. Internal entries carry the staff member's name and email.
async function auditRows(c: any, s: S, q: string, from: string, to: string, limit: number) {
  const d = dbFor(c, s);
  if (!d) return [];
  const where: string[] = [], args: any[] = [];
  if (from) { where.push("a.at >= ?"); args.push(from); }
  if (to) { where.push("a.at <= ?"); args.push(to + "T23:59:59.999Z"); }
  if (q) { where.push("(a.action LIKE ? OR a.ip LIKE ? OR a.fp LIKE ? OR a.detail LIKE ?" + (s === "internal" ? " OR u.email LIKE ? OR u.name LIKE ?" : "") + ")"); args.push(...Array(s === "internal" ? 6 : 4).fill(`%${q}%`)); }
  const join = s === "internal" ? "LEFT JOIN users u ON u.id = a.user_id" : s === "learn" ? "LEFT JOIN users u ON u.id = a.user_id" : "";
  const who = join ? "COALESCE(u.name, u.email, a.user_id)" : "a.user_id";
  const email = join ? "u.email" : "NULL";
  const sql = `SELECT a.id, a.at, a.ip, a.fp, a.ua, ${who} AS who, ${email} AS email, a.action, a.detail FROM audit_log a ${join} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.id DESC LIMIT ${limit}`;
  return (await d.prepare(sql).bind(...args).all().catch(() => ({ results: [] as any[] }))).results;
}

security.get("/audit", async (c) => {
  const s = site(c.req.query("site"));
  const rows = await auditRows(c, s, str(c.req.query("q"), 80), str(c.req.query("from"), 10), str(c.req.query("to"), 10), 500);
  return c.json({ rows });
});

security.get("/audit.csv", async (c) => {
  const s = site(c.req.query("site"));
  const rows: any[] = await auditRows(c, s, str(c.req.query("q"), 80), str(c.req.query("from"), 10), str(c.req.query("to"), 10), 20000);
  const cell = (v: any) => { const t = v == null ? "" : String(v); return /[",\n]/.test(t) || /^[=+\-@]/.test(t) ? `"${t.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : t; };
  const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
  const head = "Date and time (IST),UTC timestamp,IP address,Device signature,Browser,Who,Email,Action,Detail";
  const body = rows.map((r) => [ist(r.at), r.at, r.ip, r.fp, r.ua, r.who, r.email, r.action, r.detail].map(cell).join(",")).join("\n");
  await audit(c, c.env.DB, c.get("user").id, "security.audit_exported", { site: s, rows: rows.length });
  return c.body("﻿" + head + "\n" + body, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="kayak-${s}-audit-${new Date().toISOString().slice(0, 10)}.csv"` });
});

security.post("/test-alert", async (c) => {
  if (!mailEnabled(c.env)) return c.json({ error: "Email is not configured yet. Add RESEND_API_KEY to the GitHub secrets and redeploy, then try again." }, 503);
  await securityEvent(c, c.env.DB, "internal", { kind: "test.alert", severity: "high", userId: c.get("user").id, detail: { by: c.get("user").email } });
  return c.json({ ok: true, note: "A test alert is on its way to the directors." });
});
