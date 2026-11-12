// Kayak Document Drive: identity, address, KYC, KYB and KYV documents, read by OCR, checked, and
// written into the People Masters only after a second person approves.
//
// Safeguards (DPDP Act, 2023; Aadhaar Act, 2016 and UIDAI rules; RBI card-data rules; PCI DSS):
// - Every file is encrypted in the Worker (AES-GCM, a key derived from PII_ENCRYPTION_KEY) before
//   it reaches storage, and the extracted fields are sealed the same way.
// - Administrators only. Opening a document needs a reason, and every upload, view, approval and
//   deletion is written to the audit log and the document's own access log.
// - Aadhaar: only a masked copy (first eight digits hidden) is kept. If OCR finds a full Aadhaar
//   number, the file is not stored; only the last four digits are kept and a masked copy is asked for.
// - Payment cards: the image is never stored (RBI does not allow merchants to keep card data, and
//   PCI DSS forbids keeping the CVV). OCR keeps only the network, issuer, last four digits, expiry
//   and the name on the card, and never reads the CVV.
// - Maker-checker: the person who uploads a document cannot approve its OCR result.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { str } from "../../../packages/core/src/http";
import { seal, unseal } from "../../../packages/core/src/crypto";
import { modelFor } from "../../../packages/core/src/ai";
import { Env, User, atLeast, uid } from "./env";
import { REGISTERS } from "./people";
import { recordUsage } from "./assistant";
import { putEncrypted, getEncrypted, delEncrypted } from "./gdrive";

type V = { Bindings: Env; Variables: { user: User } };
export const vault = new Hono<V>();
const now = () => new Date().toISOString();

