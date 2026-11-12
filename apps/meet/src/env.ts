export interface Env {
  DB: D1Database;
  ROOMS: DurableObjectNamespace;
  REC: R2Bucket;
  AI?: Ai;
  ASSETS: Fetcher;
  MEET_SIGNING_KEY?: string;
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}
