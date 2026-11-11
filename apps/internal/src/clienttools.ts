// Client Tools and Client Tools Monitoring: the solutions Kayak runs for clients, each client's
// deployment (plan, seats, renewal, value, owner), and uptime and response-time monitoring of every
// public endpoint, checked every 15 minutes, with incidents opened and closed automatically.
import { Hono } from "hono";
import { readJson, str } from "../../../packages/core/src/http";
import { audit } from "../../../packages/core/src/session";
import { Env, User, atLeast, uid } from "./env";
import { probe } from "./dash";
import SITE from "../../www/src/site-data.json";

type V = { Bindings: Env; Variables: { user: User } };
export const clientTools = new Hono<V>();
const now = () => new Date().toISOString();
const admin = (c: any) => atLeast(c.get("user"), "admin");

const SEED_MONITORS: [string, string, string][] = [
  ["Kayak website", "https://www.kayaksa.com/healthz", "kayak"],
  ["Kayak Learn", "https://learn.kayaksa.com/healthz", "learn"],
  ["Kayak Meet", "https://meet.kayaksa.com/healthz", "meet"],
  ["NexaPair UAE website", "https://www.nexapair.ae/", "nexapair"],
  ["NexaPair app", "https://app.nexapair.ae/", "nexapair"],
  ["NexaPair demo", "https://demo.nexapair.ae/", "nexapair"],
];
async function seed(db: D1Database) {
  const n = await db.prepare("SELECT COUNT(*) n FROM monitors").first<any>();
  if (n?.n) return;
  await db.batch(SEED_MONITORS.map(([name, url, tool]) => db.prepare("INSERT INTO monitors (id, name, url, tool, created_at) VALUES (?,?,?,?,?)").bind(uid(), name, url, tool, now())));
}

/** Checks every monitor once; opens an incident after two failures in a row and closes it on recovery. */
export async function runChecks(db: D1Database) {
  await seed(db);
  const { results: ms } = await db.prepare("SELECT * FROM monitors").all<any>();
  const res = await Promise.all(ms.map(async (m: any) => ({ m, p: await probe(m.url, 10_000) })));
  const stmts: D1PreparedStatement[] = [];
  for (const { m, p } of res) {
    stmts.push(db.prepare("INSERT INTO monitor_checks (monitor_id, at, ok, status, ms, error) VALUES (?,?,?,?,?,?)").bind(m.id, now(), p.ok ? 1 : 0, p.status, p.ms, (p as any).error || null));
    const open = await db.prepare("SELECT id FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL").bind(m.id).first<any>();
    if (p.ok && open) stmts.push(db.prepare("UPDATE incidents SET resolved_at = ? WHERE id = ?").bind(now(), open.id));
    if (!p.ok && !open) {
      const prev = await db.prepare("SELECT ok FROM monitor_checks WHERE monitor_id = ? ORDER BY id DESC LIMIT 1").bind(m.id).first<any>();
      if (prev && !prev.ok) stmts.push(db.prepare("INSERT INTO incidents (monitor_id, title, started_at) VALUES (?,?,?)").bind(m.id, `${m.name} is not responding (${p.status || (p as any).error || "no answer"})`, now()));
    }
  }
  if (stmts.length) await db.batch(stmts);
  await db.prepare("DELETE FROM monitor_checks WHERE at < ?").bind(new Date(Date.now() - 90 * 86400_000).toISOString()).run();
  return res.length;
}

