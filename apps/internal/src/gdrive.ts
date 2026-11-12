// Document Drive storage in Google Drive: the "Kayak Document Drive" shared drive.
//
// - Files are encrypted in the Worker (AES-GCM) before they leave Cloudflare, exactly as before, so the
//   copies in Google Drive are unreadable ciphertext (".kdd" files). They open only through Kayak
//   Internal, which asks for a reason and writes every view to the audit log.
// - A SuperAdmin connects the shared drive once with Google sign-in (OAuth; the consent screen in the
//   kayak-internal Google Cloud project). New Google Cloud organisations block service-account keys by
//   default, so no key file is needed. The refresh token is sealed with the personal-data key.
// - Once connected, new uploads go to the shared drive and existing files are moved across from R2
//   (copied, checked byte-for-byte, then deleted from R2).
// - Until it is connected, files stay in Kayak's encrypted R2 bucket as before.
import { Hono } from "hono";
import { seal, unseal, randomToken } from "../../../packages/core/src/crypto";
import { audit } from "../../../packages/core/src/session";
import { Env, User, atLeast } from "./env";

const SCOPE = "openid email https://www.googleapis.com/auth/drive";
const DRIVE_NAME = "Kayak Document Drive";
const FOLDER_NAME = "Kayak Internal - Document Vault (encrypted)";
const COOKIE = "__Host-kgd_state";
const now = () => new Date().toISOString();
const keyOf = (env: Env) => { if (!env.PII_ENCRYPTION_KEY) throw new Error("The personal-data key is not set yet."); return env.PII_ENCRYPTION_KEY + ":gdrive"; };
const redirect = (env: Env) => `${env.SITE_URL || "https://internal.kayaksa.com"}/oauth/drive/callback`;
export const driveConfigured = (env: Env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

interface Link { account: string | null; refresh: string; drive_id: string | null; drive_name: string | null; folder_id: string | null; connected_by: string; connected_at: string }
async function link(env: Env): Promise<Link | null> {
  return (await env.DB.prepare("SELECT * FROM drive_link WHERE id = 1").first<any>()) || null;
}
let cached: { token: string; until: number } | null = null;
async function token(env: Env): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const l = await link(env); if (!l) throw new Error("Google Drive is not connected.");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token", refresh_token: await unseal(l.refresh, keyOf(env)) }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    await env.DB.prepare("UPDATE drive_link SET error = ? WHERE id = 1").bind("Google sign-in has expired or was revoked. A SuperAdmin needs to reconnect.").run();
    throw new Error("Google Drive access has expired. A SuperAdmin needs to reconnect it.");
  }
  cached = { token: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}
async function g(env: Env, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await token(env)}`, ...(init.headers || {}) } });
  return r;
}
/** True when new files should go to Google Drive. */
export async function driveReady(env: Env) {
  if (!driveConfigured(env)) return false;
  const l = await link(env).catch(() => null);
  return !!(l && l.folder_id);
}

// ------------------------------------------------------------------ storage: put / get / delete
// Keys: "gd:<Drive file id>" for Google Drive, anything else is an R2 key (older files).
export async function putEncrypted(env: Env, name: string, bytes: Uint8Array, meta: Record<string, string>): Promise<string> {
  if (!(await driveReady(env))) {
    const key = `docs/${name}`;
    await env.VAULT!.put(key, bytes, { customMetadata: meta });
    return key;
  }
  const l = (await link(env))!;
  const boundary = "kdd" + randomToken(12);
  const metaJson = JSON.stringify({ name: `${name}.kdd`, parents: [l.folder_id], mimeType: "application/octet-stream", description: "Encrypted by Kayak Internal. Opens only in Kayak Internal's Document Drive.", appProperties: { kayak: "vault", ...Object.fromEntries(Object.entries(meta).map(([k, v]) => [k.slice(0, 30), String(v).slice(0, 60)])) } });
  const head = new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const tail = new TextEncoder().encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length); body.set(head); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);
  const r = await g(env, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error(`Google Drive didn't accept the file (${j.error?.message || r.status}).`);
  if (Number(j.size) !== bytes.length) { await delEncrypted(env, `gd:${j.id}`).catch(() => {}); throw new Error("Google Drive stored a different size; the upload was undone."); }
  return `gd:${j.id}`;
}
export async function getEncrypted(env: Env, key: string): Promise<ArrayBuffer | null> {
  if (!key.startsWith("gd:")) { const o = await env.VAULT?.get(key); return o ? o.arrayBuffer() : null; }
  const r = await g(env, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(key.slice(3))}?alt=media&supportsAllDrives=true`);
  return r.ok ? r.arrayBuffer() : null;
}
export async function delEncrypted(env: Env, key: string) {
  if (!key.startsWith("gd:")) { await env.VAULT?.delete(key); return; }
  const id = encodeURIComponent(key.slice(3));
  const r = await g(env, `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`, { method: "DELETE" });
  // Shared drives only let managers delete outright; otherwise move it to the drive's trash.
  if (!r.ok && r.status !== 404) await g(env, `https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
}

