// Website module: manages www.kayaksa.com from the portal through the WWW_DB binding.
// Enquiries, Kay's answer memory (approve before Kay uses it), Confluence articles, SeeCounter
// cases, subscribers and site statistics. Editors and above can change content.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { readJson, str } from "../../../packages/core/src/http";
import { Env, User, atLeast, uid } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const website = new Hono<V>();

const db = (c: any) => {
  const d = (c.env as Env).WWW_DB;
  if (!d) throw Object.assign(new Error("The website database is not connected to the portal yet."), { status: 503 });
  return d;
};
const editor = (c: any) => atLeast(c.get("user"), "editor");
const deny = (c: any) => c.json({ error: "Editors and administrators only." }, 403);
const now = () => new Date().toISOString();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);

// ---------------- overview
website.get("/overview", async (c) => {
  const d = db(c);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [views, enq, newEnq, subs, kay, pending, top, refs, vit] = await Promise.all([
    d.prepare("SELECT day, SUM(views) n FROM stat_views WHERE day >= ? GROUP BY day ORDER BY day").bind(since).all(),
    d.prepare("SELECT COUNT(*) n FROM enquiries WHERE created_at >= ?").bind(since).first<any>(),
    d.prepare("SELECT COUNT(*) n FROM enquiries WHERE status = 'new'").first<any>(),
    d.prepare("SELECT list, COUNT(*) n FROM subscribers WHERE status = 'active' GROUP BY list").all(),
    d.prepare("SELECT SUM(chats) chats, SUM(voice) voice, SUM(memory_hits) memory, SUM(lite) lite, SUM(claude) claude, SUM(tts_chars) tts, SUM(tts_cached) cached FROM kay_usage WHERE day >= ?").bind(since).first<any>(),
    d.prepare("SELECT COUNT(*) n FROM kay_memory WHERE status = 'pending'").first<any>(),
    d.prepare("SELECT path, SUM(views) n FROM stat_views WHERE day >= ? GROUP BY path ORDER BY n DESC LIMIT 10").bind(since).all(),
    d.prepare("SELECT value, SUM(n) n FROM stat_dims WHERE dim = 'referrer' AND day >= ? GROUP BY value ORDER BY n DESC LIMIT 8").bind(since).all(),
    d.prepare("SELECT lcp, cls, inp FROM stat_vitals WHERE day >= ? ORDER BY id DESC LIMIT 2000").bind(since).all<any>(),
  ]);
  const p75 = (k: string) => { const a = vit.results.map((r: any) => r[k]).filter((x: any) => x != null).sort((x: number, y: number) => x - y); return a.length ? a[Math.floor(a.length * 0.75)] : null; };
  return c.json({ views: views.results, enquiries30: enq?.n || 0, newEnquiries: newEnq?.n || 0, subscribers: subs.results, kay: kay || {}, pendingAnswers: pending?.n || 0, top: top.results, referrers: refs.results, vitals: { lcp: p75("lcp"), cls: p75("cls"), inp: p75("inp"), samples: vit.results.length } });
});

