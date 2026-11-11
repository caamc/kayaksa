// Cookieless, consent-free page statistics shared by the public sites. No cookies, no identifiers:
// only a daily count per path, referrer domain, country, device class and browser family, plus Core
// Web Vitals samples. Bots, crawlers and headless browsers are not counted.
import { rateLimit, clientIp } from "./http";
import { sha256hex } from "./crypto";

export const STATS_SQL = `CREATE TABLE IF NOT EXISTS stat_views (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path));
CREATE TABLE IF NOT EXISTS stat_dims (day TEXT NOT NULL, dim TEXT NOT NULL, value TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, dim, value));
CREATE TABLE IF NOT EXISTS stat_vitals (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, path TEXT NOT NULL, lcp INTEGER, cls REAL, inp INTEGER, ttfb INTEGER);`;

export async function statsBeacon(c: any, db: D1Database, salt = "kayak") {
  const text = await c.req.text();
  if (text.length > 2000) return c.body(null, 204);
  let b: any; try { b = JSON.parse(text); } catch { return c.body(null, 204); }
  if (!(await rateLimit(db, `a:${await sha256hex(clientIp(c) + salt)}`, 120, 600))) return c.body(null, 204);
  const day = new Date().toISOString().slice(0, 10);
  const path = String(b.p || "/").slice(0, 120).replace(/[^\w\/-]/g, "");
  if (b.t === "pv") {
    const ua = c.req.header("User-Agent") || "";
    if (/bot|crawl|spider|preview|headless/i.test(ua)) return c.body(null, 204);
    const device = Number(b.w) < 700 ? "mobile" : Number(b.w) < 1100 ? "tablet" : "desktop";
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Other";
    const ref = String(b.r || "").toLowerCase().replace(/^www\./, "").slice(0, 80) || "direct";
    const country = (c.req.raw as any).cf?.country || "XX";
    const hour = String(new Date().getUTCHours());
    const up = (dim: string, v: string) => db.prepare("INSERT INTO stat_dims (day, dim, value, n) VALUES (?,?,?,1) ON CONFLICT(day, dim, value) DO UPDATE SET n = n + 1").bind(day, dim, v);
    await db.batch([
      db.prepare("INSERT INTO stat_views (day, path, views) VALUES (?,?,1) ON CONFLICT(day, path) DO UPDATE SET views = views + 1").bind(day, path),
      up("referrer", ref), up("country", country), up("device", device), up("browser", browser), up("hour", hour),
    ]);
  } else if (b.t === "cwv") {
    const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);
    await db.prepare("INSERT INTO stat_vitals (day, path, lcp, cls, inp, ttfb) VALUES (?,?,?,?,?,?)").bind(day, path, n(b.lcp), n(b.cls), n(b.inp), n(b.ttfb)).run();
  }
  return c.body(null, 204);
}
