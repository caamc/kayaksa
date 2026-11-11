// Confluence studio (Kayak AI). Drafts the monthly magazine on its own: researches the period with
// Claude and web search, writes Kayak's perspectives within strict guardrails, spotlights one Kayak
// solution, and assembles the issue. Nothing is published until a SuperAdmin approves the release.
//
// Editions live in the www database (WWW_DB, table `editions`); www.kayaksa.com shows only rows with
// status 'released'. The procedure mirrors the Kayak-Confluence-Skill.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { readJson, str } from "../../../packages/core/src/http";
import { mailEnabled, mailHtml, sendMail } from "../../../packages/core/src/mail";
import { modelFor } from "../../../packages/core/src/ai";
import { Env, User, atLeast, superadmins } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const confluence = new Hono<V>();

const WWW = "https://www.kayaksa.com";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SECTIONS = ["Regulatory", "Financial", "Deals", "Business", "Technology"] as const;
const IMAGES = ["boardroom", "mumbai", "kayak", "confluence"];

// Kayak solutions take turns in the spotlight. SeeCounter is never spotlighted: Confluence does not cover counterfeiting.
export const ROTATION = [
  { tool: "NexaPair UAE", url: "https://www.nexapair.ae", page: `${WWW}/solutions/nexapair` },
  { tool: "SayUsNow", url: "", page: `${WWW}/solutions/sayusnow` },
  { tool: "DocuVow", url: "", page: `${WWW}/solutions/docuvow` },
  { tool: "NexaPair", url: "https://www.nexapair.in", page: `${WWW}/solutions/nexapair` },
];

const db = (c: any): D1Database => {
  if (!c.env.WWW_DB) throw Object.assign(new Error("The website database is not connected."), { status: 503 });
  return c.env.WWW_DB;
};

// ---------------------------------------------------------------- dates
/** Issue YYYY-MM covers the 25th of month M-2 to the 25th of month M-1. */
export function periodOf(id: string) {
  const [y, m] = id.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 3, 25)), to = new Date(Date.UTC(y, m - 2, 25));
  const f = (d: Date, yr = true) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${yr ? " " + d.getUTCFullYear() : ""}`;
  const s = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
  return {
    month: `${MONTHS[m - 1]} ${y}`,
    period: `${f(from, from.getUTCFullYear() !== to.getUTCFullYear())} – ${f(to)}`,
    periodShort: `${s(from)} – ${s(to)} ${to.getUTCFullYear()}`,
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
  };
}
/** The issue due now: after the 25th of a month, the next month's issue. */
export function dueIssue(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  let y = ist.getUTCFullYear(), m = ist.getUTCMonth() + 1; // 1-12, the current month
  if (ist.getUTCDate() >= 26) m += 1;
  if (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- the editorial rules (shared by every AI step)
const RULES = `You are on the Confluence desk of Kayak Strategic Advisors Private Limited (Kayak), an Indian advisory firm in Mumbai and Thane with six service clusters: Strategy, Deal & Transactions; Tax, Legal & Regulatory; Crisis & Resilience; Technology & AI; Managed Services; International Desk. Confluence is Kayak's premier monthly business-insight magazine for boards, promoters, CFOs and family offices.

