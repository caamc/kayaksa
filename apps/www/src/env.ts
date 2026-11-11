import type { AiEnv } from "../../../packages/core/src/ai";
import type { MailEnv } from "../../../packages/core/src/mail";

export interface Env extends AiEnv, MailEnv {
  DB: D1Database; // kayaksa-www: articles, enquiries, subscribers, SeeCounter cases, statistics
  ASSETS: Fetcher;
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
}
