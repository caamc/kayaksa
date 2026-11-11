// People and access: the signed-in user's own account, and user administration.
import { Hono } from "hono";
import { hashPassword, verifyPassword, passwordProblems, sha256hex, unseal } from "../../../packages/core/src/crypto";
import { verifyTotp } from "../../../packages/core/src/totp";
import { audit, endAllSessions } from "../../../packages/core/src/session";
import { readJson, str, email as cleanEmail } from "../../../packages/core/src/http";
import { mailEnabled, mailHtml, sendMail } from "../../../packages/core/src/mail";
import { Env, User, Role, atLeast, superadmins, uid } from "./env";
import { issueLink, recoveryCodes } from "./auth";

type V = { Bindings: Env; Variables: { user: User } };
export const me = new Hono<V>();
export const admin = new Hono<V>();

me.get("/", (c) => {
  const u = c.get("user");
  return c.json({
    ...u,
    isSuperadmin: u.role === "superadmin",
    can: { admin: atLeast(u, "admin"), edit: atLeast(u, "editor") },
    mail: mailEnabled(c.env),
    learnUrl: c.env.LEARN_URL || "https://learn.kayaksa.com",
  });
});

me.post("/", async (c) => {
  const u = c.get("user");
  const b = await readJson<any>(c, 4096);
  const name = str(b.name, 120) || u.name;
  await c.env.DB.prepare("UPDATE users SET name = ?, title = ?, phone = ? WHERE id = ?").bind(name, str(b.title, 120), str(b.phone, 60), u.id).run();
  return c.json({ ok: true });
});

me.post("/password", async (c) => {
  const u = c.get("user");
  const b = await readJson<any>(c, 4096);
  const row = await c.env.DB.prepare("SELECT pw_hash FROM users WHERE id = ?").bind(u.id).first<any>();
  if (!(await verifyPassword(String(b.current || ""), row?.pw_hash))) return c.json({ error: "Your current password is not correct." }, 400);
  const problems = passwordProblems(String(b.next || ""), u.email);
  if (problems.length) return c.json({ error: problems.join(" ") }, 400);
  await c.env.DB.prepare("UPDATE users SET pw_hash = ?, pw_changed_at = ? WHERE id = ?").bind(await hashPassword(String(b.next)), new Date().toISOString(), u.id).run();
  await audit(c, c.env.DB, u.id, "account.password_changed");
  return c.json({ ok: true });
});

me.post("/recovery-codes", async (c) => {
  const u = c.get("user");
  const b = await readJson<any>(c, 1024);
  const row = await c.env.DB.prepare("SELECT totp_secret FROM users WHERE id = ?").bind(u.id).first<any>();
  const step = row?.totp_secret ? await verifyTotp(await unseal(row.totp_secret, c.env.AUTH_ENCRYPTION_KEY), str(b.code, 10)) : null;
  if (step == null) return c.json({ error: "Enter the current code from your authenticator app." }, 400);
  const rc = await recoveryCodes();
  await c.env.DB.prepare("UPDATE users SET recovery = ? WHERE id = ?").bind(JSON.stringify(rc.hashes), u.id).run();
  await audit(c, c.env.DB, u.id, "account.recovery_codes_renewed");
  return c.json({ recoveryCodes: rc.plain });
});

me.post("/sign-out-everywhere", async (c) => {
  const u = c.get("user");
  await endAllSessions(c.env.DB, u.id);
  await audit(c, c.env.DB, u.id, "account.signed_out_everywhere");
  return c.json({ ok: true });
});

// ----- Administration (admin and superadmin) -----
admin.use("*", async (c, next) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  return next();
});

admin.get("/users", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, email, name, title, role, status, totp_enabled, last_login, created_at, locked_until FROM users ORDER BY status = 'disabled', name COLLATE NOCASE",
  ).all();
  const protectedEmails = superadmins(c.env);
  return c.json({ users: results.map((r: any) => ({ ...r, protected: protectedEmails.includes(r.email) })) });
});

function canAssign(actor: User, role: Role) {
  if (role === "superadmin" || role === "admin") return actor.role === "superadmin";
  return atLeast(actor, "admin");
}

async function deliver(c: any, to: string, name: string, kind: "invite" | "reset", link: string) {
  if (!mailEnabled(c.env)) return false;
  const html =
    kind === "invite"
      ? mailHtml({ site: "INTERNAL", title: `Welcome to Kayak, ${name || "colleague"}`, intro: "You have been invited to Kayak Internal, our portal for the brand library, tools, partner network, AI assistant and training. Set your password and two-factor authentication to get started. The link works once and expires in 7 days.", action: { label: "Set up my account", url: link }, outro: "If you were not expecting this, ignore this email." })
      : mailHtml({ site: "INTERNAL", title: "Reset your Kayak password", intro: "An administrator issued a password reset for your Kayak Internal account. The link works once and expires in 24 hours. Your two-factor authentication stays as it is.", action: { label: "Choose a new password", url: link }, outro: "If you did not ask for this, tell your administrator." });
  const r = await sendMail(c.env, to, kind === "invite" ? "Your invitation to Kayak Internal" : "Reset your Kayak Internal password", html);
  return r.sent;
}