clientTools.get("/", async (c) => {
  await seed(c.env.DB);
  const since = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
  const [{ results: deps }, { results: mons }, { results: stats }, { results: recent }, { results: inc }, last] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM client_deployments ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'pilot' THEN 1 ELSE 2 END, renewal_date").all<any>(),
    c.env.DB.prepare("SELECT * FROM monitors ORDER BY name").all<any>(),
    c.env.DB.prepare("SELECT monitor_id, SUM(CASE WHEN at >= ?1 THEN ok ELSE 0 END) ok1, SUM(CASE WHEN at >= ?1 THEN 1 ELSE 0 END) n1, SUM(CASE WHEN at >= ?2 THEN ok ELSE 0 END) ok7, SUM(CASE WHEN at >= ?2 THEN 1 ELSE 0 END) n7, SUM(ok) ok30, COUNT(*) n30, AVG(CASE WHEN ok = 1 THEN ms END) avg FROM monitor_checks WHERE at >= ?3 GROUP BY monitor_id").bind(since(1), since(7), since(30)).all<any>(),
    c.env.DB.prepare("SELECT monitor_id, at, ok, ms FROM monitor_checks WHERE at >= ? ORDER BY id").bind(since(2)).all<any>(),
    c.env.DB.prepare("SELECT i.*, m.name FROM incidents i LEFT JOIN monitors m ON m.id = i.monitor_id ORDER BY i.id DESC LIMIT 30").all<any>(),
    c.env.DB.prepare("SELECT MAX(at) at FROM monitor_checks").first<any>(),
  ]);
  const t = Date.now();
  return c.json({
    tools: (SITE as any).tools.filter((x: any) => x.id !== "seecounter").map((x: any) => ({ id: x.id, name: x.name, kind: x.kind, color: x.color, site: x.site || null }))
      .concat([{ id: "learn", name: "Kayak Learn", kind: "Learning management", color: "#17807E", site: "learn.kayaksa.com" }, { id: "meet", name: "Kayak Meet", kind: "Meetings and calling", color: "#0E2F3C", site: "meet.kayaksa.com" }]),
    deployments: deps.map((d: any) => ({ ...d, renewInDays: d.renewal_date ? Math.round((Date.parse(d.renewal_date) - t) / 86400_000) : null })),
    monitors: mons.map((m: any) => {
      const s = stats.find((x: any) => x.monitor_id === m.id) || {};
      const pts = recent.filter((r: any) => r.monitor_id === m.id);
      const sorted = pts.filter((p: any) => p.ok).map((p: any) => p.ms).sort((a: number, b: number) => a - b);
      return { ...m, up24: s.n1 ? (s.ok1 / s.n1) * 100 : null, up7: s.n7 ? (s.ok7 / s.n7) * 100 : null, up30: s.n30 ? (s.ok30 / s.n30) * 100 : null, avg: s.avg ? Math.round(s.avg) : null, p95: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : null, last: pts.at(-1) || null, series: pts.slice(-96).map((p: any) => [p.at, p.ok, p.ms]) };
    }),
    incidents: inc, lastCheck: last?.at || null,
  });
});
clientTools.post("/check", async (c) => {
  const last = await c.env.DB.prepare("SELECT MAX(at) at FROM monitor_checks").first<any>();
  if (last?.at && Date.now() - Date.parse(last.at) < 60_000) return c.json({ ok: true, skipped: true });
  return c.json({ ok: true, checked: await runChecks(c.env.DB) });
});
clientTools.post("/monitors", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 2048);
  const url = str(b.url, 300);
  if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(url)) return c.json({ error: "Use a full https:// address." }, 400);
  await c.env.DB.prepare("INSERT INTO monitors (id, name, url, tool, created_at) VALUES (?,?,?,?,?)").bind(uid(), str(b.name, 80) || url, url, str(b.tool, 40), now()).run();
  return c.json({ ok: true });
});
clientTools.post("/monitors/:id/delete", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  await c.env.DB.batch([c.env.DB.prepare("DELETE FROM monitor_checks WHERE monitor_id = ?").bind(c.req.param("id")), c.env.DB.prepare("DELETE FROM monitors WHERE id = ?").bind(c.req.param("id"))]);
  return c.json({ ok: true });
});
clientTools.post("/deployments", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 8192);
  const client = str(b.client, 120), tool = str(b.tool, 40);
  if (!client || !tool) return c.json({ error: "Name the client and the tool." }, 400);
  const id = str(b.id, 60) || uid();
  const st = ["prospect", "pilot", "live", "paused", "ended"].includes(b.status) ? b.status : "pilot";
  const d = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? v : null);
  await c.env.DB.prepare(`INSERT INTO client_deployments (id, client, tool, plan, region, status, seats, start_date, renewal_date, value, owner, url, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET client = excluded.client, tool = excluded.tool, plan = excluded.plan, region = excluded.region, status = excluded.status, seats = excluded.seats, start_date = excluded.start_date, renewal_date = excluded.renewal_date, value = excluded.value, owner = excluded.owner, url = excluded.url, notes = excluded.notes, updated_at = excluded.updated_at`)
    .bind(id, client, tool, str(b.plan, 60), str(b.region, 40), st, Number(b.seats) || null, d(b.start_date), d(b.renewal_date), Number(b.value) || null, str(b.owner, 60), /^https:\/\//.test(b.url || "") ? str(b.url, 300) : null, str(b.notes, 1000), now(), now()).run();
  await audit(c, c.env.DB, c.get("user").id, "clienttools.deployment_saved", { client, tool });
  return c.json({ id });
});
clientTools.post("/deployments/:id/delete", async (c) => {
  if (!admin(c)) return c.json({ error: "Administrators only." }, 403);
  await c.env.DB.prepare("DELETE FROM client_deployments WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});
