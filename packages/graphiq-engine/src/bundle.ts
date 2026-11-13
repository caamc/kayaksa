// Encrypted case export (.gqcase): the case's records, notes and metadata as JSON, encrypted with
// a passphrase chosen by the analyst (PBKDF2-SHA256, 310,000 iterations, then AES-256-GCM).
// Uses only Web Crypto, so it works in browsers, Workers and Node 20+.
const enc = new TextEncoder(), dec = new TextDecoder();
const MAGIC = "GQCASE1";
export const BUNDLE_ITERATIONS = 310_000;

async function keyFrom(pass: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const b = typeof data === "string" ? enc.encode(data) : data;
  const d = await crypto.subtle.digest("SHA-256", b as BufferSource);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Layout: "GQCASE1" | 4-byte header length | header JSON | ciphertext. */
export async function encryptBundle(payload: unknown, passphrase: string): Promise<Uint8Array> {
  if (!passphrase || passphrase.length < 12) throw new Error("Use a passphrase of at least 12 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = enc.encode(JSON.stringify(payload));
  const header = enc.encode(JSON.stringify({ v: 1, kdf: "PBKDF2-SHA256", iterations: BUNDLE_ITERATIONS, salt: [...salt], iv: [...iv], sha256: await sha256Hex(plain), created: new Date().toISOString() }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(passphrase, salt, BUNDLE_ITERATIONS), plain));
  const out = new Uint8Array(MAGIC.length + 4 + header.length + ct.length);
  out.set(enc.encode(MAGIC), 0);
  new DataView(out.buffer).setUint32(MAGIC.length, header.length);
  out.set(header, MAGIC.length + 4);
  out.set(ct, MAGIC.length + 4 + header.length);
  return out;
}

export async function decryptBundle<T = any>(data: Uint8Array, passphrase: string): Promise<T> {
  if (dec.decode(data.subarray(0, MAGIC.length)) !== MAGIC) throw new Error("This is not a GraphIQ case export.");
  const hl = new DataView(data.buffer, data.byteOffset).getUint32(MAGIC.length);
  const header = JSON.parse(dec.decode(data.subarray(MAGIC.length + 4, MAGIC.length + 4 + hl)));
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(header.iv) }, await keyFrom(passphrase, new Uint8Array(header.salt), header.iterations), data.subarray(MAGIC.length + 4 + hl) as BufferSource));
  } catch { throw new Error("Wrong passphrase, or the file has been changed."); }
  if ((await sha256Hex(plain)) !== header.sha256) throw new Error("The export failed its integrity check.");
  return JSON.parse(dec.decode(plain));
}
