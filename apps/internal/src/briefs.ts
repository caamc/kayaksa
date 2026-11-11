// Briefing & Capability Studio and the Kayak Benchmark Tool.
// A colleague names a client, its industry and the service Kayak is proposing. Kayak AI researches
// the sector (IBEF, Statista, MeitY, regulators, industry bodies), the client's public profile and
// recent news in the client's sector for that service, then writes Kayak's capability and
// illustrative scenarios. Every fact carries its source. Illustrative scenarios are labelled as such
// and never presented as past engagements. Each step is one request, run in order by the page.
import { Hono } from "hono";
import { readJson, str, rateLimit } from "../../../packages/core/src/http";
import { audit } from "../../../packages/core/src/session";
import { modelFor, KAYAK_VOICE } from "../../../packages/core/src/ai";
import { Env, User, atLeast, uid } from "./env";
import { recordUsage } from "./assistant";
import SERVICES from "../../www/public/assets/services.json";
import SITE from "../../www/src/site-data.json";

type V = { Bindings: Env; Variables: { user: User } };
export const briefs = new Hono<V>();
const now = () => new Date().toISOString();

export const CAPABILITIES = [
  ...(SITE as any).clusters.map((c: any) => ({ id: `cluster:${c.id}`, group: "Service cluster", name: c.name, line: c.line })),
  ...(SERVICES as any[]).map((s: any) => ({ id: `service:${s.slug}`, group: (SITE as any).clusters.find((c: any) => c.id === s.cluster)?.name || "Service", name: s.name, line: s.summary })),
  ...(SITE as any).tools.filter((t: any) => t.id !== "seecounter").map((t: any) => ({ id: `tool:${t.id}`, group: "Kayak Solutions", name: t.name, line: t.line })),
];
const STEPS: Record<string, string[]> = { briefing: ["sector", "client", "news", "capability", "cases"], benchmark: ["peers", "metrics"] };

const RULES = `${KAYAK_VOICE}
Rules: report only facts you actually found, each with its source title and URL; prefer authoritative sources (IBEF, Statista public pages, MeitY, MCA, RBI, SEBI, PIB, ministries, industry bodies such as NASSCOM, CII and FICCI, the World Bank, IMF, company filings and annual reports, reputable business press). Never invent figures. If a figure is not available, say so. Real companies and people appear only in neutral factual reporting, never in opinion or allegation. Respond with JSON only.`;

