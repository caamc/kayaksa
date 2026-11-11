// Signed Kayak Meet invitations. internal.kayaksa.com issues them; meet.kayaksa.com checks them.
// A token says which room, which role and (for staff) who; it expires. HMAC-SHA256 with MEET_SIGNING_KEY.
export type MeetRole = "host" | "member" | "guest";
export interface MeetClaims { r: string; role: MeetRole; n?: string; e?: string; x: number }

const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (ch) => ch.charCodeAt(0));

async function key(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signMeet(secret: string, claims: MeetClaims): Promise<string> {
  const body = b64u(new TextEncoder().encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(body));
  return `${body}.${b64u(sig)}`;
}

export async function verifyMeet(secret: string | undefined, token: string | null | undefined): Promise<MeetClaims | null> {
  if (!secret || !token || token.length > 2000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), unb64u(sig), new TextEncoder().encode(body));
    if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(unb64u(body))) as MeetClaims;
    if (!c.r || !c.role || !c.x || c.x < Date.now()) return null;
    return c;
  } catch {
    return null;
  }
}

export const newRoomId = () => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint8Array(10));
  const s = [...r].map((v) => a[v % a.length]).join("");
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
};
