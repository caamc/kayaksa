// Evidence files: SHA-256 on upload (checked against the hash the browser computed before sending),
// stored in R2 encrypted with AES-256-GCM under a per-case key derived (HKDF-SHA256) from
// GRAPHIQ_DATA_KEY, with a chain-of-custody entry for every upload, download and integrity check.
import { Hono } from "hono";
import { str, HttpError } from "../../../packages/core/src/http";
import { audit } from "./audit";
import { caseFor } from "./access";
import { now, uid, type Ctx, type Env, type V } from "./env";

export const evidence = new Hono<V>();
export const MAX_EVIDENCE_BYTES = 40 * 1024 * 1024;
const MAGIC = new TextEncoder().encode("GQE1");

async function caseKey(env: Env, caseId: string) {
  if (!env.GRAPHIQ_DATA_KEY || env.GRAPHIQ_DATA_KEY.length < 32) throw new HttpError(503, "Evidence storage is not set up yet (the data key is missing). Run the deploy workflow with graphiq included.");
  const ikm = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.GRAPHIQ_DATA_KEY), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("kayak-graphiq-evidence-v1"), info: new TextEncoder().encode(caseId) }, ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

export async function encryptFor(env: Env, caseId: string, plain: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(caseId) }, await caseKey(env, caseId), plain));
  const out = new Uint8Array(4 + 12 + ct.length);
  out.set(MAGIC, 0); out.set(iv, 4); out.set(ct, 16);
  return out;
}
export async function decryptFor(env: Env, caseId: string, sealed: Uint8Array) {
  if (sealed.length < 32 || new TextDecoder().decode(sealed.subarray(0, 4)) !== "GQE1") throw new HttpError(500, "The stored evidence file is not in the expected format.");
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.subarray(4, 16), additionalData: new TextEncoder().encode(caseId) }, await caseKey(env, caseId), sealed.subarray(16)));
  } catch { throw new HttpError(409, "The stored evidence file failed decryption: it has been altered or the data key changed."); }
}

async function custody(c: Ctx, evId: string, caseId: string, action: string, detail: unknown = null) {
  const u = c.get("user");
  await c.env.DB.prepare("INSERT INTO custody (evidence_id, case_id, at, user_id, user_email, action, detail) VALUES (?,?,?,?,?,?,?)").bind(evId, caseId, now(), u?.id || null, u?.email || null, action, detail == null ? null : JSON.stringify(detail)).run();
}

evidence.get("/cases/:id/evidence", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const { results } = await c.env.DB.prepare("SELECT e.id, e.kind, e.file_name, e.mime, e.size, e.sha256, e.note, e.created_at, u.name AS by_name FROM evidence e LEFT JOIN users u ON u.id = e.created_by WHERE e.case_id = ? AND e.deleted_at IS NULL ORDER BY e.created_at").bind(k.id).all();
  await audit(c, "evidence.listed", k.id, { count: results.length });
  return c.json({ evidence: results, maxBytes: MAX_EVIDENCE_BYTES });
});