// ---------------- enquiries
website.get("/enquiries", async (c) => {
  const status = str(c.req.query("status"), 20);
  const { results } = await db(c).prepare(`SELECT * FROM enquiries ${status ? "WHERE status = ?1" : ""} ORDER BY created_at DESC LIMIT 300`).bind(...(status ? [status] : [])).all();
  return c.json({ enquiries: results });
});
website.post("/enquiries/:id", async (c) => {
  const b = await readJson<any>(c, 8192);
  const status = ["new", "in_progress", "closed", "spam"].includes(b.status) ? b.status : null;
  await db(c).prepare("UPDATE enquiries SET status = COALESCE(?, status), notes = ? WHERE id = ?").bind(status, str(b.notes, 4000), c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "website.enquiry_updated", { id: c.req.param("id"), status });
  return c.json({ ok: true });
});
// A candidate's résumé: downloaded, never shown inline, and every download is logged.
website.get("/enquiries/:id/resume", async (c) => {
  const e: any = await db(c).prepare("SELECT resume_key, resume_name, name FROM enquiries WHERE id = ?").bind(c.req.param("id")).first();
  if (!e?.resume_key || !c.env.CAREERS) return c.json({ error: "No résumé is attached." }, 404);
  const o = await c.env.CAREERS.get(e.resume_key);
  if (!o) return c.json({ error: "The résumé file is missing." }, 404);
  await audit(c, c.env.DB, c.get("user").id, "website.resume_downloaded", { id: c.req.param("id") });
  const fn = String(e.resume_name || "resume").replace(/[^\w .()-]/g, "_");
  return new Response(o.body, { headers: { "Content-Type": o.httpMetadata?.contentType || "application/octet-stream", "Content-Disposition": `attachment; filename="${fn}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});
website.post("/enquiries/:id/delete", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  const r: any = await db(c).prepare("SELECT resume_key FROM enquiries WHERE id = ?").bind(c.req.param("id")).first();
  if (r?.resume_key) await c.env.CAREERS?.delete(r.resume_key);
  await db(c).prepare("DELETE FROM enquiries WHERE id = ?").bind(c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "website.enquiry_deleted", { id: c.req.param("id") });
  return c.json({ ok: true });
});

// ---------------- Kay's answer memory
website.get("/kay", async (c) => {
  const d = db(c);
  const [mem, fb, qs] = await Promise.all([
    d.prepare("SELECT * FROM kay_memory ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, asked DESC, created_at DESC LIMIT 300").all(),
    d.prepare("SELECT rating, question, answer, at FROM kay_feedback ORDER BY id DESC LIMIT 50").all(),
    d.prepare("SELECT question, answered_by, at FROM kay_questions ORDER BY id DESC LIMIT 60").all(),
  ]);
  return c.json({ memory: mem.results, feedback: fb.results, questions: qs.results });
});
website.post("/kay", async (c) => {
  if (!editor(c)) return deny(c);
  const b = await readJson<any>(c, 16384);
  const q = str(b.question, 300), a = str(b.answer, 2000);
  if (!q || !a) return c.json({ error: "A question and an answer are both needed." }, 400);
  const status = ["pending", "approved", "rejected"].includes(b.status) ? b.status : "pending";
  const id = b.id ? str(b.id, 60) : uid();
  await db(c).prepare(`INSERT INTO kay_memory (id, question, answer, voice_answer, source, status, created_at, reviewed_by, reviewed_at, indexed) VALUES (?1,?2,?3,?4,'staff',?5,?6,?7,?6,0)
    ON CONFLICT(id) DO UPDATE SET question=?2, answer=?3, voice_answer=?4, status=?5, reviewed_by=?7, reviewed_at=?6, indexed=0`)
    .bind(id, q, a, str(b.voice, 600), status, now(), c.get("user").email).run();
  await audit(c, c.env.DB, c.get("user").id, `website.kay_${status}`, { id, question: q });
  return c.json({ id });
});

// ---------------- Confluence articles
website.get("/articles", async (c) => c.json({ articles: (await db(c).prepare("SELECT * FROM articles ORDER BY COALESCE(published_at, updated_at) DESC").all()).results }));
website.post("/articles", async (c) => {
  if (!editor(c)) return deny(c);
  const b = await readJson<any>(c, 200_000);
  const title = str(b.title, 200);
  if (!title) return c.json({ error: "Give the article a title." }, 400);
  const id = b.id ? str(b.id, 70) : slug(title);
  const body = String(b.body || "").split(/\n{2,}/).map((p: string) => p.trim()).filter(Boolean).slice(0, 200);
  const status = ["draft", "published", "archived"].includes(b.status) ? b.status : "draft";
  const t = now();
  await db(c).prepare(`INSERT INTO articles (id, section, cluster, pattern, mins, title, dek, body, status, published_at, updated_at, author) VALUES (?1,?2,?3,'chevron-wake',?4,?5,?6,?7,?8,?9,?10,?11)
    ON CONFLICT(id) DO UPDATE SET section=?2, cluster=?3, mins=?4, title=?5, dek=?6, body=?7, status=?8, published_at=COALESCE(articles.published_at, ?9), updated_at=?10, author=?11`)
    .bind(id, str(b.section, 60) || "Insight", str(b.cluster, 40), Math.max(1, Math.round(body.join(" ").split(/\s+/).length / 220)), title, str(b.dek, 400), JSON.stringify(body), status, status === "published" ? t : null, t, c.get("user").name || c.get("user").email).run();
  await audit(c, c.env.DB, c.get("user").id, "website.article_saved", { id, status });
  return c.json({ id });
});

// ---------------- SeeCounter cases
website.get("/cases", async (c) => c.json({ cases: (await db(c).prepare("SELECT * FROM cases ORDER BY COALESCE(action_date, created_at) DESC LIMIT 500").all()).results }));
website.post("/cases", async (c) => {
  if (!editor(c)) return deny(c);
  const b = await readJson<any>(c, 16384);
  const title = str(b.title, 200), summary = str(b.summary, 1500), action = str(b.action, 40);
  if (!title || !summary || !action) return c.json({ error: "Title, summary and type of action are required." }, 400);
  const src = str(b.source_url, 500);
  if (b.published && !/^https:\/\//.test(src)) return c.json({ error: "A published case needs a public source link (https://) so that it can be checked." }, 400);
  const id = b.id ? str(b.id, 60) : uid();
  const t = now();
  await db(c).prepare(`INSERT INTO cases (id, title, summary, brand, category, action, status, jurisdiction, authority, action_date, source_url, published, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?13)
    ON CONFLICT(id) DO UPDATE SET title=?2, summary=?3, brand=?4, category=?5, action=?6, status=?7, jurisdiction=?8, authority=?9, action_date=?10, source_url=?11, published=?12, updated_at=?13`)
    .bind(id, title, summary, str(b.brand, 120), str(b.category, 120), action, b.status === "closed" ? "closed" : "ongoing", str(b.jurisdiction, 120), str(b.authority, 160), str(b.action_date, 10) || null, src, b.published ? 1 : 0, t).run();
  await audit(c, c.env.DB, c.get("user").id, "website.case_saved", { id, published: !!b.published });
  return c.json({ id });
});

// ---------------- subscribers (counts, and CSV for administrators)
website.get("/subscribers.csv", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  const { results } = await db(c).prepare("SELECT email, list, frequency, filters, confirmed_at FROM subscribers WHERE status = 'active' ORDER BY list, email").all<any>();
  const cell = (v: unknown) => { const s = String(v ?? ""); return /^[=+\-@\t\r]/.test(s) ? `"'${s.replace(/"/g, '""')}"` : `"${s.replace(/"/g, '""')}"`; };
  await audit(c, c.env.DB, c.get("user").id, "website.subscribers_exported");
  return new Response(["email,list,frequency,filters,confirmed_at", ...results.map((r) => [r.email, r.list, r.frequency, r.filters, r.confirmed_at].map(cell).join(","))].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="kayak-subscribers.csv"', "Cache-Control": "no-store" },
  });
});
