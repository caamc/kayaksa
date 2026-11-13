// Profiles, photos, professional status, the Activity feed, settings synced across devices, and Meet Calls.
//
// Privacy: people see the profile and photo of someone only when they could already see them in the
// workspace (they share a conversation, or both work at Kayak). Phone numbers are shown only to Kayak
// colleagues and to people the member shares a conversation with.
import { Hono } from "hono";
import { readJson, str, rateLimit } from "../../../packages/core/src/http";
import { newRoomId, signMeet } from "../../../packages/core/src/meettoken";
import { sha256hex } from "../../../packages/core/src/crypto";
import { mayJoin } from "./workspace";
import { auditFull } from "../../../packages/core/src/shield";
import { needMember, now, type Member } from "./auth";
import type { Env } from "./env";

type V = { Bindings: Env; Variables: { member: Member } };
export const people = new Hono<V>();
people.use("*", needMember);

const err = (msg: string, status = 400) => Object.assign(new Error(msg), { status });
const me = (c: any): Member => c.get("member");
people.onError((e: any, c) => c.json({ error: e.status ? e.message : "Something went wrong. Try again." }, e.status || 500));

export const PRESENCE = ["auto", "available", "busy", "dnd", "brb", "away", "offline"] as const;
const MAX_PHOTO = 2 * 1024 * 1024;

async function canSee(env: Env, viewer: Member, id: string): Promise<boolean> {
  if (viewer.id === id) return true;
  const p: any = await env.DB.prepare("SELECT kind FROM members WHERE id = ? AND status != 'disabled'").bind(id).first();
  if (!p) return false;
  if (viewer.kind === "employee" && p.kind === "employee") return true;
  return !!(await env.DB.prepare("SELECT 1 FROM channel_members a JOIN channel_members b ON a.channel_id = b.channel_id WHERE a.member_id = ? AND b.member_id = ? LIMIT 1").bind(viewer.id, id).first());
}

/** What everyone else sees as someone's availability right now. */
export function presenceOf(p: any): string {
  const t = Date.now();
  if (p.ooo_until && Date.parse(p.ooo_until) > t) return "ooo";
  const set = p.presence && p.presence !== "auto" && (!p.presence_until || Date.parse(p.presence_until) > t) ? p.presence : "auto";
  const online = p.last_seen && t - Date.parse(p.last_seen) < 5 * 60_000;
  if (set === "offline") return "offline";
  if (set !== "auto") return online || set === "dnd" ? set : "offline";
  if (!online) return "offline";
  return t - Date.parse(p.last_seen) > 2 * 60_000 ? "away" : "available";
}
export function statusOf(p: any) {
  const live = p.status_text && (!p.status_until || Date.parse(p.status_until) > Date.now());
  return {
    presence: presenceOf(p),
    custom: live ? { text: p.status_text, emoji: p.status_emoji || "", until: p.status_until || null } : null,
    ooo: p.ooo_until && Date.parse(p.ooo_until) > Date.now() ? { until: p.ooo_until, note: p.ooo_note || "" } : null,
    avatar: p.avatar_key ? `/api/wsx/avatar/${p.id}?v=${p.avatar_v || 0}` : null,
    title: p.title || "",
  };
}

/** Adds an Activity entry for each person in `to` (never for the actor themselves). */
export async function addActivity(env: Env, to: string[], e: { kind: string; actor?: string | null; channel?: string | null; ref?: string | number | null; text: string }) {
  const ids = [...new Set(to)].filter((i) => i && i !== e.actor).slice(0, 200);
  if (!ids.length) return;
  const at = now();
  await env.DB.batch(ids.map((id) => env.DB.prepare("INSERT INTO activity (member_id, at, kind, actor_id, channel_id, ref, text) VALUES (?,?,?,?,?,?,?)")
    .bind(id, at, e.kind, e.actor || null, e.channel || null, e.ref == null ? null : String(e.ref), e.text.slice(0, 300))));
}