async function claude(env: Env, prompt: string, search = 0, maxTokens = 3500) {
  const body: any = { model: modelFor(env, "anthropic"), max_tokens: maxTokens, system: RULES, messages: [{ role: "user", content: prompt }] };
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: search }];
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Claude: ${j?.error?.message || r.status}`);
  const text = (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  await recordUsage(env.DB, body.model, "briefing", prompt.length, text.length);
  const a = text.search(/[\[{]/), z = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (a < 0) throw new Error("Kayak AI did not return a structured answer. Run the step again.");
  return JSON.parse(text.slice(a, z + 1));
}

briefs.get("/meta", (c) => c.json({ capabilities: CAPABILITIES, ai: !!c.env.ANTHROPIC_API_KEY }));
briefs.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, kind, brand, client, industry, service, status, created_by, created_at, updated_at FROM briefs ORDER BY updated_at DESC LIMIT 200").all();
  return c.json({ briefs: results });
});
briefs.get("/:id", async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM briefs WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!r) return c.json({ error: "Not found." }, 404);
  const data = r.data ? JSON.parse(r.data) : {};
  return c.json({ ...r, data, steps: STEPS[r.kind], capability: CAPABILITIES.find((x) => x.id === r.service) || null });
});
briefs.post("/", async (c) => {
  const u = c.get("user");
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ error: "Claude is not configured, so research cannot run." }, 503);
  if (!(await rateLimit(c.env.DB, `brief:${u.id}`, 20, 86400))) return c.json({ error: "Twenty briefs a day is the limit." }, 429);
  const b = await readJson<any>(c, 8192);
  const kind = b.kind === "benchmark" ? "benchmark" : "briefing";
  const client = str(b.client, 120);
  if (!client) return c.json({ error: "Name the client." }, 400);
  const brand = ["group", "ksa", "innovations", "technology", "sayusnow", "nexapair", "docuvow"].includes(b.brand) ? b.brand : "ksa";
  const id = uid();
  const data = { input: { details: str(b.details, 2000), peers: str(b.peers, 400), metrics: str(b.metrics, 400), audience: str(b.audience, 120) }, done: [] as string[] };
  await c.env.DB.prepare("INSERT INTO briefs (id, kind, brand, client, industry, service, status, data, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?, 'running', ?, ?, ?, ?)").bind(id, kind, brand, client, str(b.industry, 120), str(b.service, 120), JSON.stringify(data), u.email, now(), now()).run();
  await audit(c, c.env.DB, u.id, `briefs.${kind}_started`, { client });
  return c.json({ id });
});
briefs.post("/:id/brand", async (c) => {
  const b = await readJson<any>(c, 256);
  if (["group", "ksa", "innovations", "technology", "sayusnow", "nexapair", "docuvow"].includes(b.brand)) await c.env.DB.prepare("UPDATE briefs SET brand = ?, updated_at = ? WHERE id = ?").bind(b.brand, now(), c.req.param("id")).run();
  return c.json({ ok: true });
});
briefs.post("/:id/delete", async (c) => {
  const u = c.get("user");
  const r = await c.env.DB.prepare("SELECT created_by FROM briefs WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!r || (r.created_by !== u.email && !atLeast(u, "admin"))) return c.json({ error: "Not yours." }, 403);
  await c.env.DB.prepare("DELETE FROM briefs WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

briefs.post("/:id/step", async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM briefs WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!r) return c.json({ error: "Not found." }, 404);
  const data = JSON.parse(r.data || "{}");
  const steps = STEPS[r.kind];
  const step = steps.find((s) => !data.done.includes(s));
  if (!step) return c.json({ status: "ready", done: data.done });
  const cap = CAPABILITIES.find((x) => x.id === r.service);
  const ctx = `Client: ${r.client}. Industry: ${r.industry || "not given; infer it from public information"}. ${data.input.details ? `Notes from the colleague: ${data.input.details}.` : ""} Today: ${new Date().toDateString()}.`;
  try {
    if (step === "sector") data.sector = await claude(c.env, `${ctx}\nResearch the client's sector in India (and globally where relevant). Return {"title":"sector name","overview":"3 to 4 sentences","facts":[{"metric":"","value":"","period":"","source":"","url":""}] (5 to 8 sourced figures such as market size, growth, exports, employment, policy targets),"drivers":["4 growth drivers"],"regulation":[{"name":"law, regulator or scheme","what":"what it means for companies in this sector","url":""}],"risks":["4 sector risks"],"outlook":"2 sentences"}`, 6, 4000);
    else if (step === "client") data.client = await claude(c.env, `${ctx}\nBuild a factual public-domain briefing on the client. Return {"overview":"3 sentences","facts":[{"label":"Founded|Headquarters|Listed on|Business lines|Employees|Revenue (latest reported)|Ownership","value":"","source":"","url":""}],"leadership":[{"name":"","role":"","url":""}] (public roles only),"news":[{"date":"","headline":"","url":""}] (up to 6, most recent first),"themes":["3 themes a board there is likely to be weighing, phrased neutrally"]}`, 6, 4000);
    else if (step === "news") data.news = await claude(c.env, `${ctx}\nService Kayak is proposing: ${cap ? `${cap.name}: ${cap.line}` : r.service || "general advisory"}.\nFind recent public news (last 12 months) about this kind of need among the client's competitors and in its sector: regulatory actions, deals, incidents, investments or programmes that show why this service matters now. Return {"headline":"one line on why now","items":[{"date":"","company":"","what":"one neutral sentence","relevance":"why it matters for the client","url":""}] (5 to 7),"takeaway":"2 sentences for a one-page slide"}`, 6, 3500);
    else if (step === "capability") data.capability = await claude(c.env, `${ctx}\nWrite Kayak's capability statement for: ${cap ? `${cap.name} (${cap.group}): ${cap.line}` : r.service}. Use what the sector and client research found: ${JSON.stringify({ sector: data.sector?.title, themes: data.client?.themes, why: data.news?.headline }).slice(0, 1500)}.\nReturn {"title":"capability headline","promise":"one sentence","approach":[{"phase":"","what":"","weeks":""}] (4 phases),"deliverables":["5 deliverables"],"team":"who from Kayak, by role","why_kayak":["4 reasons, no superlatives, no invented credentials"],"questions":["5 questions for the first meeting"]}`, 0, 2500);
    else if (step === "cases") data.cases = await claude(c.env, `${ctx}\nService: ${cap ? cap.name : r.service}. Write 3 illustrative scenarios that show how Kayak would deliver this service for organisations like the client. They are not past engagements: use fictional companies (A Ltd, B Pvt Ltd, C Ltd) and the Relativity Index cast where people appear. Return [{"title":"","company":"fictional, e.g. A Ltd, a listed mid-sized manufacturer","situation":"2 sentences","what_we_would_do":["3 steps"],"what_good_looks_like":[{"label":"","value":"a qualitative or target outcome, never a claimed result"}] (3 items),"label":"Illustrative scenario, not a past engagement"}]`, 0, 2500);
    else if (step === "peers") data.peers = await claude(c.env, `${ctx}\nPeers named by the colleague: ${data.input.peers || "none; choose 4 comparable listed or well-documented peers in India"}. Return {"peers":[{"name":"","why":"why comparable","url":""}] (4 to 5, not including the client)}`, 4, 1500);
    else if (step === "metrics") data.metrics = await claude(c.env, `${ctx}\nBenchmark the client against these peers: ${JSON.stringify((data.peers?.peers || []).map((p: any) => p.name))}. Metrics requested: ${data.input.metrics || "revenue, revenue growth, EBITDA margin, employees"}. Use the latest reported figures from filings, annual reports or reputable databases. Return {"period":"e.g. FY2025","metrics":[{"name":"","unit":"","higher_is_better":true,"rows":[{"company":"","value":number or null,"display":"","source":"","url":""}]}] (client first in each rows list),"observations":["3 neutral observations, no advice"],"caveats":["data caveats"]}`, 8, 5000);
    data.done.push(step);
    const status = steps.every((s) => data.done.includes(s)) ? "ready" : "running";
    await c.env.DB.prepare("UPDATE briefs SET data = ?, status = ?, error = NULL, updated_at = ? WHERE id = ?").bind(JSON.stringify(data), status, now(), r.id).run();
    return c.json({ status, done: data.done, step });
  } catch (e: any) {
    await c.env.DB.prepare("UPDATE briefs SET error = ?, updated_at = ? WHERE id = ?").bind(String(e?.message || e).slice(0, 300), now(), r.id).run();
    return c.json({ error: e?.message || "That step failed. Run it again.", step }, 502);
  }
});
