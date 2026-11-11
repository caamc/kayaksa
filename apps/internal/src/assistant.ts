// Kayak AI: chat (streamed), plus the AI helpers behind Business Cards and Presentations.
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { availableProviders, pickProvider, streamText, completeJson, modelFor, KAYAK_VOICE, ChatMessage } from "../../../packages/core/src/ai";
import { readJson, str, rateLimit } from "../../../packages/core/src/http";
import { audit } from "../../../packages/core/src/session";
import { Env, User, uid } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const ai = new Hono<V>();

const MODES: Record<string, string> = {
  general: "Help the colleague with whatever they ask. Use headings and bullet points only when they make the answer easier to scan.",
  draft: "Draft polished client-ready text: emails, proposals, letters, scopes of work and executive summaries, in Kayak's voice. Ask for missing facts with clearly marked placeholders such as [CLIENT NAME] instead of inventing them.",
  research: "Act as a research assistant on Indian and international regulation, governance, risk, investigations and technology. Separate what is well established from what may have changed since your training, and tell the user what to verify and where (statute, regulator circular, official site).",
  review: "Review the text the user pastes: point out gaps, risks, unclear wording and factual claims that need support, then offer a corrected version.",
};

// ----- Cost control -----
// Most staff questions are short look-ups or rewrites. They go to a light model; substantive work
// (drafting, research, reviews, long inputs, long threads) stays on Sonnet 5.5. History is trimmed,
// older turns are clipped, and the whole prefix is prompt-cached, so a typical turn costs roughly a
// tenth of what it did.
const LIGHT_ANTHROPIC = "claude-haiku-5-5";
const LIGHT_GEMINI = "gemini-flash-lite-latest";
const HEAVY = /\b(draft|proposal|scope|engagement letter|report|analy[sz]e|research|review|compare|strategy|due diligence|regulation|legal|contract|policy|plan|table|summar(y|ise|ize) (this|the attached))\b/i;
function isLight(mode: string, text: string, turns: number) {
  return mode === "general" && text.length < 280 && turns <= 6 && !HEAVY.test(text) && !/```|\n.*\n.*\n/.test(text);
}
function trimHistory(rows: ChatMessage[]): ChatMessage[] {
  const keep = rows.slice(-12);
  return keep.map((m, i) => (i < keep.length - 4 && m.content.length > 2500 ? { ...m, content: m.content.slice(0, 2500) + "\n…[earlier text shortened]" } : m));
}

async function underLimit(c: any, u: User) {
  const lim = Number(c.env.AI_DAILY_MESSAGE_LIMIT || 200);
  return rateLimit(c.env.DB, `ai:${u.id}:${new Date().toISOString().slice(0, 10)}`, lim, 86_400);
}

ai.get("/providers", (c) => c.json({ providers: availableProviders(c.env), default: pickProvider(c.env), modes: Object.keys(MODES) }));

ai.get("/conversations", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, title, provider, model, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100").bind(c.get("user").id).all();
  return c.json({ conversations: results });
});

ai.get("/conversations/:id", async (c) => {
  const conv = await c.env.DB.prepare("SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?").bind(c.req.param("id"), c.get("user").id).first();
  if (!conv) return c.json({ error: "Not found." }, 404);
  const { results } = await c.env.DB.prepare("SELECT role, content, created_at FROM ai_messages WHERE conv_id = ? ORDER BY id").bind(conv.id).all();
  return c.json({ conversation: conv, messages: results });
});

ai.delete("/conversations/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM ai_conversations WHERE id = ? AND user_id = ?").bind(c.req.param("id"), c.get("user").id).run();
  return c.json({ ok: true });
});

ai.post("/chat", async (c) => {
  const u = c.get("user");
  const b = await readJson<any>(c, 200_000);
  const provider = pickProvider(c.env, str(b.provider, 20));
  if (!provider) return c.json({ error: "No AI provider is connected yet. Add ANTHROPIC_API_KEY, OPENAI_API_KEY or XAI_API_KEY to the GitHub secrets and redeploy." }, 503);
  if (!(await underLimit(c, u))) return c.json({ error: "You have reached today's AI message limit. It resets at midnight UTC." }, 429);
  const text = str(b.message, 60_000);
  if (!text) return c.json({ error: "Type a message." }, 400);
  const mode = MODES[b.mode] ? b.mode : "general";
  let convId = str(b.conversationId, 60);
  const now = new Date().toISOString();
  if (convId) {
    const own = await c.env.DB.prepare("SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?").bind(convId, u.id).first();
    if (!own) return c.json({ error: "Conversation not found." }, 404);
  } else {
    convId = uid();
    await c.env.DB.prepare("INSERT INTO ai_conversations (id, user_id, title, provider, model, created_at, updated_at) VALUES (?,?,?,?,?,?,?)")
      .bind(convId, u.id, text.replace(/\s+/g, " ").slice(0, 70), provider, modelFor(c.env, provider), now, now).run();
  }
  const { results: prior } = await c.env.DB.prepare("SELECT role, content FROM ai_messages WHERE conv_id = ? ORDER BY id DESC LIMIT 12").bind(convId).all<any>();
  const history: ChatMessage[] = trimHistory(prior.reverse().map((m: any) => ({ role: m.role, content: m.content })));
  history.push({ role: "user", content: text });
  await c.env.DB.prepare("INSERT INTO ai_messages (conv_id, role, content, created_at) VALUES (?, 'user', ?, ?)").bind(convId, text, now).run();
  const system = `${KAYAK_VOICE}\n\nYou are Kayak AI, the internal assistant for Kayak staff. The colleague is ${u.name || "a Kayak colleague"}${u.title ? `, ${u.title}` : ""}. Today is ${new Date().toDateString()}.\n${MODES[mode]}\nBe concise: use as few words as the question needs, and never pad. Format answers in Markdown.`;

  // Route: light questions to Haiku (or Gemini Flash-Lite when no Claude key is chosen); the rest to the provider's main model.
  const light = b.quality !== "best" && isLight(mode, text, history.length);
  const useProvider = provider;
  let model: string | undefined;
  if (light && provider === "anthropic") model = LIGHT_ANTHROPIC;
  else if (light && provider === "google") model = LIGHT_GEMINI;
  const maxTokens = mode === "draft" || mode === "review" ? 3000 : light ? 700 : 1800;
  const shown = model || modelFor(c.env, useProvider);

  return streamSSE(c, async (s) => {
    await s.writeSSE({ event: "meta", data: JSON.stringify({ conversationId: convId, provider: useProvider, model: shown, light }) });
    let full = "";
    try {
      const run = async (m?: string) => {
        for await (const chunk of streamText(c.env, useProvider, { system, messages: history, maxTokens, model: m, cacheSystem: true, cacheMessages: true })) {
          full += chunk;
          await s.writeSSE({ event: "delta", data: JSON.stringify({ t: chunk }) });
        }
      };
      try { await run(model); }
      catch (e) { if (model && !full) await run(undefined); else throw e; } // light model unavailable: fall back to the main one
      await s.writeSSE({ event: "done", data: "{}" });
    } catch (e: any) {
      await s.writeSSE({ event: "error", data: JSON.stringify({ error: e?.message || "The AI service failed." }) });
    } finally {
      if (full) {
        await c.env.DB.batch([
          c.env.DB.prepare("INSERT INTO ai_messages (conv_id, role, content, created_at) VALUES (?, 'assistant', ?, ?)").bind(convId, full, new Date().toISOString()),
          c.env.DB.prepare("UPDATE ai_conversations SET updated_at = ? WHERE id = ?").bind(new Date().toISOString(), convId),
        ]);
      }
    }
  });
});

// ----- Business cards: turn a prompt into structured card details -----
ai.post("/card-fields", async (c) => {
  const u = c.get("user");
  const b = await readJson<any>(c, 8192);
  const provider = pickProvider(c.env, str(b.provider, 20));
  if (!provider) return c.json({ error: "No AI provider is connected yet, so fill in the fields directly." }, 503);
  if (!(await underLimit(c, u))) return c.json({ error: "Daily AI limit reached." }, 429);
  const prompt = str(b.prompt, 2000);
  try {
    const fields = await completeJson<any>(c.env, provider, {
      system: `Extract business card details from the request. Answer with JSON only, in this shape:
{"name":"","title":"","department":"","phones":["+91 98765 43210"],"email":"","website":"www.kayaksa.com","company":"ksa|group|innovations|technology","address":"","locations":"","note":""}
Rules: keep the person's exact spelling; format Indian mobile numbers as "+91 XXXXX XXXXX"; "company" is "group" when the card should show all Kayak companies, "innovations" for Kayak Innovations, "technology" for Kayak Technology Solutions, otherwise "ksa"; leave fields empty when not given; never invent details. Put anything you could not place in "note".`,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 600,
      temperature: 0,
    });
    await audit(c, c.env.DB, u.id, "cards.ai_fields");
    return c.json({ fields });
  } catch (e: any) {
    return c.json({ error: e?.message || "The AI could not read that request." }, 502);
  }
});

