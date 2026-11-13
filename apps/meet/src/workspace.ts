// The Meet by Kayak workspace: channels, projects and direct messages with threads, reactions and
// files; tasks on a board; meetings started from a conversation or scheduled with calendar invites;
// Kayak AI summaries and translation; outgoing integrations (Slack, signed webhooks).
//
// Privacy rules, enforced on every request:
//   - A client sees only channels they were added to, and only the people in those channels.
//   - A client cannot create channels or add people; they can message people they share a channel with.
//   - Employees see open Kayak channels and can join them; private channels need an invitation.
//   - Files are served only to channel members, as downloads, under a sandbox policy.
import { Hono } from "hono";
import { readJson, str, email as cleanEmail, rateLimit } from "../../../packages/core/src/http";
import { seal, unseal, randomToken, sha256hex } from "../../../packages/core/src/crypto";
import { signMeet, newRoomId } from "../../../packages/core/src/meettoken";
import { mailEnabled, mailHtml, sendMail } from "../../../packages/core/src/mail";
import { auditFull } from "../../../packages/core/src/shield";
import { needMember, employeeOnly, issueInvite, resetClient, now, type Member } from "./auth";
import type { Env } from "./env";
import { pushMeeting, removeMeeting, syncMember } from "./calendar";
import { read as readUsage, view as usageView } from "./usage";
import { addActivity, messageActivity, announceActivity, ringing, statusOf } from "./people";

type V = { Bindings: Env; Variables: { member: Member } };
export const ws = new Hono<V>();
ws.use("*", needMember);

const err = (msg: string, status = 400) => Object.assign(new Error(msg), { status });
const me = (c: any): Member => c.get("member");
const isEmp = (m: Member) => m.kind === "employee";
const id8 = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const MAX_FILE = 25 * 1024 * 1024;
const BLOCKED_EXT = /\.(exe|msi|bat|cmd|com|scr|pif|ps1|vbs|vbe|js|jse|wsf|wsh|jar|dll|cpl|hta|reg|lnk|apk|app|dmg|pkg|sh|html?|xhtml|mht)$/i;

ws.onError((e: any, c) => c.json({ error: e.status ? e.message : "Something went wrong. Try again." }, e.status || 500));

// ------------------------------------------------------------------ access helpers
async function channelFor(c: any, chId: string, opts: { join?: boolean } = {}) {
  const m = me(c);
  const ch: any = await c.env.DB.prepare("SELECT * FROM channels WHERE id = ?").bind(chId).first();
  if (!ch) throw err("Conversation not found.", 404);
  const mem: any = await c.env.DB.prepare("SELECT role, last_read, muted FROM channel_members WHERE channel_id = ? AND member_id = ?").bind(chId, m.id).first();
  if (mem) return { ch, role: mem.role as string, mem };
  // Employees may read and join open Kayak channels without an invitation.
  if (isEmp(m) && ch.kind !== "dm" && !ch.private) {
    if (opts.join) {
      await c.env.DB.prepare("INSERT OR IGNORE INTO channel_members (channel_id, member_id, role, added_at) VALUES (?,?,?,?)").bind(chId, m.id, "member", now()).run();
      await sysMsg(c.env, chId, `${m.name} joined.`);
      return { ch, role: "member", mem: { last_read: 0 } };
    }
    return { ch, role: "viewer", mem: null };
  }
  throw err("You don't have access to this conversation.", 403);
}
const canManage = (m: Member, x: { role: string; ch: any }) => isEmp(m) && (x.role === "owner" || x.ch.created_by === m.id);

async function sysMsg(env: Env, chId: string, body: string, kind = "system", meta: any = null) {
  await env.DB.prepare("INSERT INTO messages (channel_id, member_id, body, kind, meta, created_at) VALUES (?,?,?,?,?,?)").bind(chId, null, body, kind, meta ? JSON.stringify(meta) : null, now()).run();
}

/** Ids of everyone this member shares at least one channel with. */
async function coMemberIds(env: Env, mid: string): Promise<Set<string>> {
  const { results } = await env.DB.prepare("SELECT DISTINCT b.member_id id FROM channel_members a JOIN channel_members b ON a.channel_id = b.channel_id WHERE a.member_id = ?").bind(mid).all<any>();
  return new Set(results.map((r) => r.id));
}

// ------------------------------------------------------------------ boot and polling
ws.get("/boot", async (c) => {
  const m = me(c);
  const D = c.env.DB;
  const { results: chans } = await D.prepare(`
    SELECT ch.id, ch.name, ch.kind, ch.topic, ch.private, ch.external, ch.due, ch.archived, ch.created_by, cm.role, cm.muted, cm.notify, cm.last_read,
      (SELECT COUNT(*) FROM messages x WHERE x.channel_id = ch.id AND x.id > cm.last_read AND x.parent_id IS NULL AND x.deleted = 0 AND (x.member_id IS NULL OR x.member_id != ?)) unread,
      (SELECT MAX(id) FROM messages x WHERE x.channel_id = ch.id) last_id,
      (SELECT GROUP_CONCAT(member_id) FROM channel_members y WHERE y.channel_id = ch.id) member_ids
    FROM channel_members cm JOIN channels ch ON ch.id = cm.channel_id WHERE cm.member_id = ? AND ch.archived = 0 ORDER BY ch.kind, ch.name`).bind(m.id, m.id).all<any>();
  const open = isEmp(m) ? (await D.prepare("SELECT id, name, kind, topic FROM channels WHERE private = 0 AND archived = 0 AND kind != 'dm' AND id NOT IN (SELECT channel_id FROM channel_members WHERE member_id = ?) ORDER BY name LIMIT 200").bind(m.id).all<any>()).results : [];
  const people = await visiblePeople(c.env, m);
  const maxId = (await D.prepare("SELECT MAX(id) n FROM messages").first<any>())?.n || 0;
  const todoDue = (await D.prepare("SELECT COUNT(*) n FROM todos WHERE member_id = ? AND done = 0 AND due IS NOT NULL AND due <= ?").bind(m.id, new Date().toISOString().slice(0,10)).first<any>())?.n || 0;
  return c.json({ me: m, channels: chans.map((x) => ({ ...x, member_ids: String(x.member_ids || "").split(",").filter(Boolean) })), open, people, since: maxId, at: now(), mail: mailEnabled(c.env), ai: !!c.env.AI, todoDue });
});

async function visiblePeople(env: Env, m: Member) {
  const co = await coMemberIds(env, m.id);
  const { results } = await env.DB.prepare("SELECT id, name, email, org, kind, status, last_seen, title, avatar_key, avatar_v, presence, presence_until, status_text, status_emoji, status_until, ooo_until, ooo_note FROM members WHERE status != 'disabled' ORDER BY name").all<any>();
  return results.filter((p) => p.id === m.id || co.has(p.id) || (isEmp(m) && p.kind === "employee")).map((p) => {
    const s = statusOf(p);
    return {
      id: p.id, name: p.name, org: p.org, kind: p.kind, status: p.status, last_seen: p.last_seen,
      email: isEmp(m) || p.kind === "employee" || p.id === m.id ? p.email : undefined,
      online: s.presence !== "offline", ...s,
    };
  });
}

ws.get("/poll", async (c) => {
  const m = me(c);
  const since = Number(c.req.query("since")) || 0;
  const at = str(c.req.query("at"), 40) || now();
  // Presence: "online" means seen in the last five minutes.
  await c.env.DB.prepare("UPDATE members SET last_seen = ? WHERE id = ?").bind(now(), m.id).run();
  const { results } = await c.env.DB.prepare(`
    SELECT x.*, mb.name author FROM messages x LEFT JOIN members mb ON mb.id = x.member_id
    WHERE x.id > ? AND x.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?) ORDER BY x.id LIMIT 200`).bind(since, m.id).all<any>();
  const edits = (await c.env.DB.prepare(`SELECT x.*, mb.name author FROM messages x LEFT JOIN members mb ON mb.id = x.member_id
    WHERE (x.edited_at > ? OR x.touched_at > ?) AND x.id <= ? AND x.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?) LIMIT 100`).bind(at, at, since, m.id).all<any>()).results;
  const tasks = await c.env.DB.prepare("SELECT COUNT(*) n FROM tasks WHERE updated_at > ? AND channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?)").bind(at, m.id).first<any>();
  const chans = await c.env.DB.prepare("SELECT COUNT(*) n FROM channel_members WHERE member_id = ? AND added_at > ?").bind(m.id, at).first<any>();
  const act = await c.env.DB.prepare("SELECT COUNT(*) n, MAX(id) top FROM activity WHERE member_id = ? AND read = 0").bind(m.id).first<any>();
  const ring = await ringing(c.env, m.id);
  return c.json({ activity: { unread: act?.n || 0, top: act?.top || 0 }, ring, messages: results.map(pub), edits: edits.map(pub), tasksChanged: (tasks?.n || 0) > 0, channelsChanged: (chans?.n || 0) > 0, since: results.length ? results[results.length - 1].id : since, at: now() });
});

