// Kay's languages: which engine can listen, translate, speak and transliterate in which language,
// the client-pack switches, and the routing rules. Pure functions only (no network), so the unit
// tests can check every rule (tests/unit/kay-languages.test.mjs).
//
// Engines and their licences (all allow commercial use; credits in apps/www/THIRD_PARTY_NOTICES.md):
//   Whisper large-v3-turbo on Workers AI (MIT)       speech to text, 99 languages     Kayak AI and Kayak AI+
//   Whisper large-v3 on the language engine (MIT)     speech to text, 100 languages    Kayak AI+, when connected
//   AI4Bharat IndicTrans2 en-indic 1B on Workers AI   English to 22+ Indian languages  both
//   (MIT)
//   Meta M2M-100 1.2B on Workers AI (MIT)              any pair of 100 languages        both
//   IndicTrans2 both directions + Google MADLAD-400   on the language engine           Kayak AI+, when connected
//   (MIT, Apache-2.0)
//   AI4Bharat Indic Parler-TTS (Apache-2.0)           voice, 21 languages              Kayak AI+, language engine
//   Gemini text to speech (Google API, paid)          voice, 24 languages              Kayak AI+
//   MeloTTS on Workers AI (MIT)                        voice, 6 languages               Kayak AI
//   The visitor's own device voice                     every language the device has    fallback for both
//   Rule-based Brahmic transliteration (Kayak's own)  17 Indian languages              both, in the browser too
// Meta Seamless and MMS-TTS, and Coqui XTTS, are left out on purpose: non-commercial licences.

export const FEATURES = [
  "kayak_ai", // Kayak AI: answers from Kayak's own models on its Cloudflare account (Llama 3.3 70B)
  "kayak_ai_plus", // Kayak AI+: answers from Claude, plus the premium voices and the language engine
  "languages", // replies in a language other than English
  "voice_in", // speech to text (Whisper)
  "voice_out", // spoken replies
  "translate", // translate any message
  "transliterate", // type in Roman letters, get the native script (and back)
  "read_aloud", // read any message aloud
  "recordings", // keep what Kay hears, for validation and for training (needs the visitor's consent)
] as const;
export type Feature = (typeof FEATURES)[number];
export type Mode = "kayak_ai" | "kayak_ai_plus";

/**
 * The client pack, from KAY_PACK. Empty or "all" switches everything on (the demo and kayaksa.com).
 * A comma-separated list switches on only those features; "all,-recordings" removes one.
 * At least one of kayak_ai / kayak_ai_plus always stays on, or Kay could not answer at all.
 */