Non-negotiable rules:
1. Facts only from sources you actually found, each with its date and URL. Never invent facts, figures, dates, quotes or URLs. If unsure, leave it out.
2. Only developments dated inside the period. If something just outside the period is essential, say so explicitly in the text.
3. Political neutrality. Report government, regulator and court actions as facts. Never praise, criticise or speculate about governments, parties, politicians or their motives. No commentary on elections, religion, caste or conflicts beyond neutral facts.
4. Legal safety. Real companies and people appear only in factual reporting, never in an opinion, criticism, prediction or allegation. No views on any security's price or merits; no buy/sell/hold language. Kayak is not a law firm and not a SEBI-registered investment adviser or research analyst.
5. Kayak's perspective is always built on a fictional scenario using the Relativity Index cast: Ram (promoter/MD of A Ltd, listed mid-sized manufacturer), Shyam (CFO), Sita (independent director, audit committee chair), Geeta (founder of Q Pvt Ltd, a technology company), John (partner at P Capital, an overseas fund), Johnny (runs R Services, an exporter of services), Janardan (head of a family office), and fictional companies A, B, C, P, Q, R. Write "In this scenario, our perspective is that…". Never apply the perspective universally.
6. Never mention counterfeiting, fakes or piracy anywhere.
7. British English, plain and precise, no hype, no exclamation marks, no em-dash flourishes.
Respond with JSON only, no prose before or after.`;

// ---------------------------------------------------------------- Claude with web search
async function claude(env: Env, system: string, prompt: string, opts: { search?: number; maxTokens?: number } = {}): Promise<any> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("Claude is not configured (ANTHROPIC_API_KEY).");
  const body: any = {
    model: modelFor(env, "anthropic"),
    max_tokens: opts.maxTokens || 4000,
    system,
    messages: [{ role: "user", content: prompt }],
  };
  if (opts.search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: opts.search }];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Claude: ${j?.error?.message || r.status}`);
  const text = (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("Claude did not return JSON.");
  try { return JSON.parse(text.slice(a, b + 1)); } catch { throw new Error("Claude returned malformed JSON."); }
}

async function pageText(url: string) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Kayak Confluence desk)" } });
    const h = await r.text();
    return h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").slice(0, 14000);
  } catch { return ""; }
}

// ---------------------------------------------------------------- pipeline
interface Pipe { steps: string[]; done: string[]; research: Record<string, any[]>; stories: any[]; spotlight?: any; error?: string; log: { at: string; step: string; ok: boolean; note?: string }[] }

function newPipe(): Pipe {
  return { steps: [...SECTIONS.map((s) => `research:${s}`), "spotlight", ...SECTIONS.map((s) => `write:${s}`), "assemble"], done: [], research: {}, stories: [], log: [] };
}

