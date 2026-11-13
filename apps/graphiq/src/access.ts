// Case access rules shared by every route: a person sees a case's data only when they are a member
// of that case, and only does what their role allows.
import { HttpError } from "../../../packages/core/src/http";
import { can, type Ctx, type Env, type Perm } from "./env";

export interface CaseRow {
  id: string; title: string; description: string | null; status: string; legal_basis: string; legal_text: string; ref_no: string; ref_date: string;
  authority: string; supervisor: string; notice_version: string; tz: string; cc: string; retain_until: string | null; shard: string; settings: string | null;
  record_count: number; restored_from: string | null; created_by: string; created_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null;
}

export async function isMember(env: Env, caseId: string, userId: string) {
  return !!(await env.DB.prepare("SELECT 1 FROM case_members WHERE case_id = ? AND user_id = ?").bind(caseId, userId).first());
}

/** Loads a case the signed-in user is a member of, checking the permission. Throws 403/404. */
export async function caseFor(c: Ctx, id: string, perm: Perm = "analyse"): Promise<CaseRow> {
  const u = c.get("user");
  const k = await c.env.DB.prepare("SELECT * FROM cases WHERE id = ?").bind(String(id).slice(0, 64)).first<CaseRow>();
  if (!k || k.status === "deleted") throw new HttpError(404, "This case does not exist or has been deleted.");
  if (!(await isMember(c.env, k.id, u.id))) throw new HttpError(403, "You are not assigned to this case.");
  if (!can(u, perm)) throw new HttpError(403, "Your role does not allow this.");
  return k;
}

/** Imports and analysis need the second user's approval first (four-eyes). */
export function needApproved(k: CaseRow) {
  if (k.status !== "approved") throw new HttpError(409, k.status === "pending" ? "This case is waiting for approval by an Approver. Data cannot be imported until it is approved." : `This case is ${k.status}; data cannot be imported.`);
}

/** The D1 database holding this case's records (sharding for very large cases). */
export function dataDb(env: Env, k: Pick<CaseRow, "shard">): D1Database {
  const d = (env as any)[k.shard];
  return d && typeof d.prepare === "function" ? d : env.DB;
}

export const tzOffsetMinutes = (tz: string) => {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(Date.now() / 60000) * 60000) / 60000);
  } catch { return 330; }
};
