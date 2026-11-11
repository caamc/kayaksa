// Shared HTTP plumbing: security headers, origin checks, request limits and rate limiting.
import type { Context, MiddlewareHandler } from "hono";

export interface CspOptions {
  connect?: string[];
  img?: string[];
  frameAncestors?: string;
}

export function csp(opts: CspOptions = {}): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${opts.img?.length ? " " + opts.img.join(" ") : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${opts.connect?.length ? " " + opts.connect.join(" ") : ""}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    `frame-ancestors ${opts.frameAncestors ?? "'none'"}`,
  ].join("; ");
}

/** Adds the security headers every Kayak site sends. */
export function securityHeaders(opts: CspOptions & { noindex?: boolean; permissions?: string } = {}): MiddlewareHandler {
  const policy = csp(opts);
  return async (c, next) => {
    await next();
    // Responses from the static-assets binding have immutable headers; copy before editing.
    c.res = new Response(c.res.body, c.res);
    const h = c.res.headers;
    const https = new URL(c.req.url).protocol === "https:";
    if (!h.has("Content-Security-Policy")) h.set("Content-Security-Policy", https ? policy + "; upgrade-insecure-requests" : policy);
    h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "strict-origin-when-cross-origin");
    h.set("Permissions-Policy", opts.permissions ?? "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    h.set("Cross-Origin-Opener-Policy", "same-origin");
    h.set("X-Frame-Options", "DENY");
    if (opts.noindex) h.set("X-Robots-Tag", "noindex, nofollow");
  };
}

/**
 * Refuses state-changing requests that do not come from this site's own pages. Browsers send
 * Origin on every cross-site POST, so a matching Origin (or Sec-Fetch-Site: same-origin) is a
 * reliable CSRF defence alongside SameSite cookies.
 */
export function sameOrigin(): MiddlewareHandler {
  return async (c, next) => {
    const m = c.req.method;
    if (m === "GET" || m === "HEAD" || m === "OPTIONS") return next();
    const site = c.req.header("Sec-Fetch-Site");
    const origin = c.req.header("Origin");
    const host = new URL(c.req.url).origin;
    if (site && site !== "same-origin" && site !== "none") return c.json({ error: "Cross-site request refused." }, 403);
    if (origin && origin !== host) return c.json({ error: "Cross-site request refused." }, 403);
    if (!origin && !site) return c.json({ error: "Missing request origin." }, 403);
    return next();
  };
}

export function clientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For")?.split(",")[0].trim() || "0.0.0.0";
}

/** Reads a JSON body with a size cap; returns {} for an empty body. */
export async function readJson<T = Record<string, unknown>>(c: Context, maxBytes = 64 * 1024): Promise<T> {
  const len = Number(c.req.header("Content-Length") || 0);
  if (len > maxBytes) throw new HttpError(413, "Request is too large.");
  const text = await c.req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request is too large.");
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function email(v: unknown): string {
  const e = str(v, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : "";
}

/**
 * Fixed-window rate limiting backed by D1 (table rate_limits(key TEXT PRIMARY KEY, window INTEGER, count INTEGER)).
 * Returns true when the action is allowed.
 */
export async function rateLimit(db: D1Database, key: string, limit: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window = ?2 THEN count + 1 ELSE 1 END, window = ?2
       RETURNING count`,
    )
    .bind(key, win)
    .first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}

export function nowIso(): string {
  return new Date().toISOString();
}
