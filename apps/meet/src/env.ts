export interface Env {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
  SPACES: DurableObjectNamespace;
  REC: R2Bucket;
  AI?: Ai;
  ASSETS: Fetcher;
  MEET_SIGNING_KEY?: string;
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  // Town halls on Cloudflare Realtime (SFU). Set by the "Set up Cloudflare Realtime" workflow.
  CF_REALTIME_APP_ID?: string;
  CF_REALTIME_APP_SECRET?: string;
  // Day of the month Cloudflare bills on (1-28), for the monthly usage limits in usage.ts.
  USAGE_CYCLE_DAY?: string;
  // Two-way calendar sync. From GitHub secrets; see docs/meet-calendar-and-signing.md.
  MS_CLIENT_ID?: string;
  MS_CLIENT_SECRET?: string;
  MS_TENANT?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
