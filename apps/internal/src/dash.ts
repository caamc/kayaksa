// Dashboards: the Home dashboard (traffic and activity across www and Learn) and the Kayak Digital
// Dashboard (the health of Kayak's whole digital estate). Read-only, from the sites' own databases.
// Statistics are cookieless counts; no visitor is identified.
import { Hono } from "hono";
import { readJson, str } from "../../../packages/core/src/http";
import { mailEnabled } from "../../../packages/core/src/mail";
import { audit } from "../../../packages/core/src/session";
import { Env, User, atLeast } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const dash = new Hono<V>();

const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => dayStr(new Date(Date.now() - n * 86400_000));
const safe = async <T>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch { return fb; } };
const all = (db: D1Database | undefined, sql: string, ...b: any[]) => (db ? safe(db.prepare(sql).bind(...b).all<any>().then((r) => r.results), [] as any[]) : Promise.resolve([] as any[]));
const one = (db: D1Database | undefined, sql: string, ...b: any[]) => (db ? safe(db.prepare(sql).bind(...b).first<any>(), null) : Promise.resolve(null));

async function siteTraffic(db: D1Database | undefined, since: string, prev: string, today: string) {
  const [daily, prevT, top, refs, dev, ctry, brw, hours, vit] = await Promise.all([
    all(db, "SELECT day, SUM(views) n FROM stat_views WHERE day >= ? GROUP BY day ORDER BY day", since),
    one(db, "SELECT SUM(views) n FROM stat_views WHERE day >= ? AND day < ?", prev, since),
    all(db, "SELECT path, SUM(views) n FROM stat_views WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 12", since),
    all(db, "SELECT value, SUM(n) n FROM stat_dims WHERE dim = 'referrer' AND day >= ? GROUP BY value ORDER BY n DESC LIMIT 8", since),
    all(db, "SELECT value, SUM(n) n FROM stat_dims WHERE dim = 'device' AND day >= ? GROUP BY value ORDER BY n DESC", since),
    all(db, "SELECT value, SUM(n) n FROM stat_dims WHERE dim = 'country' AND day >= ? GROUP BY value ORDER BY n DESC LIMIT 10", since),
    all(db, "SELECT value, SUM(n) n FROM stat_dims WHERE dim = 'browser' AND day >= ? GROUP BY value ORDER BY n DESC", since),
    all(db, "SELECT value, SUM(n) n FROM stat_dims WHERE dim = 'hour' AND day >= ? GROUP BY value", since),
    all(db, "SELECT lcp, cls, inp FROM stat_vitals WHERE day >= ? ORDER BY id DESC LIMIT 2000", since),
  ]);
  const p75 = (k: string) => { const a = vit.map((r: any) => r[k]).filter((x: any) => x != null).sort((x: number, y: number) => x - y); return a.length ? a[Math.floor(a.length * 0.75)] : null; };
  const h = Array(24).fill(0); hours.forEach((r: any) => { h[(Number(r.value) + 5) % 24] += r.n; }); // UTC hour to IST, to the nearest hour
  const total = daily.reduce((s: number, r: any) => s + r.n, 0);
  return { daily, total, prevTotal: prevT?.n || 0, today: daily.find((r: any) => r.day === today)?.n || 0, top, referrers: refs, devices: dev, countries: ctry, browsers: brw, hoursIst: h, vitals: { lcp: p75("lcp"), cls: p75("cls"), inp: p75("inp"), samples: vit.length } };
}

