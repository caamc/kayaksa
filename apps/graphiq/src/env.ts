import type { Context } from "hono";

export interface Env {
  DB: D1Database;
  /** Optional extra D1 databases for very large cases (see docs/graphiq-on-premise.md, "Sharding"). */
  [shard: `DATA_${number}`]: D1Database | undefined;
  EVIDENCE: R2Bucket;
  AI?: Ai;
  ASSETS: Fetcher;
  GRAPHIQ_SIGNING_KEY?: string;
  GRAPHIQ_DATA_KEY?: string;
  INTERNAL_URL?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}

export type Role = "admin" | "approver" | "analyst" | "viewer";
export interface User { id: string; email: string; name: string; role: Role; status: string }
export type V = { Bindings: Env; Variables: { user: User; fp?: string } };
export type Ctx = Context<V>;

export const ROLES: Role[] = ["admin", "approver", "analyst", "viewer"];
export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", approver: "Approver", analyst: "Analyst", viewer: "Viewer" };

/** What each role may do. Case data is visible only to members of the case, whatever the role. */
export const PERMS = {
  createCase: ["admin", "analyst"],
  importData: ["admin", "analyst"],
  analyse: ["admin", "analyst", "approver", "viewer"],
  export: ["admin", "analyst"],
  annotate: ["admin", "analyst"],
  approve: ["approver"],
  manageUsers: ["admin"],
  manageCase: ["admin"],
  deleteCase: ["admin"],
  editTowers: ["admin", "analyst"],
} as const satisfies Record<string, readonly Role[]>;
export type Perm = keyof typeof PERMS;
export const can = (u: User | null | undefined, p: Perm) => !!u && u.status === "active" && (PERMS[p] as readonly string[]).includes(u.role);

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();

/** The lawful-use notice every case creator must acknowledge. */
export const NOTICE_VERSION = "GQ-LAWFUL-2026-11";
export const LEGAL_BASES = {
  court_order: "Court order",
  statutory_notice: "Statutory authority notice",
  own_records: "Customer's own corporate telecom records",
  written_consent: "Written consent of the subscriber",
  other: "Other lawful basis",
} as const;
