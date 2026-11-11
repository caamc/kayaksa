// Kayak Shield: the request firewall every Kayak site runs in front of its routes.
//
//  - Lets verified search engines and AI assistants through on public sites (so Kayak stays
//    findable on Google, Bing, ChatGPT, Claude and Perplexity) and refuses all bots on internal.
//  - Blocks scrapers, scripted clients, vulnerability probes and request floods for 4 hours,
//    by network address and by device signature (a hash of browser traits; MAC addresses never
//    reach a web server, so they cannot be used).
//  - Writes every security event and block to D1, and emails the directors about serious ones.
//
// The device signature is a one-way hash, and network addresses are kept only in security
// records (180 days, the CERT-In retention period), never in site statistics.
import type { Context, MiddlewareHandler } from "hono";
import { clientIp, rateLimit } from "./http";
import { sendMail, mailHtml, type MailEnv } from "./mail";

export type Site = "www" | "learn" | "internal";
export type Severity = "low" | "medium" | "high" | "critical";
export interface SecurityEvent { kind: string; severity: Severity; detail?: unknown; path?: string; userId?: string | null }

export const BLOCK_HOURS = 4;
export const RETENTION_DAYS = 180;
export const DIRECTORS = ["anuj@kayaksa.com", "deepak@kayaksa.com", "ca.anuj@hotmail.com", "seema@kayaksa.com"];

// Crawlers that make Kayak visible. On public sites they are allowed (and robots.txt still rules).
const GOOD_BOTS = /(googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|bingbot|bingpreview|duckduckbot|applebot|yandexbot|baiduspider|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|linkedinbot|facebookexternalhit|meta-externalagent|twitterbot|slackbot|whatsapp|telegrambot|discordbot|cloudflare-healthchecks)/i;
// Scrapers, SEO harvesters and scripted clients.
const BAD_BOTS = /(python-requests|python-urllib|aiohttp|httpx|scrapy|curl\/|wget|go-http-client|java\/|okhttp|libwww|lwp-|httpclient|node-fetch|axios|undici|phantomjs|headlesschrome|puppeteer|playwright|selenium|zgrab|masscan|nmap|nikto|sqlmap|nuclei|wpscan|dirbuster|gobuster|ffuf|semrush|ahrefs|mj12bot|dotbot|bytespider|petalbot|blexbot|dataforseo|serpstat|megaindex|seekport|barkrowler|ccbot|diffbot|omgili|imagesift|timpibot|amazonbot|scrapingbee|zenrows|crawler4j|httrack|webcopier|sitesucker|offline explorer)/i;
// Paths only attackers ask for.
const PROBES = /(\/\.env|\/\.git|\/\.aws|\/\.ssh|\/\.htaccess|\/\.ds_store|wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|\/cgi-bin|\/vendor\/phpunit|\/actuator|\/server-status|\/boaform|\/HNAP1|\/solr\/|\/jenkins|\/druid|\/console\/|\.php(\?|$)|\.asp(x)?(\?|$)|\.jsp(\?|$)|\/etc\/passwd|\.\.%2f|%2e%2e|<script|union(\s|%20|\+)select|\/owa\/|\/autodiscover)/i;

const BURST_LIMIT = 120; // page or API requests per minute from one address
const blockedCache = new Map<string, number>(); // in-isolate cache: key -> blocked-until (ms) or 0 = known clean
const burst = new Map<string, { m: number; n: number }>();

