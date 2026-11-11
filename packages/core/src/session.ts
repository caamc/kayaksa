// Server-side sessions in D1. The browser holds only a random token in an HttpOnly, Secure,
// SameSite=Lax __Host- cookie; the database stores its SHA-256, so a database leak does not
// expose live sessions.
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { randomToken, sha256hex } from "./crypto";
import { clientIp } from "./http";
import { auditFull } from "./shield";

export type SessionKind = "full" | "pre";

export interface SessionRow {
  id: string;
  user_id: string;
  kind: SessionKind;
  created_at: string;
  expires_at: string;
  last_seen: string;
}

export interface SessionConfig {
  cookie: string; // e.g. "__Host-ksa_sid"
  fullTtlHours: number; // absolute lifetime
  idleMinutes: number; // sliding idle timeout
  preTtlMinutes: number; // time allowed to finish the second factor
}

function secureCookies(c: Context) {
  // __Host- cookies need HTTPS; wrangler dev on http://localhost uses a plain name instead.
  return new URL(c.req.url).protocol === "https:";
}

export function cookieName(c: Context, cfg: SessionConfig, kind: SessionKind) {
  const base = kind === "pre" ? cfg.cookie.replace("sid", "pre") : cfg.cookie;
  return secureCookies(c) ? base : base.replace("__Host-", "dev_");
}

export async function createSession(c: Context, db: D1Database, cfg: SessionConfig, userId: string, kind: SessionKind) {
  const token = randomToken(32);
  const id = await sha256hex(token);
  const now = new Date();
  const ttlMs = kind === "pre" ? cfg.preTtlMinutes * 60_000 : cfg.fullTtlHours * 3_600_000;
  const expires = new Date(now.getTime() + ttlMs);
  await db
    .prepare("INSERT INTO sessions (id, user_id, kind, created_at, expires_at, last_seen, ip, ua) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, userId, kind, now.toISOString(), expires.toISOString(), now.toISOString(), clientIp(c), (c.req.header("User-Agent") || "").slice(0, 200))
    .run();
  setCookie(c, cookieName(c, cfg, kind), token, {
    httpOnly: true,
    secure: secureCookies(c),
    sameSite: "Lax",
    path: "/",
    maxAge: Math.floor(ttlMs / 1000),
  });
  return id;
}

export async function readSession(c: Context, db: D1Database, cfg: SessionConfig, kind: SessionKind): Promise<SessionRow | null> {
  const token = getCookie(c, cookieName(c, cfg, kind));
  if (!token || token.length > 100) return null;
  const id = await sha256hex(token);
  const row = await db.prepare("SELECT id, user_id, kind, created_at, expires_at, last_seen FROM sessions WHERE id = ? AND kind = ?").bind(id, kind).first<SessionRow>();
  if (!row) return null;
  const now = Date.now();
  const idleOk = kind === "pre" || now - Date.parse(row.last_seen) < cfg.idleMinutes * 60_000;
  if (Date.parse(row.expires_at) < now || !idleOk) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return null;
  }
  // Slide the idle window at most once a minute to keep writes low.
  if (kind === "full" && now - Date.parse(row.last_seen) > 60_000) {
    await db.prepare("UPDATE sessions SET last_seen = ? WHERE id = ?").bind(new Date(now).toISOString(), id).run();
  }
  return row;
}

export async function endSession(c: Context, db: D1Database, cfg: SessionConfig, kind: SessionKind) {
  const token = getCookie(c, cookieName(c, cfg, kind));
  if (token) await db.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256hex(token)).run();
  deleteCookie(c, cookieName(c, cfg, kind), { path: "/", secure: secureCookies(c) });
}

export async function endAllSessions(db: D1Database, userId: string) {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

export async function audit(c: Context, _db: D1Database, userId: string | null, action: string, detail: unknown = null) {
  await auditFull(c, _db, userId, action, detail);
}
