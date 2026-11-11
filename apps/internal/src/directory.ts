// Kayak Tools (catalogue) and Kayak Network (partner directory).
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { readJson, str, email as cleanEmail } from "../../../packages/core/src/http";
import { Env, User, atLeast, uid } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const tools = new Hono<V>();
export const network = new Hono<V>();

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || uid();
const url = (v: unknown) => {
  const s = str(v, 500);
  if (!s) return "";
  if (s.startsWith("/app#") || s.startsWith("/app")) return s;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
};
const editor = (c: any) => atLeast(c.get("user"), "editor");

// ---------- Tools ----------
tools.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM tools ORDER BY sort, name").all();
  return c.json({ tools: results });
});

tools.post("/", async (c) => {
  if (!editor(c)) return c.json({ error: "Editors and administrators only." }, 403);
  const b = await readJson<any>(c, 8192);
  const name = str(b.name, 80);
  if (!name) return c.json({ error: "Give the tool a name." }, 400);
  const id = b.id ? str(b.id, 60) : slug(name);
  const status = ["live", "beta", "coming-soon", "internal"].includes(b.status) ? b.status : "live";
  const color = /^#[0-9a-f]{6}$/i.test(b.color || "") ? b.color : "#17807E";
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO tools (id, name, category, summary, url, status, owner, color, sort, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)
     ON CONFLICT(id) DO UPDATE SET name=?2, category=?3, summary=?4, url=?5, status=?6, owner=?7, color=?8, sort=?9, updated_at=?10`,
  ).bind(id, name, str(b.category, 80), str(b.summary, 400), url(b.url), status, str(b.owner, 80), color, Number(b.sort) || 100, now).run();
  await audit(c, c.env.DB, c.get("user").id, "tools.saved", { id, name });
  return c.json({ id });
});

tools.delete("/:id", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  await c.env.DB.prepare("DELETE FROM tools WHERE id = ?").bind(c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "tools.deleted", { id: c.req.param("id") });
  return c.json({ ok: true });
});

// ---------- Network ----------
export const GROUPS = ["client", "bp_consulting", "bp_vendor", "senior_advisor", "affiliate"];
const KINDS = ["Client", "Alliance partner", "Referral partner", "Technology partner", "Associate firm", "Subject expert", "Law firm", "Investigation partner", "Group company", "Other"];
const parseList = (v: unknown) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((x) => str(x, 60)).filter(Boolean).slice(0, 20);

network.get("/meta", (c) => c.json({ kinds: KINDS, groups: GROUPS }));

network.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM partners ORDER BY name COLLATE NOCASE").all<any>();
  return c.json({ partners: results.map((r: any) => ({ ...r, sectors: JSON.parse(r.sectors || "[]"), services: JSON.parse(r.services || "[]") })) });
});

network.post("/", async (c) => {
  if (!editor(c)) return c.json({ error: "Editors and administrators can change the network." }, 403);
  const b = await readJson<any>(c, 16384);
  const name = str(b.name, 160);
  if (!name) return c.json({ error: "Enter the partner's name." }, 400);
  const kind = KINDS.includes(b.kind) ? b.kind : "Other";
  const status = ["active", "prospect", "paused", "ended"].includes(b.status) ? b.status : "active";
  const ce = b.contact_email ? cleanEmail(b.contact_email) : "";
  if (b.contact_email && !ce) return c.json({ error: "The contact email does not look right." }, 400);
  const id = b.id ? str(b.id, 60) : uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO partners (id, name, kind, status, sectors, services, city, country, website, contact_name, contact_role, contact_email, contact_phone, since, nda_until, rating, notes, created_by, created_at, updated_at, grp, email_opt_out)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?19,?20,?21)
     ON CONFLICT(id) DO UPDATE SET name=?2, kind=?3, status=?4, sectors=?5, services=?6, city=?7, country=?8, website=?9, contact_name=?10, contact_role=?11,
       contact_email=?12, contact_phone=?13, since=?14, nda_until=?15, rating=?16, notes=?17, updated_at=?19, grp=?20, email_opt_out=?21`,
  ).bind(
    id, name, kind, status, JSON.stringify(parseList(b.sectors)), JSON.stringify(parseList(b.services)), str(b.city, 80), str(b.country, 80) || "India",
    url(b.website), str(b.contact_name, 120), str(b.contact_role, 120), ce, str(b.contact_phone, 60), str(b.since, 10), str(b.nda_until, 10),
    Math.max(0, Math.min(5, Number(b.rating) || 0)), str(b.notes, 4000), c.get("user").id, now, GROUPS.includes(b.grp) ? b.grp : "bp_consulting", b.email_opt_out ? 1 : 0,
  ).run();
  await audit(c, c.env.DB, c.get("user").id, "network.saved", { id, name });
  return c.json({ id });
});

network.delete("/:id", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  await c.env.DB.prepare("DELETE FROM partners WHERE id = ?").bind(c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "network.deleted", { id: c.req.param("id") });
  return c.json({ ok: true });
});

network.get("/export.csv", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM partners ORDER BY name COLLATE NOCASE").all<any>();
  const cols = ["name", "grp", "kind", "status", "sectors", "services", "city", "country", "website", "contact_name", "contact_role", "contact_email", "contact_phone", "since", "nda_until", "rating", "notes"];
  // Prefix cells that a spreadsheet would treat as a formula.
  const cell = (v: unknown) => {
    let s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = results.map((r: any) => cols.map((k) => cell(k === "sectors" || k === "services" ? JSON.parse(r[k] || "[]") : r[k])).join(","));
  await audit(c, c.env.DB, c.get("user").id, "network.exported", { rows: rows.length });
  return new Response([cols.join(","), ...rows].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="kayak-network-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
});