type Field = { k: string; l: string; to?: string };
export const DOC_TYPES: Record<string, { label: string; group: string; keep: "yes" | "masked-only" | "never"; fields: Field[] }> = {
  pan: { label: "PAN card", group: "Identity", keep: "yes", fields: [{ k: "name", l: "Name" }, { k: "father_name", l: "Father's name" }, { k: "dob", l: "Date of birth", to: "dob" }, { k: "pan", l: "PAN", to: "pan" }] },
  aadhaar: { label: "Aadhaar (masked copy)", group: "Identity", keep: "masked-only", fields: [{ k: "name", l: "Name" }, { k: "dob", l: "Date of birth", to: "dob" }, { k: "gender", l: "Gender", to: "gender" }, { k: "aadhaar_last4", l: "Aadhaar, last 4 digits", to: "aadhaar_last4" }, { k: "address", l: "Address", to: "address" }] },
  passport: { label: "Passport", group: "Identity", keep: "yes", fields: [{ k: "name", l: "Name" }, { k: "passport", l: "Passport number", to: "passport" }, { k: "nationality", l: "Nationality", to: "nationality" }, { k: "dob", l: "Date of birth", to: "dob" }, { k: "expiry_date", l: "Expiry date" }, { k: "address", l: "Address", to: "address" }] },
  driving_licence: { label: "Driving licence", group: "Identity", keep: "yes", fields: [{ k: "name", l: "Name" }, { k: "dl_number", l: "Licence number" }, { k: "dob", l: "Date of birth", to: "dob" }, { k: "expiry_date", l: "Valid until" }, { k: "address", l: "Address", to: "address" }] },
  voter_id: { label: "Voter ID (EPIC)", group: "Identity", keep: "yes", fields: [{ k: "name", l: "Name" }, { k: "epic", l: "EPIC number" }, { k: "address", l: "Address", to: "address" }] },
  address_proof: { label: "Address proof (utility bill)", group: "Address", keep: "yes", fields: [{ k: "name", l: "Name on the bill" }, { k: "address", l: "Address", to: "address" }, { k: "bill_date", l: "Bill date" }, { k: "provider", l: "Issued by" }] },
  bank_statement: { label: "Bank statement", group: "Bank", keep: "yes", fields: [{ k: "name", l: "Account holder" }, { k: "bank_name", l: "Bank", to: "bank_name" }, { k: "account_number", l: "Account number", to: "bank_account" }, { k: "ifsc", l: "IFSC", to: "ifsc" }, { k: "period_to", l: "Statement up to" }] },
  cancelled_cheque: { label: "Cancelled cheque", group: "Bank", keep: "yes", fields: [{ k: "name", l: "Account holder" }, { k: "bank_name", l: "Bank", to: "bank_name" }, { k: "account_number", l: "Account number", to: "bank_account" }, { k: "ifsc", l: "IFSC", to: "ifsc" }, { k: "micr", l: "MICR" }] },
  payment_card: { label: "Debit or credit card (details only)", group: "Bank", keep: "never", fields: [{ k: "name", l: "Name on card" }, { k: "card_network", l: "Network" }, { k: "issuer", l: "Issuing bank" }, { k: "last4", l: "Last 4 digits" }, { k: "expiry", l: "Expiry (MM/YY)" }] },
  gst_certificate: { label: "GST registration (KYB)", group: "Business", keep: "yes", fields: [{ k: "name", l: "Legal name" }, { k: "trade_name", l: "Trade name" }, { k: "gstin", l: "GSTIN", to: "gstin" }, { k: "address", l: "Principal place of business", to: "address" }] },
  incorporation: { label: "Certificate of incorporation (KYB)", group: "Business", keep: "yes", fields: [{ k: "name", l: "Company name" }, { k: "cin", l: "CIN / LLPIN", to: "cin" }, { k: "incorporation_date", l: "Date of incorporation" }] },
  firm_registration: { label: "Firm registration or partnership deed (KYB)", group: "Business", keep: "yes", fields: [{ k: "name", l: "Firm name" }, { k: "registration_number", l: "Registration number" }, { k: "partners", l: "Partners" }] },
  udyam: { label: "Udyam (MSME) certificate (KYV)", group: "Business", keep: "yes", fields: [{ k: "name", l: "Enterprise name" }, { k: "udyam", l: "Udyam number", to: "udyam" }, { k: "category", l: "Micro, small or medium" }] },
  other: { label: "Other document", group: "Other", keep: "yes", fields: [{ k: "name", l: "Name" }, { k: "summary", l: "What it is" }] },
};
const MAX = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function piiKey(env: Env) {
  if (!env.PII_ENCRYPTION_KEY) throw Object.assign(new Error("The personal-data key is not set yet. It is created on the next deploy."), { status: 503 });
  return env.PII_ENCRYPTION_KEY;
}
async function fileKey(env: Env) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(piiKey(env) + ":vault-files"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptBytes(env: Env, data: ArrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await fileKey(env), data));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return out;
}
async function decryptBytes(env: Env, data: ArrayBuffer) {
  const u = new Uint8Array(data);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, await fileKey(env), u.slice(12));
}
function b64(buf: ArrayBuffer) { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }
const hex = async (buf: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map((b) => b.toString(16).padStart(2, "0")).join("");
const admin = (c: any) => atLeast(c.get("user"), "admin");
const deny = (c: any) => c.json({ error: "Only administrators can use the Document Drive." }, 403);

// ------------------------------------------------------------------ OCR
async function ocr(env: Env, type: string, mime: string, data: ArrayBuffer) {
  if (!env.ANTHROPIC_API_KEY) throw Object.assign(new Error("Kayak AI is not connected, so OCR is unavailable. The document is stored; enter the details by hand."), { status: 503 });
  const t = DOC_TYPES[type];
  const fields = t.fields.map((f) => `"${f.k}": "${f.l}"`).join(", ");
  const rules = [
    "Read the document exactly. Copy values as printed; never guess. If a value is not visible, use an empty string.",
    "Dates as YYYY-MM-DD. PAN, IFSC and GSTIN in capitals without spaces. Account numbers as digits only.",
    type === "aadhaar" ? "Aadhaar: report only the LAST FOUR digits in aadhaar_last4. Set full_aadhaar_visible to true if all 12 digits are readable (not masked with X)." : "",
    type === "payment_card" ? "Payment card: report only the network, issuer, last four digits, expiry and name. NEVER read or report the full card number or the CVV." : "",
    "Also report for every field a confidence from 0 to 1, whether the document is legible, and which document type it actually is.",
  ].filter(Boolean).join(" ");
  const media = mime === "application/pdf" ? { type: "document", source: { type: "base64", media_type: mime, data: b64(data) } } : { type: "image", source: { type: "base64", media_type: mime, data: b64(data) } };
  const prompt = `This is a ${t.label}. ${rules}\nAnswer with JSON only: {"fields": {${fields}}, "confidence": {"<field>": 0.0}, "legible": true, "detected_type": "", "full_aadhaar_visible": false, "notes": ""}`;
  const model = modelFor(env, "anthropic");
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model, max_tokens: 900, temperature: 0, messages: [{ role: "user", content: [media, { type: "text", text: prompt }] }] }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`OCR: ${j?.error?.message || r.status}`), { status: 502 });
  const text = (j.content || []).map((b: any) => b.text || "").join("");
  await recordUsage(env.DB, model, "ocr", data.byteLength / 1000, text.length);
  try { return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { throw Object.assign(new Error("OCR could not read this document. Try a clearer scan."), { status: 422 }); }
}

