// Sign-in with password plus mandatory TOTP two-factor authentication.
import { Hono } from "hono";
import { hashPassword, verifyPassword, passwordProblems, randomToken, sha256hex, safeEqual, seal, unseal } from "../../../packages/core/src/crypto";
import { newTotpSecret, totpUri, verifyTotp } from "../../../packages/core/src/totp";
import { createSession, readSession, endSession, endAllSessions, audit } from "../../../packages/core/src/session";
import { readJson, str, email as cleanEmail, rateLimit, clientIp, HttpError } from "../../../packages/core/src/http";
import { Env, User, SESSION, superadmins, uid } from "./env";

export const auth = new Hono<{ Bindings: Env }>();

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const GENERIC = "Email or password is not correct.";

async function userByEmail(db: D1Database, e: string) {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(e).first<any>();
}
async function userById(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<any>();
}

async function preUser(c: any): Promise<any> {
  const s = await readSession(c, c.env.DB, SESSION, "pre");
  if (!s) throw new HttpError(401, "Your sign-in step has expired. Start again.");
  const u = await userById(c.env.DB, s.user_id);
  if (!u || u.status !== "active") throw new HttpError(401, "This account is not active.");
  return u;
}

async function finish(c: any, u: any) {
  await endSession(c, c.env.DB, SESSION, "pre");
  await createSession(c, c.env.DB, SESSION, u.id, "full");
  await c.env.DB.prepare("UPDATE users SET failed = 0, locked_until = NULL, last_login = ? WHERE id = ?").bind(new Date().toISOString(), u.id).run();
  await audit(c, c.env.DB, u.id, "auth.signed_in");
}