/** Activity for a new message: @mentions, replies in threads you're part of, and direct messages. */
export async function messageActivity(env: Env, author: Member, ch: any, msgId: number, body: string, parent: number | null) {
  const { results } = await env.DB.prepare("SELECT m.id, m.name, cm.notify FROM channel_members cm JOIN members m ON m.id = cm.member_id WHERE cm.channel_id = ? AND cm.muted = 0").bind(ch.id).all<any>();
  const quietIds = new Set(results.filter((p) => p.notify === "mentions").map((p) => p.id)); // "@mentions only"
  const snippet = body.replace(/\s+/g, " ").slice(0, 140);
  const where = ch.kind === "dm" ? "" : ` in #${ch.name}`;
  const everyone = /(^|\s)@(channel|everyone)\b/i.test(body) && ch.kind !== "dm";
  const mentioned = results.filter((p) => everyone || body.includes("@" + p.name)).map((p) => p.id);
  if (mentioned.length) await addActivity(env, mentioned, { kind: "mention", actor: author.id, channel: ch.id, ref: msgId, text: `${author.name} mentioned ${everyone ? "everyone" : "you"}${where}: ${snippet}` });
  if (parent) {
    const { results: t } = await env.DB.prepare("SELECT DISTINCT member_id id FROM messages WHERE (id = ? OR parent_id = ?) AND member_id IS NOT NULL").bind(parent, parent).all<any>();
    const ids = t.map((r) => r.id).filter((i) => !mentioned.includes(i) && !quietIds.has(i));
    await addActivity(env, ids, { kind: "reply", actor: author.id, channel: ch.id, ref: parent, text: `${author.name} replied${where}: ${snippet}` });
  } else if (ch.kind === "dm") {
    await addActivity(env, results.map((p) => p.id).filter((i) => !mentioned.includes(i) && !quietIds.has(i)), { kind: "dm", actor: author.id, channel: ch.id, ref: msgId, text: `${author.name}: ${snippet}` });
  }
}

/** Announcements reach everyone in the channel (except people who turned the channel off). */
export async function announceActivity(env: Env, author: Member, ch: any, msgId: number, title: string) {
  const { results } = await env.DB.prepare("SELECT member_id id FROM channel_members WHERE channel_id = ? AND muted = 0").bind(ch.id).all<any>();
  await addActivity(env, results.map((r) => r.id), { kind: "mention", actor: author.id, channel: ch.id, ref: msgId, text: `Announcement in #${ch.name} from ${author.name}: ${title}` });
}

// ------------------------------------------------------------------ profiles
people.get("/profile/:id", async (c) => {
  const m = me(c), id = c.req.param("id");
  if (!(await canSee(c.env, m, id))) throw err("Profile not found.", 404);
  const p: any = await c.env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first();
  const close = m.kind === "employee" || id === m.id || p.kind === m.kind;
  return c.json({
    id: p.id, name: p.name, email: m.kind === "employee" || p.kind === "employee" || p.id === m.id ? p.email : undefined, org: p.kind === "employee" ? "Kayak Strategic Advisors" : p.org || "",
    kind: p.kind, dept: p.dept || "", phone: close ? p.phone || "" : "", location: p.location || "", pronouns: p.pronouns || "", bio: p.bio || "", tz: p.tz || "",
    links: p.links ? JSON.parse(p.links) : [], ...statusOf(p), last_seen: p.last_seen, lang: p.lang, editable: p.id === m.id, nameFromInternal: p.kind === "employee",
  });
});
people.patch("/profile", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 8192);
  const links = (Array.isArray(b.links) ? b.links : []).slice(0, 5).map((l: any) => ({ label: str(l?.label, 40), url: str(l?.url, 300) })).filter((l: any) => l.label && /^https:\/\/[^\s<>"]+$/i.test(l.url));
  const tz = str(b.tz, 60);
  if (tz) { try { new Intl.DateTimeFormat("en", { timeZone: tz }); } catch { throw err("Pick a time zone from the list."); } }
  const phone = str(b.phone, 30);
  if (phone && !/^\+?[0-9 ()-]{6,30}$/.test(phone)) throw err("Check the phone number: digits, spaces, + and - only.");
  const name = m.kind === "client" ? str(b.name, 80) || m.name : m.name; // employees' names come from Kayak Internal
  await c.env.DB.prepare("UPDATE members SET name = ?, title = ?, dept = ?, phone = ?, location = ?, pronouns = ?, bio = ?, tz = ?, links = ? WHERE id = ?")
    .bind(name, str(b.title, 80) || null, str(b.dept, 80) || null, phone || null, str(b.location, 80) || null, str(b.pronouns, 30) || null, str(b.bio, 500) || null, tz || null, JSON.stringify(links), m.id).run();
  await auditFull(c as any, c.env.DB, m.id, "meet.profile.updated", null);
  return c.json({ ok: true });
});