// ------------------------------------------------------------------ QC
const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function gstinValid(g: string) {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) { const p = GST_CHARS.indexOf(g[i]) * (i % 2 ? 2 : 1); sum += Math.floor(p / 36) + (p % 36); }
  return GST_CHARS[(36 - (sum % 36)) % 36] === g[14];
}
const PAN_HOLDER: Record<string, string> = { P: "individual", C: "company", F: "firm or LLP", H: "HUF", A: "association of persons", T: "trust", B: "body of individuals", L: "local authority", J: "artificial juridical person", G: "government" };
const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 1);
function nameMatch(a: string, b: string) { const x = new Set(norm(a)), y = norm(b); if (!x.size || !y.length) return null; return y.filter((w) => x.has(w)).length / Math.max(x.size, y.length); }
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

export function qcChecks(type: string, f: Record<string, string>, conf: Record<string, number>, master: { name?: string; kind?: string; sealed?: Record<string, string>; data?: Record<string, string> } | null) {
  const out: { check: string; result: "pass" | "warn" | "fail"; detail: string }[] = [];
  const add = (check: string, ok: boolean | null, detail: string, warnOnly = false) => out.push({ check, result: ok === null ? "warn" : ok ? "pass" : warnOnly ? "warn" : "fail", detail });
  if (f.pan) { const ok = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan); add("PAN format", ok, ok ? `Valid format; holder type: ${PAN_HOLDER[f.pan[3]] || "unknown"}` : "Not five letters, four digits, one letter");
    if (ok && master?.kind) { const want = master.kind === "employee" || master.kind === "director" ? "P" : null; if (want) add("PAN holder type", f.pan[3] === want, f.pan[3] === want ? "Individual PAN, as expected" : `Expected an individual PAN (4th letter P), found ${f.pan[3]}`); } }
  if (f.ifsc) add("IFSC format", /^[A-Z]{4}0[A-Z0-9]{6}$/.test(f.ifsc), "Four letters, a zero, then six characters");
  if (f.account_number) add("Account number", /^\d{9,18}$/.test(f.account_number), "9 to 18 digits");
  if (f.gstin) { const ok = gstinValid(f.gstin); add("GSTIN checksum", ok, ok ? "Format and check digit are valid" : "Format or check digit is wrong"); if (ok && f.pan) add("GSTIN matches PAN", f.gstin.slice(2, 12) === f.pan, "Characters 3 to 12 of a GSTIN are the PAN"); }
  if (f.cin) add("CIN / LLPIN format", /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(f.cin) || /^[A-Z]{3}-[0-9]{4}$/.test(f.cin), "21-character CIN or AAA-0000 LLPIN");
  if (f.aadhaar_last4) add("Aadhaar last four", /^\d{4}$/.test(f.aadhaar_last4), "Four digits only are kept");
  if (f.udyam) add("Udyam number", /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(f.udyam), "UDYAM-XX-00-0000000");
  for (const k of ["dob", "expiry_date", "bill_date", "period_to", "incorporation_date"]) if (f[k]) add(`Date: ${k.replace("_", " ")}`, isDate(f[k]), "A real date (YYYY-MM-DD)");
  if (f.expiry_date && isDate(f.expiry_date)) add("Not expired", Date.parse(f.expiry_date) > Date.now(), `Valid until ${f.expiry_date}`);
  if (type === "address_proof" && isDate(f.bill_date)) add("Recent address proof", Date.now() - Date.parse(f.bill_date) < 62 * 864e5, "Utility bills older than two months are not accepted as address proof", true);
  if (type === "bank_statement" && isDate(f.period_to)) add("Recent statement", Date.now() - Date.parse(f.period_to) < 92 * 864e5, "Statement within the last three months", true);
  if (master?.name && f.name) { const m = nameMatch(master.name, f.name); add("Name matches the master", m === null ? null : m >= 0.6, m === null ? "Could not compare" : `${Math.round((m || 0) * 100)}% of name words match "${master.name}"`, true); }
  if (master?.sealed?.dob && f.dob) add("Date of birth matches", master.sealed.dob === f.dob, "Compared with the date already in the master");
  if (master?.sealed?.pan && f.pan) add("PAN matches", master.sealed.pan === f.pan, "Compared with the PAN already in the master");
  const low = Object.entries(conf || {}).filter(([k, v]) => f[k] && Number(v) < 0.8).map(([k]) => k);
  add("OCR confidence", low.length === 0, low.length ? `Check by eye: ${low.join(", ")}` : "Every field read with high confidence", true);
  return out;
}