const pub = (x: any) => ({ id: x.id, channel_id: x.channel_id, member_id: x.member_id, author: x.member_id ? x.author || "Former participant" : null, parent_id: x.parent_id, body: x.deleted ? "" : x.body, kind: x.kind, meta: x.meta ? JSON.parse(x.meta) : null, reactions: x.reactions ? JSON.parse(x.reactions) : {}, created_at: x.created_at, edited_at: x.edited_at, deleted: !!x.deleted, replies: x.replies || 0, pinned: x.pinned_at ? { by: x.pinned_by, at: x.pinned_at } : null });

// ------------------------------------------------------------------ channels
ws.post("/channels", employeeOnly, async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 16_384);
  const name = str(b.name, 80).replace(/\s+/g, " ");
  if (!name) throw err("Give the channel a name.");
  const kind = b.kind === "project" ? "project" : "channel";
  const id = id8();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO channels (id, name, kind, topic, private, due, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id, name, kind, str(b.topic, 300) || null, b.private === false ? 0 : 1, kind === "project" ? str(b.due, 10) || null : null, m.id, now()),
    c.env.DB.prepare("INSERT INTO channel_members (channel_id, member_id, role, added_at) VALUES (?,?,?,?)").bind(id, m.id, "owner", now()),
  ]);
  await sysMsg(c.env, id, `${m.name} created ${kind === "project" ? "the project" : "this channel"}.`);
  const added = await addPeople(c, id, m, b.members || []);
  await auditFull(c as any, c.env.DB, m.id, "meet.ws.channel.created", { id, kind, private: b.private !== false });
  return c.json({ id, ...added });
});

async function addPeople(c: any, chId: string, by: Member, list: any[]) {
  const invites: { email: string; link: string }[] = [];
  const names: string[] = [];
  for (const p of (Array.isArray(list) ? list : []).slice(0, 50)) {
    let target: any = null;
    if (p.id) target = await c.env.DB.prepare("SELECT * FROM members WHERE id = ? AND status != 'disabled'").bind(String(p.id)).first();
    else if (p.email) {
      const e = cleanEmail(p.email);
      if (!e) continue;
      target = await c.env.DB.prepare("SELECT * FROM members WHERE email = ?").bind(e).first();
      if (!target || target.status === "invited") {
        const r = await issueInvite(c.env, by, { email: e, name: str(p.name, 80), org: str(p.org, 120) });
        target = r.member;
        if (r.link) invites.push({ email: e, link: r.link });
      }
    }
    if (!target || target.status === "disabled") continue;
    await c.env.DB.prepare("INSERT OR IGNORE INTO channel_members (channel_id, member_id, role, added_at) VALUES (?,?,?,?)").bind(chId, target.id, "member", now()).run();
    if (target.kind === "client") await c.env.DB.prepare("UPDATE channels SET external = 1 WHERE id = ?").bind(chId).run();
    names.push(target.name);
    const chRow: any = await c.env.DB.prepare("SELECT name, kind FROM channels WHERE id = ?").bind(chId).first();
    if (chRow && chRow.kind !== "dm") await addActivity(c.env, [target.id], { kind: "added", actor: by.id, channel: chId, text: `${by.name} added you to ${chRow.kind === "project" ? "the project" : "#"}${chRow.name}` });
  }
  if (names.length) await sysMsg(c.env, chId, `${by.name} added ${names.join(", ")}.`);
  // Email invitations go out only when email is configured; otherwise the inviter copies the link.
  const ch: any = await c.env.DB.prepare("SELECT name FROM channels WHERE id = ?").bind(chId).first();
  const sent: string[] = [];
  if (mailEnabled(c.env)) for (const i of invites) {
    const r = await sendMail(c.env, i.email, `${by.name} invited you to Meet by Kayak`, mailHtml({
      site: "MEET BY KAYAK", title: `${by.name} invited you to “${ch?.name || "a conversation"}”`,
      intro: `Kayak Strategic Advisors uses Meet by Kayak to work privately with clients: messages, files, tasks and meetings in one secure place. Open the link below to accept the privacy notice and set up sign-in with an authenticator app. It takes two minutes.`,
      action: { label: "Accept invitation", url: i.link }, outro: "The link works once and expires in 7 days. If you weren't expecting this, you can ignore it.",
    }));
    if (r.sent) sent.push(i.email);
  }
  if (invites.length) await auditFull(c as any, c.env.DB, by.id, "meet.ws.invited", { channel: chId, count: invites.length, emailed: sent.length });
  return { invites: invites.filter((i) => !sent.includes(i.email)), emailed: sent };
}

ws.get("/channels/:id", async (c) => {
  const x = await channelFor(c, c.req.param("id"));
  const { results: members } = await c.env.DB.prepare("SELECT m.id, m.name, m.org, m.kind, m.status, cm.role FROM channel_members cm JOIN members m ON m.id = cm.member_id WHERE cm.channel_id = ? ORDER BY m.kind DESC, m.name").bind(x.ch.id).all<any>();
  const ints = canManage(me(c), x) ? (await c.env.DB.prepare("SELECT id, kind, label, events, last_status, created_at FROM integrations WHERE channel_id = ?").bind(x.ch.id).all<any>()).results : [];
  return c.json({ channel: x.ch, role: x.role, manage: canManage(me(c), x), members, integrations: ints });
});

ws.patch("/channels/:id", async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"));
  if (!canManage(m, x)) throw err("Only the channel's owner can change it.", 403);
  const b = await readJson<any>(c, 4096);
  const name = b.name !== undefined ? str(b.name, 80) : x.ch.name;
  await c.env.DB.prepare("UPDATE channels SET name = ?, topic = ?, due = ?, archived = ?, private = ? WHERE id = ?")
    .bind(name || x.ch.name, b.topic !== undefined ? str(b.topic, 300) : x.ch.topic, b.due !== undefined ? str(b.due, 10) || null : x.ch.due, b.archived ? 1 : 0, b.private === undefined ? x.ch.private : b.private ? 1 : 0, x.ch.id).run();
  if (b.archived) await auditFull(c as any, c.env.DB, m.id, "meet.ws.channel.archived", { id: x.ch.id });
  return c.json({ ok: true });
});