dash.get("/", async (c) => {
  const env = c.env;
  const days = Math.min(365, Math.max(7, Number(c.req.query("days")) || 30));
  const since = daysAgo(days - 1), prev = daysAgo(days * 2 - 1), today = dayStr(new Date());
  const sinceTs = since + "T00:00:00", prevTs = prev + "T00:00:00";
  const W = env.WWW_DB, L = env.LEARN_DB, D = env.DB;
  const [www, learn, enqD, enqPrev, subs, kayD, signD, signPrev, ordD, ordPrev, certs, secD, blocks, aiD, meet, launches, certsT] = await Promise.all([
    siteTraffic(W, since, prev, today),
    siteTraffic(L, since, prev, today),
    all(W, "SELECT substr(created_at,1,10) day, COUNT(*) n FROM enquiries WHERE created_at >= ? GROUP BY day ORDER BY day", sinceTs),
    one(W, "SELECT COUNT(*) n FROM enquiries WHERE created_at >= ? AND created_at < ?", prevTs, sinceTs),
    one(W, "SELECT COUNT(*) n FROM subscribers WHERE status = 'active'"),
    all(W, "SELECT day, chats, voice FROM kay_usage WHERE day >= ? ORDER BY day", since),
    all(L, "SELECT substr(created_at,1,10) day, COUNT(*) n FROM users WHERE created_at >= ? GROUP BY day ORDER BY day", sinceTs),
    one(L, "SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ?", prevTs, sinceTs),
    all(L, "SELECT substr(paid_at,1,10) day, COUNT(*) n, SUM(total_paise) paise FROM orders WHERE status = 'paid' AND paid_at >= ? GROUP BY day ORDER BY day", sinceTs),
    one(L, "SELECT COUNT(*) n, SUM(total_paise) paise FROM orders WHERE status = 'paid' AND paid_at >= ? AND paid_at < ?", prevTs, sinceTs),
    one(L, "SELECT COUNT(*) n FROM certificates WHERE issued_at >= ?", sinceTs),
    all(D, "SELECT substr(at,1,10) day, severity, COUNT(*) n FROM security_events WHERE at >= ? GROUP BY day, severity ORDER BY day", sinceTs),
    one(D, "SELECT COUNT(*) n FROM ip_blocks WHERE until > ? AND lifted_at IS NULL", Date.now()),
    all(D, "SELECT day, model, kind, calls, chars_in, chars_out FROM ai_usage WHERE day >= ? ORDER BY day", since),
    one(env.MEET_DB, "SELECT COUNT(*) n, SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) live FROM meetings WHERE created_at >= ?", sinceTs),
    all(D, "SELECT l.id, l.app, l.target_date, l.status, (SELECT COUNT(*) FROM launch_items i WHERE i.launch_id = l.id) items, (SELECT COUNT(*) FROM launch_items i WHERE i.launch_id = l.id AND i.status = 'done') done FROM launches l WHERE l.status != 'launched' ORDER BY l.target_date LIMIT 6"),
    all(D, "SELECT entity, standard, status, target_date, (SELECT COUNT(*) FROM cert_steps s WHERE s.cert_id = c.id) steps, (SELECT COUNT(*) FROM cert_steps s WHERE s.cert_id = c.id AND s.done_at IS NOT NULL) done FROM certifications c ORDER BY target_date LIMIT 8"),
  ]);
  const sum = (a: any[], k = "n") => a.reduce((s, r) => s + (r[k] || 0), 0);
  return c.json({
    range: { days, since, today },
    www, learn,
    enquiries: { daily: enqD, total: sum(enqD), prevTotal: enqPrev?.n || 0 },
    subscribers: subs?.n || 0,
    kay: { daily: kayD, chats: sum(kayD, "chats"), voice: sum(kayD, "voice") },
    signups: { daily: signD, total: sum(signD), prevTotal: signPrev?.n || 0 },
    sales: { daily: ordD, orders: sum(ordD), revenue: sum(ordD, "paise") / 100, prevRevenue: (ordPrev?.paise || 0) / 100, prevOrders: ordPrev?.n || 0 },
    certificatesIssued: certs?.n || 0,
    security: { daily: secD, activeBlocks: blocks?.n || 0 },
    ai: aiD,
    meet: { meetings: meet?.n || 0, live: meet?.live || 0 },
    launches, certifications: certsT,
  });
});

// Live pulse: today's counts, refreshed every half minute by the dashboard.
dash.get("/live", async (c) => {
  const today = dayStr(new Date()), hr = String(new Date().getUTCHours());
  const q = (db?: D1Database) => Promise.all([one(db, "SELECT SUM(views) n FROM stat_views WHERE day = ?", today), one(db, "SELECT n FROM stat_dims WHERE day = ? AND dim = 'hour' AND value = ?", today, hr)]);
  const [[wt, wh], [lt, lh]] = await Promise.all([q(c.env.WWW_DB), q(c.env.LEARN_DB)]);
  return c.json({ at: new Date().toISOString(), www: { today: wt?.n || 0, hour: wh?.n || 0 }, learn: { today: lt?.n || 0, hour: lh?.n || 0 } });
});

// ---------------------------------------------------------------- Kayak Digital Dashboard
const PROPERTIES: [string, string, string][] = [
  ["www.kayaksa.com", "https://www.kayaksa.com/healthz", "Website"],
  ["learn.kayaksa.com", "https://learn.kayaksa.com/healthz", "Kayak Learn"],
  ["meet.kayaksa.com", "https://meet.kayaksa.com/healthz", "Kayak Meet"],
  ["nexapair.ae", "https://www.nexapair.ae/", "NexaPair UAE"],
  ["app.nexapair.ae", "https://app.nexapair.ae/", "NexaPair app"],
];
const UA = "Mozilla/5.0 (compatible; KayakMonitor/1.0; +https://www.kayaksa.com)";