// ----- Presentations: plan a deck as structured slides -----
export interface DeckInputs { title: string; client: string; sector: string; cluster: string; services: string[]; audience: string; purpose: string; slides: number; notes: string }

ai.post("/deck-plan", async (c) => {
  const u = c.get("user");
  const b = await readJson<any>(c, 32_000);
  const provider = pickProvider(c.env, str(b.provider, 20));
  if (!provider) return c.json({ error: "No AI provider is connected yet. Use “Start from the service outline” instead." }, 503);
  if (!(await underLimit(c, u))) return c.json({ error: "Daily AI limit reached." }, 429);
  const i = b.inputs || {};
  const n = Math.max(6, Math.min(24, Number(i.slides) || 12));
  try {
    const spec = await completeJson<any>(c.env, provider, {
      system: `${KAYAK_VOICE}

Plan a presentation in Kayak's master format. Answer with JSON only:
{"title":"","subtitle":"","slides":[ ... ]}
Each slide is one of:
{"type":"section","title":"","kicker":""}
{"type":"bullets","title":"","kicker":"","bullets":["",""],"note":""}
{"type":"two-column","title":"","kicker":"","left":{"heading":"","bullets":[""]},"right":{"heading":"","bullets":[""]}}
{"type":"stats","title":"","kicker":"","stats":[{"value":"","label":""}],"source":""}
{"type":"process","title":"","kicker":"","steps":[{"title":"","text":""}]}
{"type":"quote","quote":"","by":""}
{"type":"table","title":"","kicker":"","columns":["",""],"rows":[["",""]]}
{"type":"closing","title":"","bullets":[""]}
Rules: exactly ${n} slides after the title slide; begin with an agenda (bullets) and end with "closing" covering next steps; at most 5 bullets of at most 16 words each; kicker is a 1–3 word eyebrow in capitals; stats only with figures you are confident are public and true, each with a source, otherwise use bullets; tailor everything to the sector, the service line and the services named; no invented client facts — use [placeholders] where client data is needed.`,
      messages: [{ role: "user", content: JSON.stringify({ title: i.title, client: i.client, sector: i.sector, serviceLine: i.cluster, services: i.services, audience: i.audience, purpose: i.purpose, extraNotes: i.notes }) }],
      maxTokens: 6000,
      temperature: 0.4,
    });
    await audit(c, c.env.DB, u.id, "decks.ai_plan", { sector: i.sector, cluster: i.cluster });
    return c.json({ spec, provider });
  } catch (e: any) {
    return c.json({ error: e?.message || "The AI could not plan the deck." }, 502);
  }
});
