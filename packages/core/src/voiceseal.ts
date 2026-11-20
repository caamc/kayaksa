// Sealing for what Kay hears on www.kayaksa.com: AES-256-GCM with a key derived from KAY_VOICE_KEY.
// Shared by www (which seals) and the internal portal (which opens them for review). Format: 12-byte IV,
// then ciphertext and tag. Text is stored as base64 of the same.
const enc = new TextEncoder();
const dec = new TextDecoder();

async function key(secret: string | undefined): Promise<CryptoKey> {
  if (!secret || secret.length < 32) throw new Error("KAY_VOICE_KEY is missing or shorter than 32 characters");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode("kay-voice|" + secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

export async function sealBytes(secret: string | undefined, plain: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), plain));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
}
export async function unsealBytes(secret: string | undefined, sealed: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.subarray(0, 12) }, await key(secret), sealed.subarray(12)));
}
export const sealText = async (secret: string | undefined, t: string) => b64(await sealBytes(secret, enc.encode(t)));
export const unsealText = async (secret: string | undefined, s: string) => (s ? dec.decode(await unsealBytes(secret, unb64(s))) : "");