ws.post("/channels/:id/join", employeeOnly, async (c) => { await channelFor(c, c.req.param("id"), { join: true }); return c.json({ ok: true }); });
ws.post("/channels/:id/leave", async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"));
  if (x.ch.kind === "dm") throw err("You can't leave a direct message. Mute it instead.");
  await c.env.DB.prepare("DELETE FROM channel_members WHERE channel_id = ? AND member_id = ?").bind(x.ch.id, m.id).run();
  await sysMsg(c.env, x.ch.id, `${m.name} left.`);
  return c.json({ ok: true });
});
ws.post("/channels/:id/members", employeeOnly, async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"));
  if (x.role === "viewer" || x.ch.kind === "dm") throw err("Join the channel first.", 403);
  const b = await readJson<any>(c, 16_384);
  return c.json(await addPeople(c, x.ch.id, m, b.members || []));
});
ws.delete("/channels/:id/members/:mid", employeeOnly, async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"));
  if (!canManage(m, x)) throw err("Only the channel's owner can remove people.", 403);
  const t: any = await c.env.DB.prepare("SELECT name FROM members WHERE id = ?").bind(c.req.param("mid")).first();
  await c.env.DB.prepare("DELETE FROM channel_members WHERE channel_id = ? AND member_id = ?").bind(x.ch.id, c.req.param("mid")).run();
  const ext = await c.env.DB.prepare("SELECT COUNT(*) n FROM channel_members cm JOIN members mb ON mb.id = cm.member_id WHERE cm.channel_id = ? AND mb.kind = 'client'").bind(x.ch.id).first<any>();
  await c.env.DB.prepare("UPDATE channels SET external = ? WHERE id = ?").bind(ext?.n ? 1 : 0, x.ch.id).run();
  if (t) await sysMsg(c.env, x.ch.id, `${m.name} removed ${t.name}.`);
  return c.json({ ok: true });
});
ws.post("/channels/:id/read", async (c) => {
  const b = await readJson<any>(c, 512);
  await c.env.DB.prepare("UPDATE channel_members SET last_read = MAX(last_read, ?) WHERE channel_id = ? AND member_id = ?").bind(Number(b.id) || 0, c.req.param("id"), me(c).id).run();
  return c.json({ ok: true });
});
ws.post("/channels/:id/mute", async (c) => {
  const b = await readJson<any>(c, 512);
  await c.env.DB.prepare("UPDATE channel_members SET muted = ? WHERE channel_id = ? AND member_id = ?").bind(b.muted ? 1 : 0, c.req.param("id"), me(c).id).run();
  return c.json({ ok: true });
});
// Notification level per conversation: everything, @mentions only, or off.
ws.post("/channels/:id/notify", async (c) => {
  const b = await readJson<any>(c, 256);
  const level = ["all", "mentions", "off"].includes(b.level) ? b.level : "all";
  await c.env.DB.prepare("UPDATE channel_members SET notify = ?, muted = ? WHERE channel_id = ? AND member_id = ?").bind(level === "off" ? "all" : level, level === "off" ? 1 : 0, c.req.param("id"), me(c).id).run();
  return c.json({ ok: true, level });
});
// Pinned messages: anyone in the conversation can pin; everyone sees the pins.
ws.post("/messages/:id/pin", async (c) => {
  const { m, msg } = await ownMessage(c);
  if (msg.deleted || msg.parent_id || msg.kind === "system") throw err("This message can't be pinned.");
  const b = await readJson<any>(c, 256);
  if (b.pin) {
    const n: any = await c.env.DB.prepare("SELECT COUNT(*) n FROM messages WHERE channel_id = ? AND pinned_at IS NOT NULL").bind(msg.channel_id).first();
    if ((n?.n || 0) >= 50) throw err("A conversation can have up to 50 pinned messages. Unpin one first.");
    await c.env.DB.prepare("UPDATE messages SET pinned_by = ?, pinned_at = ?, touched_at = ? WHERE id = ?").bind(m.name, now(), now(), msg.id).run();
    await sysMsg(c.env, msg.channel_id, `${m.name} pinned a message.`);
  } else await c.env.DB.prepare("UPDATE messages SET pinned_by = NULL, pinned_at = NULL, touched_at = ? WHERE id = ?").bind(now(), msg.id).run();
  return c.json({ ok: true });
});
ws.get("/channels/:id/pins", async (c) => {
  const x = await channelFor(c, c.req.param("id"));
  const { results } = await c.env.DB.prepare("SELECT x.*, mb.name author FROM messages x LEFT JOIN members mb ON mb.id = x.member_id WHERE x.channel_id = ? AND x.pinned_at IS NOT NULL AND x.deleted = 0 ORDER BY x.pinned_at DESC LIMIT 50").bind(x.ch.id).all<any>();
  return c.json({ pins: results.map(pub) });
});
// Saved messages: a private bookmark list for each person.
ws.post("/messages/:id/save", async (c) => {
  const { m, msg } = await ownMessage(c);
  const b = await readJson<any>(c, 256);
  if (b.save) await c.env.DB.prepare("INSERT OR IGNORE INTO saved_messages (member_id, message_id, at) VALUES (?,?,?)").bind(m.id, msg.id, now()).run();
  else await c.env.DB.prepare("DELETE FROM saved_messages WHERE member_id = ? AND message_id = ?").bind(m.id, msg.id).run();
  return c.json({ ok: true });
});
ws.get("/saved", async (c) => {
  const m = me(c);
  const { results } = await c.env.DB.prepare(`SELECT x.*, mb.name author, ch.name channel_name, ch.kind channel_kind FROM saved_messages s JOIN messages x ON x.id = s.message_id
    LEFT JOIN members mb ON mb.id = x.member_id JOIN channels ch ON ch.id = x.channel_id
    WHERE s.member_id = ? AND x.deleted = 0 AND x.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?) ORDER BY s.at DESC LIMIT 200`).bind(m.id, m.id).all<any>();
  return c.json({ saved: results.map((r) => ({ ...pub(r), channel_name: r.channel_name, channel_kind: r.channel_kind })) });
});

ws.post("/dm", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 1024);
  const other: any = await c.env.DB.prepare("SELECT id, name, kind FROM members WHERE id = ? AND status = 'active'").bind(str(b.id, 64)).first();
  if (!other || other.id === m.id) throw err("Choose someone to message.");
  // Clients may message only people they already work with in a shared channel.
  if (!isEmp(m) || other.kind === "client") {
    const co = await coMemberIds(c.env, m.id);
    if (!co.has(other.id)) throw err("You can message people you share a channel with.", 403);
  }
  const key = [m.id, other.id].sort().join(":");
  let ch: any = await c.env.DB.prepare("SELECT id FROM channels WHERE dm_key = ?").bind(key).first();
  if (!ch) {
    ch = { id: id8() };
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO channels (id, name, kind, private, external, created_by, created_at, dm_key) VALUES (?,?,?,?,?,?,?,?)").bind(ch.id, "Direct message", "dm", 1, m.kind === "client" || other.kind === "client" ? 1 : 0, m.id, now(), key),
      c.env.DB.prepare("INSERT INTO channel_members (channel_id, member_id, role, added_at) VALUES (?,?,?,?)").bind(ch.id, m.id, "member", now()),
      c.env.DB.prepare("INSERT INTO channel_members (channel_id, member_id, role, added_at) VALUES (?,?,?,?)").bind(ch.id, other.id, "member", now()),
    ]);
  }
  return c.json({ id: ch.id });
});

// ------------------------------------------------------------------ messages
ws.get("/channels/:id/messages", async (c) => {
  const x = await channelFor(c, c.req.param("id"));
  const before = Number(c.req.query("before")) || 2 ** 53;
  const parent = Number(c.req.query("parent")) || 0;
  const q = parent
    ? c.env.DB.prepare("SELECT x.*, mb.name author FROM messages x LEFT JOIN members mb ON mb.id = x.member_id WHERE x.channel_id = ? AND (x.id = ? OR x.parent_id = ?) ORDER BY x.id LIMIT 500").bind(x.ch.id, parent, parent)
    : c.env.DB.prepare(`SELECT x.*, mb.name author, (SELECT COUNT(*) FROM messages r WHERE r.parent_id = x.id AND r.deleted = 0) replies
        FROM messages x LEFT JOIN members mb ON mb.id = x.member_id WHERE x.channel_id = ? AND x.parent_id IS NULL AND x.id < ? ORDER BY x.id DESC LIMIT 60`).bind(x.ch.id, before);
  const { results } = await q.all<any>();
  const list = parent ? results : results.reverse();
  return c.json({ messages: list.map(pub), more: !parent && results.length === 60, lastRead: x.mem?.last_read || 0, viewer: x.role === "viewer" });
});

ws.post("/channels/:id/messages", async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"), { join: true });
  const b = await readJson<any>(c, 32_768);
  const body = str(b.body, 8000);
  if (!body) throw err("Write a message first.");
  if (!(await rateLimit(c.env.DB, `msg:${m.id}`, 60, 60))) throw err("You're sending messages very quickly. Wait a moment.", 429);
  const parent = Number(b.parent_id) || null;
  // Announcements: a headline post in a channel or project, highlighted for everyone and sent to their Activity.
  const announce = !parent && x.ch.kind !== "dm" && b.announce ? { announce: true, title: str(b.title, 120) || "Announcement" } : null;
  if (parent) {
    const p = await c.env.DB.prepare("SELECT id FROM messages WHERE id = ? AND channel_id = ? AND parent_id IS NULL").bind(parent, x.ch.id).first();
    if (!p) throw err("That thread no longer exists.", 404);
  }
  const r = await c.env.DB.prepare("INSERT INTO messages (channel_id, member_id, parent_id, body, meta, created_at) VALUES (?,?,?,?,?,?) RETURNING id").bind(x.ch.id, m.id, parent, body, announce ? JSON.stringify(announce) : null, now()).first<any>();
  c.executionCtx.waitUntil((announce ? announceActivity(c.env, m, x.ch, r.id, announce.title) : messageActivity(c.env, m, x.ch, r.id, body, parent)).catch(() => {}));
  await c.env.DB.prepare("UPDATE channel_members SET last_read = ? WHERE channel_id = ? AND member_id = ?").bind(r.id, x.ch.id, m.id).run();
  return c.json({ id: r.id });
});