// ------------------------------------------------------------------ the Drive
vault.get("/meta", (c) => c.json({ types: DOC_TYPES, registers: Object.fromEntries(Object.entries(REGISTERS).map(([k, v]) => [k, v.label])), ready: !!c.env.VAULT && !!c.env.PII_ENCRYPTION_KEY, ocr: !!c.env.ANTHROPIC_API_KEY }));

vault.get("/tree", async (c) => {
  if (!admin(c)) return deny(c);
  const [{ results: masters }, { results: counts }] = await Promise.all([
    c.env.DB.prepare("SELECT id, kind, name, status FROM masters ORDER BY kind, name COLLATE NOCASE").all<any>(),
    c.env.DB.prepare("SELECT master_id, status, COUNT(*) n FROM vault_docs GROUP BY master_id, status").all<any>(),
  ]);
  const n = (id: string | null, st?: string) => counts.filter((x: any) => x.master_id === id && (!st || x.status === st)).reduce((s: number, x: any) => s + x.n, 0);
  return c.json({ folders: Object.entries(REGISTERS).map(([k, v]) => ({ kind: k, label: v.label, masters: masters.filter((m: any) => m.kind === k).map((m: any) => ({ ...m, docs: n(m.id), qc: n(m.id, "qc") })) })), unfiled: n(null), qcTotal: counts.filter((x: any) => x.status === "qc").reduce((s: number, x: any) => s + x.n, 0) });
});

vault.get("/docs", async (c) => {
  if (!admin(c)) return deny(c);
  const m = c.req.query("master"), st = c.req.query("status");
  const where = st === "qc" ? "d.status = 'qc'" : m ? "d.master_id = ?1" : "d.master_id IS NULL";
  const { results } = await c.env.DB.prepare(`SELECT d.id, d.master_kind, d.master_id, d.doc_type, d.file_name, d.mime, d.size, d.stored, CASE WHEN d.r2_key LIKE 'gd:%' THEN 'gd:' ELSE '' END r2_key, d.status, d.qc, d.uploaded_by, d.approved_by, d.approved_at, d.created_at, d.note, u.name uploader, a.name approver, ms.name master_name FROM vault_docs d LEFT JOIN users u ON u.id = d.uploaded_by LEFT JOIN users a ON a.id = d.approved_by LEFT JOIN masters ms ON ms.id = d.master_id WHERE ${where} ORDER BY d.created_at DESC LIMIT 300`).bind(...(m && st !== "qc" ? [m] : [])).all<any>();
  return c.json({ docs: results.map((d: any) => ({ ...d, qc: JSON.parse(d.qc || "[]") })) });
});

