// Cryptographic helpers built only on Web Crypto (available in Cloudflare Workers).

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(p);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** A URL-safe random token with `bytes` bytes of entropy (default 32 = 256 bits). */
export function randomToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

export async function sha256hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two strings of equal length. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Passwords: PBKDF2-SHA256. Workers caps PBKDF2 at 100,000 iterations.
const PBKDF2_ITER = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, key, 256);
  return `pbkdf2$sha256$${PBKDF2_ITER}$${b64url(salt)}$${b64url(bits)}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Spend comparable time so a missing account is not distinguishable by timing.
    await hashPassword(password);
    return false;
  }
  const [scheme, hash, iter, saltB64, want] = stored.split("$");
  if (scheme !== "pbkdf2" || hash !== "sha256") return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64url(saltB64), iterations: Number(iter) },
    key,
    256,
  );
  return safeEqual(b64url(bits), want);
}

/** Problems with a proposed password, or an empty list when it is acceptable. */
export function passwordProblems(pw: string, email?: string): string[] {
  const p: string[] = [];
  if (pw.length < 12) p.push("Use at least 12 characters.");
  if (pw.length > 200) p.push("Use at most 200 characters.");
  if (!/[a-z]/i.test(pw) || !/[0-9\W_]/.test(pw)) p.push("Mix letters with numbers or symbols.");
  if (email && pw.toLowerCase().includes(email.split("@")[0].toLowerCase())) p.push("Do not include your email name.");
  if (/^(.)\1+$/.test(pw) || /password|kayak123|qwerty|123456/i.test(pw)) p.push("Choose something harder to guess.");
  return p;
}

// Field encryption (AES-GCM) for secrets at rest, such as TOTP seeds. The key comes from the
// AUTH_ENCRYPTION_KEY secret; any string works, it is stretched with SHA-256.
async function aesKey(secret: string): Promise<CryptoKey> {
  if (!secret || secret.length < 16) throw new Error("AUTH_ENCRYPTION_KEY is missing or too short");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(plain: string, secret: string): Promise<string> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), enc.encode(plain));
  return `v1.${b64url(iv)}.${b64url(ct)}`;
}

export async function unseal(sealed: string, secret: string): Promise<string> {
  const [v, iv, ct] = sealed.split(".");
  if (v !== "v1") throw new Error("Unknown sealed format");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv) }, await aesKey(secret), fromB64url(ct));
  return dec.decode(pt);
}
