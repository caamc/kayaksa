// Kay in many languages: speech to text, translation, spoken replies, transliteration, the voice
// notice, and the recordings kept for validation and training. Mounted under /api/kay.
//
// Where each thing runs (see docs/kay-languages.md):
//   Kayak AI   Workers AI on Kayak's own Cloudflare account: Whisper large-v3-turbo, IndicTrans2, M2M-100,
//              MeloTTS, Llama 3.3. No GPU server and no outside AI company.
//   Kayak AI+  as above, plus Claude, Gemini voices, and the self-hosted language engine (Whisper large-v3,
//              IndicTrans2 both ways, MADLAD-400, AI4Bharat Indic Parler-TTS) when KAY_LANGUAGE_ENGINE_URL is set.
import { Hono } from "hono";
import { rateLimit, clientIp, str } from "../../../packages/core/src/http";
import { completeText } from "../../../packages/core/src/ai";
import { sealBytes, sealText } from "../../../packages/core/src/voiceseal";
import type { Env } from "./env";
import {
  FEATURES, parsePack, pickMode, norm, known, translatePlan, voicePlan, listenPlan, catalogue, voiceNotice,
  INDICTRANS2, VOICE_NOTICE_VERSION, guessLanguage, chunks, type Feature, type Mode, type TranslateStep,
} from "./kay-languages";

