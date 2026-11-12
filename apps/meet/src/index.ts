// meet.kayaksa.com — Kayak Meet. Kayak's own meeting service: browser to browser audio and video
// (end-to-end encrypted by WebRTC), Kayak's own signalling (Durable Objects), live captions and
// minutes on Cloudflare Workers AI, recordings in Kayak's own R2 storage, and feedback that feeds an
// improvement log approved by administrators. No meeting vendor is involved.
import { Hono } from "hono";
import { securityHeaders, sameOrigin, str, rateLimit } from "../../../packages/core/src/http";
import { shield, auditFull } from "../../../packages/core/src/shield";
import { verifyMeet, type MeetClaims } from "../../../packages/core/src/meettoken";
import { Room } from "./room";
export { Room };

import type { Env } from "./env";
import { auth, currentMember, needMember } from "./auth";
import { ws, serveFile, mayJoin } from "./workspace";
type C = { Bindings: Env; Variables: { claims: MeetClaims; meeting: any } };
const app = new Hono<C>();
const ROOM_RE = /^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/;

app.get("/healthz", (c) => c.json({ ok: true, site: "meet" }));
// Public pages (product, download, sign-in) may be indexed; everything else stays out of search engines.
const PUBLIC_PAGES = new Set(["/", "/download"]);
app.use("*", async (c, next) => { await next(); if (!PUBLIC_PAGES.has(c.req.path) && c.res.status !== 101) { c.res = new Response(c.res.body, c.res); c.res.headers.set("X-Robots-Tag", "noindex, nofollow"); } });
app.use("*", securityHeaders({ noindex: false, permissions: "camera=(self), microphone=(self), display-capture=(self), autoplay=(self), fullscreen=(self), geolocation=(), payment=(), usb=()" }));
// A client office or a Kayak floor shares one address: chat refreshes every 4 s and live captions
// post every few seconds per person, so Meet allows far more per address than the brochure sites.
app.use("*", shield("meet", (e) => e.DB, { allowGoodBots: false, burstLimit: 1500 }));
app.use("/api/*", sameOrigin());

// ---------------------------------------------------------------- access
// A meeting can be joined with a signed invitation link (guests, old links) or, when there is none,
// with a Meet by Kayak account that is entitled to the meeting (host, Kayak employee, invited client,
// or member of the channel the meeting belongs to).
async function claimsFrom(c: any, roomId?: string): Promise<MeetClaims | null> {
  const t = c.req.query("t") || c.req.header("X-Meet-Token");
  if (t) return verifyMeet(c.env.MEET_SIGNING_KEY, t);
  const id = roomId || c.req.param("room");
  if (!id || !ROOM_RE.test(id)) return null;
  const m = await currentMember(c);
  if (!m) return null;
  const mt: any = await c.env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(id).first();
  if (!mt || !(await mayJoin(c.env, m, mt))) return null;
  const host = mt.host_email === m.email || (mt.parent_id && m.kind === "employee" && ((await c.env.DB.prepare("SELECT host_email FROM meetings WHERE id = ?").bind(mt.parent_id).first()) as any)?.host_email === m.email);
  return { r: id, role: host ? "host" : m.kind === "employee" ? "member" : "guest", n: m.name, e: m.email, x: Date.now() + 12 * 3_600_000 };
}
async function needRoom(c: any, next: () => Promise<void>) {
  const cl = await claimsFrom(c);
  const id = c.req.param("room") || cl?.r;
  if (!cl || cl.r !== id) return c.json({ error: "This invitation link is not valid or has expired. Ask the host for a new one." }, 401);
  const m = await c.env.DB.prepare("SELECT id, title, kind, host_name, starts_at, duration_min, lobby, status FROM meetings WHERE id = ?").bind(id).first();
  if (!m || m.status === "cancelled") return c.json({ error: "This meeting does not exist or was cancelled." }, 404);
  c.set("claims", cl);
  c.set("meeting", m);
  await next();
}

