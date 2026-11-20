import type { AiEnv } from "../../../packages/core/src/ai";
import type { MailEnv } from "../../../packages/core/src/mail";

export interface Env extends AiEnv, MailEnv {
  DB: D1Database; // kayaksa-www: articles, enquiries, subscribers, SeeCounter cases, statistics
  ASSETS: Fetcher;
  GOOGLE_SITE_VERIFICATION?: string; // Search Console HTML-tag code (public)
  BING_SITE_VERIFICATION?: string; // Bing Webmaster Tools code (public)
  CV?: R2Bucket; // kayaksa-careers: résumés attached to applications (private)
  SITE_URL: string; // https://www.kayaksa.com
  ENQUIRY_TO?: string; // where new enquiries are emailed (needs RESEND_API_KEY)
  CONTACT_PHONE?: string; // optional rapid-response number shown on the contact page
  KAY_VOICE?: string; // Gemini voice for Kay (default "Iapetus")
  KAY_TTS_MODEL?: string;
  KAY_STT_MODEL?: string;
  STATS_SALT?: string; // secret salt so statistics never hold network addresses
  KAY_LITE_MODEL?: string; // low-cost model for small talk (default gemini-flash-lite-latest)
  KAY_MEMORY_MIN?: string; // similarity needed to answer from memory (default 0.86)
  AI?: Ai; // Workers AI: embeddings for the answer memory
  VEC?: VectorizeIndex; // Vectorize index "kay-memory"
  // Kay in many languages (kay-voice.ts, docs/kay-languages.md)
  KAY_PACK?: string; // client pack: "all" (default), a list of features, or "all,-recordings"
  KAY_LANGUAGE_ENGINE_URL?: string; // optional self-hosted engine (Whisper large-v3, IndicTrans2, MADLAD-400, Indic Parler-TTS)
  KAY_LANGUAGE_ENGINE_TOKEN?: string; // bearer token for that engine (secret)
  KAY_TRANSLATE_MODEL?: string; // Claude model for translation and transliteration fallbacks (default claude-haiku-5-5)
  VOICE?: R2Bucket; // kayaksa-kay-voice: what Kay hears, sealed with KAY_VOICE_KEY (private)
  KAY_VOICE_KEY?: string; // secret, at least 32 characters; recordings are not kept without it
  KAY_VOICE_RETENTION_DAYS?: string; // default 365
  KAY_VOICE_DAILY_CAP?: string; // speech-to-text requests per day across the site (default 3000)
}
