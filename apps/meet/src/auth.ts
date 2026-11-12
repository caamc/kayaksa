// Sign-in for Meet by Kayak.
//   Kayak employees: single sign-on from Kayak Internal (which already enforces password + two-factor).
//     internal.kayaksa.com/sso/meet issues a 60-second, one-time signed ticket; we exchange it here.
//   Clients: invited by a Kayak employee. The one-time invitation link lets them accept the privacy
//     notice and set up an authenticator app; after that they sign in with email + 6-digit code.
//   Guests (no account): still join single meetings with a signed invitation link, as before.
// Sessions: random token in an HttpOnly cookie; only its SHA-256 is stored. 12-hour absolute
// lifetime, 2-hour idle timeout. Every sign-in, failure and invitation is audited.
import { Hono } from "hono";
import { createSession, readSession, endSession, type SessionConfig } from "../../../packages/core/src/session";
import { randomToken, sha256hex, seal, unseal } from "../../../packages/core/src/crypto";
import { readJson, str, email as cleanEmail, rateLimit, clientIp } from "../../../packages/core/src/http";
import { newTotpSecret, verifyTotp, totpUri } from "../../../packages/core/src/totp";
import { verifyMeet } from "../../../packages/core/src/meettoken";
import { auditFull } from "../../../packages/core/src/shield";
import type { Env } from "./env";

export const NOTICE_VERSION = "KMEET-PN-2026-11";
export const SESSION: SessionConfig = { cookie: "__Host-kmeet_sid", fullTtlHours: 12, idleMinutes: 120, preTtlMinutes: 10 };
export interface Member { id: string; email: string; name: string; org: string | null; kind: "employee" | "client"; status: string; lang: string }

const totpKey = (env: Env) => {
  if (!env.MEET_SIGNING_KEY) throw Object.assign(new Error("Meet is not fully set up yet (signing key missing)."), { status: 503 });
  return env.MEET_SIGNING_KEY + ":totp";
};
export const now = () => new Date().toISOString();
const DAY = 86_400_000;

export async function currentMember(c: any): Promise<Member | null> {
  if (c.get?.("member") !== undefined) return c.get("member");
  const s = await readSession(c, c.env.DB, SESSION, "full");
  let m: Member | null = null;
  if (s) {
    m = await c.env.DB.prepare("SELECT id, email, name, org, kind, status, lang FROM members WHERE id = ?").bind(s.user_id).first();
    if (m && m.status !== "active") m = null;
  }
  c.set?.("member", m);
  return m;
}

/** Guard for workspace APIs. */
export async function needMember(c: any, next: () => Promise<void>) {
  const m = await currentMember(c);
  if (!m) return c.json({ error: "Your session has ended. Sign in again." }, 401);
  await next();
  c.res = new Response(c.res.body, c.res);
  c.res.headers.set("Cache-Control", "private, no-store");
}
export const employeeOnly = async (c: any, next: () => Promise<void>) => (c.get("member")?.kind === "employee" ? next() : c.json({ error: "Only Kayak team members can do this." }, 403));

export const auth = new Hono<{ Bindings: Env; Variables: { member: Member | null } }>();

