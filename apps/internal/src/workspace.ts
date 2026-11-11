// Whiteboards, the Studio idea wall, Kayakers Update and Kayakers Store requests.
import { Hono } from "hono";
import { readJson, str } from "../../../packages/core/src/http";
import { audit } from "../../../packages/core/src/session";
import { Env, User, atLeast, uid } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const workspace = new Hono<V>();
const now = () => new Date().toISOString();

// ------------------------------------------------------------------ whiteboards
workspace.get("/boards", async (c) => {
  const u = c.get("user");
  const { results } = await c.env.DB.prepare("SELECT b.id, b.title, b.thumb, b.shared, b.updated_at, b.owner, u.name owner_name FROM boards b LEFT JOIN users u ON u.id = b.owner WHERE b.owner = ? OR b.shared = 1 ORDER BY b.updated_at DESC LIMIT 200").bind(u.id).all();
  return c.json({ boards: results });
});
workspace.get("/boards/:id", async (c) => {
  const u = c.get("user");
  const b = await c.env.DB.prepare("SELECT * FROM boards WHERE id = ? AND (owner = ? OR shared = 1)").bind(c.req.param("id"), u.id).first<any>();
  if (!b) return c.json({ error: "Not found." }, 404);
  return c.json({ ...b, data: JSON.parse(b.data), mine: b.owner === u.id });
});
workspace.post("/boards", async (c) => {
  const u = c.get("user");
  const b = await readJson<any>(c, 2_500_000);
  const id = str(b.id, 60) || uid();
  const data = JSON.stringify(b.data || { items: [] });
  if (data.length > 2_000_000) return c.json({ error: "This board is too large to save. Split it into two boards." }, 413);
  const thumb = typeof b.thumb === "string" && b.thumb.startsWith("data:image/") && b.thumb.length < 400_000 ? b.thumb : null;
  const ex = await c.env.DB.prepare("SELECT owner, shared FROM boards WHERE id = ?").bind(id).first<any>();
  if (ex && ex.owner !== u.id && !ex.shared) return c.json({ error: "Not your board." }, 403);
  if (ex) await c.env.DB.prepare("UPDATE boards SET title = ?, data = ?, thumb = COALESCE(?, thumb), shared = CASE WHEN owner = ? THEN ? ELSE shared END, updated_at = ? WHERE id = ?").bind(str(b.title, 120) || "Untitled board", data, thumb, u.id, b.shared ? 1 : 0, now(), id).run();
  else await c.env.DB.prepare("INSERT INTO boards (id, title, owner, data, thumb, shared, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id, str(b.title, 120) || "Untitled board", u.id, data, thumb, b.shared ? 1 : 0, now(), now()).run();
  return c.json({ id });
});
workspace.post("/boards/:id/delete", async (c) => {
  await c.env.DB.prepare("DELETE FROM boards WHERE id = ? AND owner = ?").bind(c.req.param("id"), c.get("user").id).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ idea wall
workspace.get("/ideas", async (c) => {
  const u = c.get("user");
  const { results } = await c.env.DB.prepare("SELECT i.*, us.name author, EXISTS(SELECT 1 FROM idea_votes v WHERE v.idea_id = i.id AND v.user_id = ?) voted FROM ideas i LEFT JOIN users us ON us.id = i.by_user ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'doing' THEN 1 ELSE 2 END, i.votes DESC, i.id DESC LIMIT 200").bind(u.id).all();
  return c.json({ ideas: results });
});
workspace.post("/ideas", async (c) => {
  const b = await readJson<any>(c, 4096);
  const t = str(b.text, 500);
  if (!t) return c.json({ error: "Write the idea." }, 400);
  await c.env.DB.prepare("INSERT INTO ideas (by_user, text, tag, created_at) VALUES (?,?,?,?)").bind(c.get("user").id, t, str(b.tag, 30) || "idea", now()).run();
  return c.json({ ok: true });
});
workspace.post("/ideas/:id/vote", async (c) => {
  const u = c.get("user"), id = Number(c.req.param("id"));
  const had = await c.env.DB.prepare("SELECT 1 FROM idea_votes WHERE idea_id = ? AND user_id = ?").bind(id, u.id).first();
  await c.env.DB.batch(had
    ? [c.env.DB.prepare("DELETE FROM idea_votes WHERE idea_id = ? AND user_id = ?").bind(id, u.id), c.env.DB.prepare("UPDATE ideas SET votes = MAX(0, votes - 1) WHERE id = ?").bind(id)]
    : [c.env.DB.prepare("INSERT INTO idea_votes (idea_id, user_id) VALUES (?,?)").bind(id, u.id), c.env.DB.prepare("UPDATE ideas SET votes = votes + 1 WHERE id = ?").bind(id)]);
  return c.json({ ok: true });
});
workspace.post("/ideas/:id", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 1024);
  const st = ["open", "doing", "done", "parked"].includes(b.status) ? b.status : "open";
  await c.env.DB.prepare("UPDATE ideas SET status = ? WHERE id = ?").bind(st, c.req.param("id")).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ Kayakers Update
workspace.get("/updates", async (c) => {
  const u = c.get("user");
  const [{ results: items }, { results: reacts }] = await Promise.all([
    c.env.DB.prepare("SELECT up.*, us.name author FROM updates up LEFT JOIN users us ON us.id = up.by_user ORDER BY up.pinned DESC, up.id DESC LIMIT 100").all<any>(),
    c.env.DB.prepare("SELECT update_id, emoji, COUNT(*) n, SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) mine FROM update_reacts GROUP BY update_id, emoji").bind(u.id).all<any>(),
  ]);
  return c.json({ updates: items.map((x: any) => ({ ...x, reactions: reacts.filter((r: any) => r.update_id === x.id) })) });
});
workspace.post("/updates", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "editor")) return c.json({ error: "Editors and administrators can post updates." }, 403);
  const b = await readJson<any>(c, 20_000);
  const title = str(b.title, 160);
  if (!title) return c.json({ error: "Give the update a headline." }, 400);
  const kind = ["announcement", "win", "launch", "people", "learning", "milestone"].includes(b.kind) ? b.kind : "announcement";
  await c.env.DB.prepare("INSERT INTO updates (kind, title, body, by_user, pinned, created_at) VALUES (?,?,?,?,?,?)").bind(kind, title, str(b.body, 8000), u.id, b.pinned ? 1 : 0, now()).run();
  await audit(c, c.env.DB, u.id, "updates.posted", { kind });
  return c.json({ ok: true });
});
workspace.post("/updates/:id/react", async (c) => {
  const u = c.get("user"), id = Number(c.req.param("id"));
  const b = await readJson<any>(c, 256);
  const e = ["clap", "party", "idea", "heart", "rocket"].includes(b.emoji) ? b.emoji : null;
  if (!e) return c.json({ error: "Unknown reaction." }, 400);
  const had = await c.env.DB.prepare("SELECT 1 FROM update_reacts WHERE update_id = ? AND user_id = ? AND emoji = ?").bind(id, u.id, e).first();
  await c.env.DB.prepare(had ? "DELETE FROM update_reacts WHERE update_id = ? AND user_id = ? AND emoji = ?" : "INSERT INTO update_reacts (update_id, user_id, emoji) VALUES (?,?,?)").bind(id, u.id, e).run();
  return c.json({ ok: true });
});
workspace.post("/updates/:id/delete", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  await c.env.DB.batch([c.env.DB.prepare("DELETE FROM update_reacts WHERE update_id = ?").bind(c.req.param("id")), c.env.DB.prepare("DELETE FROM updates WHERE id = ?").bind(c.req.param("id"))]);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ Kayakers Store requests
workspace.get("/store", async (c) => {
  const u = c.get("user");
  const all = atLeast(u, "admin");
  const { results } = await c.env.DB.prepare(`SELECT r.*, us.name requester FROM store_requests r LEFT JOIN users us ON us.id = r.by_user ${all ? "" : "WHERE r.by_user = ?1"} ORDER BY r.id DESC LIMIT 300`).bind(...(all ? [] : [u.id])).all();
  return c.json({ requests: results, admin: all });
});
workspace.post("/store", async (c) => {
  const b = await readJson<any>(c, 4096);
  const item = str(b.item, 80);
  if (!item) return c.json({ error: "Choose an item." }, 400);
  await c.env.DB.prepare("INSERT INTO store_requests (by_user, item, brand, variant, size, qty, note, created_at) VALUES (?,?,?,?,?,?,?,?)").bind(c.get("user").id, item, str(b.brand, 40), str(b.variant, 40), str(b.size, 10), Math.min(50, Math.max(1, Number(b.qty) || 1)), str(b.note, 500), now()).run();
  return c.json({ ok: true });
});
workspace.post("/store/:id", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 1024);
  const st = ["requested", "approved", "ordered", "delivered", "declined"].includes(b.status) ? b.status : "requested";
  await c.env.DB.prepare("UPDATE store_requests SET status = ? WHERE id = ?").bind(st, c.req.param("id")).run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ KSA Office Toolbar
workspace.get("/toolbar", async (c) => {
  await audit(c, c.env.DB, c.get("user").id, "toolbar.token_viewed", {});
  return c.json({ base: "https://toolbar.kayaksa.com", assistantUrl: "https://toolbar.kayaksa.com/api/assistant", token: c.env.TOOLBAR_TOKEN || null });
});