// Photos: PNG, JPEG or WebP up to 2 MB. The app crops and resizes to 512 px before upload.
const isImage = (b: Uint8Array) =>
  (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ? "image/png" :
  (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ? "image/jpeg" :
  (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) ? "image/webp" : null;
people.put("/avatar", async (c) => {
  const m = me(c);
  if (!(await rateLimit(c.env.DB, `avatar:${m.id}`, 10, 3600))) throw err("You've changed your photo a lot. Try again later.", 429);
  if (Number(c.req.header("Content-Length") || 0) > MAX_PHOTO + 1024) throw err("Photos can be up to 2 MB.", 413);
  const buf = new Uint8Array(await c.req.arrayBuffer());
  if (!buf.length || buf.length > MAX_PHOTO) throw err("Photos can be up to 2 MB.", 413);
  const type = isImage(buf);
  if (!type) throw err("Use a PNG, JPEG or WebP picture.");
  const key = `avatars/${m.id}`;
  await c.env.REC.put(key, buf, { httpMetadata: { contentType: type } });
  await c.env.DB.prepare("UPDATE members SET avatar_key = ?, avatar_v = avatar_v + 1 WHERE id = ?").bind(key, m.id).run();
  await auditFull(c as any, c.env.DB, m.id, "meet.profile.photo", { size: buf.length });
  return c.json({ ok: true });
});
people.delete("/avatar", async (c) => {
  const m = me(c);
  await c.env.REC.delete(`avatars/${m.id}`);
  await c.env.DB.prepare("UPDATE members SET avatar_key = NULL, avatar_v = avatar_v + 1 WHERE id = ?").bind(m.id).run();
  return c.json({ ok: true });
});
people.get("/avatar/:id", async (c) => {
  const m = me(c), id = c.req.param("id");
  if (!(await canSee(c.env, m, id))) return c.body(null, 404);
  const o = await c.env.REC.get(`avatars/${id}`);
  if (!o) return c.body(null, 404);
  return new Response(o.body, { headers: { "Content-Type": o.httpMetadata?.contentType || "image/png", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
});

// ------------------------------------------------------------------ status
const until = (v: any) => { if (!v) return null; const d = new Date(v); return isNaN(+d) || +d < Date.now() ? null : d.toISOString(); };
people.put("/status", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 2048);
  const presence = PRESENCE.includes(b.presence) ? b.presence : "auto";
  const text = str(b.text, 100), emoji = str(b.emoji, 8);
  await c.env.DB.prepare("UPDATE members SET presence = ?, presence_until = ?, status_text = ?, status_emoji = ?, status_until = ?, ooo_until = ?, ooo_note = ? WHERE id = ?")
    .bind(presence, presence === "auto" ? null : until(b.presenceUntil), text || null, text ? emoji || null : null, text ? until(b.until) : null, until(b.oooUntil), str(b.oooNote, 300) || null, m.id).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ settings synced across devices
people.get("/prefs", async (c) => {
  const r: any = await c.env.DB.prepare("SELECT prefs FROM members WHERE id = ?").bind(me(c).id).first();
  return c.json({ prefs: r?.prefs ? JSON.parse(r.prefs) : {} });
});
people.put("/prefs", async (c) => {
  const b = await readJson<any>(c, 16_384);
  const prefs = b && typeof b.prefs === "object" && !Array.isArray(b.prefs) ? b.prefs : {};
  const s = JSON.stringify(prefs);
  if (s.length > 12_000) throw err("Too many settings to save.");
  await c.env.DB.prepare("UPDATE members SET prefs = ? WHERE id = ?").bind(s, me(c).id).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ Activity
people.get("/activity", async (c) => {
  const m = me(c);
  // Clean-up runs now and then as people use Activity (Cloudflare limits scheduled jobs per account).
  if (Math.random() < 0.02) c.executionCtx.waitUntil(pruneActivity(c.env).catch(() => {}));
  const before = Number(c.req.query("before")) || 1e15;
  const kind = str(c.req.query("kind"), 20);
  const unread = c.req.query("unread") === "1";
  const { results } = await c.env.DB.prepare(`SELECT a.*, mb.name actor FROM activity a LEFT JOIN members mb ON mb.id = a.actor_id
    WHERE a.member_id = ? AND a.id < ? ${kind ? "AND a.kind = ?" : "AND ? = ?"} ${unread ? "AND a.read = 0" : ""} ORDER BY a.id DESC LIMIT 50`)
    .bind(m.id, before, kind || 1, kind || 1).all<any>();
  const n: any = await c.env.DB.prepare("SELECT COUNT(*) n FROM activity WHERE member_id = ? AND read = 0").bind(m.id).first();
  return c.json({ items: results, unread: n?.n || 0 });
});
people.post("/activity/read", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 4096);
  if (b.all) await c.env.DB.prepare("UPDATE activity SET read = 1 WHERE member_id = ? AND read = 0").bind(m.id).run();
  else {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Number.isFinite).slice(0, 100);
    if (ids.length) await c.env.DB.prepare(`UPDATE activity SET read = ? WHERE member_id = ? AND id IN (${ids.map(() => "?").join(",")})`).bind(b.unread ? 0 : 1, m.id, ...ids).run();
  }
  return c.json({ ok: true });
});
// Activity older than 90 days is deleted by the daily clean-up.
export async function pruneActivity(env: Env) {
  await env.DB.prepare("DELETE FROM activity WHERE at < ?").bind(new Date(Date.now() - 90 * 864e5).toISOString()).run();
  await env.DB.prepare("UPDATE calls SET state = 'missed', ended_at = ? WHERE state = 'ringing' AND started_at < ?").bind(now(), new Date(Date.now() - 120_000).toISOString()).run();
}

// ------------------------------------------------------------------ Meet Calls (internet / VoIP calls)
// A call is a private Meet room. Ringing reaches the other side through Activity and the live poll;
// it stops after 45 seconds and becomes a missed call.
const RING_MS = 45_000;
people.post("/calls", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 4096);
  if (!(await rateLimit(c.env.DB, `call:${m.id}`, 20, 600))) throw err("That's a lot of calls in a short time. Wait a few minutes.", 429);
  const to = [...new Set((Array.isArray(b.to) ? b.to : []).map((x: any) => str(x, 40)).filter(Boolean))].filter((x) => x !== m.id).slice(0, 15) as string[];
  if (!to.length) throw err("Choose who to call.");
  for (const id of to) if (!(await canSee(c.env, m, id))) throw err("You can call only people you share a conversation with.", 403);
  const { results: ppl } = await c.env.DB.prepare(`SELECT id, name, email FROM members WHERE id IN (${to.map(() => "?").join(",")})`).bind(...to).all<any>();
  const room = newRoomId(), id = crypto.randomUUID().replace(/-/g, "").slice(0, 16), video = b.video ? 1 : 0;
  const title = ppl.length === 1 ? `Call: ${m.name} and ${ppl[0].name}` : `Group call with ${m.name}`;
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO meetings (id, title, kind, host_email, host_name, starts_at, duration_min, lobby, invitees, status, created_by, created_at, channel_id) VALUES (?,?,'meeting',?,?,NULL,60,0,?,'scheduled',?,?,NULL)")
      .bind(room, title, m.email, m.name, JSON.stringify(ppl.map((p) => p.email)), m.id, now()),
    c.env.DB.prepare("INSERT INTO calls (id, room, caller_id, video, started_at) VALUES (?,?,?,?,?)").bind(id, room, m.id, video, now()),
    c.env.DB.prepare("INSERT INTO call_parties (call_id, member_id, state) VALUES (?,?,'joined')").bind(id, m.id),
    ...ppl.map((p) => c.env.DB.prepare("INSERT INTO call_parties (call_id, member_id, state) VALUES (?,?,'ringing')").bind(id, p.id)),
  ]);
  await auditFull(c as any, c.env.DB, m.id, "meet.call.started", { call: id, to: ppl.length, video });
  return c.json({ id, room, url: `/${room}` });
});
/** Calls ringing for this member right now (read by the live poll). */
export async function ringing(env: Env, mid: string) {
  const since = new Date(Date.now() - RING_MS).toISOString();
  const { results } = await env.DB.prepare(`SELECT c.id, c.room, c.video, c.started_at, mb.name caller, mb.id caller_id,
      (SELECT COUNT(*) FROM call_parties x WHERE x.call_id = c.id) parties
    FROM call_parties p JOIN calls c ON c.id = p.call_id JOIN members mb ON mb.id = c.caller_id
    WHERE p.member_id = ? AND p.state = 'ringing' AND c.state IN ('ringing','live') AND c.started_at > ?`).bind(mid, since).all<any>();
  return results;
}
async function party(c: any) {
  const m = me(c), id = c.req.param("id");
  const call: any = await c.env.DB.prepare("SELECT * FROM calls WHERE id = ?").bind(id).first();
  const p: any = call && (await c.env.DB.prepare("SELECT * FROM call_parties WHERE call_id = ? AND member_id = ?").bind(id, m.id).first());
  if (!p) throw err("Call not found.", 404);
  return { m, call, p };
}
people.post("/calls/:id/answer", async (c) => {
  const { m, call } = await party(c);
  if (["ended", "cancelled", "missed"].includes(call.state)) throw err("This call has ended.", 410);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE call_parties SET state = 'joined' WHERE call_id = ? AND member_id = ?").bind(call.id, m.id),
    c.env.DB.prepare("UPDATE calls SET state = 'live', answered_at = COALESCE(answered_at, ?) WHERE id = ?").bind(now(), call.id),
  ]);
  return c.json({ url: `/${call.room}` });
});
people.post("/calls/:id/decline", async (c) => {
  const { m, call } = await party(c);
  await c.env.DB.prepare("UPDATE call_parties SET state = 'declined' WHERE call_id = ? AND member_id = ? AND state = 'ringing'").bind(call.id, m.id).run();
  const left: any = await c.env.DB.prepare("SELECT COUNT(*) n FROM call_parties WHERE call_id = ? AND state IN ('ringing','joined') AND member_id != ?").bind(call.id, call.caller_id).first();
  if (!left?.n && call.state === "ringing") await c.env.DB.prepare("UPDATE calls SET state = 'declined', ended_at = ? WHERE id = ?").bind(now(), call.id).run();
  await addActivity(c.env, [call.caller_id], { kind: "call", actor: m.id, ref: call.id, text: `${m.name} declined your call.` });
  return c.json({ ok: true });
});
people.post("/calls/:id/end", async (c) => {
  const { m, call } = await party(c);
  const b = await readJson<any>(c, 256).catch(() => ({}));
  if (call.caller_id === m.id && call.state === "ringing") {
    // Hung up before anyone answered: missed call for everyone still ringing.
    const { results } = await c.env.DB.prepare("SELECT member_id FROM call_parties WHERE call_id = ? AND state = 'ringing'").bind(call.id).all<any>();
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE call_parties SET state = 'missed' WHERE call_id = ? AND state = 'ringing'").bind(call.id),
      c.env.DB.prepare("UPDATE calls SET state = ?, ended_at = ? WHERE id = ?").bind(b?.timeout ? "missed" : "cancelled", now(), call.id),
    ]);
    await addActivity(c.env, results.map((r) => r.member_id), { kind: "missed", actor: m.id, ref: call.id, text: `Missed ${call.video ? "video" : "audio"} call from ${m.name}` });
  } else {
    await c.env.DB.prepare("UPDATE call_parties SET state = 'left' WHERE call_id = ? AND member_id = ?").bind(call.id, m.id).run();
    const on: any = await c.env.DB.prepare("SELECT COUNT(*) n FROM call_parties WHERE call_id = ? AND state = 'joined'").bind(call.id).first();
    if (!on?.n) await c.env.DB.prepare("UPDATE calls SET state = 'ended', ended_at = ? WHERE id = ? AND state = 'live'").bind(now(), call.id).run();
  }
  return c.json({ ok: true });
});
people.get("/calls", async (c) => {
  const m = me(c);
  const { results } = await c.env.DB.prepare(`SELECT c.id, c.room, c.video, c.state, c.started_at, c.answered_at, c.ended_at, c.caller_id, p.state my_state,
      (SELECT GROUP_CONCAT(x.member_id) FROM call_parties x WHERE x.call_id = c.id) party_ids
    FROM call_parties p JOIN calls c ON c.id = p.call_id WHERE p.member_id = ? ORDER BY c.started_at DESC LIMIT 100`).bind(m.id).all<any>();
  return c.json({ calls: results.map((r) => ({ ...r, party_ids: String(r.party_ids || "").split(",").filter(Boolean) })) });
});

