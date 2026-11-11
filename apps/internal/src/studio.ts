// Saved business cards and presentations (per user).
import { Hono } from "hono";
import { readJson, str } from "../../../packages/core/src/http";
import { Env, User, uid } from "./env";

type V = { Bindings: Env; Variables: { user: User } };

function store(table: "cards" | "decks") {
  const app = new Hono<V>();
  app.get("/", async (c) => {
    const cols = table === "cards" ? "id, label, template, data, updated_at" : "id, title, inputs, updated_at";
    const { results } = await c.env.DB.prepare(`SELECT ${cols} FROM ${table} WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100`).bind(c.get("user").id).all();
    return c.json({ items: results });
  });
  app.get("/:id", async (c) => {
    const row = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).bind(c.req.param("id"), c.get("user").id).first();
    return row ? c.json({ item: row }) : c.json({ error: "Not found." }, 404);
  });
  app.post("/", async (c) => {
    const u = c.get("user");
    const b = await readJson<any>(c, 400_000);
    const id = str(b.id, 60) || uid();
    const now = new Date().toISOString();
    if (table === "cards") {
      await c.env.DB.prepare(
        `INSERT INTO cards (id, user_id, label, template, data, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6)
         ON CONFLICT(id) DO UPDATE SET label=?3, template=?4, data=?5, updated_at=?6 WHERE user_id=?2`,
      ).bind(id, u.id, str(b.label, 120) || "Card", str(b.template, 40), JSON.stringify(b.data ?? {}).slice(0, 20_000), now).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO decks (id, user_id, title, inputs, spec, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6)
         ON CONFLICT(id) DO UPDATE SET title=?3, inputs=?4, spec=?5, updated_at=?6 WHERE user_id=?2`,
      ).bind(id, u.id, str(b.title, 200) || "Presentation", JSON.stringify(b.inputs ?? {}).slice(0, 20_000), JSON.stringify(b.spec ?? {}).slice(0, 350_000), now).run();
    }
    return c.json({ id });
  });
  app.delete("/:id", async (c) => {
    await c.env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).bind(c.req.param("id"), c.get("user").id).run();
    return c.json({ ok: true });
  });
  return app;
}

export const cards = store("cards");
export const decks = store("decks");