/** Raw upload: PUT body = file bytes. Headers: X-File-Name, X-Content-SHA256 (from the browser), X-Kind, X-Note. */
evidence.put("/cases/:id/evidence", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  if (k.status !== "approved") throw new HttpError(409, "Evidence can be added once the case is approved.");
  const len = Number(c.req.header("Content-Length") || 0);
  if (len > MAX_EVIDENCE_BYTES) throw new HttpError(413, `Evidence files are limited to ${MAX_EVIDENCE_BYTES / 1048576} MB each for now. Split larger files.`);
  const plain = new Uint8Array(await c.req.arrayBuffer());
  if (!plain.length) throw new HttpError(400, "The file is empty.");
  if (plain.length > MAX_EVIDENCE_BYTES) throw new HttpError(413, "The file is too large.");
  const sha = hex(await crypto.subtle.digest("SHA-256", plain));
  const claimed = (c.req.header("X-Content-SHA256") || "").toLowerCase();
  if (claimed && claimed !== sha) throw new HttpError(422, "The file changed on the way to the server (its SHA-256 does not match what your browser computed). Upload it again.");
  const name = str(decodeURIComponent(c.req.header("X-File-Name") || "file"), 200).replace(/[\\/\0]/g, "_") || "file";
  const kind = c.req.header("X-Kind") === "attachment" ? "attachment" : "source";
  const id = uid(), key = `cases/${k.id}/evidence/${id}`;
  await c.env.EVIDENCE.put(key, await encryptFor(c.env, k.id, plain), { customMetadata: { case: k.id, sha256: sha, enc: "AES-256-GCM/HKDF-case" } });
  await c.env.DB.prepare("INSERT INTO evidence (id, case_id, kind, file_name, mime, size, sha256, r2_key, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, k.id, kind, name, str(c.req.header("Content-Type"), 100) || "application/octet-stream", plain.length, sha, key, str(decodeURIComponent(c.req.header("X-Note") || ""), 500) || null, c.get("user").id, now()).run();
  await custody(c, id, k.id, "received and sealed", { sha256: sha, size: plain.length, browserHashMatched: !!claimed });
  await audit(c, "evidence.uploaded", k.id, { id, file: name, sha256: sha, size: plain.length, kind });
  return c.json({ id, sha256: sha, size: plain.length });
});

evidence.get("/cases/:id/evidence/:eid/download", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "export");
  const e = await c.env.DB.prepare("SELECT * FROM evidence WHERE id = ? AND case_id = ? AND deleted_at IS NULL").bind(c.req.param("eid"), k.id).first<any>();
  if (!e) throw new HttpError(404, "No such evidence file.");
  const obj = await c.env.EVIDENCE.get(e.r2_key);
  if (!obj) throw new HttpError(410, "The evidence object is missing from storage.");
  const plain = await decryptFor(c.env, k.id, new Uint8Array(await obj.arrayBuffer()));
  const sha = hex(await crypto.subtle.digest("SHA-256", plain));
  await custody(c, e.id, k.id, "downloaded", { sha256: sha, matches: sha === e.sha256 });
  await audit(c, "evidence.downloaded", k.id, { id: e.id, file: e.file_name, sha256: sha, matches: sha === e.sha256 });
  return new Response(plain, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${e.file_name.replace(/["\r\n]/g, "_")}"`, "X-Content-SHA256": sha, "Cache-Control": "no-store" } });
});

evidence.post("/cases/:id/evidence/:eid/verify", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const e = await c.env.DB.prepare("SELECT * FROM evidence WHERE id = ? AND case_id = ? AND deleted_at IS NULL").bind(c.req.param("eid"), k.id).first<any>();
  if (!e) throw new HttpError(404, "No such evidence file.");
  const obj = await c.env.EVIDENCE.get(e.r2_key);
  let ok = false, sha = "", why = "";
  if (!obj) why = "The stored object is missing.";
  else {
    try { const plain = await decryptFor(c.env, k.id, new Uint8Array(await obj.arrayBuffer())); sha = hex(await crypto.subtle.digest("SHA-256", plain)); ok = sha === e.sha256; if (!ok) why = "The SHA-256 no longer matches the value recorded at upload."; }
    catch (err: any) { why = err.message; }
  }
  await custody(c, e.id, k.id, ok ? "integrity verified" : "integrity check FAILED", { sha256: sha, expected: e.sha256, why: why || undefined });
  await audit(c, "evidence.verified", k.id, { id: e.id, ok, sha256: sha });
  return c.json({ ok, sha256: sha, expected: e.sha256, reason: why || null });
});

evidence.get("/cases/:id/evidence/:eid/custody", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const { results } = await c.env.DB.prepare("SELECT at, user_email, action, detail FROM custody WHERE evidence_id = ? AND case_id = ? ORDER BY id").bind(c.req.param("eid"), k.id).all();
  return c.json({ custody: results });
});