people.get("/calls/:id", async (c) => {
  const { call } = await party(c);
  const { results } = await c.env.DB.prepare("SELECT member_id, state FROM call_parties WHERE call_id = ?").bind(call.id).all<any>();
  return c.json({ id: call.id, room: call.room, state: call.state, video: !!call.video, parties: results });
});

// ------------------------------------------------------------------ Cast to a screen
people.post("/cast", async (c) => {
  const m = me(c);
  const b = await readJson<any>(c, 1024);
  const code = String(b.code || "").replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) throw err("Enter the 6-digit code shown on the screen.");
  if (!(await rateLimit(c.env.DB, `cast:${m.id}`, 10, 600))) throw err("Too many tries. Wait a few minutes.", 429);
  const row: any = await c.env.DB.prepare("SELECT * FROM cast_codes WHERE code = ? AND created_at > ?").bind(code, new Date(Date.now() - 15 * 60_000).toISOString()).first();
  if (!row) throw err("That code isn't showing on any screen. Check it, or refresh the screen for a new one.", 404);
  const mt: any = await c.env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(str(b.room, 40)).first();
  if (!mt || !(await mayJoin(c.env, m, mt))) throw err("Choose a meeting you can join.", 403);
  // The screen joins as a guest named "Screen: <person>"; meetings with a lobby still ask the host to admit it.
  const key = c.env.MEET_SIGNING_KEY;
  if (!key) throw err("Casting isn't available yet.", 503);
  const link = `/${mt.id}?t=${await signMeet(key, { r: mt.id, role: "guest", x: Date.now() + 8 * 3_600_000 })}&screen=1&name=${encodeURIComponent("Screen - " + m.name)}`;
  await c.env.DB.prepare("UPDATE cast_codes SET link = ?, title = ?, sent_by = ?, sent_at = ? WHERE code = ?").bind(link, mt.title, m.id, now(), code).run();
  await auditFull(c as any, c.env.DB, m.id, "meet.cast.sent", { meeting: mt.id });
  return c.json({ ok: true });
});

