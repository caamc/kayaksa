import type { Context } from "hono";
import type { AiEnv } from "../../../packages/core/src/ai";
import type { MailEnv } from "../../../packages/core/src/mail";
import type { SessionConfig } from "../../../packages/core/src/session";

export interface Env extends AiEnv, MailEnv {
  DB: D1Database;
  LEARN_DB?: D1Database;
  WWW_DB?: D1Database; // www.kayaksa.com content, enquiries and statistics // learn.kayaksa.com, for public certificate verification and learner statistics
  BRAND: R2Bucket;
  MEET_DB?: D1Database; // Kayak Meet meetings, transcripts and feedback
  MEET_REC?: R2Bucket; // Kayak Meet recordings
  VAULT?: R2Bucket; // Document Drive: encrypted identity, KYC, KYB and KYV documents
  MEET_SIGNING_KEY?: string;
  TOOLBAR_TOKEN?: string; // KSA Office Toolbar Assistant access token, shown to staff to paste into the add-in
  AI?: Ai;
  ASSETS: Fetcher;
  AUTH_ENCRYPTION_KEY: string;
  PII_ENCRYPTION_KEY?: string; // seals sensitive fields in the People Masters
  BOOTSTRAP_TOKEN?: string;
  SUPERADMIN_EMAILS: string; // comma-separated
  SITE_URL: string; // https://internal.kayaksa.com
  LEARN_URL?: string;
  AI_DAILY_MESSAGE_LIMIT?: string;
}

export type Role = "superadmin" | "admin" | "editor" | "employee";

export interface User {
  id: string;
  email: string;
  name: string;
  title: string;
  phone: string;
  role: Role;
  status: "invited" | "active" | "disabled";
  totp_enabled: number;
}

export type Ctx = Context<{ Bindings: Env; Variables: { user: User } }>;

export const SESSION: SessionConfig = { cookie: "__Host-ksa_sid", fullTtlHours: 12, idleMinutes: 60, preTtlMinutes: 10 };

const RANK: Record<Role, number> = { employee: 1, editor: 2, admin: 3, superadmin: 4 };
export const atLeast = (u: User, r: Role) => RANK[u.role] >= RANK[r];

export function superadmins(env: Env): string[] {
  return (env.SUPERADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export const uid = () => crypto.randomUUID();