// ------------------------------------------------------------------ admin API (/api/vault/drive)
type V = { Bindings: Env; Variables: { user: User } };
export const driveApi = new Hono<V>();
const superOnly = (c: any) => atLeast(c.get("user"), "superadmin");
driveApi.get("/", async (c) => {
  const l: any = await link(c.env).catch(() => null);
  const inR2 = (await c.env.DB.prepare("SELECT COUNT(*) n FROM vault_docs WHERE r2_key IS NOT NULL AND r2_key NOT LIKE 'gd:%'").first<any>())?.n || 0;
  const inDrive = (await c.env.DB.prepare("SELECT COUNT(*) n FROM vault_docs WHERE r2_key LIKE 'gd:%'").first<any>())?.n || 0;
  return c.json({ configured: driveConfigured(c.env), connected: !!l, account: l?.account || null, driveName: l?.drive_name || null, ready: !!l?.folder_id, error: l?.error || null, connectedAt: l?.connected_at || null, inR2, inDrive, canManage: superOnly(c), driveLabel: DRIVE_NAME });
});
// Find the "Kayak Document Drive" shared drive and make the vault folder in it.
async function attach(env: Env) {
  const q = encodeURIComponent(`name = '${DRIVE_NAME}'`);
  const r = await g(env, `https://www.googleapis.com/drive/v3/drives?q=${q}&useDomainAdminAccess=false&fields=drives(id,name)`);
  const j: any = await r.json().catch(() => ({}));
  const d = (j.drives || [])[0];
  if (!d) throw new Error(`The shared drive "${DRIVE_NAME}" wasn't found for this Google account. Add the account to it as a Content manager (or Manager), then try again.`);
  const fq = encodeURIComponent(`name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and '${d.id}' in parents and trashed = false`);
  const fr: any = await (await g(env, `https://www.googleapis.com/drive/v3/files?q=${fq}&corpora=drive&driveId=${d.id}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id)`)).json().catch(() => ({}));
  let folder = fr.files?.[0]?.id;
  if (!folder) {
    const cr: any = await (await g(env, "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder", parents: [d.id], description: "Encrypted documents from Kayak Internal's Document Drive. Do not edit or rename; they open only through Kayak Internal." }) })).json().catch(() => ({}));
    folder = cr.id;
  }
  if (!folder) throw new Error("Couldn't create the vault folder in the shared drive. The account needs Content manager access.");
  await env.DB.prepare("UPDATE drive_link SET drive_id = ?, drive_name = ?, folder_id = ?, error = NULL WHERE id = 1").bind(d.id, d.name, folder).run();
}
driveApi.post("/attach", async (c) => {
  if (!superOnly(c)) return c.json({ error: "Only a SuperAdmin can do this." }, 403);
  try { await attach(c.env); return c.json({ ok: true }); } catch (e: any) { return c.json({ error: e.message }, 400); }
});
// Move older files from R2 to the shared drive, a batch at a time: copy, read back, compare, delete from R2.
driveApi.post("/migrate", async (c) => {
  if (!superOnly(c)) return c.json({ error: "Only a SuperAdmin can do this." }, 403);
  if (!(await driveReady(c.env))) return c.json({ error: "Connect the shared drive first." }, 400);
  const { results } = await c.env.DB.prepare("SELECT id, r2_key, doc_type type, uploaded_by FROM vault_docs WHERE r2_key IS NOT NULL AND r2_key NOT LIKE 'gd:%' LIMIT 10").all<any>();
  let moved = 0, failed = 0;
  for (const d of results) {
    try {
      const o = await c.env.VAULT!.get(d.r2_key); if (!o) { failed++; continue; }
      const bytes = new Uint8Array(await o.arrayBuffer());
      const key = await putEncrypted(c.env, d.id, bytes, { type: d.type || "", by: d.uploaded_by || "" });
      const back = new Uint8Array((await getEncrypted(c.env, key)) || new ArrayBuffer(0));
      if (back.length !== bytes.length || !back.every((b, i) => b === bytes[i])) { await delEncrypted(c.env, key); failed++; continue; }
      await c.env.DB.prepare("UPDATE vault_docs SET r2_key = ? WHERE id = ?").bind(key, d.id).run();
      await c.env.VAULT!.delete(d.r2_key);
      moved++;
    } catch { failed++; }
  }
  const left = (await c.env.DB.prepare("SELECT COUNT(*) n FROM vault_docs WHERE r2_key IS NOT NULL AND r2_key NOT LIKE 'gd:%'").first<any>())?.n || 0;
  await audit(c, c.env.DB, c.get("user").id, "vault.drive.migrated", { moved, failed, left });
  return c.json({ moved, failed, left });
});
driveApi.post("/disconnect", async (c) => {
  if (!superOnly(c)) return c.json({ error: "Only a SuperAdmin can do this." }, 403);
  const inDrive = (await c.env.DB.prepare("SELECT COUNT(*) n FROM vault_docs WHERE r2_key LIKE 'gd:%'").first<any>())?.n || 0;
  if (inDrive) return c.json({ error: `${inDrive} documents are stored in Google Drive. Reconnect instead of disconnecting, or they can't be opened.` }, 400);
  await c.env.DB.prepare("DELETE FROM drive_link WHERE id = 1").run(); cached = null;
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ Google sign-in (/oauth/drive/*)
export const drivePages = new Hono<V>();
drivePages.get("/connect", async (c) => {
  if (!superOnly(c)) return c.text("Only a SuperAdmin can connect Google Drive.", 403);
  if (!driveConfigured(c.env)) return c.redirect("/app#drive?gd=unconfigured");
  const state = randomToken(24);
  const u = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID!, redirect_uri: redirect(c.env), response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent", state, login_hint: c.get("user").email })}`;
  return new Response(null, { status: 302, headers: { Location: u, "Set-Cookie": `${COOKIE}=${state}.${c.get("user").id}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`, "Cache-Control": "no-store" } });
});
drivePages.get("/callback", async (c) => {
  const u = c.get("user");
  const ck = (c.req.header("Cookie") || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";
  const [state, uidc] = ck.split(".");
  const back = (q: string) => new Response(null, { status: 302, headers: { Location: `/app#drive?gd=${q}`, "Set-Cookie": `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0` } });
  if (!superOnly(c) || !state || state !== c.req.query("state") || uidc !== u.id) return back("failed");
  const code = c.req.query("code"); if (!code) return back("cancelled");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID!, client_secret: c.env.GOOGLE_CLIENT_SECRET!, grant_type: "authorization_code", code, redirect_uri: redirect(c.env) }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.refresh_token) return back("failed");
  let account: string | null = null;
  try { account = JSON.parse(atob(j.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).email || null; } catch {}
  await c.env.DB.prepare("INSERT INTO drive_link (id, account, refresh, connected_by, connected_at) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET account = excluded.account, refresh = excluded.refresh, connected_by = excluded.connected_by, connected_at = excluded.connected_at, error = NULL")
    .bind(account, await seal(j.refresh_token, keyOf(c.env)), u.id, now()).run();
  cached = { token: j.access_token, until: Date.now() + j.expires_in * 1000 };
  await audit(c, c.env.DB, u.id, "vault.drive.connected", { account });
  try { await attach(c.env); } catch { return back("nodrive"); }
  return back("connected");
});