/** Public endpoints for the screen itself (no sign-in): get a code, then wait for a meeting. */
export const castPublic = new Hono<{ Bindings: Env }>();
castPublic.post("/new", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || "0";
  if (!(await rateLimit(c.env.DB, `castnew:${ip}`, 20, 3600))) return c.json({ error: "Too many screens from this network. Try later." }, 429);
  await c.env.DB.prepare("DELETE FROM cast_codes WHERE created_at < ?").bind(new Date(Date.now() - 3_600_000).toISOString()).run();
  for (let i = 0; i < 5; i++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const code = String(n).padStart(6, "0"), secret = crypto.randomUUID();
    const ok = await c.env.DB.prepare("INSERT INTO cast_codes (code, secret_hash, created_at) VALUES (?,?,?) ON CONFLICT(code) DO NOTHING RETURNING code").bind(code, await sha256hex(secret), now()).first();
    if (ok) return c.json({ code, secret, expiresIn: 900 });
  }
  return c.json({ error: "Try again." }, 503);
});
castPublic.post("/wait", async (c) => {
  const b = await readJson<any>(c, 512);
  const row: any = await c.env.DB.prepare("SELECT * FROM cast_codes WHERE code = ?").bind(String(b.code || "").slice(0, 6)).first();
  if (!row || row.secret_hash !== (await sha256hex(String(b.secret || "")))) return c.json({ error: "expired" }, 410);
  if (!row.link) return c.json({ waiting: true });
  await c.env.DB.prepare("DELETE FROM cast_codes WHERE code = ?").bind(row.code).run(); // one use
  return c.json({ link: row.link, title: row.title });
});