export async function fingerprint(c: Context): Promise<string> {
  const h = (n: string) => c.req.header(n) || "";
  const cf: any = (c.req.raw as any).cf || {};
  const raw = [h("User-Agent"), h("Accept-Language"), h("Sec-CH-UA"), h("Sec-CH-UA-Platform"), h("Sec-CH-UA-Mobile"), cf.asn || "", cf.tlsCipher || ""].join("|");
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function meta(c: Context) {
  const cf: any = (c.req.raw as any).cf || {};
  return { country: cf.country || "", asn: cf.asn || null, org: (cf.asOrganization || "").slice(0, 80), city: (cf.city || "").slice(0, 60) };
}

/** Records a security event; serious ones are emailed to the directors (throttled). */
export async function securityEvent(c: Context, db: D1Database, site: Site, ev: SecurityEvent, fp?: string) {
  const ip = clientIp(c);
  const f = fp || (await fingerprint(c));
  const at = new Date().toISOString();
  const path = (ev.path || new URL(c.req.url).pathname).slice(0, 300);
  const ua = (c.req.header("User-Agent") || "").slice(0, 300);
  const detail = JSON.stringify({ ...meta(c), ...(ev.detail && typeof ev.detail === "object" ? ev.detail : ev.detail != null ? { note: ev.detail } : {}) }).slice(0, 2000);
  await db.prepare("INSERT INTO security_events (at, site, kind, severity, ip, fp, ua, path, user_id, detail) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(at, site, ev.kind, ev.severity, ip, f, ua, path, ev.userId ?? null, detail).run();
  if (ev.severity === "high" || ev.severity === "critical") {
    const p = alertDirectors(c, db, site, { ...ev, path }, ip, f, at).catch((e) => console.error("security alert failed", e?.message));
    try { c.executionCtx.waitUntil(p); } catch { await p; }
  }
}

async function alertDirectors(c: Context, db: D1Database, site: Site, ev: SecurityEvent, ip: string, fp: string, at: string) {
  // One email per kind and address per hour, and no more than 24 a day in total.
  if (!(await rateLimit(db, `alert:${ev.kind}:${ip}`, 1, 3600))) return;
  if (!(await rateLimit(db, `alert:all`, 24, 86_400))) return;
  const env = c.env as MailEnv & { SECURITY_ALERT_TO?: string };
  const to = (env.SECURITY_ALERT_TO || DIRECTORS.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
  const m = meta(c);
  const rows = [["When", new Date(at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"], ["Site", `${site}.kayaksa.com`], ["What", ev.kind.replace(/[._]/g, " ")], ["Severity", ev.severity.toUpperCase()], ["Address", `${ip}${m.country ? " · " + m.country : ""}${m.org ? " · " + m.org : ""}`], ["Device signature", fp], ["Path", ev.path || ""], ["Action taken", ev.kind.startsWith("blocked") || ev.kind.startsWith("probe") ? `Blocked for ${BLOCK_HOURS} hours` : "Logged; review in Security"]];
  const esc = (s: string) => String(s).replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[x]!);
  const table = `<table style="border-collapse:collapse;width:100%;font:14px Arial,sans-serif">${rows.map(([k, v]) => `<tr><td style="padding:6px 10px 6px 0;color:#4E6470;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;color:#0E2F3C">${esc(v)}</td></tr>`).join("")}</table>`;
  const html = mailHtml({
    site: "SECURITY",
    title: `Security alert: ${ev.kind.replace(/[._]/g, " ")}`,
    intro: `Kayak Shield detected a ${ev.severity} security event.${table}`,
    action: { label: "Open Security in the portal", url: "https://internal.kayaksa.com/app#/security" },
    outro: "Under the CERT-In Directions of 28 April 2022, a reportable cyber incident must be reported to CERT-In within six hours of noticing it. The Security page lists the reportable categories and the reporting steps.",
  });
  for (const addr of to) await sendMail(env, addr, `[Kayak Security] ${ev.severity.toUpperCase()}: ${ev.kind.replace(/[._]/g, " ")} on ${site}`, html);
}

/** Blocks a device signature, and its network address too when `ip` is given. */
export async function blockClient(c: Context, db: D1Database, site: Site, reason: string, ip: string | null, fp: string, hours = BLOCK_HOURS) {
  const until = Date.now() + hours * 3_600_000;
  await db.prepare("INSERT INTO ip_blocks (ip, fp, site, reason, created_at, until) VALUES (?,?,?,?,?,?)")
    .bind(ip, fp, site, reason.slice(0, 200), new Date().toISOString(), until).run();
  if (ip) blockedCache.set("ip:" + ip, until);
  blockedCache.set("fp:" + fp, until);
}

async function isBlocked(db: D1Database, ip: string, fp: string): Promise<number> {
  const now = Date.now();
  for (const k of ["ip:" + ip, "fp:" + fp]) {
    const v = blockedCache.get(k);
    if (v && v > now) return v;
  }
  const ck = "ip:" + ip;
  if (blockedCache.get(ck) === 0 && blockedCache.get("chk:" + ip)! > now) return 0;
  const row = await db.prepare("SELECT MAX(until) AS u FROM ip_blocks WHERE (ip = ? OR fp = ?) AND until > ? AND lifted_at IS NULL").bind(ip, fp, now).first<{ u: number | null }>();
  const u = row?.u || 0;
  blockedCache.set(ck, u);
  blockedCache.set("chk:" + ip, now + 60_000); // re-check D1 at most once a minute per address
  if (blockedCache.size > 5000) blockedCache.clear();
  return u;
}

/** Lifts a block (used by the Security page). Clears this isolate's cache; others expire within a minute. */
export function forgetBlock(ip: string, fp: string) {
  blockedCache.delete("ip:" + ip); blockedCache.delete("fp:" + fp); blockedCache.delete("chk:" + ip);
}

function blockedResponse(until: number) {
  const mins = Math.max(1, Math.round((until - Date.now()) / 60000));
  return new Response(`Access from your network has been paused for security reasons. Try again in about ${mins} minutes. If you think this is a mistake, write to enquiries@kayaksa.com.`, {
    status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(mins * 60), "Cache-Control": "no-store" },
  });
}

/**
 * The firewall middleware. `db` picks the D1 database that holds security_events and ip_blocks.
 * Static files (anything with a file extension other than .html) skip the D1 checks to keep the site fast,
 * but still get the user-agent and probe checks, which are pure string tests.
 */
export function shield(site: Site, db: (env: any) => D1Database, opts: { allowGoodBots: boolean }): MiddlewareHandler {
  return async (c, next) => {
    const url = new URL(c.req.url);
    const path = url.pathname;
    if (path === "/healthz" || path === "/api/health" || path === "/robots.txt") return next();
    const D = db(c.env);
    const ip = clientIp(c);
    const ua = c.req.header("User-Agent") || "";
    const cf: any = (c.req.raw as any).cf || {};
    const verifiedBot = !!cf.verifiedBotCategory || !!cf.botManagement?.verifiedBot;
    const fp = await fingerprint(c);
    const isFile = /\.[a-z0-9]{2,5}$/i.test(path) && !path.endsWith(".html");

    // 1. Existing block.
    if (!isFile || PROBES.test(path)) {
      const until = await isBlocked(D, ip, fp);
      if (until) return blockedResponse(until);
    }

    // 2. Vulnerability probes: block straight away.
    if (PROBES.test(path + url.search)) {
      await blockClient(c, D, site, "probe", ip, fp);
      await securityEvent(c, D, site, { kind: "probe.blocked", severity: "high", detail: { query: url.search.slice(0, 200) } }, fp);
      return blockedResponse(Date.now() + BLOCK_HOURS * 3_600_000);
    }

    // 3. Floods (per isolate, approximate but free). Verified crawlers are exempt.
    if (!isFile && !verifiedBot) {
      const m = Math.floor(Date.now() / 60000);
      const b = burst.get(ip);
      if (!b || b.m !== m) burst.set(ip, { m, n: 1 });
      else if (++b.n > BURST_LIMIT) {
        await blockClient(c, D, site, "flood", ip, fp);
        await securityEvent(c, D, site, { kind: "blocked.flood", severity: "high", detail: { perMinute: b.n } }, fp);
        return blockedResponse(Date.now() + BLOCK_HOURS * 3_600_000);
      }
      if (burst.size > 5000) burst.clear();
    }
    // 4. Bots.
    const good = GOOD_BOTS.test(ua);
    if (good && opts.allowGoodBots) return next();
    if (good && !opts.allowGoodBots) return new Response("Not available.", { status: 403, headers: { "X-Robots-Tag": "noindex, nofollow" } });
    if (!ua || BAD_BOTS.test(ua)) {
      if (verifiedBot && opts.allowGoodBots) return next();
      // Mobile networks in India share one address across many people, so a scraper's address is
      // blocked only when it keeps coming back; its device signature is blocked straight away.
      const repeat = !(await rateLimit(D, `scraper:${ip}`, 3, BLOCK_HOURS * 3600));
      await blockClient(c, D, site, ua ? "scraper" : "no user agent", repeat ? ip : null, fp);
      await securityEvent(c, D, site, { kind: "blocked.scraper", severity: "medium", detail: { reason: ua ? "Known scraper or scripted client" : "Request without a browser identity" } }, fp);
      return blockedResponse(Date.now() + BLOCK_HOURS * 3_600_000);
    }

    c.set("fp" as any, fp);
    return next();
  };
}

/** Audit entry with address, browser and device signature. Works for staff (userId) and anonymous visitors. */
export async function auditFull(c: Context, db: D1Database, userId: string | null, action: string, detail: unknown = null) {
  const fp = (c.get("fp" as any) as string) || (await fingerprint(c));
  await db.prepare("INSERT INTO audit_log (at, user_id, action, detail, ip, ua, fp) VALUES (?,?,?,?,?,?,?)")
    .bind(new Date().toISOString(), userId, action, detail == null ? null : JSON.stringify(detail).slice(0, 2000), clientIp(c), (c.req.header("User-Agent") || "").slice(0, 300), fp)
    .run();
}

/** Deletes security records past the retention period. Run from a daily cron. */
export async function pruneSecurity(db: D1Database) {
  const cut = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM security_events WHERE at < ?").bind(cut),
    db.prepare("DELETE FROM ip_blocks WHERE until < ?").bind(Date.now() - RETENTION_DAYS * 86_400_000),
    db.prepare("DELETE FROM audit_log WHERE at < ?").bind(new Date(Date.now() - 3 * 365 * 86_400_000).toISOString()),
  ]);
}

export const SECURITY_SQL = `
CREATE TABLE IF NOT EXISTS security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, site TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, ip TEXT, fp TEXT, ua TEXT, path TEXT, user_id TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS sec_at ON security_events(at);
CREATE TABLE IF NOT EXISTS ip_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, fp TEXT, site TEXT, reason TEXT, created_at TEXT NOT NULL, until INTEGER NOT NULL, lifted_at TEXT, lifted_by TEXT);
CREATE INDEX IF NOT EXISTS blocks_ip ON ip_blocks(ip, until);
CREATE INDEX IF NOT EXISTS blocks_fp ON ip_blocks(fp, until);
ALTER TABLE audit_log ADD COLUMN ua TEXT;
ALTER TABLE audit_log ADD COLUMN fp TEXT;`;