admin.post("/users", async (c) => {
  const actor = c.get("user");
  const b = await readJson<any>(c, 4096);
  const e = cleanEmail(b.email);
  const role = (["employee", "editor", "admin", "superadmin"].includes(b.role) ? b.role : "employee") as Role;
  if (!e) return c.json({ error: "Enter a valid email address." }, 400);
  if (!canAssign(actor, role)) return c.json({ error: "Only a SuperAdmin can create administrators." }, 403);
  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(e).first();
  if (exists) return c.json({ error: "Someone with this email already has an account." }, 409);
  const id = uid();
  const name = str(b.name, 120);
  await c.env.DB.prepare("INSERT INTO users (id, email, name, title, role, status, created_at) VALUES (?,?,?,?,?, 'invited', ?)").bind(id, e, name, str(b.title, 120), role, new Date().toISOString()).run();
  const link = await issueLink(c.env, "invite", id, actor.id, 7);
  const emailed = await deliver(c, e, name, "invite", link);
  await audit(c, c.env.DB, actor.id, "admin.user_invited", { email: e, role });
  return c.json({ id, link, emailed });
});

admin.post("/users/:id", async (c) => {
  const actor = c.get("user");
  const id = c.req.param("id");
  const b = await readJson<any>(c, 4096);
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<any>();
  if (!u) return c.json({ error: "No such user." }, 404);
  const prot = superadmins(c.env).includes(u.email);
  const role = b.role && ["employee", "editor", "admin", "superadmin"].includes(b.role) ? (b.role as Role) : u.role;
  const status = b.status && ["active", "disabled", "invited"].includes(b.status) ? b.status : u.status;
  if (id === actor.id && (role !== u.role || status !== u.status)) return c.json({ error: "You cannot change your own role or status." }, 400);
  if (prot && (role !== "superadmin" || status === "disabled")) return c.json({ error: "The founding SuperAdmin accounts cannot be demoted or disabled." }, 403);
  if ((u.role === "admin" || u.role === "superadmin" || role === "admin" || role === "superadmin") && actor.role !== "superadmin" && (role !== u.role || status !== u.status)) {
    return c.json({ error: "Only a SuperAdmin can change administrators." }, 403);
  }
  if (status === "active" && u.status === "invited") return c.json({ error: "Invited people become active when they accept their invite." }, 400);
  await c.env.DB.prepare("UPDATE users SET name = ?, title = ?, role = ?, status = ? WHERE id = ?").bind(str(b.name, 120) || u.name, b.title != null ? str(b.title, 120) : u.title, role, status, id).run();
  if (status === "disabled") await endAllSessions(c.env.DB, id);
  await audit(c, c.env.DB, actor.id, "admin.user_updated", { email: u.email, role, status });
  return c.json({ ok: true });
});

admin.post("/users/:id/link", async (c) => {
  const actor = c.get("user");
  const b = await readJson<any>(c, 1024);
  const kind = b.kind === "reset" ? "reset" : "invite";
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!u) return c.json({ error: "No such user." }, 404);
  if (u.status === "disabled") return c.json({ error: "Enable the account first." }, 400);
  if (kind === "invite" && u.status !== "invited") return c.json({ error: "This person has already joined. Issue a password reset instead." }, 400);
  if ((u.role === "superadmin" || u.role === "admin") && actor.role !== "superadmin") return c.json({ error: "Only a SuperAdmin can reset an administrator." }, 403);
  const link = await issueLink(c.env, kind, u.id, actor.id, kind === "invite" ? 7 : 1);
  const emailed = await deliver(c, u.email, u.name, kind, link);
  await audit(c, c.env.DB, actor.id, `admin.${kind}_link_issued`, { email: u.email });
  return c.json({ link, emailed });
});

admin.post("/users/:id/reset-2fa", async (c) => {
  const actor = c.get("user");
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!u) return c.json({ error: "No such user." }, 404);
  if (u.id === actor.id) return c.json({ error: "Ask another administrator to reset your own two-factor authentication." }, 400);
  if ((u.role === "superadmin" || u.role === "admin") && actor.role !== "superadmin") return c.json({ error: "Only a SuperAdmin can reset an administrator." }, 403);
  await c.env.DB.prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_last_step = 0, recovery = '[]' WHERE id = ?").bind(u.id).run();
  await endAllSessions(c.env.DB, u.id);
  await audit(c, c.env.DB, actor.id, "admin.2fa_reset", { email: u.email });
  return c.json({ ok: true });
});

admin.get("/audit", async (c) => {
  const limit = Math.min(500, Math.max(10, Number(c.req.query("limit") || 200)));
  const { results } = await c.env.DB.prepare(
    "SELECT a.at, a.action, a.detail, a.ip, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ?",
  ).bind(limit).all();
  return c.json({ entries: results });
});

admin.get("/stats", async (c) => {
  const q = (s: string) => c.env.DB.prepare(s).first<{ n: number }>().then((r) => r?.n ?? 0);
  return c.json({
    users: await q("SELECT COUNT(*) n FROM users WHERE status = 'active'"),
    invited: await q("SELECT COUNT(*) n FROM users WHERE status = 'invited'"),
    partners: await q("SELECT COUNT(*) n FROM partners"),
    certificates: await q("SELECT COUNT(*) n FROM certificates"),
    conversations: await q("SELECT COUNT(*) n FROM ai_conversations"),
  });
});

export { sha256hex };
