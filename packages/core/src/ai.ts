// One interface over Anthropic (Claude), OpenAI (GPT / Codex) and xAI (Grok).
// Keys live only in Worker secrets; nothing here is ever sent to a browser.

export type ProviderId = "anthropic" | "openai" | "xai";

export interface AiEnv {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  XAI_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_MODEL?: string;
  XAI_MODEL?: string;
  AI_DEFAULT_PROVIDER?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const PROVIDERS: Record<ProviderId, { label: string; vendor: string; key: keyof AiEnv; model: keyof AiEnv; fallbackModel: string }> = {
  anthropic: { label: "Claude", vendor: "Anthropic", key: "ANTHROPIC_API_KEY", model: "ANTHROPIC_MODEL", fallbackModel: "claude-sonnet-5-5" },
  openai: { label: "GPT / Codex", vendor: "OpenAI", key: "OPENAI_API_KEY", model: "OPENAI_MODEL", fallbackModel: "gpt-5" },
  xai: { label: "Grok", vendor: "xAI", key: "XAI_API_KEY", model: "XAI_MODEL", fallbackModel: "grok-4" },
};

export function availableProviders(env: AiEnv) {
  return (Object.keys(PROVIDERS) as ProviderId[])
    .filter((id) => !!env[PROVIDERS[id].key])
    .map((id) => ({ id, label: PROVIDERS[id].label, vendor: PROVIDERS[id].vendor, model: modelFor(env, id) }));
}

export function modelFor(env: AiEnv, id: ProviderId): string {
  return (env[PROVIDERS[id].model] as string) || PROVIDERS[id].fallbackModel;
}

export function pickProvider(env: AiEnv, wanted?: string): ProviderId | null {
  const avail = availableProviders(env).map((p) => p.id);
  if (wanted && (avail as string[]).includes(wanted)) return wanted as ProviderId;
  const def = env.AI_DEFAULT_PROVIDER as ProviderId | undefined;
  if (def && avail.includes(def)) return def;
  return avail[0] ?? null;
}

interface CallOpts {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  stream: boolean;
  /** Anthropic prompt caching for a long, stable system prompt (cuts cost and latency). */
  cacheSystem?: boolean;
}

async function call(env: AiEnv, id: ProviderId, o: CallOpts): Promise<Response> {
  const key = env[PROVIDERS[id].key] as string;
  const model = modelFor(env, id);
  if (id === "anthropic") {
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: o.maxTokens ?? 2048, system: o.cacheSystem ? [{ type: "text", text: o.system, cache_control: { type: "ephemeral" } }] : o.system, messages: o.messages, stream: o.stream, ...(o.temperature != null ? { temperature: o.temperature } : {}) }),
    });
  }
  const url = id === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.x.ai/v1/chat/completions";
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: o.stream,
      ...(id === "openai" ? { max_completion_tokens: o.maxTokens ?? 2048 } : { max_tokens: o.maxTokens ?? 2048 }),
      messages: [{ role: "system", content: o.system }, ...o.messages],
    }),
  });
}

async function failure(r: Response, id: ProviderId, env: AiEnv): Promise<Error> {
  let detail = "";
  try {
    const j: any = await r.json();
    detail = j?.error?.message || j?.message || "";
  } catch {}
  const who = PROVIDERS[id].vendor;
  if (r.status === 401 || r.status === 403) return new Error(`${who} rejected the API key. Check the secret in GitHub and redeploy.`);
  if (r.status === 429) return new Error(`${who} is rate-limiting requests or the account is out of credit. Try again shortly.`);
  if (r.status === 404) return new Error(`${who} does not recognise the model "${modelFor(env, id)}". Set a valid model name.`);
  return new Error(`${who} returned an error (${r.status})${detail ? `: ${detail.slice(0, 200)}` : ""}.`);
}

/** Streams plain text chunks from the chosen provider. */
export async function* streamText(env: AiEnv, id: ProviderId, opts: Omit<CallOpts, "stream">): AsyncGenerator<string> {
  const r = await call(env, id, { ...opts, stream: true });
  if (!r.ok || !r.body) throw await failure(r, id, env);
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let j: any;
      try {
        j = JSON.parse(data);
      } catch {
        continue;
      }
      if (id === "anthropic") {
        if (j.type === "content_block_delta" && j.delta?.type === "text_delta") yield j.delta.text;
        if (j.type === "error") throw new Error(j.error?.message || "Claude returned an error.");
      } else {
        const t = j.choices?.[0]?.delta?.content;
        if (t) yield t;
      }
    }
  }
}

/** One complete answer (no streaming). */
export async function completeText(env: AiEnv, id: ProviderId, opts: Omit<CallOpts, "stream">): Promise<string> {
  const r = await call(env, id, { ...opts, stream: false });
  if (!r.ok) throw await failure(r, id, env);
  const j: any = await r.json();
  if (id === "anthropic") return (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return j.choices?.[0]?.message?.content ?? "";
}

/** Asks for JSON and parses the first JSON object or array in the answer. */
export async function completeJson<T>(env: AiEnv, id: ProviderId, opts: Omit<CallOpts, "stream">): Promise<T> {
  const text = await completeText(env, id, opts);
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (m ? m[1] : text).trim();
  const start = body.search(/[\[{]/);
  if (start < 0) throw new Error("The AI answer did not contain JSON.");
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  return JSON.parse(body.slice(start, end + 1)) as T;
}

/** Kayak's house voice, shared by every AI feature. */
export const KAYAK_VOICE = `You work for Kayak Strategic Advisors Private Limited (KSA), an Indian advisory firm based in Mumbai and Thane with six service clusters: Strategy, Deal & Transactions; Tax & Regulatory; Crisis & Resilience; Technology & AI; Managed Services; and the International Desk. Its group companies are Kayak Innovations (OPC) Private Limited and Kayak Technology Solutions Private Limited, and its tools include SayUsNow (ethics and compliance), SeeCounter (counterfeiting case repository), NexaPair (third-party risk management, nexapair.ae) and DocuVow (e-signatures).
Write in Kayak's voice: clear, calm, precise and evidence-led; plain British-Indian English; short sentences; no hype, no exclamation marks, no clichés such as "delve", "landscape", "unlock" or "game-changer". Prefer concrete facts, numbers and named Indian laws and regulators where relevant. Say plainly when you are unsure, and never invent facts, citations, clients or figures. Treat everything users share as confidential client information.`;