async function recoveryCodes(): Promise<{ plain: string[]; hashes: string[] }> {
  const plain: string[] = [];
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  for (let i = 0; i < 10; i++) {
    const b = crypto.getRandomValues(new Uint8Array(8));
    const s = [...b].map((x) => alphabet[x % alphabet.length]).join("");
    plain.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return { plain, hashes: await Promise.all(plain.map((p) => sha256hex(p))) };
}

auth.get("/state", async (c) => {
  const full = await readSession(c, c.env.DB, SESSION, "full");
  if (full) return c.json({ mode: "full" });
  const pre = await readSession(c, c.env.DB, SESSION, "pre");
  if (pre) {
    const u = await userById(c.env.DB, pre.user_id);
    if (u) return c.json({ mode: "pre", next: u.totp_enabled ? "totp" : "enrol", email: u.email });
  }
  return c.json({ mode: "none", setup: !!c.env.BOOTSTRAP_TOKEN });
});

auth.post("/login", async (c) => {
  const b = await readJson<{ email?: string; password?: string }>(c, 4096);
  const e = cleanEmail(b.email);
  const pw = typeof b.password === "string" ? b.password : "";
  const ip = clientIp(c);
  if (!(await rateLimit(c.env.DB, `login-ip:${ip}`, 30, 900)) || (e && !(await rateLimit(c.env.DB, `login-email:${e}`, 12, 900)))) {
    return c.json({ error: "Too many attempts. Wait 15 minutes and try again." }, 429);
  }
  if (!e || !pw) return c.json({ error: GENERIC }, 400);
  const u = await userByEmail(c.env.DB, e);
  if (u?.locked_until && Date.parse(u.locked_until) > Date.now()) {
    await verifyPassword(pw, null);
    return c.json({ error: `This account is locked after too many failed attempts. Try again after ${new Date(u.locked_until).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST.` }, 423);
  }
  const ok = await verifyPassword(pw, u?.status === "active" ? u.pw_hash : null);
  if (!u || u.status !== "active" || !ok) {
    if (u && u.status === "active") {
      const failed = (u.failed || 0) + 1;
      const lock = failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
      await c.env.DB.prepare("UPDATE users SET failed = ?, locked_until = ? WHERE id = ?").bind(lock ? 0 : failed, lock, u.id).run();
      await audit(c, c.env.DB, u.id, lock ? "auth.locked" : "auth.failed_password");
    }
    return c.json({ error: GENERIC }, 401);
  }
  await endSession(c, c.env.DB, SESSION, "pre");
  await createSession(c, c.env.DB, SESSION, u.id, "pre");
  return c.json({ next: u.totp_enabled ? "totp" : "enrol" });
});

auth.post("/totp", async (c) => {
  const u = await preUser(c);
  if (!(await rateLimit(c.env.DB, `totp:${u.id}`, 8, 600))) return c.json({ error: "Too many codes tried. Wait 10 minutes and sign in again." }, 429);
  const b = await readJson<{ code?: string }>(c, 1024);
  const code = str(b.code, 20).toLowerCase();
  if (!u.totp_enabled || !u.totp_secret) return c.json({ error: "Set up your authenticator first." }, 400);
  if (/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    const step = await verifyTotp(await unseal(u.totp_secret, c.env.AUTH_ENCRYPTION_KEY), code);
    if (step != null && step > (u.totp_last_step || 0)) {
      await c.env.DB.prepare("UPDATE users SET totp_last_step = ? WHERE id = ?").bind(step, u.id).run();
      await finish(c, u);
      return c.json({ ok: true });
    }
  } else if (/^[a-z0-9]{4}-?[a-z0-9]{4}$/.test(code)) {
    const norm = code.includes("-") ? code : `${code.slice(0, 4)}-${code.slice(4)}`;
    const h = await sha256hex(norm);
    const list: string[] = JSON.parse(u.recovery || "[]");
    if (list.includes(h)) {
      await c.env.DB.prepare("UPDATE users SET recovery = ? WHERE id = ?").bind(JSON.stringify(list.filter((x) => x !== h)), u.id).run();
      await audit(c, c.env.DB, u.id, "auth.recovery_code_used", { left: list.length - 1 });
      await finish(c, u);
      return c.json({ ok: true, recoveryLeft: list.length - 1 });
    }
  }
  await audit(c, c.env.DB, u.id, "auth.failed_code");
  return c.json({ error: "That code is not correct or has already been used." }, 401);
});

auth.get("/enrol", async (c) => {
  const u = await preUser(c);
  if (u.totp_enabled) return c.json({ error: "Two-factor authentication is already set up." }, 400);
  const secret = newTotpSecret();
  await c.env.DB.prepare("UPDATE users SET totp_secret = ? WHERE id = ?").bind(await seal(secret, c.env.AUTH_ENCRYPTION_KEY), u.id).run();
  return c.json({ secret, uri: totpUri(secret, u.email, "Kayak Internal") });
});

auth.post("/enrol", async (c) => {
  const u = await preUser(c);
  if (u.totp_enabled || !u.totp_secret) return c.json({ error: "Start the authenticator set-up again." }, 400);
  if (!(await rateLimit(c.env.DB, `enrol:${u.id}`, 10, 600))) return c.json({ error: "Too many codes tried. Wait 10 minutes." }, 429);
  const b = await readJson<{ code?: string }>(c, 1024);
  const step = await verifyTotp(await unseal(u.totp_secret, c.env.AUTH_ENCRYPTION_KEY), str(b.code, 10));
  if (step == null) return c.json({ error: "That code does not match. Check the time on your phone is set automatically, then try the newest code." }, 400);
  const rc = await recoveryCodes();
  await c.env.DB.prepare("UPDATE users SET totp_enabled = 1, totp_last_step = ?, recovery = ? WHERE id = ?").bind(step, JSON.stringify(rc.hashes), u.id).run();
  await audit(c, c.env.DB, u.id, "auth.2fa_enrolled");
  await finish(c, u);
  return c.json({ ok: true, recoveryCodes: rc.plain });
});

auth.post("/logout", async (c) => {
  const s = await readSession(c, c.env.DB, SESSION, "full");
  await endSession(c, c.env.DB, SESSION, "full");
  await endSession(c, c.env.DB, SESSION, "pre");
  if (s) await audit(c, c.env.DB, s.user_id, "auth.signed_out");
  return c.json({ ok: true });
});

// First-run set-up for the two SuperAdmins. Needs the BOOTSTRAP_TOKEN secret, works only for an
// email listed in SUPERADMIN_EMAILS, and only until that account is active.
auth.post("/setup", async (c) => {
  if (!(await rateLimit(c.env.DB, `setup:${clientIp(c)}`, 6, 3600))) return c.json({ error: "Too many attempts. Wait an hour." }, 429);
  const b = await readJson<{ email?: string; token?: string; name?: string; password?: string }>(c, 4096);
  const e = cleanEmail(b.email);
  const token = str(b.token, 200);
  const name = str(b.name, 120);
  const pw = typeof b.password === "string" ? b.password : "";
  const boot = c.env.BOOTSTRAP_TOKEN || "";
  if (!boot || boot.length < 24) return c.json({ error: "First-run set-up is switched off." }, 403);
  if (!e || !superadmins(c.env).includes(e) || !safeEqual(await sha256hex(token), await sha256hex(boot))) {
    await audit(c, c.env.DB, null, "auth.setup_refused", { email: e });
    return c.json({ error: "The email or set-up token is not correct." }, 403);
  }
  if (!name) return c.json({ error: "Enter your name." }, 400);
  const problems = passwordProblems(pw, e);
  if (problems.length) return c.json({ error: problems.join(" ") }, 400);
  const existing = await userByEmail(c.env.DB, e);
  if (existing && existing.status === "active") return c.json({ error: "This account is already set up. Sign in instead." }, 409);
  const now = new Date().toISOString();
  const id = existing?.id || uid();
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, role, status, pw_hash, pw_changed_at, created_at) VALUES (?1, ?2, ?3, 'superadmin', 'active', ?4, ?5, ?5)
     ON CONFLICT(email) DO UPDATE SET name = ?3, role = 'superadmin', status = 'active', pw_hash = ?4, pw_changed_at = ?5, totp_enabled = 0, totp_secret = NULL`,
  ).bind(id, e, name, await hashPassword(pw), now).run();
  await audit(c, c.env.DB, id, "auth.superadmin_setup");
  const u = await userByEmail(c.env.DB, e);
  await createSession(c, c.env.DB, SESSION, u.id, "pre");
  return c.json({ next: "enrol" });
});

auth.get("/token", async (c) => {
  const t = str(c.req.query("t"), 120);
  if (!t) return c.json({ error: "Missing link." }, 400);
  const row = await c.env.DB.prepare("SELECT t.kind, t.expires_at, t.used_at, u.email, u.name FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?").bind(await sha256hex(t)).first<any>();
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now()) return c.json({ error: "This link has expired or has already been used. Ask an administrator for a new one." }, 410);
  return c.json({ kind: row.kind, email: row.email, name: row.name });
});

auth.post("/redeem", async (c) => {
  if (!(await rateLimit(c.env.DB, `redeem:${clientIp(c)}`, 20, 3600))) return c.json({ error: "Too many attempts. Wait an hour." }, 429);
  const b = await readJson<{ token?: string; name?: string; password?: string }>(c, 4096);
  const h = await sha256hex(str(b.token, 120));
  const t = await c.env.DB.prepare("SELECT * FROM tokens WHERE token_hash = ?").bind(h).first<any>();
  if (!t || t.used_at || Date.parse(t.expires_at) < Date.now()) return c.json({ error: "This link has expired or has already been used." }, 410);
  const u = await userById(c.env.DB, t.user_id);
  if (!u || u.status === "disabled") return c.json({ error: "This account is disabled." }, 403);
  const pw = typeof b.password === "string" ? b.password : "";
  const problems = passwordProblems(pw, u.email);
  if (problems.length) return c.json({ error: problems.join(" ") }, 400);
  const name = str(b.name, 120) || u.name;
  if (!name) return c.json({ error: "Enter your name." }, 400);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE tokens SET used_at = ? WHERE token_hash = ?").bind(now, h),
    c.env.DB.prepare("UPDATE users SET pw_hash = ?, pw_changed_at = ?, status = 'active', name = ?, failed = 0, locked_until = NULL WHERE id = ?").bind(await hashPassword(pw), now, name, u.id),
  ]);
  await endAllSessions(c.env.DB, u.id);
  await audit(c, c.env.DB, u.id, t.kind === "invite" ? "auth.invite_accepted" : "auth.password_reset");
  await createSession(c, c.env.DB, SESSION, u.id, "pre");
  return c.json({ next: u.totp_enabled ? "totp" : "enrol" });
});

/** Creates a single-use invite or reset link; returns the URL. */
export async function issueLink(env: Env, kind: "invite" | "reset", userId: string, by: string, days = 7) {
  const token = randomToken(32);
  const now = new Date();
  await env.DB.prepare("INSERT INTO tokens (token_hash, kind, user_id, expires_at, created_by, created_at) VALUES (?,?,?,?,?,?)")
    .bind(await sha256hex(token), kind, userId, new Date(now.getTime() + days * 86_400_000).toISOString(), by, now.toISOString())
    .run();
  await env.DB.prepare("UPDATE tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL AND token_hash != ?")
    .bind(now.toISOString(), userId, kind, await sha256hex(token))
    .run();
  return `${env.SITE_URL.replace(/\/$/, "")}/welcome?t=${token}`;
}

/** Middleware: requires a full (two-factor) session. */
export async function loadUser(c: any): Promise<User | null> {
  const db = c.env.DB as D1Database;
  const s = await readSession(c, c.env.DB, SESSION, "full");
  if (!s) return null;
  const u = await db.prepare("SELECT id, email, name, title, phone, role, status, totp_enabled FROM users WHERE id = ?").bind(s.user_id).first<User>();
  if (!u || u.status !== "active" || !u.totp_enabled) return null;
  return u;
}

export { recoveryCodes };