export function parsePack(raw: string | undefined): Set<Feature> {
  const parts = String(raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const on = new Set<Feature>();
  if (!parts.length || parts.includes("all")) FEATURES.forEach((f) => on.add(f));
  for (const p of parts) {
    const off = p.startsWith("-");
    const name = (off ? p.slice(1) : p) as Feature;
    if (!(FEATURES as readonly string[]).includes(name)) continue;
    off ? on.delete(name) : on.add(name);
  }
  if (!on.has("kayak_ai") && !on.has("kayak_ai_plus")) on.add("kayak_ai_plus");
  return on;
}

/** The mode a request gets: what the visitor asked for if the pack has it, otherwise the other one. */
export function pickMode(asked: unknown, pack: Set<Feature>, plusAvailable: boolean, ownAvailable: boolean): Mode | null {
  const plus = pack.has("kayak_ai_plus") && plusAvailable;
  const own = pack.has("kayak_ai") && ownAvailable;
  if (asked === "kayak_ai" && own) return "kayak_ai";
  if (asked === "kayak_ai_plus" && plus) return "kayak_ai_plus";
  return plus ? "kayak_ai_plus" : own ? "kayak_ai" : null;
}

// ------------------------------------------------------------------ language sets (ISO 639 codes)
/** Whisper's 100 languages (99 plus Cantonese), with Javanese as "jv" (Whisper's own code is "jw"). */
export const WHISPER = (
  "en zh de es ru ko fr ja pt tr pl ca nl ar sv it id hi fi vi he uk el ms cs ro da hu ta no th ur hr bg lt la mi ml " +
  "cy sk te fa lv bn sr az sl kn et mk br eu is hy ne mn bs kk sq sw gl mr pa si km sn yo so af oc ka be tg sd gu am yi " +
  "lo uz fo ht ps tk nn mt sa lb my bo tl mg as tt haw ln ha ba jv su yue"
).split(" ");
/** Whisper large-v3-turbo on Workers AI has the same tokenizer but no separate Cantonese tag. */
export const WHISPER_TURBO = WHISPER.filter((c) => c !== "yue");

/** IndicTrans2 (English to Indian languages) on Workers AI: ISO code -> FLORES-200 code. */
export const INDICTRANS2: Record<string, string> = {
  as: "asm_Beng", awa: "awa_Deva", bn: "ben_Beng", bho: "bho_Deva", brx: "brx_Deva", doi: "doi_Deva", gom: "gom_Deva",
  gon: "gon_Deva", gu: "guj_Gujr", hi: "hin_Deva", hne: "hne_Deva", kn: "kan_Knda", ks: "kas_Arab", kha: "kha_Latn",
  lus: "lus_Latn", mag: "mag_Deva", mai: "mai_Deva", ml: "mal_Mlym", mni: "mni_Beng", mr: "mar_Deva", ne: "npi_Deva",
  or: "ory_Orya", pa: "pan_Guru", sa: "san_Deva", sat: "sat_Olck", sd: "snd_Arab", ta: "tam_Taml", te: "tel_Telu", ur: "urd_Arab",
};
/** The 22 scheduled languages of India (Eighth Schedule). */
export const SCHEDULED = "as bn brx doi gu hi kn ks gom mai ml mni mr ne or pa sa sat sd ta te ur".split(" ");

/** M2M-100's 100 languages (any direction). */
export const M2M100 = (
  "af am ar ast az ba be bg bn br bs ca ceb cs cy da de el en es et fa ff fi fr fy ga gd gl gu ha he hi hr ht hu hy id ig " +
  "ilo is it ja jv ka kk km kn ko lb lg ln lo lt lv mg mk ml mn mr ms my ne nl no ns oc or pa pl ps pt ro ru sd si sk sl so " +
  "sq sr ss su sv sw ta th tl tn tr uk ur uz vi wo xh yi yo zh zu"
).split(" ");

/** Indic Parler-TTS (language engine): its 21 languages and a recommended speaker for each. */
export const PARLER = "as bn brx doi en gu hi kn gom mai ml mni mr ne or sa sat sd ta te ur".split(" ");
/** Gemini text to speech: the languages Google lists for its speech models. */
export const GEMINI_TTS = "ar bn de en es fr hi id it ja ko mr nl pl pt ro ru ta te th tr uk vi".split(" ");
/** MeloTTS on Workers AI. */
export const MELO = "en es fr zh ja ko".split(" ");
/** Llama 3.3's officially supported languages: Kayak AI answers in these directly, others via translation. */
export const LLAMA_NATIVE = "en de fr it pt hi es th".split(" ");
/** Rule-based transliteration in kay-xlit.js. */
export const XLIT = "hi mr ne sa mai gom doi brx bn as gu pa or ta te kn ml".split(" ");
/** Written right to left. */
export const RTL = new Set("ar fa he ur ps sd yi ks ug dv".split(" "));

const uniq = (a: string[]) => [...new Set(a)];
/** Every language Kay offers in the picker: anything at least one engine can read, write or hear. */
export const ALL = uniq([...WHISPER, ...M2M100, ...Object.keys(INDICTRANS2), "en"]).sort();

export function norm(code: unknown): string {
  const c = String(code ?? "").trim().toLowerCase().replace(/_/g, "-").split("-")[0];
  return ({ jw: "jv", iw: "he", nb: "no", kok: "gom", in: "id" } as Record<string, string>)[c] ?? c;
}
export const known = (code: string) => ALL.includes(code);

// ------------------------------------------------------------------ routing
export type TranslateStep = { engine: "engine" | "indictrans2" | "m2m100" | "llm"; from: string; to: string };

/**
 * How to translate from one language to another without the language engine.
 * English -> Indian language: IndicTrans2. Any pair M2M-100 knows: M2M-100. Indian language <-> anything
 * else: through English. Kayak AI+ can fall back to Claude for anything left (step "llm").
 */
export function translatePlan(from: string, to: string, o: { engine: boolean; llm: boolean }): TranslateStep[] | null {
  from = norm(from) || "en"; to = norm(to);
  if (!to || from === to) return [];
  if (o.engine) return [{ engine: "engine", from, to }];
  const direct = (a: string, b: string): TranslateStep | null =>
    a === "en" && INDICTRANS2[b] ? { engine: "indictrans2", from: a, to: b }
    : M2M100.includes(a) && M2M100.includes(b) ? { engine: "m2m100", from: a, to: b }
    : null;
  const one = direct(from, to);
  if (one) return [one];
  if (from !== "en" && to !== "en") {
    const a = direct(from, "en"), b = direct("en", to);
    if (a && b) return [a, b];
  }
  return o.llm ? [{ engine: "llm", from, to }] : null;
}

/** A best guess at the language of a text from its script, for text whose language nobody told us. */
export function guessLanguage(text: string): string {
  const t = String(text || "");
  const tests: [RegExp, string][] = [
    [/[\u0900-\u097F]/, "hi"], [/[\u0980-\u09FF]/, "bn"], [/[\u0A00-\u0A7F]/, "pa"], [/[\u0A80-\u0AFF]/, "gu"],
    [/[\u0B00-\u0B7F]/, "or"], [/[\u0B80-\u0BFF]/, "ta"], [/[\u0C00-\u0C7F]/, "te"], [/[\u0C80-\u0CFF]/, "kn"],
    [/[\u0D00-\u0D7F]/, "ml"], [/[\u0600-\u06FF]/, /[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2]/.test(t) ? "ur" : "ar"],
    [/[\u0590-\u05FF]/, "he"], [/[\u0400-\u04FF]/, "ru"], [/[\u0370-\u03FF]/, "el"], [/[\u3040-\u30FF]/, "ja"],
    [/[\uAC00-\uD7AF]/, "ko"], [/[\u4E00-\u9FFF]/, "zh"], [/[\u0E00-\u0E7F]/, "th"], [/[\u10A0-\u10FF]/, "ka"],
    [/[\u0530-\u058F]/, "hy"], [/[\u1200-\u137F]/, "am"], [/[\u0D80-\u0DFF]/, "si"], [/[\u1780-\u17FF]/, "km"],
    [/[\u1000-\u109F]/, "my"], [/[\u0E80-\u0EFF]/, "lo"], [/[\u0F00-\u0FFF]/, "bo"], [/[\u1C50-\u1C7F]/, "sat"],
  ];
  for (const [re, code] of tests) if (re.test(t)) return code;
  return "en";
}

/** Splits text into sentence groups of at most ~300 characters, remembering the break after each. */
export function chunks(text: string, max = 300): { text: string; sep: string }[] {
  const out: { text: string; sep: string }[] = [];
  for (const m of text.matchAll(/([^\n]*)(\n+|$)/g)) {
    if (!m[0]) break;
    const line = m[1], sep = m[2];
    const sentences = line.match(/[^.!?।॥。？！]+[.!?।॥。？！]*\s*/g) || [line];
    let cur = "";
    const flush = (end: string) => { if (cur) { out.push({ text: cur.trim(), sep: end }); cur = ""; } };
    for (const sn of sentences) {
      if (cur && (cur + sn).length > max) flush(" ");
      if (sn.length > max) {
        // A run-on sentence: break at spaces (or hard, for scripts written without spaces).
        flush(" ");
        for (const w of sn.match(/\S+\s*/g) || [sn]) {
          if (cur && (cur + w).length > max) flush(" ");
          if (w.length > max) { for (let i = 0; i < w.length; i += max) out.push({ text: w.slice(i, i + max).trim(), sep: "" }); continue; }
          cur += w;
        }
        continue;
      }
      cur += sn;
    }
    flush(sep);
    if (!line && sep) out.push({ text: "", sep });
  }
  return out.filter((p) => p.text || p.sep);
}

export type Voice = "engine" | "gemini" | "openai" | "melo" | "device";
/** Which voices may speak a language, best first. The browser falls back to the device voice. */
export function voicePlan(lang: string, mode: Mode, o: { engine: boolean; gemini: boolean; openai: boolean; melo: boolean }): Voice[] {
  lang = norm(lang) || "en";
  const out: Voice[] = [];
  if (mode === "kayak_ai_plus") {
    // Kay's own English voice stays Gemini (Iapetus); Indian languages prefer AI4Bharat.
    if (o.engine && PARLER.includes(lang) && lang !== "en") out.push("engine");
    if (o.gemini && GEMINI_TTS.includes(lang)) out.push("gemini");
    if (o.engine && lang === "en") out.push("engine");
    if (o.openai) out.push("openai"); // gpt-4o-mini-tts follows the language of the text
  } else {
    if (o.engine && PARLER.includes(lang)) out.push("engine");
    if (o.melo && MELO.includes(lang)) out.push("melo");
  }
  out.push("device");
  return out;
}

export type Listener = "engine" | "workers" | "gemini" | "openai";
export function listenPlan(mode: Mode, o: { engine: boolean; workers: boolean; gemini: boolean; openai: boolean }): Listener[] {
  const out: Listener[] = [];
  if (mode === "kayak_ai_plus" && o.engine) out.push("engine");
  if (o.workers) out.push("workers");
  if (mode === "kayak_ai" && o.engine) out.push("engine");
  if (mode === "kayak_ai_plus") { if (o.gemini) out.push("gemini"); if (o.openai) out.push("openai"); }
  return out;
}

/** What the visitor's browser needs to draw the panel: languages and what each one can do. */
export function catalogue(o: { engine: boolean; plus: boolean }) {
  return ALL.map((code) => ({
    code,
    hear: WHISPER.includes(code) || code === "yue",
    text: M2M100.includes(code) || !!INDICTRANS2[code] || code === "en",
    voice: (o.engine && PARLER.includes(code)) || (o.plus && GEMINI_TTS.includes(code)) || MELO.includes(code),
    xlit: XLIT.includes(code),
    rtl: RTL.has(code),
    indian: SCHEDULED.includes(code) || !!INDICTRANS2[code],
  }));
}

// ------------------------------------------------------------------ the voice notice
export const VOICE_NOTICE_VERSION = "KAY-VOICE-2026-11-20";
/** The notice a visitor accepts before Kay listens. Shown in the panel exactly as written here. */
export function voiceNotice(recordingsOn: boolean, retentionDays: number) {
  return recordingsOn
    ? {
        version: VOICE_NOTICE_VERSION,
        title: "Before you speak to Kay",
        points: [
          "What Kay hears (your recording and its transcript) is saved on Kayak's servers, encrypted.",
          "It is used only to check Kay's answers and to train and improve Kayak's AI.",
          "It is not shared with Kayak's investigators, or with any client's investigators, unless the law or an order of a court requires it.",
          `It is kept for ${retentionDays} days, then deleted. You can delete your recordings at any time from this panel.`,
          "Please don't speak confidential details, or anyone else's personal data. Speak to Kay only if you are 18 or older.",
        ],
        accept: "I agree, start listening",
        decline: "No thanks, I'll type",
      }
    : {
        version: VOICE_NOTICE_VERSION,
        title: "Before you speak to Kay",
        points: [
          "Your voice is sent to Kayak's AI service to be turned into text. The recording is not kept.",
          "Please don't speak confidential details, or anyone else's personal data. Speak to Kay only if you are 18 or older.",
        ],
        accept: "OK, start listening",
        decline: "No thanks, I'll type",
      };
}