async function runStep(env: Env, D: D1Database, row: any, pipe: Pipe): Promise<void> {
  const step = pipe.steps.find((s) => !pipe.done.includes(s));
  if (!step) return;
  const P = periodOf(row.id);
  const [kind, section] = step.split(":");

  if (kind === "research") {
    const focus: Record<string, string> = {
      Regulatory: "Indian regulation and law affecting companies: SEBI, MCA, GST Council and CBIC, CBDT, RBI regulation of non-banks, DPDP, labour codes, competition law, courts' key business rulings; and major regulatory developments in the UAE and GCC where relevant to Indian business.",
      Financial: "Monetary policy, interest rates, the rupee, inflation, banking and capital-market developments in India; relevant global financial developments.",
      Deals: "Mergers and acquisitions, private equity, IPOs and fundraising in India, including published deal trackers.",
      Business: "Major corporate results, strategy moves and industry developments in India, global capability centres, exports.",
      Technology: "AI, data protection, cybersecurity and digital public infrastructure developments in India and globally that matter to boards.",
    };
    const out = await claude(env, RULES, `Research the period ${P.period} (inclusive: ${P.fromIso} to ${P.toIso}) for the ${section} section. Focus: ${focus[section]}
Find the two developments most significant for Indian boards, promoters, CFOs and family offices. For each, give verified facts with dates inside the period and the URLs you used.
Return JSON: {"items":[{"headline":"...","why":"one sentence on why it matters to boards","facts":[{"date":"8 Oct","text":"...","url":"https://..."}],"sources":[["Title","https://..."]]}]}`, { search: 8, maxTokens: 3500 });
    pipe.research[section] = (out.items || []).slice(0, 2);
  } else if (kind === "spotlight") {
    const used = (await D.prepare("SELECT spotlight_tool FROM editions WHERE status = 'released' ORDER BY id DESC").all<any>()).results.map((r: any) => r.spotlight_tool);
    const all = ["NexaPair UAE", ...used]; // Issue 01 spotlighted NexaPair UAE
    const pick = ROTATION.slice().sort((a, b) => lastUsed(all, a.tool) - lastUsed(all, b.tool))[0];
    const text = (await pageText(pick.url || pick.page)) + " " + (pick.url ? await pageText(pick.page) : "");
    const out = await claude(env, RULES, `Write this month's Kayak Solutions spotlight on ${pick.tool}. Use ONLY the public product information below and public, sourced regulatory or market context you find with web search. Be honest about feature status (Live / Coming soon) exactly as published. Include a disclosure that the tool is a Kayak solution (developed and marketed by Kayak Technology Solutions, intellectual property held by Kayak Innovations (OPC) Private Limited) and that Kayak has a commercial interest.
PUBLIC PRODUCT INFORMATION:
${text}
Return JSON matching: {"tool":"${pick.tool}","url":"${pick.url || pick.page}","kicker":"Kayak Solutions spotlight","title":"...","dek":"...","why":["...","..."],"regulation":[{"date":"...","text":"..."}],"modules":[["Name","Live|Coming soon","what it does"]],"helps":[["Team","how it helps"]],"numbers":[["value","label"]],"cast":[["Name","role"]],"scenario":["...","..."],"howItHelps":["In this scenario, a platform like ${pick.tool} would…","..."],"disclosure":"...","cta":"...","sources":[["Title","https://..."]]}
Keep it to two magazine pages: why 2 short paragraphs, regulation up to 3 items, modules up to 6, helps up to 5, numbers 3.`, { search: 5, maxTokens: 3500 });
    out.tool = pick.tool;
    pipe.spotlight = out;
  } else if (kind === "write") {
    const items = pipe.research[section] || [];
    for (const it of items.slice(0, section === "Deals" || section === "Technology" || section === "Regulatory" ? 2 : 1)) {
      const out = await claude(env, RULES, `Write one Confluence story for the ${section} section from these researched facts (use only these facts and sources; dates must be inside ${P.period}):
${JSON.stringify(it)}
Return JSON: {"section":"${section}","kicker":"two or three words","title":"short, sharp headline","dek":"one or two sentences","facts":[{"date":"8 Oct","text":"..."}],"numbers":[["value","label"],["value","label"],["value","label"]],"matters":["...","..."],"cast":[["Name","role in this scenario"]],"scenario":["...","..."],"perspective":["In this scenario, our perspective is that …","...","..."],"questions":["...","...","..."],"sources":[["Title","https://..."]]}
Length: facts 3-5 items, each under 60 words; perspective 3 paragraphs under 90 words each. The scenario uses only Relativity Index names and fictional companies.`, { maxTokens: 3000 });
      out.section = section;
      out.id = slug(out.title || section);
      out.image = IMAGES[pipe.stories.length % IMAGES.length];
      pipe.stories.push(out);
    }
  } else if (kind === "assemble") {
    const stories = pipe.stories.slice(0, 8);
    const out = await claude(env, RULES, `These are the stories for Confluence, ${P.month}, covering ${P.period}:
${JSON.stringify(stories.map((s) => ({ section: s.section, title: s.title, dek: s.dek, numbers: s.numbers })))}
Write the issue's front matter. Return JSON: {"coverTitle":"one or two words","coverDek":"one sentence","coverLines":["four short lines naming stories"],"editorsTitle":"...","editorsNote":["3 paragraphs; the third explains the Relativity Index scenario method"],"numbers":[["value","label"] x8 from the stories' facts only],"agenda":["six questions for boards this month"]}`, { maxTokens: 2500 });
    const issueNo = 1 + ((await D.prepare("SELECT COUNT(*) n FROM editions WHERE status = 'released'").first<any>())?.n || 0) + 1; // Issue 01 was built in
    const edition = {
      id: row.id, issue: `Issue ${String(issueNo).padStart(2, "0")}`, month: P.month, period: P.period, periodShort: P.periodShort,
      published: new Date().toISOString().slice(0, 10),
      editorsTitle: out.editorsTitle, coverTitle: out.coverTitle, coverDek: out.coverDek, coverLines: (out.coverLines || []).slice(0, 4),
      editorsNote: out.editorsNote || [], numbers: (out.numbers || []).slice(0, 8),
      cast: CAST, stories: stories.map(normaliseStory), spotlight: pipe.spotlight, agenda: (out.agenda || []).slice(0, 6),
    };
    const problems = check(edition);
    await D.prepare("UPDATE editions SET data = ?, status = 'draft', spotlight_tool = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(edition), pipe.spotlight?.tool || null, new Date().toISOString(), row.id).run();
    pipe.log.push({ at: new Date().toISOString(), step: "checks", ok: !problems.length, note: problems.join("; ") || "All checks passed" });
  }
  pipe.done.push(step);
  pipe.log.push({ at: new Date().toISOString(), step, ok: true });
}

const lastUsed = (list: string[], tool: string) => { const i = list.indexOf(tool); return i < 0 ? -1 : list.length - i; };
const slug = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const CAST: [string, string][] = [
  ["Ram", "Promoter and managing director of A Ltd, a listed mid-sized manufacturer that imports raw material"],
  ["Shyam", "Chief financial officer, the person who signs the numbers"],
  ["Sita", "Independent director and audit committee chair"],
  ["Geeta", "Founder of Q Pvt Ltd, a fast-growing technology company"],
  ["John", "Partner at P Capital, an overseas private equity fund"],
  ["Johnny", "Runs R Services, an exporter of engineering services"],
  ["Janardan", "Head of a family office that owns stakes in B and C"],
];
function normaliseStory(s: any) {
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  return { id: s.id, section: SECTIONS.includes(s.section) ? s.section : "Business", kicker: str(s.kicker, 40), title: str(s.title, 120), dek: str(s.dek, 400), image: s.image,
    facts: arr(s.facts).slice(0, 6), numbers: arr(s.numbers).slice(0, 3), matters: arr(s.matters).slice(0, 2), cast: arr(s.cast).slice(0, 3),
    scenario: arr(s.scenario).slice(0, 2), perspective: arr(s.perspective).slice(0, 3), questions: arr(s.questions).slice(0, 3), sources: arr(s.sources).slice(0, 4) };
}

/** Editorial checks before an issue can be submitted. */
export function check(e: any): string[] {
  const p: string[] = [];
  const text = JSON.stringify(e).toLowerCase();
  if (/counterfeit|piracy|fake goods/.test(text)) p.push("Mentions counterfeiting, which Confluence never covers");
  if (/\b(buy|sell|hold) (rating|recommendation|the stock|shares)\b|target price|multibagger/.test(text)) p.push("Contains investment-advice language");
  if (!e.stories?.length || e.stories.length < 6) p.push(`Only ${e.stories?.length || 0} stories; aim for 8`);
  for (const s of e.stories || []) {
    if (!s.sources?.length) p.push(`"${s.title}" has no sources`);
    if (!(s.perspective || []).some((x: string) => /in this scenario/i.test(x))) p.push(`"${s.title}" perspective does not start from the scenario`);
    if (!(s.scenario || []).join(" ").match(/Ram|Shyam|Sita|Geeta|John|Johnny|Janardan/)) p.push(`"${s.title}" scenario does not use the Relativity Index cast`);
  }
  if (!e.spotlight) p.push("No Kayak solution in the spotlight");
  else if (!/commercial interest/i.test(e.spotlight.disclosure || "")) p.push("Spotlight lacks the commercial-interest disclosure");
  return p;
}

/** Advances drafting for up to `budgetMs`. Used by the portal (one step per click) and the daily schedule. */
export async function advance(env: Env, id: string, budgetMs = 80_000): Promise<{ status: string; pipe: Pipe | null }> {
  const D = env.WWW_DB!;
  const start = Date.now();
  for (;;) {
    const row = await D.prepare("SELECT * FROM editions WHERE id = ?").bind(id).first<any>();
    if (!row || row.status !== "drafting") return { status: row?.status || "missing", pipe: row?.pipeline ? JSON.parse(row.pipeline) : null };
    const pipe: Pipe = JSON.parse(row.pipeline || "null") || newPipe();
    try { await runStep(env, D, row, pipe); delete pipe.error; }
    catch (e: any) {
      pipe.error = String(e?.message || e).slice(0, 400);
      pipe.log.push({ at: new Date().toISOString(), step: pipe.steps.find((s) => !pipe.done.includes(s)) || "?", ok: false, note: pipe.error });
      await D.prepare("UPDATE editions SET pipeline = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(pipe), new Date().toISOString(), id).run();
      return { status: "drafting", pipe };
    }
    await D.prepare("UPDATE editions SET pipeline = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(pipe), new Date().toISOString(), id).run();
    if (pipe.done.length >= pipe.steps.length) {
      const fresh = await D.prepare("SELECT status FROM editions WHERE id = ?").bind(id).first<any>();
      return { status: fresh?.status || "draft", pipe };
    }
    if (Date.now() - start >= budgetMs) break;
  }
  const row = await D.prepare("SELECT status, pipeline FROM editions WHERE id = ?").bind(id).first<any>();
  return { status: row?.status, pipe: row?.pipeline ? JSON.parse(row.pipeline) : null };
}

async function createDraft(env: Env, id: string, by: string | null) {
  const now = new Date().toISOString();
  const token = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await env.WWW_DB!.prepare("INSERT INTO editions (id, status, pipeline, preview_token, created_at, updated_at, created_by, history) VALUES (?, 'drafting', ?, ?, ?, ?, ?, ?)")
    .bind(id, JSON.stringify(newPipe()), token, now, now, by, JSON.stringify([{ at: now, by: by || "schedule", action: "drafting started" }])).run();
}

/** Daily schedule: start the due issue after the 25th, and keep drafting until done. Never releases. */
export async function scheduledConfluence(env: Env) {
  if (!env.WWW_DB || !env.ANTHROPIC_API_KEY) return;
  const id = dueIssue();
  const row = await env.WWW_DB.prepare("SELECT status FROM editions WHERE id = ?").bind(id).first<any>().catch(() => null);
  const builtIn = id === "2026-11";
  if (!row && !builtIn) await createDraft(env, id, null);
  if (builtIn) return;
  const r = await advance(env, id, 9 * 60_000);
  if (r.status === "draft" && mailEnabled(env)) {
    const fresh = await env.WWW_DB.prepare("SELECT preview_token FROM editions WHERE id = ?").bind(id).first<any>();
    for (const to of superadmins(env)) await sendMail(env, to, `Confluence ${periodOf(id).month} is drafted and waiting for review`, mailHtml({ site: "CONFLUENCE", title: `Confluence, ${periodOf(id).month}`, intro: `The draft covering ${periodOf(id).period} is ready. Nothing has been published. Review it, edit anything you wish, and release it only when you are satisfied.`, action: { label: "Review the draft", url: "https://internal.kayaksa.com/app#/confluence/" + id }, outro: `Preview: ${WWW}/confluence/${id}?preview=${fresh?.preview_token}` }));
  }
}

// ---------------------------------------------------------------- API
const hist = (row: any, by: string, action: string, note?: string) => JSON.stringify([...(JSON.parse(row.history || "[]")), { at: new Date().toISOString(), by, action, ...(note ? { note } : {}) }].slice(-100));
const isSuper = (c: any) => c.get("user").role === "superadmin";

confluence.use("*", async (c, next) => (atLeast(c.get("user"), "editor") ? next() : c.json({ error: "Editors and administrators only." }, 403)));

confluence.get("/", async (c) => {
  const { results } = await db(c).prepare("SELECT id, status, spotlight_tool, created_at, updated_at, released_at, approved_by, emailed_at, emailed_count FROM editions ORDER BY id DESC").all();
  // The next issue to work on: the one due now, or the following month once that exists.
  let due = dueIssue();
  const inc = (id: string) => { const [y, m] = id.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };
  if (due === "2026-11" || results.some((r: any) => r.id === due)) due = inc(due);
  const p = periodOf(due);
  const early = new Date().toISOString().slice(0, 10) <= p.toIso;
  return c.json({ early, editions: [{ id: "2026-11", status: "released", spotlight_tool: "NexaPair UAE", builtIn: true, released_at: "2026-11-11" }, ...results.filter((r: any) => r.id !== "2026-11")], due, duePeriod: periodOf(due), rotation: ROTATION.map((r) => r.tool), canRelease: isSuper(c), ai: !!c.env.ANTHROPIC_API_KEY });
});

confluence.post("/", async (c) => {
  const b = await readJson<any>(c, 1024);
  const id = /^\d{4}-\d{2}$/.test(b.id || "") ? b.id : dueIssue();
  if (id === "2026-11") return c.json({ error: "Issue 01 (November 2026) is already published." }, 400);
  const ex = await db(c).prepare("SELECT status FROM editions WHERE id = ?").bind(id).first<any>();
  if (ex) return c.json({ error: `${periodOf(id).month} already exists (${ex.status}).` }, 409);
  await createDraft(c.env, id, c.get("user").email);
  await audit(c, c.env.DB, c.get("user").id, "confluence.drafting_started", { id });
  return c.json({ id });
});

confluence.get("/:id", async (c) => {
  const row = await db(c).prepare("SELECT * FROM editions WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!row) return c.json({ error: "Issue not found." }, 404);
  const data = row.data ? JSON.parse(row.data) : null;
  return c.json({ ...row, data, pipeline: row.pipeline ? JSON.parse(row.pipeline) : null, history: JSON.parse(row.history || "[]"), checks: data ? check(data) : [], period: periodOf(row.id), previewUrl: `${WWW}/confluence/${row.id}?preview=${row.preview_token}`, canRelease: isSuper(c) });
});

confluence.post("/:id/step", async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ error: "Claude is not configured." }, 503);
  const r = await advance(c.env, c.req.param("id"), 0);
  return c.json(r);
});

confluence.post("/:id/restart", async (c) => {
  const row = await db(c).prepare("SELECT * FROM editions WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!row || row.status === "released") return c.json({ error: "Only unreleased issues can be redrafted." }, 400);
  await db(c).prepare("UPDATE editions SET status = 'drafting', pipeline = ?, history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(newPipe()), hist(row, c.get("user").email, "redrafting from scratch"), new Date().toISOString(), row.id).run();
  return c.json({ ok: true });
});

confluence.put("/:id", async (c) => {
  const row = await db(c).prepare("SELECT * FROM editions WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!row) return c.json({ error: "Issue not found." }, 404);
  if (row.status === "released") return c.json({ error: "A released issue cannot be edited. Withdraw it first." }, 400);
  const b = await readJson<any>(c, 600_000);
  if (!b.data?.stories || !b.data?.coverTitle) return c.json({ error: "That does not look like a complete issue." }, 400);
  b.data.id = row.id;
  await db(c).prepare("UPDATE editions SET data = ?, status = CASE WHEN status = 'submitted' THEN 'draft' ELSE status END, spotlight_tool = ?, history = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(b.data), b.data.spotlight?.tool || null, hist(row, c.get("user").email, "edited"), new Date().toISOString(), row.id).run();
  await audit(c, c.env.DB, c.get("user").id, "confluence.edited", { id: row.id });
  return c.json({ ok: true, checks: check(b.data) });
});

confluence.post("/:id/submit", async (c) => {
  const row = await db(c).prepare("SELECT * FROM editions WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!row || row.status !== "draft") return c.json({ error: "Only a finished draft can be sent for approval." }, 400);
  const problems = check(JSON.parse(row.data));
  await db(c).prepare("UPDATE editions SET status = 'submitted', submitted_by = ?, submitted_at = ?, history = ?, updated_at = ? WHERE id = ?").bind(c.get("user").email, new Date().toISOString(), hist(row, c.get("user").email, "sent for approval", problems.join("; ")), new Date().toISOString(), row.id).run();
  if (mailEnabled(c.env)) for (const to of superadmins(c.env)) await sendMail(c.env, to, `Approval needed: Confluence ${periodOf(row.id).month}`, mailHtml({ site: "CONFLUENCE", title: "Confluence is waiting for your approval", intro: `${c.get("user").name || c.get("user").email} has sent Confluence, ${periodOf(row.id).month}, for your approval. It will not be published until you release it.${problems.length ? `<br><br>Open checks: ${problems.join("; ")}` : ""}`, action: { label: "Review and release", url: "https://internal.kayaksa.com/app#/confluence/" + row.id } }));
  await audit(c, c.env.DB, c.get("user").id, "confluence.submitted", { id: row.id });
  return c.json({ ok: true });
});

// Release is the SuperAdmin's decision alone.
confluence.post("/:id/release", async (c) => {
  if (!isSuper(c)) return c.json({ error: "Only the SuperAdmin can release Confluence." }, 403);
  const b = await readJson<any>(c, 1024);
  if (b.confirm !== "RELEASE") return c.json({ error: "Type RELEASE to confirm." }, 400);
  const row = await db(c).prepare("SELECT * FROM editions WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!row || !["draft", "submitted"].includes(row.status) || !row.data) return c.json({ error: "Only a finished draft can be released." }, 400);
  const now = new Date().toISOString();
  await db(c).prepare("UPDATE editions SET status = 'released', approved_by = ?, approved_at = ?, released_at = ?, history = ?, updated_at = ? WHERE id = ?").bind(c.get("user").email, now, now, hist(row, c.get("user").email, "approved and released"), now, row.id).run();
  await audit(c, c.env.DB, c.get("user").id, "confluence.released", { id: row.id });
  let sent = 0;
  if (b.email && mailEnabled(c.env)) {
    const E = JSON.parse(row.data);
    const { results } = await db(c).prepare("SELECT email FROM subscribers WHERE list = 'confluence' AND status = 'active'").all<any>().catch(() => ({ results: [] as any[] }));
    const env2 = { ...c.env, MAIL_FROM: "Kayak Strategic Advisors <advisory@kayaksa.com>" };
    for (const s of results) {
      if (await sendMail(env2 as any, s.email, `Confluence, ${E.month}: ${E.coverTitle}`, mailHtml({ site: "CONFLUENCE", title: `${E.coverTitle}`, intro: `${E.coverDek}<br><br><b>In this issue</b><br>${E.coverLines.join("<br>")}${E.spotlight ? `<br>Spotlight: ${E.spotlight.tool}` : ""}<br><br>Covering ${E.period}.`, action: { label: "Open the magazine", url: `${WWW}/confluence/${E.id}` }, outro: "Kayak's perspectives are built on fictional scenarios and are not legal, tax or investment advice. Your perspective may be different. For more details, write to advisory@kayaksa.com. You receive Confluence because you subscribed at www.kayaksa.com; to stop, reply with the word unsubscribe." }))) sent++;
    }
    await db(c).prepare("UPDATE editions SET emailed_at = ?, emailed_count = ? WHERE id = ?").bind(new Date().toISOString(), sent, row.id).run();
  }
  return c.json({ ok: true, emailed: sent, url: `${WWW}/confluence/${row.id}` });
});

confluence.post("/:id/withdraw", async (c) => {
  if (!isSuper(c)) return c.json({ error: "Only the SuperAdmin can withdraw an issue." }, 403);
  const row = await db(c).prepare("SELECT * FROM editions WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!row || row.status !== "released") return c.json({ error: "Only a released issue can be withdrawn." }, 400);
  await db(c).prepare("UPDATE editions SET status = 'draft', history = ?, updated_at = ? WHERE id = ?").bind(hist(row, c.get("user").email, "withdrawn from the website"), new Date().toISOString(), row.id).run();
  await audit(c, c.env.DB, c.get("user").id, "confluence.withdrawn", { id: row.id });
  return c.json({ ok: true });
});

confluence.post("/:id/preview-link", async (c) => {
  const token = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db(c).prepare("UPDATE editions SET preview_token = ? WHERE id = ?").bind(token, c.req.param("id")).run();
  return c.json({ previewUrl: `${WWW}/confluence/${c.req.param("id")}?preview=${token}` });
});