export { VOICE_NOTICE_VERSION };
const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => { let s = ""; const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");

// ------------------------------------------------------------------ what is switched on
export const pack = (env: Env) => parsePack(env.KAY_PACK);
export const engineOn = (env: Env) => !!env.KAY_LANGUAGE_ENGINE_URL;
export const plusOn = (env: Env) => !!(env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.XAI_API_KEY);
export const ownOn = (env: Env) => !!env.AI;
export const retentionDays = (env: Env) => Math.max(1, Math.min(3650, Number(env.KAY_VOICE_RETENTION_DAYS || 365)));
export const recordingsOn = (env: Env, p = pack(env)) => p.has("recordings") && !!env.VOICE && (env.KAY_VOICE_KEY || "").length >= 32;
export function modeFor(env: Env, asked: unknown): Mode | null {
  return pickMode(asked, pack(env), plusOn(env), ownOn(env));
}
export class PackError extends Error { constructor(public feature: Feature) { super(`${feature} is not in this client pack`); } }
const need = (env: Env, f: Feature) => { if (!pack(env).has(f)) throw new PackError(f); };
const packRefusal = (f: Feature) => ({ error: "That feature is not switched on for this site.", code: "KAY_FEATURE_NOT_IN_PACK", feature: f });

// ------------------------------------------------------------------ the language engine (optional, self-hosted)
// Same API as NexaPair's ml/nexamind-language service, so one GPU server can serve both.
async function engine(env: Env, path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const base = String(env.KAY_LANGUAGE_ENGINE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("language engine not configured");
  const headers = new Headers(init.headers);
  if (env.KAY_LANGUAGE_ENGINE_TOKEN) headers.set("Authorization", `Bearer ${env.KAY_LANGUAGE_ENGINE_TOKEN}`);
  const r = await fetch(base + path, { ...init, headers, signal: AbortSignal.timeout(init.timeoutMs ?? 20000) });
  if (!r.ok) throw new Error(`language engine ${path} ${r.status}`);
  return r;
}

// ------------------------------------------------------------------ translation
async function step(env: Env, s: TranslateStep, text: string): Promise<string> {
  if (s.engine === "engine") {
    const r = await engine(env, "/v1/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, source: s.from, target: s.to }) });
    return String(((await r.json()) as any).text || "").trim();
  }
  if (!env.AI) throw new Error("Workers AI is not connected");
  // Both models translate a sentence or two at a time (IndicTrans2 stops at 256 tokens), so longer text
  // goes in pieces, keeping paragraph and line breaks.
  if (s.engine === "indictrans2" || s.engine === "m2m100") {
    const parts = chunks(text);
    const todo = parts.filter((p) => p.text.trim());
    let out: string[];
    if (s.engine === "indictrans2") {
      const r: any = await env.AI.run("@cf/ai4bharat/indictrans2-en-indic-1B" as any, { text: todo.map((p) => p.text), target_language: INDICTRANS2[s.to] } as any);
      out = (r?.translations || []).map((t: unknown) => String(t || "").trim());
    } else {
      out = [];
      for (const p of todo) out.push(String(((await env.AI.run("@cf/meta/m2m100-1.2b" as any, { text: p.text, source_lang: s.from, target_lang: s.to } as any)) as any)?.translated_text || "").trim());
    }
    if (out.length !== todo.length || out.some((t) => !t)) throw new Error(`${s.engine} returned an incomplete translation`);
    let i = 0;
    return parts.map((p) => (p.text.trim() ? out[i++] : "") + p.sep).join("").trim();
  }
  // Kayak AI+ only: Claude for language pairs the open models do not cover.
  const name = (c: string) => { try { return new Intl.DisplayNames(["en"], { type: "language" }).of(c) || c; } catch { return c; } };
  return (await completeText(env, "anthropic", {
    system: `Translate the user's text from ${s.from ? name(s.from) : "its language"} into ${name(s.to)}. Keep names, numbers and links as they are. Reply with the translation only.`,
    messages: [{ role: "user", content: text }], maxTokens: 1200, temperature: 0, model: env.KAY_TRANSLATE_MODEL || "claude-haiku-5-5",
  })).trim();
}

/** Translates text, trying the language engine first (Kayak AI+), then Kayak's own Workers AI models. */
export async function translateText(env: Env, text: string, from: string, to: string, mode: Mode): Promise<{ text: string; engine: string; steps: TranslateStep[] }> {
  from = norm(from) || guessLanguage(text);
  to = norm(to);
  const llm = mode === "kayak_ai_plus" && !!env.ANTHROPIC_API_KEY;
  const plans: TranslateStep[][] = [];
  if (mode === "kayak_ai_plus" && engineOn(env)) plans.push(translatePlan(from, to, { engine: true, llm: false }) || []);
  const own = translatePlan(from, to, { engine: false, llm });
  if (own) plans.push(own);
  if (!plans.length) throw new Error("no translation route");
  let last: unknown = null;
  for (const plan of plans) {
    if (!plan.length) return { text, engine: "none", steps: [] };
    try {
      let out = text;
      for (const s of plan) { out = await step(env, s, out); if (!out) throw new Error(`${s.engine} returned nothing`); }
      return { text: out.slice(0, 6000), engine: plan.map((s) => s.engine).join("+"), steps: plan };
    } catch (e) { last = e; console.error("kay translate", plan.map((s) => s.engine).join("+"), String((e as any)?.message || e).slice(0, 200)); }
  }
  throw last instanceof Error ? last : new Error("translation failed");
}

// ------------------------------------------------------------------ transliteration (server side: smart, for any script)
// The browser converts Roman letters to Indian scripts itself (assets/kay-xlit.js, no network). The server
// handles everything else: phonetic Hinglish-style input, scripts the rules do not cover, and native -> Roman.
export async function transliterate(env: Env, text: string, lang: string, direction: "to_native" | "to_roman", mode: Mode): Promise<{ text: string; engine: string }> {
  if (mode === "kayak_ai_plus" && engineOn(env)) {
    try {
      const r = await engine(env, "/v1/transliterate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, language: lang, direction }) });
      const t = String(((await r.json()) as any).text || "").trim();
      if (t) return { text: t, engine: "engine" };
    } catch (e: any) { console.error("kay xlit engine", e?.message); }
  }
  let name = lang;
  try { name = new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || lang; } catch {}
  const system = direction === "to_native"
    ? `The user typed ${name} words in Roman (English) letters, the way people type on a phone. Rewrite them in the standard ${name} script, word for word. Do not translate. Keep English words, names, numbers and punctuation as they are. Reply with the converted text only.`
    : `Write the user's ${name} text in Roman (English) letters, the way an Indian reader would type it, word for word. Do not translate. Reply with the converted text only.`;
  if (mode === "kayak_ai_plus" && env.ANTHROPIC_API_KEY) {
    const t = await completeText(env, "anthropic", { system, messages: [{ role: "user", content: text }], maxTokens: 800, temperature: 0, model: env.KAY_TRANSLATE_MODEL || "claude-haiku-5-5" }).catch(() => "");
    if (t.trim()) return { text: t.trim(), engine: "claude" };
  }
  if (env.AI) {
    const r: any = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any, { messages: [{ role: "system", content: system }, { role: "user", content: text }], max_tokens: 800, temperature: 0 } as any).catch(() => null);
    const t = String(r?.response || "").trim();
    if (t) return { text: t, engine: "workers-ai" };
  }
  throw new Error("transliteration failed");
}

// ------------------------------------------------------------------ speech to text
const HALLUCINATIONS = /^(thank you\.?|thanks for watching\.?|you|bye\.?|\.|subtitles by.*|please subscribe.*)$/i;
const cleanText = (t: unknown) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return HALLUCINATIONS.test(s) ? "" : s.slice(0, 2000); };

type Heard = { text: string; language: string; engine: string };
export async function hear(env: Env, audio: ArrayBuffer, type: string, lang: string, mode: Mode, fallbacks: { gemini?: (b: ArrayBuffer, t: string) => Promise<string>; openai?: (b: ArrayBuffer, t: string) => Promise<string> } = {}): Promise<Heard> {
  const plan = listenPlan(mode, { engine: engineOn(env), workers: !!env.AI, gemini: !!(env.GEMINI_API_KEY && fallbacks.gemini), openai: !!(env.OPENAI_API_KEY && fallbacks.openai) });
  const hint = lang && lang !== "auto" ? norm(lang) : "";
  for (const p of plan) {
    try {
      if (p === "engine") {
        const form = new FormData();
        form.append("file", new File([audio], "speech." + (type.split("/")[1] || "webm"), { type }));
        if (hint) form.append("language", hint);
        const r: any = await (await engine(env, "/v1/transcribe", { method: "POST", body: form, timeoutMs: 45000 })).json();
        const text = cleanText(r.text);
        if (text) return { text, language: norm(r.language) || hint, engine: "whisper-large-v3" };
      }
      if (p === "workers") {
        const input: any = { audio: b64(audio), task: "transcribe", vad_filter: true, condition_on_previous_text: false };
        if (hint && hint !== "yue") input.language = hint === "jv" ? "jw" : hint;
        const r: any = await env.AI!.run("@cf/openai/whisper-large-v3-turbo" as any, input);
        const text = cleanText(r?.text);
        if (text) return { text, language: norm(r?.transcription_info?.language) || hint, engine: "whisper-large-v3-turbo" };
      }
      if (p === "gemini" && fallbacks.gemini) { const text = cleanText(await fallbacks.gemini(audio, type)); if (text) return { text, language: hint || guessLanguage(text), engine: "gemini" }; }
      if (p === "openai" && fallbacks.openai) { const text = cleanText(await fallbacks.openai(audio, type)); if (text) return { text, language: hint || guessLanguage(text), engine: "openai" }; }
    } catch (e: any) { console.error("kay listen", p, String(e?.message || e).slice(0, 200)); }
  }
  return { text: "", language: hint, engine: "none" };
}

// ------------------------------------------------------------------ spoken replies
export type Audio = { bytes: ArrayBuffer; type: string; voice: string };
type Voices = { gemini?: (t: string, lang: string) => Promise<{ bytes: ArrayBuffer; type: string }>; openai?: (t: string, lang: string) => Promise<{ bytes: ArrayBuffer; type: string }> };
export async function speakIn(env: Env, text: string, lang: string, mode: Mode, voices: Voices): Promise<Audio | null> {
  const plan = voicePlan(lang, mode, { engine: engineOn(env), gemini: !!(env.GEMINI_API_KEY && voices.gemini), openai: !!(env.OPENAI_API_KEY && voices.openai), melo: !!env.AI });
  for (const v of plan) {
    try {
      if (v === "engine") {
        const r = await engine(env, "/v1/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, language: norm(lang) }), timeoutMs: 45000 });
        return { bytes: await r.arrayBuffer(), type: r.headers.get("Content-Type") || "audio/wav", voice: "indic-parler-tts" };
      }
      if (v === "gemini" && voices.gemini) return { ...(await voices.gemini(text, norm(lang))), voice: "gemini" };
      if (v === "openai" && voices.openai) return { ...(await voices.openai(text, norm(lang))), voice: "openai" };
      if (v === "melo") {
        const r: any = await env.AI!.run("@cf/myshell-ai/melotts" as any, { prompt: text, lang: norm(lang) } as any);
        const a = typeof r?.audio === "string" ? r.audio : "";
        if (a) return { bytes: unb64(a).buffer as ArrayBuffer, type: "audio/mpeg", voice: "melotts" };
      }
    } catch (e: any) { console.error("kay speak", v, String(e?.message || e).slice(0, 200)); }
  }
  return null; // the browser uses the device's own voice
}

// ------------------------------------------------------------------ recordings: sealed, kept, then deleted
async function hasVoiceConsent(env: Env, vid: string): Promise<boolean> {
  if (!/^[a-z0-9-]{16,40}$/i.test(vid)) return false;
  const row = await env.DB.prepare("SELECT granted, notice_version FROM consents WHERE vid = ? AND purpose = 'kay_voice' ORDER BY id DESC LIMIT 1").bind(vid).first<any>();
  return !!row && row.granted === 1 && row.notice_version === VOICE_NOTICE_VERSION;
}

async function keep(c: any, audio: ArrayBuffer, type: string, h: Heard, o: { vid: string; mode: Mode; lang: string; durationMs: number; page: string }): Promise<string | null> {
  const env: Env = c.env;
  const id = crypto.randomUUID();
  const at = new Date();
  const key = `v1/${at.toISOString().slice(0, 7)}/${id}.bin`;
  const ipHash = hex(await crypto.subtle.digest("SHA-256", enc.encode(`${env.STATS_SALT || "kay"}|${clientIp(c)}|${at.toISOString().slice(0, 10)}`))).slice(0, 32);
  await env.VOICE!.put(key, await sealBytes(env.KAY_VOICE_KEY, new Uint8Array(audio)), { customMetadata: { sealed: "aes-256-gcm", type } });
  await env.DB.prepare(`INSERT INTO kay_recordings (id, at, vid, mode, lang, heard_lang, duration_ms, bytes, mime, r2_key, transcript, engine, notice_version, page, ip_hash, status, retain_until)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'kept', ?)`)
    .bind(id, at.toISOString(), o.vid, o.mode, o.lang, h.language || "", o.durationMs, audio.byteLength, type, key, await sealText(env.KAY_VOICE_KEY, h.text), h.engine, VOICE_NOTICE_VERSION, o.page,
      ipHash, new Date(at.getTime() + retentionDays(env) * 86400_000).toISOString()).run()
    .catch(async (e) => { await env.VOICE!.delete(key).catch(() => {}); throw e; });
  return id;
}

/** Daily: deletes recordings past their retention date, unless under a legal hold. */
export async function purgeRecordings(env: Env) {
  if (!env.DB) return;
  const nowIso = new Date().toISOString();
  const rows = await env.DB.prepare("SELECT id, r2_key FROM kay_recordings WHERE retain_until < ? AND status NOT IN ('legal_hold','deleted') LIMIT 500").bind(nowIso).all<any>().catch(() => ({ results: [] as any[] }));
  for (const r of rows.results) {
    await env.VOICE?.delete(r.r2_key).catch(() => {});
    await env.DB.prepare("UPDATE kay_recordings SET status = 'deleted', transcript = '', deleted_at = ?, deleted_reason = 'retention' WHERE id = ?").bind(nowIso, r.id).run();
  }
}

function usage(c: any, col: string, n = 1) {
  if (!/^[a-z_]+$/.test(col)) return;
  const day = new Date().toISOString().slice(0, 10);
  c.executionCtx.waitUntil(c.env.DB.prepare(`INSERT INTO kay_usage (day, ${col}) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET ${col} = ${col} + excluded.${col}`).bind(day, n).run().catch(() => {}));
}

// ------------------------------------------------------------------ routes
type Fallbacks = {
  transcribe: { gemini?: (b: ArrayBuffer, t: string) => Promise<string>; openai?: (b: ArrayBuffer, t: string) => Promise<string> };
  voices: (env: Env) => Voices;
};

export function kayLanguageApi(fb: (env: Env) => Fallbacks) {
  const app = new Hono<{ Bindings: Env }>();
  app.onError((e, c) => (e instanceof PackError ? c.json(packRefusal(e.feature), 403) : (console.error("kay language", e?.message), c.json({ error: "Something went wrong. Please try again." }, 500))));

  // What this site's pack switches on, the languages, and the notice to show before listening.
  app.get("/config", (c) => {
    const p = pack(c.env);
    const rec = recordingsOn(c.env, p);
    const modes = (["kayak_ai_plus", "kayak_ai"] as Mode[]).filter((m) => p.has(m) && (m === "kayak_ai" ? ownOn(c.env) : plusOn(c.env)));
    return c.json({
      features: Object.fromEntries(FEATURES.map((f) => [f, p.has(f) && (f !== "recordings" || rec)])),
      modes, defaultMode: modes[0] || null,
      engine: engineOn(c.env),
      languages: p.has("languages") ? catalogue({ engine: engineOn(c.env), plus: plusOn(c.env) }) : catalogue({ engine: false, plus: false }).filter((l) => l.code === "en"),
      notice: voiceNotice(rec, retentionDays(c.env)),
    }, 200, { "Cache-Control": "public, max-age=300" });
  });

  app.post("/translate", async (c) => {
    need(c.env, "translate");
    if (!(await rateLimit(c.env.DB, `kaytr:${clientIp(c)}`, 60, 600))) return c.json({ error: "Too many translations. Please wait a moment." }, 429);
    const b: any = await c.req.json().catch(() => ({}));
    const text = str(b.text, 4000), to = norm(b.to);
    if (!text || !known(to)) return c.json({ error: "Nothing to translate." }, 400);
    const mode = modeFor(c.env, b.mode);
    if (!mode) return c.json({ error: "Kay is not connected to an AI service yet." }, 503);
    try {
      const r = await translateText(c.env, text, str(b.from, 8), to, mode);
      usage(c, "translations", 1);
      return c.json({ text: r.text, engine: r.engine, to, machine: true });
    } catch { return c.json({ error: "That could not be translated just now." }, 502); }
  });

  app.post("/transliterate", async (c) => {
    need(c.env, "transliterate");
    if (!(await rateLimit(c.env.DB, `kayxl:${clientIp(c)}`, 60, 600))) return c.json({ error: "Too many requests. Please wait a moment." }, 429);
    const b: any = await c.req.json().catch(() => ({}));
    const text = str(b.text, 2000), lang = norm(b.lang);
    const direction = b.direction === "to_roman" ? "to_roman" : "to_native";
    if (!text || !known(lang)) return c.json({ error: "Nothing to convert." }, 400);
    const mode = modeFor(c.env, b.mode);
    if (!mode) return c.json({ error: "Kay is not connected to an AI service yet." }, 503);
    try { return c.json(await transliterate(c.env, text, lang, direction, mode)); }
    catch { return c.json({ error: "That could not be converted just now." }, 502); }
  });

  // The visitor's decision on the voice notice, recorded against their random browser id (no name, email or IP).
  app.post("/voice/consent", async (c) => {
    if (!(await rateLimit(c.env.DB, `kayvc:${clientIp(c)}`, 30, 3600))) return c.json({ error: "Too many requests." }, 429);
    const b: any = await c.req.json().catch(() => ({}));
    const vid = str(b.vid, 40);
    if (!/^[a-z0-9-]{16,40}$/i.test(vid) || b.version !== VOICE_NOTICE_VERSION) return c.json({ error: "Please read the latest notice and try again.", code: "KAY_VOICE_NOTICE_CHANGED" }, 409);
    await c.env.DB.prepare("INSERT INTO consents (vid, purpose, granted, trigger, notice_version, page, at) VALUES (?, 'kay_voice', ?, 'kay_voice_notice', ?, ?, ?)")
      .bind(vid, b.granted ? 1 : 0, VOICE_NOTICE_VERSION, str(b.page, 200), new Date().toISOString()).run();
    return c.json({ ok: true, version: VOICE_NOTICE_VERSION });
  });

  // "Delete my recordings": everything this browser recorded, except anything under a legal hold.
  app.post("/voice/forget", async (c) => {
    if (!(await rateLimit(c.env.DB, `kayvf:${clientIp(c)}`, 10, 3600))) return c.json({ error: "Too many requests." }, 429);
    const b: any = await c.req.json().catch(() => ({}));
    const vid = str(b.vid, 40);
    if (!/^[a-z0-9-]{16,40}$/i.test(vid)) return c.json({ error: "Not understood." }, 400);
    const rows = await c.env.DB.prepare("SELECT id, r2_key, status FROM kay_recordings WHERE vid = ? AND status != 'deleted'").bind(vid).all<any>();
    const at = new Date().toISOString();
    let deleted = 0, held = 0;
    for (const r of rows.results) {
      if (r.status === "legal_hold") { held++; continue; }
      await c.env.VOICE?.delete(r.r2_key).catch(() => {});
      await c.env.DB.prepare("UPDATE kay_recordings SET status = 'deleted', transcript = '', deleted_at = ?, deleted_reason = 'visitor' WHERE id = ?").bind(at, r.id).run();
      deleted++;
    }
    await c.env.DB.prepare("INSERT INTO consents (vid, purpose, granted, trigger, notice_version, page, at) VALUES (?, 'kay_voice', 0, 'kay_voice_forget', ?, '', ?)").bind(vid, VOICE_NOTICE_VERSION, at).run();
    return c.json({ ok: true, deleted, held });
  });

  // Speech to text. When recordings are on, the visitor must have accepted the current notice first.
  app.post("/listen", async (c) => {
    need(c.env, "voice_in");
    const mode = modeFor(c.env, c.req.query("mode"));
    if (!mode || (!c.env.AI && !engineOn(c.env) && !c.env.GEMINI_API_KEY && !c.env.OPENAI_API_KEY)) return c.json({ error: "Voice input is not configured. Please type instead." }, 503);
    const ip = clientIp(c);
    if (!(await rateLimit(c.env.DB, `kaylisten:${ip}`, 40, 600)) || !(await rateLimit(c.env.DB, `kaylistenday:${ip}`, 200, 86400))) return c.json({ error: "You've spoken to me a lot today. Please type for now." }, 429);
    if (!(await rateLimit(c.env.DB, "kaylisten:all", Number(c.env.KAY_VOICE_DAILY_CAP || 3000), 86400))) return c.json({ error: "Voice is resting for today. Please type instead." }, 429);
    const type = (c.req.header("Content-Type") || "audio/webm").split(";")[0].trim().toLowerCase();
    if (!/^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)$/.test(type)) return c.json({ error: "Unsupported audio." }, 415);
    const vid = str(c.req.header("X-Kay-Vid"), 40);
    const rec = recordingsOn(c.env);
    if (rec && !(await hasVoiceConsent(c.env, vid))) return c.json({ error: "Please read and accept the voice notice first.", code: "KAY_VOICE_CONSENT_REQUIRED", notice: voiceNotice(true, retentionDays(c.env)) }, 428);
    if (Number(c.req.header("Content-Length") || 0) > 5_000_000) return c.json({ error: "That recording is too long. Please keep it under a minute." }, 413);
    const audio = await c.req.arrayBuffer();
    if (audio.byteLength < 1000) return c.json({ error: "I didn't catch anything. Please try again." }, 400);
    if (audio.byteLength > 5_000_000) return c.json({ error: "That recording is too long. Please keep it under a minute." }, 413);
    const durationMs = Math.max(0, Math.min(120_000, Number(c.req.header("X-Kay-Duration") || 0) || 0));
    const lang = c.req.query("lang") || "";
    const f = fb(c.env);
    const h = await hear(c.env, audio, type, lang, mode, f.transcribe);
    usage(c, "voice_in", 1);
    let stored: string | null = null;
    if (rec && h.text) stored = await keep(c, audio, type, h, { vid, mode, lang: norm(lang) || "auto", durationMs, page: str(c.req.header("X-Kay-Page"), 120) }).catch((e) => { console.error("kay keep", e?.message); return null; });
    if (!h.text) return c.json({ error: "I couldn't make that out. Please try again, or type.", stored: false }, 502);
    return c.json({ text: h.text, language: h.language || null, engine: h.engine, stored: !!stored, mode });
  });

  // Spoken replies in the visitor's language. Sentences are cached at the edge, per voice and language.
  app.post("/speak", async (c) => {
    const b: any = await c.req.json().catch(() => ({}));
    const p = pack(c.env);
    if (!p.has(b.read ? "read_aloud" : "voice_out")) return c.json(packRefusal(b.read ? "read_aloud" : "voice_out"), 403);
    if (!(await rateLimit(c.env.DB, `kayspeak:${clientIp(c)}`, 120, 600))) return c.json({ error: "Too many requests." }, 429);
    const text = typeof b.text === "string" ? b.text.trim().slice(0, 600) : "";
    if (!text) return c.json({ error: "Nothing to say." }, 400);
    const lang = norm(b.lang) || guessLanguage(text);
    const mode = modeFor(c.env, b.mode);
    if (!mode) return c.json({ error: "Voice is not configured.", device: true }, 503);
    const cacheKey = new Request(`https://kay-voice.cache/${mode}/${lang}/${encodeURIComponent(c.env.KAY_VOICE || "Iapetus")}/${hex(await crypto.subtle.digest("SHA-256", enc.encode(text)))}`);
    const cache = (caches as any).default as Cache;
    const hit = await cache.match(cacheKey);
    if (hit) { usage(c, "tts_cached", 1); return new Response(hit.body, { headers: { "Content-Type": hit.headers.get("Content-Type") || "audio/wav", "Cache-Control": "no-store", "X-Kay-Voice": hit.headers.get("X-Kay-Voice") || "cache" } }); }
    const a = await speakIn(c.env, text, lang, mode, fb(c.env).voices(c.env));
    if (!a) return c.json({ error: "Use the device voice.", device: true, lang }, 502);
    usage(c, "tts_chars", text.length);
    c.executionCtx.waitUntil(cache.put(cacheKey, new Response(a.bytes, { headers: { "Content-Type": a.type, "X-Kay-Voice": a.voice, "Cache-Control": "public, max-age=2592000" } })));
    return new Response(a.bytes, { headers: { "Content-Type": a.type, "Cache-Control": "no-store", "X-Kay-Voice": a.voice } });
  });

  return app;
}
