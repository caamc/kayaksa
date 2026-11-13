// Sign-in for Kayak GraphIQ: single sign-on from Kayak Internal, which already enforces password +
// two-factor. internal.kayaksa.com/sso/graphiq issues a 60-second, one-time signed ticket; we
// exchange it here for a GraphIQ session (random token in an HttpOnly cookie, only its SHA-256 is
// stored; 10-hour lifetime, 45-minute idle timeout). Roles are managed inside GraphIQ.
import { Hono } from "hono";
import { createSession, readSession, endSession, type SessionConfig } from "../../../packages/core/src/session";
import { verifyMeet } from "../../../packages/core/src/meettoken";
import { email as cleanEmail, str } from "../../../packages/core/src/http";
import { appendAudit } from "./audit";
import { clientIp } from "../../../packages/core/src/http";
import { now, uid, type Role, type User, type V } from "./env";

export const SESSION: SessionConfig = { cookie: "__Host-gq_sid", fullTtlHours: 10, idleMinutes: 45, preTtlMinutes: 5 };
const DAY = 86_400_000;

export async function currentUser(c: any): Promise<User | null> {
  const cached = c.get?.("user");
  if (cached !== undefined) return cached;
  const s = await readSession(c, c.env.DB, SESSION, "full");
  let u: User | null = null;
  if (s) {
    u = await c.env.DB.prepare("SELECT id, email, name, role, status FROM users WHERE id = ?").bind(s.user_id).first();
    if (u && u.status !== "active") u = null;
  }
  c.set?.("user", u);
  return u;
}

export async function needUser(c: any, next: () => Promise<void>) {
  const u = await currentUser(c);
  if (!u) return c.json({ error: "Your session has ended. Sign in again." }, 401);
  await next();
  c.res = new Response(c.res.body, c.res);
  c.res.headers.set("Cache-Control", "private, no-store");
}

export const auth = new Hono<V>();

auth.get("/auth/sso", async (c) => {
  const cl: any = await verifyMeet(c.env.GRAPHIQ_SIGNING_KEY, c.req.query("t"));
  const ip = clientIp(c);
  if (!cl || cl.r !== "graphiq" || !cl.j || !cl.e || cl.x - Date.now() > 120_000) {
    await appendAudit(c.env, { action: "signin.rejected", detail: { why: "ticket invalid or expired" }, ip });
    return c.redirect("/login?e=sso", 302);
  }
  const used = await c.env.DB.prepare("INSERT INTO sso_used (j, at) VALUES (?, ?) ON CONFLICT(j) DO NOTHING RETURNING j").bind(String(cl.j).slice(0, 64), Date.now()).first();
  if (!used) { await appendAudit(c.env, { action: "signin.rejected", detail: { why: "ticket replayed" }, ip }); return c.redirect("/login?e=sso", 302); }
  const e = cleanEmail(cl.e);
  if (!e) return c.redirect("/login?e=sso", 302);
  let u: any = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(e).first();
  if (u?.status === "disabled") { await appendAudit(c.env, { user: u, action: "signin.refused", detail: { why: "disabled" }, ip }); return c.redirect("/login?e=disabled", 302); }
  if (!u) {
    // The first person to sign in becomes Admin; Kayak Internal superadmins are Admins; everyone
    // else starts as Viewer with no cases until an Admin gives them a role and assigns cases.
    const any = await c.env.DB.prepare("SELECT 1 FROM users LIMIT 1").first();
    const role: Role = !any || cl.ir === "superadmin" ? "admin" : "viewer";
    u = { id: uid(), email: e, name: str(cl.n, 80) || e, role, status: "active" };
    await c.env.DB.prepare("INSERT INTO users (id, email, name, role, status, created_at, last_seen) VALUES (?,?,?,?,?,?,?)").bind(u.id, e, u.name, role, "active", now(), now()).run();
    await appendAudit(c.env, { user: u, action: "user.created", detail: { role, via: "sso" }, ip });
  } else {
    await c.env.DB.prepare("UPDATE users SET name = ?, last_seen = ? WHERE id = ?").bind(str(cl.n, 80) || u.name, now(), u.id).run();
  }
  await createSession(c as any, c.env.DB, SESSION, u.id, "full");
  await appendAudit(c.env, { user: u, action: "signin", detail: { via: "Kayak Internal single sign-on" }, ip });
  await c.env.DB.prepare("DELETE FROM sso_used WHERE at < ?").bind(Date.now() - DAY).run();
  const next = c.req.query("next");
  return c.redirect(next && /^\/app[a-z0-9#/_-]*$/i.test(next) ? next : "/app", 302);
});

auth.post("/api/auth/logout", async (c) => {
  const u = await currentUser(c);
  await endSession(c as any, c.env.DB, SESSION, "full");
  if (u) await appendAudit(c.env, { user: u, action: "signout", ip: clientIp(c) });
  return c.json({ ok: true });
});