// Upload: encrypt, OCR, check. Nothing reaches a master until a second administrator approves.
vault.post("/docs", async (c) => {
  if (!admin(c)) return deny(c);
  if (!c.env.VAULT) return c.json({ error: "Document storage is not connected yet. It is created on the next deploy." }, 503);
  const u = c.get("user");
  const form = await c.req.formData();
  const file = form.get("file") as unknown as File | null;
  const type = String(form.get("doc_type") || "");
  const masterId = str(form.get("master_id"), 60) || null;
  if (!file || typeof (file as any).arrayBuffer !== "function") return c.json({ error: "Choose a file." }, 400);
  if (!DOC_TYPES[type]) return c.json({ error: "Choose what kind of document this is." }, 400);
  if (!TYPES.includes(file.type)) return c.json({ error: "Upload a JPG, PNG, WebP or PDF." }, 415);
  if (file.size > MAX) return c.json({ error: "Files up to 8 MB. Scan at 300 dpi or less." }, 413);
  const master = masterId ? await c.env.DB.prepare("SELECT id, kind, name, sealed, data FROM masters WHERE id = ?").bind(masterId).first<any>() : null;
  if (masterId && !master) return c.json({ error: "That master record no longer exists." }, 404);
  const buf = await file.arrayBuffer();
  const sha = await hex(buf);
  const dup = await c.env.DB.prepare("SELECT id FROM vault_docs WHERE sha256 = ?").bind(sha).first<any>();
  if (dup) return c.json({ error: "This exact file is already in the Drive." }, 409);
  const t = DOC_TYPES[type];
  let read: any = null, ocrError = "";
  try { read = await ocr(c.env, type, file.type, buf); } catch (e: any) { ocrError = e.message; }
  const fields: Record<string, string> = {};
  for (const f of t.fields) fields[f.k] = str(read?.fields?.[f.k], 400).trim();
  for (const k of ["pan", "ifsc", "gstin", "cin"]) if (fields[k]) fields[k] = fields[k].toUpperCase().replace(/\s/g, "");
  if (fields.account_number) fields.account_number = fields.account_number.replace(/\D/g, "");
  if (fields.aadhaar_last4) fields.aadhaar_last4 = fields.aadhaar_last4.replace(/\D/g, "").slice(-4);
  if (fields.last4) fields.last4 = fields.last4.replace(/\D/g, "").slice(-4);
  // What may be kept.
  let store = t.keep === "yes", note = "";
  if (t.keep === "never") note = "Card image not stored (RBI and PCI DSS). Only the network, issuer, last four digits, expiry and name were kept.";
  if (t.keep === "masked-only") {
    if (read?.full_aadhaar_visible) note = "The full Aadhaar number was visible, so the file was not stored. Only the last four digits were kept. Upload the masked Aadhaar from myAadhaar instead.";
    else store = true;
  }
  const sealedOcr = await seal(JSON.stringify({ fields, confidence: read?.confidence || {}, legible: read?.legible ?? null, detected: read?.detected_type || "", notes: str(read?.notes, 300) }), piiKey(c.env));
  const ms = master?.sealed ? JSON.parse(await unseal(master.sealed, piiKey(c.env))) : {};
  const qc = ocrError ? [{ check: "OCR", result: "fail", detail: ocrError }] : qcChecks(type, fields, read?.confidence || {}, master ? { name: master.name, kind: master.kind, sealed: ms, data: JSON.parse(master.data || "{}") } : null);
  if (read && read.legible === false) qc.unshift({ check: "Legible", result: "fail", detail: "The scan is not clear enough. Upload a sharper copy." });
  const id = uid();
  let r2: string | null = null;
  // Encrypted here, then kept in the "Kayak Document Drive" shared drive (or R2 until it is connected).
  if (store) r2 = await putEncrypted(c.env, id, await encryptBytes(c.env, buf), { type, by: u.id });
  await c.env.DB.prepare("INSERT INTO vault_docs (id, master_kind, master_id, doc_type, file_name, mime, size, sha256, r2_key, stored, ocr, qc, status, note, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, master?.kind || null, master?.id || null, type, str(file.name, 160), file.type, file.size, sha, r2, store ? 1 : 0, sealedOcr, JSON.stringify(qc), "qc", note, u.id, now()).run();
  await audit(c, c.env.DB, u.id, "vault.uploaded", { id, type, stored: store, master: master?.id || null });
  return c.json({ id, stored: store, note, qc });
});

// The QC view: the OCR fields (unsealed for the reviewer, logged), the checks and the master's current values.
vault.get("/docs/:id/review", async (c) => {
  if (!admin(c)) return deny(c);
  const d = await c.env.DB.prepare("SELECT * FROM vault_docs WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!d) return c.json({ error: "Not found." }, 404);
  const o = JSON.parse(await unseal(d.ocr, piiKey(c.env)));
  await c.env.DB.prepare("INSERT INTO vault_access (doc_id, user_id, action, reason, at) VALUES (?,?,?,?,?)").bind(d.id, c.get("user").id, "review", "QC review", now()).run();
  return c.json({ doc: { ...d, ocr: undefined, qc: JSON.parse(d.qc || "[]") }, fields: o.fields, confidence: o.confidence, type: DOC_TYPES[d.doc_type], mine: d.uploaded_by === c.get("user").id });
});

// Approve: a second administrator confirms (and may correct) the fields; they go into the master.
vault.post("/docs/:id/approve", async (c) => {
  if (!admin(c)) return deny(c);
  const u = c.get("user");
  const d = await c.env.DB.prepare("SELECT * FROM vault_docs WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!d) return c.json({ error: "Not found." }, 404);
  if (d.status !== "qc") return c.json({ error: "This document has already been reviewed." }, 409);
  if (d.uploaded_by === u.id) return c.json({ error: "Maker-checker: another administrator must approve a document you uploaded." }, 403);
  const b: any = await c.req.json().catch(() => ({}));
  const t = DOC_TYPES[d.doc_type];
  const fields: Record<string, string> = {};
  for (const f of t.fields) fields[f.k] = str(b.fields?.[f.k], 400).trim();
  if (fields.aadhaar_last4 && !/^\d{4}$/.test(fields.aadhaar_last4)) return c.json({ error: "Keep only the last four digits of the Aadhaar number." }, 400);
  let masterId = str(b.master_id, 60) || d.master_id;
  const kind = masterId ? (await c.env.DB.prepare("SELECT kind FROM masters WHERE id = ?").bind(masterId).first<any>())?.kind : (REGISTERS[b.new_kind] ? b.new_kind : null);
  if (!kind) return c.json({ error: "Choose the master record this document belongs to, or a register to create one in." }, 400);
  const reg = REGISTERS[kind];
  const t0 = now();
  if (!masterId) {
    if (!fields.name) return c.json({ error: "A name is needed to create the master record." }, 400);
    masterId = uid();
    await c.env.DB.prepare("INSERT INTO masters (id, kind, name, entity, status, data, sealed, lawful_basis, purpose, notice_version, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(masterId, kind, fields.name, "KSA", "active", "{}", null, reg.basis, reg.purpose, "KSA-PN-2026-11", u.id, t0, t0).run();
  }
  const m = await c.env.DB.prepare("SELECT * FROM masters WHERE id = ?").bind(masterId).first<any>();
  const data = JSON.parse(m.data || "{}"), sealed = m.sealed ? JSON.parse(await unseal(m.sealed, piiKey(c.env))) : {};
  const applied: string[] = [];
  for (const f of t.fields) {
    if (!f.to || !fields[f.k]) continue;
    const target = reg.fields.find((x) => x.k === f.to);
    if (!target) continue;
    let v = fields[f.k];
    if (f.to === "gender") v = /^f/i.test(v) ? "Woman" : /^m/i.test(v) ? "Man" : v;
    if (target.s) sealed[f.to] = v; else data[f.to] = v;
    applied.push(target.l);
  }
  const dob = sealed.dob && /^\d{4}-\d{2}-\d{2}$/.test(sealed.dob) ? sealed.dob.slice(5) : m.dob_md;
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE masters SET data = ?, sealed = ?, dob_md = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(data), Object.keys(sealed).length ? await seal(JSON.stringify(sealed), piiKey(c.env)) : null, dob, t0, masterId),
    c.env.DB.prepare("UPDATE vault_docs SET status = 'approved', master_id = ?, master_kind = ?, ocr = ?, approved_by = ?, approved_at = ? WHERE id = ?").bind(masterId, kind, await seal(JSON.stringify({ fields }), piiKey(c.env)), u.id, t0, d.id),
  ]);
  await audit(c, c.env.DB, u.id, "vault.approved", { id: d.id, master: masterId, applied });
  return c.json({ master_id: masterId, applied });
});
vault.post("/docs/:id/reject", async (c) => {
  if (!admin(c)) return deny(c);
  const b: any = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare("UPDATE vault_docs SET status = 'rejected', note = ?, approved_by = ?, approved_at = ? WHERE id = ? AND status = 'qc'").bind(str(b.reason, 300) || "Rejected at QC", c.get("user").id, now(), c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "vault.rejected", { id: c.req.param("id") });
  return c.json({ ok: true });
});

// Open a stored document: a reason is required and logged.
vault.post("/docs/:id/open", async (c) => {
  if (!admin(c)) return deny(c);
  const b: any = await c.req.json().catch(() => ({}));
  const reason = str(b.reason, 200);
  if (reason.length < 8) return c.json({ error: "Give the reason for opening this document." }, 400);
  const d = await c.env.DB.prepare("SELECT * FROM vault_docs WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!d?.stored || !d.r2_key) return c.json({ error: "No file is kept for this document." }, 404);
  const o = await getEncrypted(c.env, d.r2_key);
  if (!o) return c.json({ error: "The file is missing from storage." }, 404);
  const plain = await decryptBytes(c.env, o);
  await c.env.DB.prepare("INSERT INTO vault_access (doc_id, user_id, action, reason, at) VALUES (?,?,?,?,?)").bind(d.id, c.get("user").id, "open", reason, now()).run();
  await audit(c, c.env.DB, c.get("user").id, "vault.opened", { id: d.id, reason });
  return new Response(plain, { headers: { "Content-Type": d.mime, "Cache-Control": "no-store", "Content-Disposition": `inline; filename="${d.doc_type}-${d.id.slice(0, 8)}.${d.mime === "application/pdf" ? "pdf" : d.mime.split("/")[1]}"`, "X-Content-Type-Options": "nosniff" } });
});
vault.get("/docs/:id/log", async (c) => {
  if (!admin(c)) return deny(c);
  const { results } = await c.env.DB.prepare("SELECT a.action, a.reason, a.at, u.name FROM vault_access a LEFT JOIN users u ON u.id = a.user_id WHERE a.doc_id = ? ORDER BY a.id DESC LIMIT 100").bind(c.req.param("id")).all();
  return c.json({ log: results });
});
// Erase: SuperAdmin only, with a reason (end of retention, or an erasure request).
vault.post("/docs/:id/delete", async (c) => {
  if (!atLeast(c.get("user"), "superadmin")) return c.json({ error: "Only a SuperAdmin can erase a document." }, 403);
  const b: any = await c.req.json().catch(() => ({}));
  const reason = str(b.reason, 200);
  if (reason.length < 8) return c.json({ error: "Record why the document is being erased." }, 400);
  const d = await c.env.DB.prepare("SELECT r2_key FROM vault_docs WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (d?.r2_key) await delEncrypted(c.env, d.r2_key);
  await c.env.DB.prepare("UPDATE vault_docs SET stored = 0, r2_key = NULL, ocr = '', status = 'erased', note = ? WHERE id = ?").bind(`Erased: ${reason}`, c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "vault.erased", { id: c.req.param("id"), reason });
  return c.json({ ok: true });
});