async function ownMessage(c: any) {
  const m = me(c);
  const msg: any = await c.env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(Number(c.req.param("id")) || 0).first();
  if (!msg) throw err("Message not found.", 404);
  await channelFor(c, msg.channel_id);
  return { m, msg };
}
ws.patch("/messages/:id", async (c) => {
  const { m, msg } = await ownMessage(c);
  if (msg.member_id !== m.id || msg.deleted) throw err("You can edit only your own messages.", 403);
  const b = await readJson<any>(c, 32_768);
  const body = str(b.body, 8000);
  if (!body) throw err("A message can't be empty. Delete it instead.");
  await c.env.DB.prepare("UPDATE messages SET body = ?, edited_at = ? WHERE id = ?").bind(body, now(), msg.id).run();
  return c.json({ ok: true });
});
ws.delete("/messages/:id", async (c) => {
  const { m, msg } = await ownMessage(c);
  if (msg.member_id !== m.id) throw err("You can delete only your own messages.", 403);
  await c.env.DB.prepare("UPDATE messages SET deleted = 1, body = '', edited_at = ? WHERE id = ?").bind(now(), msg.id).run();
  if (msg.kind === "file" && msg.meta) await c.env.DB.prepare("UPDATE files SET deleted = 1 WHERE id = ?").bind(JSON.parse(msg.meta).file).run();
  return c.json({ ok: true });
});
ws.post("/messages/:id/react", async (c) => {
  const { m, msg } = await ownMessage(c);
  const b = await readJson<any>(c, 256);
  const e = str(b.emoji, 8);
  if (!["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "💡"].includes(e)) throw err("Choose one of the reactions.");
  const r = msg.reactions ? JSON.parse(msg.reactions) : {};
  const set = new Set<string>(r[e] || []);
  const adding = !set.has(m.id);
  adding ? set.add(m.id) : set.delete(m.id);
  if (adding && msg.member_id && msg.member_id !== m.id) await addActivity(c.env, [msg.member_id], { kind: "reaction", actor: m.id, channel: msg.channel_id, ref: msg.id, text: `${m.name} reacted ${e} to your message: ${String(msg.body).slice(0, 100)}` });
  if (set.size) r[e] = [...set]; else delete r[e];
  await c.env.DB.prepare("UPDATE messages SET reactions = ?, edited_at = COALESCE(edited_at, ?) WHERE id = ?").bind(JSON.stringify(r), now(), msg.id).run();
  return c.json({ reactions: r });
});

ws.get("/search", async (c) => {
  const m = me(c);
  const q = str(c.req.query("q"), 100);
  if (q.length < 2) return c.json({ results: [] });
  const like = "%" + q.replace(/[%_\\]/g, (s) => "\\" + s) + "%";
  const { results } = await c.env.DB.prepare(`SELECT x.id, x.channel_id, x.parent_id, x.body, x.created_at, mb.name author, ch.name channel, ch.kind
    FROM messages x JOIN channels ch ON ch.id = x.channel_id LEFT JOIN members mb ON mb.id = x.member_id
    WHERE x.deleted = 0 AND x.kind = 'text' AND x.body LIKE ? ESCAPE '\\' AND x.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?)
    ORDER BY x.id DESC LIMIT 50`).bind(like, m.id).all<any>();
  const tasks = (await c.env.DB.prepare(`SELECT t.id, t.title, t.status, t.channel_id, ch.name channel FROM tasks t JOIN channels ch ON ch.id = t.channel_id
    WHERE t.title LIKE ? ESCAPE '\\' AND t.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?) LIMIT 20`).bind(like, m.id).all<any>()).results;
  return c.json({ results, tasks });
});

// ------------------------------------------------------------------ files
ws.post("/channels/:id/files", async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"), { join: true });
  if (!(await rateLimit(c.env.DB, `file:${m.id}`, 30, 600))) throw err("That's a lot of files at once. Wait a few minutes.", 429);
  const len = Number(c.req.header("Content-Length") || 0);
  if (len > MAX_FILE + 4096) throw err("Files can be up to 25 MB.", 413);
  const name = str(decodeURIComponent(c.req.header("X-File-Name") || ""), 180).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_");
  if (!name) throw err("The file needs a name.");
  if (BLOCKED_EXT.test(name)) throw err("For everyone's safety, programs and web pages can't be shared. Zip and password-protect them, or share a link.");
  const buf = await c.req.arrayBuffer();
  if (!buf.byteLength || buf.byteLength > MAX_FILE) throw err("Files can be up to 25 MB.", 413);
  const fid = id8() + id8();
  const type = str(c.req.header("Content-Type"), 100) || "application/octet-stream";
  const key = `ws/${x.ch.id}/${fid}`;
  await c.env.REC.put(key, buf, { httpMetadata: { contentType: type } });
  await c.env.DB.prepare("INSERT INTO files (id, channel_id, member_id, name, type, size, r2_key, created_at) VALUES (?,?,?,?,?,?,?,?)").bind(fid, x.ch.id, m.id, name, type, buf.byteLength, key, now()).run();
  const caption = str(c.req.header("X-Caption") ? decodeURIComponent(c.req.header("X-Caption")!) : "", 2000);
  const r = await c.env.DB.prepare("INSERT INTO messages (channel_id, member_id, body, kind, meta, created_at) VALUES (?,?,?,?,?,?) RETURNING id")
    .bind(x.ch.id, m.id, caption || name, "file", JSON.stringify({ file: fid, name, size: buf.byteLength, type }), now()).first<any>();
  await auditFull(c as any, c.env.DB, m.id, "meet.ws.file.shared", { channel: x.ch.id, file: fid, size: buf.byteLength });
  return c.json({ id: r.id, file: fid });
});
ws.get("/channels/:id/files", async (c) => {
  const x = await channelFor(c, c.req.param("id"));
  const { results } = await c.env.DB.prepare("SELECT f.id, f.name, f.type, f.size, f.created_at, mb.name author FROM files f LEFT JOIN members mb ON mb.id = f.member_id WHERE f.channel_id = ? AND f.deleted = 0 ORDER BY f.created_at DESC LIMIT 200").bind(x.ch.id).all<any>();
  return c.json({ files: results });
});
export async function serveFile(c: any) {
  const f: any = await c.env.DB.prepare("SELECT * FROM files WHERE id = ? AND deleted = 0").bind(c.req.param("fid")).first();
  if (!f) return c.text("Not found", 404);
  try { await channelFor(c, f.channel_id); } catch { return c.text("Not found", 404); }
  const o = await c.env.REC.get(f.r2_key);
  if (!o) return c.text("Not found", 404);
  const inline = /^image\/(png|jpeg|gif|webp)$/.test(f.type) && c.req.query("inline") === "1";
  return new Response(o.body, { headers: {
    "Content-Type": inline ? f.type : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    "Content-Security-Policy": "sandbox; default-src 'none'", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600",
  } });
}

// ------------------------------------------------------------------ tasks and projects
const STATUSES = ["todo", "doing", "review", "done"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
ws.get("/tasks", async (c) => {
  const m = me(c);
  const ch = str(c.req.query("channel"), 40);
  if (ch) await channelFor(c, ch);
  const q = ch
    ? c.env.DB.prepare("SELECT t.*, mb.name assignee_name FROM tasks t LEFT JOIN members mb ON mb.id = t.assignee WHERE t.channel_id = ? ORDER BY t.status, t.sort, t.created_at").bind(ch)
    : c.env.DB.prepare(`SELECT t.*, mb.name assignee_name, ch.name channel_name FROM tasks t LEFT JOIN members mb ON mb.id = t.assignee JOIN channels ch ON ch.id = t.channel_id
        WHERE t.assignee = ? AND (t.status != 'done' OR t.done_at > ?) AND t.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?) ORDER BY COALESCE(t.due, '9999'), t.created_at`).bind(m.id, new Date(Date.now() - 7 * 86_400_000).toISOString(), m.id);
  return c.json({ tasks: (await q.all<any>()).results });
});
ws.post("/channels/:id/tasks", async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"), { join: true });
  const b = await readJson<any>(c, 8192);
  const title = str(b.title, 200);
  if (!title) throw err("Give the task a title.");
  const assignee = await validAssignee(c, x.ch.id, b.assignee);
  const id = id8();
  await c.env.DB.prepare("INSERT INTO tasks (id, channel_id, title, detail, status, priority, assignee, due, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, x.ch.id, title, str(b.detail, 4000) || null, STATUSES.includes(b.status) ? b.status : "todo", PRIORITIES.includes(b.priority) ? b.priority : "normal", assignee, /^\d{4}-\d{2}-\d{2}$/.test(b.due || "") ? b.due : null, m.id, now(), now()).run();
  await sysMsg(c.env, x.ch.id, `${m.name} added a task: ${title}`, "task", { task: id });
  if (assignee) await addActivity(c.env, [assignee], { kind: "task", actor: m.id, channel: x.ch.id, ref: id, text: `${m.name} assigned you a task: ${title}` });
  await notify(c.env, x.ch.id, "task", `New task in ${x.ch.name}: ${title}`);
  return c.json({ id });
});
async function validAssignee(c: any, chId: string, a: unknown) {
  if (!a) return null;
  const ok = await c.env.DB.prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND member_id = ?").bind(chId, String(a)).first();
  if (!ok) throw err("Tasks can be assigned only to people in this conversation.");
  return String(a);
}
ws.patch("/tasks/:id", async (c) => {
  const m = me(c);
  const t: any = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(c.req.param("id")).first();
  if (!t) throw err("Task not found.", 404);
  const x = await channelFor(c, t.channel_id, { join: true });
  const b = await readJson<any>(c, 8192);
  const status = STATUSES.includes(b.status) ? b.status : t.status;
  const assignee = b.assignee !== undefined ? await validAssignee(c, t.channel_id, b.assignee) : t.assignee;
  await c.env.DB.prepare("UPDATE tasks SET title = ?, detail = ?, status = ?, priority = ?, assignee = ?, due = ?, sort = ?, updated_at = ?, done_at = ? WHERE id = ?").bind(
    b.title !== undefined ? str(b.title, 200) || t.title : t.title, b.detail !== undefined ? str(b.detail, 4000) || null : t.detail, status,
    PRIORITIES.includes(b.priority) ? b.priority : t.priority, assignee, b.due !== undefined ? (/^\d{4}-\d{2}-\d{2}$/.test(b.due || "") ? b.due : null) : t.due,
    Number.isFinite(b.sort) ? b.sort : t.sort, now(), status === "done" ? t.done_at || now() : null, t.id).run();
  if (assignee && assignee !== t.assignee) await addActivity(c.env, [assignee], { kind: "task", actor: m.id, channel: t.channel_id, ref: t.id, text: `${m.name} assigned you a task: ${t.title}` });
  if (status === "done" && t.status !== "done") { await sysMsg(c.env, t.channel_id, `${m.name} completed: ${t.title}`, "task", { task: t.id }); await notify(c.env, t.channel_id, "task", `Done in ${x.ch.name}: ${t.title}`); }
  return c.json({ ok: true });
});
ws.delete("/tasks/:id", async (c) => {
  const m = me(c);
  const t: any = await c.env.DB.prepare("SELECT * FROM tasks WHERE id = ?").bind(c.req.param("id")).first();
  if (!t) throw err("Task not found.", 404);
  const x = await channelFor(c, t.channel_id);
  if (t.created_by !== m.id && !canManage(m, x)) throw err("Only the person who created the task, or the channel's owner, can delete it.", 403);
  await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(t.id).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ meetings
const MEET = "https://meet.kayaksa.com";
ws.get("/meetings", async (c) => {
  const m = me(c);
  const from = new Date(Date.now() - 3 * 3_600_000).toISOString();
  const { results } = await c.env.DB.prepare(`SELECT m.id, m.title, m.kind, m.host_name, m.host_email, m.starts_at, m.duration_min, m.status, m.channel_id, ch.name channel_name FROM meetings m LEFT JOIN channels ch ON ch.id = m.channel_id
    WHERE m.status IN ('scheduled','live') AND m.parent_id IS NULL AND ((m.starts_at IS NULL AND m.created_at >= ?) OR m.starts_at >= ? OR m.status = 'live')
      AND (m.host_email = ? OR m.invitees LIKE ? OR m.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?))
    ORDER BY COALESCE(m.starts_at, m.created_at) LIMIT 100`).bind(new Date(Date.now() - 12 * 3_600_000).toISOString(), from, m.email, `%"${m.email}"%`, m.id).all<any>();
  const recent = (await c.env.DB.prepare(`SELECT m.id, m.title, m.kind, m.started_at, m.ended_at, m.channel_id, (SELECT 1 FROM minutes WHERE meeting_id = m.id) has_minutes FROM meetings m
    WHERE m.status = 'ended' AND m.parent_id IS NULL AND (m.host_email = ? OR m.invitees LIKE ? OR m.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?)) ORDER BY m.ended_at DESC LIMIT 20`).bind(m.email, `%"${m.email}"%`, m.id).all<any>()).results;
  return c.json({ upcoming: results, recent });
});
ws.post("/meetings", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 16_384);
  let chId: string | null = str(b.channel_id, 40) || null;
  let ch: any = null;
  if (chId) ch = (await channelFor(c, chId, { join: true })).ch;
  if (!isEmp(m) && !chId) throw err("Start meetings from a conversation you share with Kayak.", 403);
  const kinds = isEmp(m) ? ["meeting", "client", "webinar", "townhall"] : ["meeting"];
  const kind = kinds.includes(b.kind) ? b.kind : ch?.external ? "client" : "meeting";
  const starts = b.startsAt ? new Date(b.startsAt) : null;
  if (starts && isNaN(+starts)) throw err("Check the date and time.");
  const invitees = (Array.isArray(b.invitees) ? b.invitees : String(b.invitees || "").split(/[\s,;]+/)).map((e: string) => cleanEmail(e)).filter(Boolean).slice(0, 100);
  const id = newRoomId();
  const title = str(b.title, 140) || (ch ? (ch.kind === "dm" ? "Call" : ch.name) : "Meeting");
  await c.env.DB.prepare("INSERT INTO meetings (id, title, kind, host_email, host_name, starts_at, duration_min, lobby, invitees, status, created_by, created_at, channel_id) VALUES (?,?,?,?,?,?,?,?,?,'scheduled',?,?,?)")
    .bind(id, title, kind, m.email, m.name, starts ? starts.toISOString() : null, Math.min(480, Math.max(15, Number(b.duration) || 30)), kind === "client" || kind === "webinar" || kind === "townhall" || b.lobby ? 1 : 0, JSON.stringify(invitees), m.id, now(), chId).run();
  if (chId) await sysMsg(c.env, chId, starts ? `${m.name} scheduled “${title}” for ${starts.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST.` : `${m.name} started a meeting.`, "meeting", { meeting: id, title, startsAt: starts?.toISOString() || null });
  await auditFull(c as any, c.env.DB, m.id, "meet.ws.meeting.created", { id, kind, channel: chId, invitees: invitees.length });
  if (invitees.length) {
    const { results: inv } = await c.env.DB.prepare(`SELECT id FROM members WHERE email IN (${invitees.map(() => "?").join(",")})`).bind(...invitees).all<any>();
    await addActivity(c.env, inv.map((r: any) => r.id), { kind: "meeting", actor: m.id, channel: chId, ref: id, text: `${m.name} invited you to “${title}”${starts ? ` on ${starts.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST` : ""}` });
  }
  if (starts) c.executionCtx.waitUntil(pushMeeting(c.env, id).catch(() => {})); // into connected Outlook / Google calendars
  return c.json({ id, url: `/${id}` });
});
ws.get("/meetings/:id", async (c) => {
  const m = me(c);
  const mt: any = await c.env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(c.req.param("id")).first();
  if (!mt || !(await mayJoin(c.env, m, mt))) throw err("Meeting not found.", 404);
  const minutes = await c.env.DB.prepare("SELECT summary, created_at FROM minutes WHERE meeting_id = ?").bind(mt.id).first();
  const host = mt.host_email === m.email;
  let guestLink: string | null = null;
  if (host && c.env.MEET_SIGNING_KEY) {
    const until = Math.max(Date.now(), mt.starts_at ? Date.parse(mt.starts_at) : 0) + 14 * 86_400_000;
    guestLink = `${MEET}/${mt.id}?t=${await signMeet(c.env.MEET_SIGNING_KEY, { r: mt.id, role: "guest", x: until })}`;
  }
  return c.json({ meeting: { ...mt, invitees: JSON.parse(mt.invitees || "[]") }, host, minutes, guestLink, url: `${MEET}/${mt.id}` });
});
ws.post("/meetings/:id/cancel", async (c) => {
  const m = me(c);
  const mt: any = await c.env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(c.req.param("id")).first();
  if (!mt || mt.host_email !== m.email) throw err("Only the host can cancel this meeting.", 403);
  await c.env.DB.prepare("UPDATE meetings SET status = 'cancelled' WHERE id = ?").bind(mt.id).run();
  c.executionCtx.waitUntil(removeMeeting(c.env, mt.id).catch(() => {}));
  if (mt.channel_id) await sysMsg(c.env, mt.channel_id, `${m.name} cancelled “${mt.title}”.`);
  return c.json({ ok: true });
});
ws.get("/meetings/:id/ics", async (c) => {
  const m = me(c);
  const mt: any = await c.env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(c.req.param("id")).first();
  if (!mt || !mt.starts_at || !(await mayJoin(c.env, m, mt))) return c.text("Not found", 404);
  const d = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const end = new Date(Date.parse(mt.starts_at) + mt.duration_min * 60_000).toISOString();
  const esc = (s: string) => s.replace(/[\\;,]/g, (x) => "\\" + x).replace(/\n/g, "\\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kayak Strategic Advisors//Meet by Kayak//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${mt.id}@meet.kayaksa.com`, `DTSTAMP:${d(now())}`, `DTSTART:${d(mt.starts_at)}`, `DTEND:${d(end)}`, `SUMMARY:${esc(mt.title)}`,
    `DESCRIPTION:${esc(`Join on Meet by Kayak: ${MEET}/${mt.id}\nSign in at ${MEET}/login, or open the app.`)}`, `LOCATION:${MEET}/${mt.id}`, `URL:${MEET}/${mt.id}`,
    `ORGANIZER;CN=${esc(mt.host_name)}:mailto:${mt.host_email}`, "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:Meeting starts in 10 minutes", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="meeting-${mt.id}.ics"` } });
});

/** Who may join a meeting with their Meet by Kayak account (no invitation link needed). */
export async function mayJoin(env: Env, m: Member, mt: any): Promise<boolean> {
  if (!mt || mt.status === "cancelled") return false;
  if (mt.host_email === m.email) return true;
  if (m.kind === "employee") return true;
  if (JSON.parse(mt.invitees || "[]").includes(m.email)) return true;
  const chId = mt.channel_id || (mt.parent_id ? (await env.DB.prepare("SELECT channel_id FROM meetings WHERE id = ?").bind(mt.parent_id).first<any>())?.channel_id : null);
  if (chId && (await env.DB.prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND member_id = ?").bind(chId, m.id).first())) return true;
  return false;
}

// ------------------------------------------------------------------ Kayak AI: summaries and translation
export const LANGS: Record<string, string> = {
  en: "English", hi: "Hindi", mr: "Marathi", gu: "Gujarati", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", bn: "Bengali", pa: "Punjabi", ur: "Urdu",
  ar: "Arabic", fr: "French", de: "German", es: "Spanish", it: "Italian", pt: "Portuguese", nl: "Dutch", ru: "Russian", uk: "Ukrainian", pl: "Polish", tr: "Turkish",
  fa: "Persian", he: "Hebrew", ja: "Japanese", zh: "Chinese", ko: "Korean", id: "Indonesian", ms: "Malay", th: "Thai", vi: "Vietnamese", sw: "Swahili", el: "Greek",
  sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian", cs: "Czech", ro: "Romanian", hu: "Hungarian", ne: "Nepali", si: "Sinhala", fil: "Filipino",
};
ws.post("/translate", async (c) => {
  if (!c.env.AI) throw err("Translation isn't available yet.", 503);
  const b = await readJson<any>(c, 16_384);
  const text = str(b.text, 4000), to = LANGS[b.to] ? b.to : "en";
  if (!text) return c.json({ text: "" });
  const r: any = await c.env.AI.run("@cf/meta/m2m100-1.2b" as any, { text, target_lang: to } as any).catch(() => null);
  return c.json({ text: String(r?.translated_text || "").trim() || text, to });
});
ws.post("/channels/:id/summary", async (c) => {
  if (!c.env.AI) throw err("Kayak AI isn't available yet.", 503);
  const m = me(c);
  if (!(await rateLimit(c.env.DB, `ai:${m.id}`, 20, 600))) throw err("Kayak AI needs a short break. Try again in a few minutes.", 429);
  const x = await channelFor(c, c.req.param("id"));
  const b = await readJson<any>(c, 1024);
  const parent = Number(b.parent_id) || 0;
  const since = parent ? 0 : Number(b.since) || 0;
  const { results } = await (parent
    ? c.env.DB.prepare("SELECT x.body, x.created_at, mb.name author FROM messages x LEFT JOIN members mb ON mb.id = x.member_id WHERE x.channel_id = ? AND (x.id = ? OR x.parent_id = ?) AND x.deleted = 0 AND x.kind IN ('text','file') ORDER BY x.id LIMIT 400").bind(x.ch.id, parent, parent)
    : c.env.DB.prepare("SELECT * FROM (SELECT x.body, x.created_at, mb.name author, x.id FROM messages x LEFT JOIN members mb ON mb.id = x.member_id WHERE x.channel_id = ? AND x.id > ? AND x.deleted = 0 AND x.kind IN ('text','file') ORDER BY x.id DESC LIMIT 300) ORDER BY id").bind(x.ch.id, since)).all<any>();
  if (results.length < 2) return c.json({ summary: "There isn't enough conversation to summarise yet." });
  const convo = results.map((r: any) => `[${r.created_at.slice(0, 16).replace("T", " ")}] ${r.author || "Kayak"}: ${r.body}`).join("\n").slice(-40_000);
  const lang = LANGS[b.lang] || "English";
  const r: any = await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any, {
    messages: [
      { role: "system", content: `You summarise workplace conversations for Kayak Strategic Advisors. Write in ${lang} (British English if English). Output Markdown: a 2-4 sentence summary, then "Decisions", "Action items" (owner - action - due date if stated) and "Open questions". Use only what is in the conversation; never invent names, numbers or dates. Omit empty sections.` },
      { role: "user", content: `${parent ? "Thread" : "Conversation"} in “${x.ch.kind === "dm" ? "a direct message" : x.ch.name}”:\n\n${convo}` },
    ], max_tokens: 900,
  } as any);
  const summary = String(r?.response || "").trim() || "The summary couldn't be written. Try again.";
  await auditFull(c as any, c.env.DB, m.id, "meet.ws.ai.summary", { channel: x.ch.id, messages: results.length });
  if (b.post && isEmp(m)) { await sysMsg(c.env, x.ch.id, summary, "recap", { by: m.name }); await notify(c.env, x.ch.id, "recap", `Recap of ${x.ch.name}:\n${summary}`); }
  return c.json({ summary, count: results.length });
});
ws.get("/meetings/:id/minutes", async (c) => {
  const m = me(c);
  const mt: any = await c.env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(c.req.param("id")).first();
  if (!mt || !(await mayJoin(c.env, m, mt))) throw err("Meeting not found.", 404);
  const mi = await c.env.DB.prepare("SELECT summary, created_at FROM minutes WHERE meeting_id = ?").bind(mt.id).first();
  return c.json({ title: mt.title, minutes: mi });
});

// ------------------------------------------------------------------ integrations (outgoing only)
ws.post("/channels/:id/integrations", employeeOnly, async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"));
  if (!canManage(m, x)) throw err("Only the channel's owner can connect apps.", 403);
  const b = await readJson<any>(c, 4096);
  if (b.confirm !== true) throw err("Confirm that this channel's recaps and task updates may be sent to the other app.");
  const url = str(b.url, 500);
  let u: URL;
  try { u = new URL(url); } catch { throw err("Paste the full https:// address."); }
  const host = u.hostname;
  if (u.protocol !== "https:" || /^[\d.]+$/.test(host) || host.includes(":") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw err("Use a public https:// address.");
  const kind = b.kind === "slack" ? "slack" : "webhook";
  if (kind === "slack" && host !== "hooks.slack.com") throw err("Slack incoming-webhook addresses start with https://hooks.slack.com/.");
  const signing = kind === "webhook" ? randomToken(24) : "";
  const events = (Array.isArray(b.events) ? b.events : ["recap", "task", "meeting"]).filter((e: string) => ["recap", "task", "meeting"].includes(e));
  const id = id8();
  await c.env.DB.prepare("INSERT INTO integrations (id, channel_id, kind, label, secret, events, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, x.ch.id, kind, str(b.label, 60) || (kind === "slack" ? "Slack" : host), await seal(JSON.stringify({ url, signing }), intKey(c.env)), JSON.stringify(events), m.id, now()).run();
  await auditFull(c as any, c.env.DB, m.id, "meet.ws.integration.added", { channel: x.ch.id, kind, host });
  await sysMsg(c.env, x.ch.id, `${m.name} connected ${kind === "slack" ? "Slack" : host}. Recaps and task updates from this channel will be sent there.`);
  return c.json({ id, signingSecret: signing || null });
});
ws.delete("/channels/:id/integrations/:iid", employeeOnly, async (c) => {
  const m = me(c);
  const x = await channelFor(c, c.req.param("id"));
  if (!canManage(m, x)) throw err("Only the channel's owner can disconnect apps.", 403);
  await c.env.DB.prepare("DELETE FROM integrations WHERE id = ? AND channel_id = ?").bind(c.req.param("iid"), x.ch.id).run();
  await auditFull(c as any, c.env.DB, m.id, "meet.ws.integration.removed", { channel: x.ch.id });
  return c.json({ ok: true });
});
const intKey = (env: Env) => { if (!env.MEET_SIGNING_KEY) throw err("Meet isn't fully set up yet.", 503); return env.MEET_SIGNING_KEY + ":integrations"; };
async function hmacHex(secret: string, body: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function notify(env: Env, chId: string, event: string, text: string) {
  if (!env.MEET_SIGNING_KEY) return;
  const { results } = await env.DB.prepare("SELECT * FROM integrations WHERE channel_id = ?").bind(chId).all<any>();
  for (const i of results) {
    if (!JSON.parse(i.events || "[]").includes(event)) continue;
    try {
      const { url, signing } = JSON.parse(await unseal(i.secret, intKey(env)));
      const body = i.kind === "slack" ? JSON.stringify({ text: text.slice(0, 3500) }) : JSON.stringify({ event, channel: chId, text, at: now() });
      const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "MeetByKayak/1.0" };
      if (signing) headers["X-Kayak-Signature"] = "sha256=" + (await hmacHex(signing, body));
      const r = await fetch(url, { method: "POST", headers, body, redirect: "manual" });
      await env.DB.prepare("UPDATE integrations SET last_status = ? WHERE id = ?").bind(`${r.status} at ${now()}`, i.id).run();
    } catch (e: any) {
      await env.DB.prepare("UPDATE integrations SET last_status = ? WHERE id = ?").bind(`failed at ${now()}`, i.id).run();
    }
  }
}

// ------------------------------------------------------------------ To-Do and Planner
const PRI = ["low", "normal", "high", "urgent"];
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
async function todoChannel(c: any, chId: unknown) {
  if (!chId) return null;
  await channelFor(c, String(chId)); // throws if the person is not in it
  return String(chId);
}
ws.get("/todos", async (c) => {
  const m = me(c);
  const { results } = await c.env.DB.prepare(`SELECT t.*, ch.name channel_name FROM todos t LEFT JOIN channels ch ON ch.id = t.channel_id
    WHERE t.member_id = ? AND (t.done = 0 OR t.done_at > ?) ORDER BY t.done, t.sort, COALESCE(t.due,'9999'), t.created_at`).bind(m.id, new Date(Date.now() - 30 * 86_400_000).toISOString()).all<any>();
  return c.json({ todos: results });
});
ws.post("/todos", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 8192);
  const text = str(b.text, 400);
  if (!text) throw err("Write the to-do first.");
  if (!(await rateLimit(c.env.DB, `todo:${m.id}`, 120, 60))) throw err("Slow down a moment.", 429);
  const id = id8();
  await c.env.DB.prepare("INSERT INTO todos (id, member_id, text, note, kind, channel_id, due, priority, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, m.id, text, str(b.note, 2000) || null, b.kind === "deliverable" ? "deliverable" : "todo", await todoChannel(c, b.channel_id), isDate(b.due) ? b.due : null, PRI.includes(b.priority) ? b.priority : "normal", now(), now()).run();
  return c.json({ id });
});
ws.patch("/todos/:id", async (c) => {
  const m = me(c);
  const t: any = await c.env.DB.prepare("SELECT * FROM todos WHERE id = ? AND member_id = ?").bind(c.req.param("id"), m.id).first();
  if (!t) throw err("To-do not found.", 404);
  const b = await readJson<any>(c, 8192);
  const done = b.done === undefined ? t.done : b.done ? 1 : 0;
  await c.env.DB.prepare("UPDATE todos SET text = ?, note = ?, kind = ?, channel_id = ?, due = ?, priority = ?, done = ?, done_at = ?, sort = ?, updated_at = ? WHERE id = ?").bind(
    b.text !== undefined ? str(b.text, 400) || t.text : t.text, b.note !== undefined ? str(b.note, 2000) || null : t.note,
    b.kind !== undefined ? (b.kind === "deliverable" ? "deliverable" : "todo") : t.kind,
    b.channel_id !== undefined ? await todoChannel(c, b.channel_id) : t.channel_id,
    b.due !== undefined ? (isDate(b.due) ? b.due : null) : t.due, PRI.includes(b.priority) ? b.priority : t.priority,
    done, done ? t.done_at || now() : null, Number.isFinite(b.sort) ? b.sort : t.sort, now(), t.id).run();
  return c.json({ ok: true });
});
ws.delete("/todos/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM todos WHERE id = ? AND member_id = ?").bind(c.req.param("id"), me(c).id).run();
  return c.json({ ok: true });
});
// The Planner: everything of mine with a date - to-dos, deliverables, tasks assigned to me, meetings —
// so deadlines and client deliverables are met. Read-only aggregate; items are edited where they live.
ws.get("/planner", async (c) => {
  const m = me(c);
  const D = c.env.DB;
  const soon = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  const [todos, tasks, meetings] = await D.batch([
    D.prepare("SELECT t.id, t.text title, t.kind, t.due, t.priority, t.done, ch.name channel FROM todos t LEFT JOIN channels ch ON ch.id = t.channel_id WHERE t.member_id = ? AND t.due IS NOT NULL AND t.done = 0").bind(m.id),
    D.prepare("SELECT t.id, t.title, t.due, t.priority, t.status, ch.name channel, ch.id channel_id FROM tasks t JOIN channels ch ON ch.id = t.channel_id WHERE t.assignee = ? AND t.due IS NOT NULL AND t.status != 'done' AND t.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?)").bind(m.id, m.id),
    D.prepare(`SELECT m2.id, m2.title, m2.kind, substr(m2.starts_at,1,10) due, m2.starts_at, ch.name channel FROM meetings m2 LEFT JOIN channels ch ON ch.id = m2.channel_id
      WHERE m2.status = 'scheduled' AND m2.parent_id IS NULL AND m2.starts_at IS NOT NULL AND substr(m2.starts_at,1,10) <= ? AND (m2.host_email = ? OR m2.invitees LIKE ? OR m2.channel_id IN (SELECT channel_id FROM channel_members WHERE member_id = ?))`).bind(soon, m.email, `%"${m.email}"%`, m.id),
  ]);
  const items = [
    ...todos.results.map((t: any) => ({ type: t.kind, id: t.id, title: t.title, due: t.due, priority: t.priority, done: !!t.done, channel: t.channel })),
    ...tasks.results.map((t: any) => ({ type: "task", id: t.id, title: t.title, due: t.due, priority: t.priority, channel: t.channel, channel_id: t.channel_id })),
    ...meetings.results.map((t: any) => ({ type: "meeting", id: t.id, title: t.title, due: t.due, startsAt: t.starts_at, channel: t.channel })),
    ...(await syncMember(c.env, m).catch(() => [])).filter((e) => e.start.slice(0, 10) <= soon && e.end >= new Date().toISOString()).map((e) => ({ type: "calendar", id: e.id, title: e.title, due: e.start.slice(0, 10), startsAt: e.allDay ? null : e.start, link: e.link, provider: e.provider })),
  ].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  return c.json({ items, today: new Date().toISOString().slice(0, 10) });
});

// ------------------------------------------------------------------ Cloudflare Realtime usage this month (Kayak team)
ws.get("/usage", employeeOnly, async (c) => c.json(usageView(await readUsage(c.env), c.env)));

// ------------------------------------------------------------------ Kayakers: whiteboards and games (Kayak team only)
const SPACE_KINDS = ["board", "chess", "carrom", "four", "snakes", "ludo", "ttt", "estates", "flip", "words", "rows"];
ws.get("/kayakers", employeeOnly, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, kind, title, mode, created_by, created_by_name, created_at, updated_at FROM spaces WHERE archived = 0 ORDER BY updated_at DESC LIMIT 200").all<any>();
  return c.json({ spaces: results });
});
ws.post("/kayakers", employeeOnly, async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 2048);
  const kind = SPACE_KINDS.includes(b.kind) ? b.kind : "board";
  const def = { board: "Whiteboard", chess: "Chess", carrom: "Carrom", four: "Kayak Four", snakes: "Snakes & Ladders", ludo: "Ludo", ttt: "Tic Tac Toe", estates: "Kayak Estates", flip: "Kayak Flip", words: "Kayak Wordsmith", rows: "Kayak Rows" } as Record<string, string>;
  const title = str(b.title, 80) || `${def[kind]} · ${m.name.split(" ")[0]}`;
  const id = id8();
  await c.env.DB.prepare("INSERT INTO spaces (id, kind, title, mode, created_by, created_by_name, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, kind, title, b.mode === "ai" ? "ai" : "team", m.id, m.name, now(), now()).run();
  return c.json({ id });
});
ws.get("/kayakers/:id", employeeOnly, async (c) => {
  const sp = await c.env.DB.prepare("SELECT id, kind, title, mode, created_by, created_by_name, created_at FROM spaces WHERE id = ? AND archived = 0").bind(c.req.param("id")).first();
  if (!sp) throw err("Not found.", 404);
  return c.json({ space: sp, me: me(c) });
});
ws.delete("/kayakers/:id", employeeOnly, async (c) => {
  const sp: any = await c.env.DB.prepare("SELECT created_by FROM spaces WHERE id = ?").bind(c.req.param("id")).first();
  if (!sp) throw err("Not found.", 404);
  if (sp.created_by !== me(c).id) throw err("Only the person who created it can remove it.", 403);
  await c.env.DB.prepare("UPDATE spaces SET archived = 1 WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ people and data rights
ws.get("/people", async (c) => c.json({ people: await visiblePeople(c.env, me(c)) }));
ws.post("/people/:id/reset", employeeOnly, async (c) => {
  const m = me(c);
  const t: any = await c.env.DB.prepare("SELECT * FROM members WHERE id = ? AND kind = 'client'").bind(c.req.param("id")).first();
  if (!t) throw err("Client not found.", 404);
  const co = await coMemberIds(c.env, m.id);
  if (!co.has(t.id) && t.invited_by !== m.id) throw err("You can reset access only for clients you work with.", 403);
  const link = await resetClient(c.env, t.id);
  await auditFull(c as any, c.env.DB, m.id, "meet.ws.client.reset", { client: t.id });
  return c.json({ link });
});
ws.post("/people/:id/disable", employeeOnly, async (c) => {
  const m = me(c);
  const t: any = await c.env.DB.prepare("SELECT * FROM members WHERE id = ? AND kind = 'client'").bind(c.req.param("id")).first();
  if (!t) throw err("Client not found.", 404);
  const co = await coMemberIds(c.env, m.id);
  if (!co.has(t.id) && t.invited_by !== m.id) throw err("You can turn off access only for clients you work with.", 403);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE members SET status = 'disabled', invite_hash = NULL WHERE id = ?").bind(t.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(t.id),
  ]);
  await auditFull(c as any, c.env.DB, m.id, "meet.ws.client.disabled", { client: t.id });
  return c.json({ ok: true });
});
ws.patch("/me", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 1024);
  const lang = LANGS[b.lang] ? b.lang : m.lang;
  const name = m.kind === "client" ? str(b.name, 80) || m.name : m.name; // employees' names come from Kayak Internal
  await c.env.DB.prepare("UPDATE members SET lang = ?, name = ? WHERE id = ?").bind(lang, name, m.id).run();
  return c.json({ ok: true });
});
// Right of access (DPDP Act s.11; GDPR Art. 15 and 20): a copy of what Meet holds about you.
ws.get("/me/export", async (c) => {
  const m = me(c);
  const D = c.env.DB;
  const [prof, msgs, tasks, files, att] = await D.batch([
    D.prepare("SELECT id, email, name, org, kind, status, lang, notice_version, created_at, last_seen FROM members WHERE id = ?").bind(m.id),
    D.prepare("SELECT x.id, ch.name channel, x.body, x.created_at, x.edited_at FROM messages x JOIN channels ch ON ch.id = x.channel_id WHERE x.member_id = ? AND x.deleted = 0 ORDER BY x.id").bind(m.id),
    D.prepare("SELECT title, status, due, created_at FROM tasks WHERE assignee = ? OR created_by = ?").bind(m.id, m.id),
    D.prepare("SELECT name, size, created_at FROM files WHERE member_id = ? AND deleted = 0").bind(m.id),
    D.prepare("SELECT meeting_id, joined_at, left_at FROM attendance WHERE email = ?").bind(m.email),
  ]);
  await auditFull(c as any, D, m.id, "meet.ws.export", null);
  return new Response(JSON.stringify({ exported_at: now(), profile: prof.results[0], messages: msgs.results, tasks: tasks.results, files: files.results, meetings_attended: att.results }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="meet-by-kayak-my-data.json"` },
  });
});
// Right to erasure for clients (DPDP Act s.12; GDPR Art. 17). Employees' accounts follow Kayak Internal.
// The account and its identifiers are erased at once. What the person wrote in shared conversations
// stays, under "Former participant", because it forms part of the engagement record Kayak may have to
// keep (DPDP Act s.8(7)); the Data Protection Officer erases that too on request where the law allows.
ws.post("/me/erase", async (c) => {
  const m = me(c);
  if (m.kind !== "client") throw err("Kayak team accounts are managed in Kayak Internal.", 400);
  const b = await readJson<any>(c, 512);
  if (b.confirm !== "ERASE") throw err("Type ERASE to confirm.");
  const anon = `erased-${(await sha256hex(m.id)).slice(0, 12)}@invalid`;
  const D = c.env.DB;
  await D.batch([
    D.prepare("UPDATE tasks SET assignee = NULL WHERE assignee = ?").bind(m.id),
    D.prepare("DELETE FROM channel_members WHERE member_id = ?").bind(m.id),
    D.prepare("UPDATE attendance SET email = NULL, name = 'Former participant' WHERE email = ?").bind(m.email),
    D.prepare("UPDATE meetings SET invitees = REPLACE(invitees, ?, ?) WHERE invitees LIKE ?").bind(`"${m.email}"`, `"${anon}"`, `%"${m.email}"%`),
    D.prepare("UPDATE members SET email = ?, name = 'Former participant', org = NULL, totp_secret = NULL, totp_last = NULL, invite_hash = NULL, status = 'disabled' WHERE id = ?").bind(anon, m.id),
    D.prepare("DELETE FROM sessions WHERE user_id = ?").bind(m.id),
  ]);
  await auditFull(c as any, D, null, "meet.ws.erased", { member: m.id });
  return c.json({ ok: true });
});