app.get("/api/room/:room", needRoom, (c) => {
  const cl = c.get("claims"), m = c.get("meeting");
  return c.json({ id: m.id, title: m.title, kind: m.kind, host: m.host_name, startsAt: m.starts_at, status: m.status, role: cl.role, name: cl.n || null, email: cl.e || null, lobby: !!m.lobby, ai: !!c.env.AI });
});

// STUN tells each browser its public address; TURN relays media only when a firewall blocks direct paths.
app.get("/api/ice/:room", needRoom, async (c) => {
  const ice: any[] = [{ urls: ["stun:stun.cloudflare.com:3478"] }];
  if (c.env.TURN_KEY_ID && c.env.TURN_KEY_API_TOKEN) {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${c.env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: "POST", headers: { Authorization: `Bearer ${c.env.TURN_KEY_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ ttl: 6 * 3600 }),
    }).catch(() => null);
    const j: any = r && r.ok ? await r.json().catch(() => null) : null;
    if (j?.iceServers) return c.json({ iceServers: j.iceServers, relay: true });
  }
  return c.json({ iceServers: ice, relay: false });
});

app.get("/ws/:room", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") return c.text("Expected a WebSocket", 426);
  const origin = c.req.header("Origin");
  if (origin && origin !== new URL(c.req.url).origin) return c.text("Forbidden", 403);
  const id = c.req.param("room");
  const cl = await claimsFrom(c, id);
  if (!cl || cl.r !== id) return c.text("Invalid invitation", 401);
  const m = await c.env.DB.prepare("SELECT id, title, kind, lobby, status FROM meetings WHERE id = ?").bind(id).first<any>();
  if (!m || m.status === "cancelled") return c.text("Not found", 404);
  const claims = { ...cl, n: cl.n || str(c.req.query("name"), 60) || "Guest" };
  await auditFull(c as any, c.env.DB, cl.e || null, "meet.joined", { room: id, role: cl.role, name: claims.n });
  const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(id));
  const h = new Headers(c.req.raw.headers);
  h.set("X-Claims", JSON.stringify(claims));
  h.set("X-Meeting", JSON.stringify(m));
  return stub.fetch(new Request(c.req.url, { headers: h }));
});

// ---------------------------------------------------------------- live captions (Workers AI Whisper)
app.post("/api/transcribe/:room", needRoom, async (c) => {
  if (!c.env.AI) return c.json({ error: "Captions are not available yet." }, 503);
  const cl = c.get("claims");
  if (!(await rateLimit(c.env.DB, `cap:${cl.r}:${cl.e || cl.n || "g"}:${c.req.header("CF-Connecting-IP")}`, 40, 60))) return c.json({ error: "slow down" }, 429);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength < 2000 || buf.byteLength > 1_200_000) return c.json({ text: "" });
  const b = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  try {
    const r: any = await c.env.AI.run("@cf/openai/whisper-large-v3-turbo" as any, { audio: btoa(bin), task: "transcribe", vad_filter: true, condition_on_previous_text: false } as any);
    const text = clean(r?.text);
    if (!text) return c.json({ text: "" });
    const lang = String(r?.transcription_info?.language || "").toLowerCase().slice(0, 8) || (/^[\x00-\x7F]*$/.test(text) ? "en" : "");
    if (lang === "en") return c.json({ text, lang, en: null });
    // Live translation to English: text first (fast), then the audio itself if that fails.
    let en = await toEnglish(c.env.AI, text, lang);
    if (!en) {
      const t: any = await c.env.AI.run("@cf/openai/whisper-large-v3-turbo" as any, { audio: btoa(bin), task: "translate", vad_filter: true } as any).catch(() => null);
      en = clean(t?.text);
    }
    return c.json({ text, lang: lang || null, en: en && en.toLowerCase() !== text.toLowerCase() ? en : null });
  } catch {
    try {
      const r: any = await c.env.AI.run("@cf/openai/whisper" as any, { audio: [...b] } as any);
      return c.json({ text: clean(r?.text) });
    } catch (e: any) {
      return c.json({ text: "", error: "Captions are busy. They will resume shortly." }, 200);
    }
  }
});

/** Translates to English on Workers AI. m2m100 when the language is known, otherwise an LLM. */
async function toEnglish(ai: Ai, text: string, lang?: string): Promise<string> {
  if (lang && lang !== "en") {
    const r: any = await ai.run("@cf/meta/m2m100-1.2b" as any, { text, source_lang: lang, target_lang: "en" } as any).catch(() => null);
    const t = String(r?.translated_text || "").trim();
    if (t) return t.slice(0, 2000);
  }
  const r: any = await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any, {
    messages: [{ role: "system", content: "Translate the user's message into natural English. Reply with the translation only, nothing else. If it is already English, reply with it unchanged." }, { role: "user", content: text }],
    max_tokens: 600,
  } as any).catch(() => null);
  return String(r?.response || "").trim().slice(0, 2000);
}

// Chat and anything else on demand: translate a short text to English.
app.post("/api/translate/:room", needRoom, async (c) => {
  if (!c.env.AI) return c.json({ error: "Translation is not available yet." }, 503);
  const cl = c.get("claims");
  if (!(await rateLimit(c.env.DB, `tr:${cl.r}:${c.req.header("CF-Connecting-IP")}`, 60, 60))) return c.json({ error: "Too many translations. Wait a moment." }, 429);
  const b = await c.req.json<any>().catch(() => ({}));
  const text = str(b.text, 2000);
  if (!text) return c.json({ en: "", text: "" });
  // Captions and chat into the viewer's own language (m2m100 covers 100 languages); English by default.
  const to = typeof b.to === "string" && /^[a-z]{2,3}$/.test(b.to) ? b.to : "en";
  if (to === "en") { const en = await toEnglish(c.env.AI, text, str(b.from, 8) || undefined); return c.json({ en, text: en, to }); }
  const r: any = await c.env.AI.run("@cf/meta/m2m100-1.2b" as any, { text, target_lang: to, ...(b.from ? { source_lang: str(b.from, 8) } : {}) } as any).catch(() => null);
  const out = String(r?.translated_text || "").trim().slice(0, 2000);
  return c.json({ en: null, text: out || text, to });
});

// Whisper sometimes "hears" stock phrases in silence; drop them.
const HALLUCINATIONS = /^(thank you\.?|thanks for watching\.?|you|bye\.?|\.|subtitles by.*|please subscribe.*)$/i;
const clean = (t: unknown) => { const s = String(t || "").replace(/\s+/g, " ").trim(); return HALLUCINATIONS.test(s) ? "" : s.slice(0, 1000); };

// ---------------------------------------------------------------- recordings (Kayak's own R2 storage)
const hostOnly = async (c: any, next: () => Promise<void>) => (c.get("claims").role === "host" ? next() : c.json({ error: "Only the host can record." }, 403));

app.post("/api/rec/:room/start", needRoom, hostOnly, async (c) => {
  const cl = c.get("claims");
  const id = crypto.randomUUID();
  const key = `recordings/${cl.r}/${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  const up = await c.env.REC.createMultipartUpload(key, { httpMetadata: { contentType: "video/webm" }, customMetadata: { room: cl.r, by: cl.n || "" } });
  await c.env.DB.prepare("INSERT INTO recordings (id, meeting_id, r2_key, upload_id, parts, by_name, started_at) VALUES (?,?,?,?,?,?,?)").bind(id, cl.r, key, up.uploadId, "[]", cl.n || "Host", new Date().toISOString()).run();
  await auditFull(c as any, c.env.DB, cl.e || null, "meet.recording_started", { room: cl.r, recording: id });
  return c.json({ id });
});

app.put("/api/rec/:room/:id/:part", needRoom, hostOnly, async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM recordings WHERE id = ? AND meeting_id = ? AND status = 'recording'").bind(c.req.param("id"), c.req.param("room")).first<any>();
  if (!r) return c.json({ error: "Recording not found." }, 404);
  const n = Number(c.req.param("part"));
  if (!(n >= 1 && n <= 10000)) return c.json({ error: "Bad part." }, 400);
  const body = await c.req.arrayBuffer();
  if (body.byteLength > 60 * 1024 * 1024) return c.json({ error: "Part too large." }, 413);
  const up = c.env.REC.resumeMultipartUpload(r.r2_key, r.upload_id);
  const part = await up.uploadPart(n, body);
  await c.env.DB.prepare("UPDATE recordings SET parts = json_insert(parts, '$[#]', json(?)), size = size + ? WHERE id = ?").bind(JSON.stringify(part), body.byteLength, r.id).run();
  return c.json({ ok: true });
});

app.post("/api/rec/:room/:id/finish", needRoom, hostOnly, async (c) => {
  const r = await c.env.DB.prepare("SELECT * FROM recordings WHERE id = ? AND meeting_id = ? AND status = 'recording'").bind(c.req.param("id"), c.req.param("room")).first<any>();
  if (!r) return c.json({ error: "Recording not found." }, 404);
  const parts = (JSON.parse(r.parts || "[]") as R2UploadedPart[]).sort((a, b) => a.partNumber - b.partNumber);
  const up = c.env.REC.resumeMultipartUpload(r.r2_key, r.upload_id);
  if (parts.length) await up.complete(parts); else await up.abort();
  await c.env.DB.prepare("UPDATE recordings SET status = ?, ended_at = ? WHERE id = ?").bind(parts.length ? "ready" : "empty", new Date().toISOString(), r.id).run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- minutes (Workers AI) and feedback
app.post("/api/minutes/:room", needRoom, hostOnly, async (c) => {
  const id = c.req.param("room");
  const out = await makeMinutes(c.env, id);
  return c.json(out);
});

async function makeMinutes(env: { DB: D1Database; AI?: Ai }, id: string) {
  if (!env.AI) return { error: "Minutes need Workers AI." };
  const { results } = await env.DB.prepare("SELECT speaker, text, text_en FROM transcript WHERE meeting_id = ? ORDER BY id").bind(id).all<any>();
  if (!results.length) return { error: "There is no transcript. Turn on captions during the meeting to get minutes." };
  const m = await env.DB.prepare("SELECT title FROM meetings WHERE id = ?").bind(id).first<any>();
  const text = results.map((r: any) => `${r.speaker}: ${r.text_en || r.text}`).join("\n").slice(-60_000);
  const r: any = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any, {
    messages: [
      { role: "system", content: "You write crisp meeting minutes for Kayak Strategic Advisors, an Indian advisory firm. Use British English. Output Markdown with these sections: Summary (3-5 sentences), Decisions, Action items (owner, action, due date if stated), Open questions. Only use what is in the transcript; never invent names, numbers or dates. If the transcript is thin, say so." },
      { role: "user", content: `Meeting: ${m?.title || id}\n\nTranscript:\n${text}` },
    ],
    max_tokens: 1200,
  } as any);
  const summary = String(r?.response || "").trim();
  if (!summary) return { error: "The minutes could not be written. Try again." };
  await env.DB.prepare("INSERT INTO minutes (meeting_id, summary, created_at, model) VALUES (?,?,?,?) ON CONFLICT(meeting_id) DO UPDATE SET summary = excluded.summary, created_at = excluded.created_at, model = excluded.model").bind(id, summary, new Date().toISOString(), "llama-3.3-70b").run();
  return { summary };
}

app.post("/api/feedback/:room", needRoom, async (c) => {
  const cl = c.get("claims");
  const b = await c.req.json<any>().catch(() => ({}));
  const n = (v: unknown) => { const x = Number(v); return x >= 1 && x <= 5 ? Math.round(x) : null; };
  if (!n(b.overall)) return c.json({ error: "Choose a rating." }, 400);
  const issues = Array.isArray(b.issues) ? b.issues.map((x: unknown) => str(x, 40)).filter(Boolean).slice(0, 10) : [];
  await c.env.DB.prepare("INSERT INTO feedback (meeting_id, name, role, overall, audio, video, ease, issues, comment, stats, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(cl.r, cl.n || str(b.name, 60) || null, cl.role, n(b.overall), n(b.audio), n(b.video), n(b.ease), JSON.stringify(issues), str(b.comment, 2000) || null, JSON.stringify(b.stats || {}).slice(0, 4000), new Date().toISOString()).run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- desktop app downloads and updates
// Installers and update manifests live in Kayak's own R2 bucket under desktop/{mac,win}/, uploaded by
// .github/workflows/desktop.yml. The desktop app's auto-updater reads latest-mac.yml / latest.yml here.
const DL_FILE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,120}\.(dmg|zip|exe|msi|yml|blockmap)$/;
app.get("/download", (c) => page(c, "/download.html"));
app.get("/download/release.json", async (c) => {
  const o = await c.env.REC.get("desktop/release.json");
  if (!o) return c.json({ version: null });
  return new Response(o.body, { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" } });
});
app.get("/download/latest/:os", async (c) => {
  const o = await c.env.REC.get("desktop/release.json");
  const r: any = o ? await o.json().catch(() => null) : null;
  const os = c.req.param("os");
  const f = os === "mac" ? r?.mac : os === "win" ? r?.win : os === "win-arm" ? r?.winArm : os === "msi" ? r?.msi : null;
  if (!f) return c.redirect("/download", 302);
  return c.redirect(`/download/${os === "mac" ? "mac" : "win"}/${encodeURIComponent(f)}`, 302);
});
app.get("/download/:os/:file", async (c) => {
  const os = c.req.param("os"), file = decodeURIComponent(c.req.param("file"));
  if (!["mac", "win"].includes(os) || !DL_FILE.test(file) || file.includes("..")) return c.text("Not found", 404);
  const o = await c.env.REC.get(`desktop/${os}/${file}`);
  if (!o) return c.text("Not found", 404);
  const yml = file.endsWith(".yml");
  const type = yml ? "text/yaml; charset=utf-8" : file.endsWith(".dmg") ? "application/x-apple-diskimage" : file.endsWith(".zip") ? "application/zip" : file.endsWith(".msi") ? "application/x-msi" : "application/octet-stream";
  return new Response(o.body, { headers: {
    "Content-Type": type, "Content-Length": String(o.size), ETag: o.httpEtag,
    "Cache-Control": yml ? "no-cache" : "public, max-age=31536000, immutable",
    ...(yml || file.endsWith(".blockmap") ? {} : { "Content-Disposition": `attachment; filename="${file.replace(/"/g, "")}"` }),
  } });
});

// ---------------------------------------------------------------- accounts and workspace
app.route("/", auth);
app.route("/api/ws", ws);
app.get("/files/:fid", needMember, serveFile);

// ---------------------------------------------------------------- pages
const page = (c: any, file: string) => c.env.ASSETS.fetch(new Request(new URL(file, c.req.url)));
app.get("/", (c) => page(c, "/index.html"));
app.get("/login", async (c) => ((await currentMember(c)) ? c.redirect("/app", 302) : page(c, "/login.html")));
app.get("/join/:token", (c) => page(c, "/login.html"));
app.get("/join", (c) => page(c, "/login.html"));
app.get("/app", async (c) => ((await currentMember(c)) ? page(c, "/app.html") : c.redirect("/login", 302)));
app.get("/:room", (c) => (ROOM_RE.test(c.req.param("room")) ? page(c, "/room.html") : c.env.ASSETS.fetch(c.req.raw)));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
