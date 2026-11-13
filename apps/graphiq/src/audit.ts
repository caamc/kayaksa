// Tamper-evident audit log. Each entry's hash is sha256(prev_hash + canonical entry), so changing,
// removing or reordering any entry breaks every hash after it, and "Verify" finds where.
// The sequence number is the primary key: two requests writing at once cannot fork the chain,
// the second one fails the insert and retries on the new head.
import { sha256hex } from "../../../packages/core/src/crypto";
import { clientIp } from "../../../packages/core/src/http";
import type { Ctx, Env, User } from "./env";

export const GENESIS = "0".repeat(64);

export function canonical(e: { seq: number; at: string; user_id: string | null; user_email: string | null; case_id: string | null; action: string; detail: string | null; ip: string | null }) {
  return JSON.stringify([e.seq, e.at, e.user_id, e.user_email, e.case_id, e.action, e.detail, e.ip]);
}

export async function appendAudit(env: Env, entry: { user?: User | null; caseId?: string | null; action: string; detail?: unknown; ip?: string | null }) {
  const detail = entry.detail == null ? null : JSON.stringify(entry.detail).slice(0, 4000);
  for (let attempt = 0; attempt < 8; attempt++) {
    const head = await env.DB.prepare("SELECT seq, hash FROM audit_chain ORDER BY seq DESC LIMIT 1").first<{ seq: number; hash: string }>();
    const e = { seq: (head?.seq || 0) + 1, at: new Date().toISOString(), user_id: entry.user?.id || null, user_email: entry.user?.email || null, case_id: entry.caseId || null, action: entry.action, detail, ip: entry.ip || null };
    const prev = head?.hash || GENESIS;
    const hash = await sha256hex(prev + canonical(e));
    try {
      await env.DB.prepare("INSERT INTO audit_chain (seq, at, user_id, user_email, case_id, action, detail, ip, prev_hash, hash) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(e.seq, e.at, e.user_id, e.user_email, e.case_id, e.action, e.detail, e.ip, prev, hash).run();
      return { seq: e.seq, hash };
    } catch (err: any) {
      if (!/UNIQUE|PRIMARY|constraint/i.test(String(err?.message))) throw err;
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 25));
    }
  }
  throw new Error("The audit log is busy. Try again.");
}

/** Audit from a request: the signed-in user and their address. */
export const audit = (c: Ctx, action: string, caseId: string | null = null, detail: unknown = null) =>
  appendAudit(c.env, { user: c.get("user"), caseId, action, detail, ip: clientIp(c) });

/** Walks the whole chain and recomputes every hash. */
export async function verifyChain(env: Env): Promise<{ ok: boolean; entries: number; brokenAt?: number; reason?: string; head?: string }> {
  let prev = GENESIS, expected = 1, after = 0, count = 0;
  for (;;) {
    const { results } = await env.DB.prepare("SELECT * FROM audit_chain WHERE seq > ? ORDER BY seq LIMIT 2000").bind(after).all<any>();
    if (!results.length) break;
    for (const r of results) {
      if (r.seq !== expected) return { ok: false, entries: count, brokenAt: expected, reason: `Entry ${expected} is missing.` };
      if (r.prev_hash !== prev) return { ok: false, entries: count, brokenAt: r.seq, reason: `Entry ${r.seq} does not link to the entry before it.` };
      const h = await sha256hex(prev + canonical(r));
      if (h !== r.hash) return { ok: false, entries: count, brokenAt: r.seq, reason: `Entry ${r.seq} has been changed since it was written.` };
      prev = r.hash; expected++; count++; after = r.seq;
    }
  }
  return { ok: true, entries: count, head: prev };
}