// ------------------------------------------------------------------ employees: SSO from Kayak Internal
auth.get("/auth/sso", async (c) => {
  const cl: any = await verifyMeet(c.env.MEET_SIGNING_KEY, c.req.query("t"));
  if (!cl || cl.r !== "sso" || !cl.j || !cl.e || cl.x - Date.now() > 120_000) {
    await auditFull(c as any, c.env.DB, null, "meet.sso.rejected", null);
    return c.redirect("/login?e=sso", 302);
  }
  // One-time: a ticket that was already used (or replayed from history) is refused.
  const used = await c.env.DB.prepare("INSERT INTO sso_used (j, at) VALUES (?, ?) ON CONFLICT(j) DO NOTHING RETURNING j").bind(String(cl.j).slice(0, 64), Date.now()).first();
  if (!used) return c.redirect("/login?e=sso", 302);
  const e = cleanEmail(cl.e);
  if (!e) return c.redirect("/login?e=sso", 302);
  let m: any = await c.env.DB.prepare("SELECT * FROM members WHERE email = ?").bind(e).first();
  if (m && m.status === "disabled") return c.redirect("/login?e=disabled", 302);
  if (!m) {
    m = { id: crypto.randomUUID(), email: e };
    await c.env.DB.prepare("INSERT INTO members (id, email, name, kind, status, notice_version, created_at, last_seen) VALUES (?,?,?,?,?,?,?,?)")
      .bind(m.id, e, str(cl.n, 80) || e, "employee", "active", NOTICE_VERSION, now(), now()).run();
  } else {
    // An employee's details come from Kayak Internal; a client account with the same email is upgraded.
    await c.env.DB.prepare("UPDATE members SET name = ?, kind = 'employee', status = 'active', totp_secret = NULL, last_seen = ? WHERE id = ?").bind(str(cl.n, 80) || m.name, now(), m.id).run();
  }
  await createSession(c as any, c.env.DB, SESSION, m.id, "full");
  await auditFull(c as any, c.env.DB, m.id, "meet.signin.sso", null);
  await c.env.DB.prepare("DELETE FROM sso_used WHERE at < ?").bind(Date.now() - DAY).run();
  const next = c.req.query("next");
  return c.redirect(next && /^\/[a-z0-9#/_-]*$/i.test(next) && !next.startsWith("//") ? next : "/app", 302);
});

// ------------------------------------------------------------------ clients: invitation + authenticator
auth.post("/api/auth/invite/check", async (c) => {
  const b = await readJson<any>(c, 2048);
  const m = await inviteMember(c, str(b.token, 100));
  if (!m) return c.json({ error: "This invitation link is not valid or has expired. Ask your Kayak contact to send a new one." }, 400);
  // A fresh authenticator secret for this setup attempt, sealed until the first code proves it works.
  const secret = newTotpSecret();
  await c.env.DB.prepare("UPDATE members SET totp_secret = ?, totp_last = NULL WHERE id = ?").bind(await seal("pending:" + secret, totpKey(c.env)), m.id).run();
  return c.json({ name: m.name, email: m.email, org: m.org, secret, uri: totpUri(secret, m.email, "Meet by Kayak"), notice: NOTICE_VERSION });
});

auth.post("/api/auth/invite/accept", async (c) => {
  const b = await readJson<any>(c, 2048);
  if (!(await rateLimit(c.env.DB, `inv:${clientIp(c)}`, 20, 600))) return c.json({ error: "Too many attempts. Wait ten minutes." }, 429);
  const m = await inviteMember(c, str(b.token, 100));
  if (!m) return c.json({ error: "This invitation link is not valid or has expired." }, 400);
  if (b.accept !== true) return c.json({ error: "Please read and accept the privacy notice to continue." }, 400);
  const name = str(b.name, 80) || m.name;
  const sealed = m.totp_secret ? await unseal(m.totp_secret, totpKey(c.env)).catch(() => "") : "";
  if (!sealed.startsWith("pending:")) return c.json({ error: "Start again from the invitation link." }, 400);
  const secret = sealed.slice(8);
  const step = await verifyTotp(secret, str(b.code, 10));
  if (step === null) return c.json({ error: "That code didn't match. Check your authenticator app and try the newest code." }, 400);
  await c.env.DB.prepare("UPDATE members SET name = ?, status = 'active', totp_secret = ?, totp_last = ?, invite_hash = NULL, invite_expires = NULL, notice_version = ?, last_seen = ? WHERE id = ?")
    .bind(name, await seal(secret, totpKey(c.env)), step, NOTICE_VERSION, now(), m.id).run();
  await createSession(c as any, c.env.DB, SESSION, m.id, "full");
  await auditFull(c as any, c.env.DB, m.id, "meet.invite.accepted", { notice: NOTICE_VERSION });
  return c.json({ ok: true, next: "/app" });
});

async function inviteMember(c: any, token: string) {
  if (!token || token.length < 20) return null;
  const m: any = await c.env.DB.prepare("SELECT * FROM members WHERE invite_hash = ?").bind(await sha256hex(token)).first();
  if (!m || m.status === "disabled" || !m.invite_expires || Date.parse(m.invite_expires) < Date.now()) return null;
  return m;
}

/** Creates (or refreshes) a client invitation. Returns the one-time link. Resets their authenticator. */
export async function issueInvite(env: Env, by: Member, input: { email: string; name: string; org?: string }): Promise<{ member: any; link: string; created: boolean }> {
  const e = cleanEmail(input.email);
  if (!e) throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
  let m: any = await env.DB.prepare("SELECT * FROM members WHERE email = ?").bind(e).first();
  if (m?.kind === "employee") return { member: m, link: "", created: false };
  if (m?.status === "disabled") throw Object.assign(new Error("This person's access was turned off. Ask an administrator."), { status: 403 });
  const token = randomToken(24);
  const hash = await sha256hex(token);
  const expires = new Date(Date.now() + 7 * DAY).toISOString();
  let created = false;
  if (!m) {
    created = true;
    m = { id: crypto.randomUUID(), email: e, name: str(input.name, 80) || e.split("@")[0], org: str(input.org, 120) || null, kind: "client", status: "invited" };
    await env.DB.prepare("INSERT INTO members (id, email, name, org, kind, status, invited_by, invite_hash, invite_expires, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(m.id, e, m.name, m.org, "client", "invited", by.id, hash, expires, now()).run();
  } else if (m.status === "invited") {
    await env.DB.prepare("UPDATE members SET invite_hash = ?, invite_expires = ? WHERE id = ?").bind(hash, expires, m.id).run();
  } else {
    // Active client: no new link needed unless the caller explicitly resets their authenticator.
    return { member: m, link: "", created: false };
  }
  return { member: m, link: `https://meet.kayaksa.com/join/${token}`, created };
}
/** Lets an active client set up a new authenticator (lost phone). */
export async function resetClient(env: Env, id: string) {
  const token = randomToken(24);
  await env.DB.prepare("UPDATE members SET status = 'invited', totp_secret = NULL, invite_hash = ?, invite_expires = ? WHERE id = ? AND kind = 'client'").bind(await sha256hex(token), new Date(Date.now() + 7 * DAY).toISOString(), id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  return `https://meet.kayaksa.com/join/${token}`;
}

auth.post("/api/auth/login", async (c) => {
  const b = await readJson<any>(c, 2048);
  const e = cleanEmail(b.email);
  const ip = clientIp(c);
  if (!(await rateLimit(c.env.DB, `login:${ip}`, 20, 600)) || !(await rateLimit(c.env.DB, `login:${e}`, 8, 600)))
    return c.json({ error: "Too many attempts. Wait ten minutes and try again." }, 429);
  const fail = async (why: string) => { await auditFull(c as any, c.env.DB, null, "meet.signin.failed", { email: e, why }); return c.json({ error: "That email and code don't match. Use the newest code in your authenticator app." }, 401); };
  if (!e) return fail("bad email");
  const m: any = await c.env.DB.prepare("SELECT * FROM members WHERE email = ?").bind(e).first();
  if (m?.kind === "employee") return c.json({ error: "Kayak team members sign in with Kayak Internal.", sso: true }, 400);
  if (!m || m.status !== "active" || !m.totp_secret) return fail("no account");
  const secret = await unseal(m.totp_secret, totpKey(c.env)).catch(() => "");
  const step = secret && !secret.startsWith("pending:") ? await verifyTotp(secret, str(b.code, 10)) : null;
  if (step === null || (m.totp_last && step <= m.totp_last)) return fail("bad code");
  await c.env.DB.prepare("UPDATE members SET totp_last = ?, last_seen = ? WHERE id = ?").bind(step, now(), m.id).run();
  await createSession(c as any, c.env.DB, SESSION, m.id, "full");
  await auditFull(c as any, c.env.DB, m.id, "meet.signin.totp", null);
  return c.json({ ok: true, next: "/app" });
});

auth.post("/api/auth/logout", async (c) => {
  const m = await currentMember(c);
  await endSession(c as any, c.env.DB, SESSION, "full");
  if (m) await auditFull(c as any, c.env.DB, m.id, "meet.signout", null);
  return c.json({ ok: true });
});