export async function probe(url: string, ms = 8000) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(ms), cf: { cacheTtl: 0 } } as any);
    return { ok: r.status < 400, status: r.status, ms: Date.now() - t0, headers: r.headers };
  } catch (e: any) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 120), headers: new Headers() };
  }
}
async function dnsTxt(name: string) {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
    const j: any = await r.json();
    return (j.Answer || []).map((a: any) => String(a.data || "").replace(/^"|"$/g, "").replace(/" "/g, ""));
  } catch { return []; }
}

dash.get("/digital", async (c) => {
  const env = c.env, W = env.WWW_DB;
  const [props, sitemap, home, txt, dmarc, articles, editions, memory, subs, socialsRow, reports] = await Promise.all([
    Promise.all(PROPERTIES.map(async ([name, url, label]) => { const p = await probe(url); return { name, label, url, ok: p.ok, status: p.status, ms: p.ms, error: (p as any).error }; })),
    fetch("https://www.kayaksa.com/sitemap.xml", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) }).then(async (r) => (r.ok ? (await r.text()).match(/<loc>/g)?.length || 0 : null)).catch(() => null),
    probe("https://www.kayaksa.com/"),
    dnsTxt("kayaksa.com"), dnsTxt("_dmarc.kayaksa.com"),
    one(W, "SELECT COUNT(*) n FROM articles WHERE status = 'published'"),
    one(W, "SELECT COUNT(*) n FROM editions WHERE status = 'released'"),
    one(W, "SELECT SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) approved, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) pending FROM kay_memory"),
    one(W, "SELECT COUNT(*) n FROM subscribers WHERE status = 'active'"),
    one(env.DB, "SELECT value FROM settings WHERE key = 'socials'"),
    all(env.DB, "SELECT id, created_at, scope, status FROM footprint_reports ORDER BY created_at DESC LIMIT 5"),
  ]);
  const h = home.headers;
  const headers = [
    ["Strict-Transport-Security", !!h.get("strict-transport-security")],
    ["Content-Security-Policy", !!h.get("content-security-policy")],
    ["X-Content-Type-Options", h.get("x-content-type-options") === "nosniff"],
    ["Referrer-Policy", !!h.get("referrer-policy")],
    ["Permissions-Policy", !!h.get("permissions-policy")],
  ];
  const spf = txt.find((t: string) => /^v=spf1/i.test(t)) || null;
  const dm = dmarc.find((t: string) => /^v=DMARC1/i.test(t)) || null;
  const socials = socialsRow ? JSON.parse(socialsRow.value) : DEFAULT_SOCIALS;
  const integrations = [
    ["Email sending (Resend)", mailEnabled(env)],
    ["Claude (Anthropic)", !!env.ANTHROPIC_API_KEY],
    ["Workers AI (speech, translation)", !!env.AI],
    ["Kayak Meet signing key", !!env.MEET_SIGNING_KEY],
    ["Website database", !!env.WWW_DB],
    ["Learn database", !!env.LEARN_DB],
    ["Meet database", !!env.MEET_DB],
  ];
  return c.json({
    at: new Date().toISOString(), properties: props,
    seo: { sitemapUrls: sitemap, homeStatus: home.status, homeMs: home.ms },
    security: { headers, spf, dmarc: dm },
    content: { articles: articles?.n || 0, editions: (editions?.n || 0) + 1, resources: 9, kayApproved: memory?.approved || 0, kayPending: memory?.pending || 0, subscribers: subs?.n || 0 },
    integrations, socials, reports,
  });
});

const DEFAULT_SOCIALS = [
  { id: "linkedin", name: "LinkedIn", url: "", handle: "", status: "planned" },
  { id: "x", name: "X", url: "", handle: "", status: "planned" },
  { id: "youtube", name: "YouTube", url: "", handle: "", status: "planned" },
  { id: "instagram", name: "Instagram", url: "", handle: "", status: "planned" },
];
dash.post("/socials", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "admin")) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 8192);
  const list = (Array.isArray(b.socials) ? b.socials : []).slice(0, 12).map((s: any) => ({ id: str(s.id, 30), name: str(s.name, 40), url: /^https:\/\//.test(s.url || "") ? str(s.url, 300) : "", handle: str(s.handle, 80), status: ["planned", "live", "paused"].includes(s.status) ? s.status : "planned" }));
  await c.env.DB.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('socials', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by").bind(JSON.stringify(list), new Date().toISOString(), u.email).run();
  await audit(c, c.env.DB, u.id, "digital.socials_updated", {});
  return c.json({ ok: true });
});
