// Kayak Meet in the staff portal: schedule meetings, issue signed invitation links, email invitations,
// and review attendance, transcripts, minutes, recordings, feedback and the improvement log.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { readJson, str } from "../../../packages/core/src/http";
import { mailEnabled, mailHtml, sendMail } from "../../../packages/core/src/mail";
import { signMeet, newRoomId, type MeetRole } from "../../../packages/core/src/meettoken";
import { Env, User, atLeast } from "./env";

type V = { Bindings: Env; Variables: { user: User } };
export const meet = new Hono<V>();
const MEET_URL = "https://meet.kayaksa.com";
const DAY = 86_400_000;

const db = (c: any): D1Database => {
  if (!c.env.MEET_DB) throw Object.assign(new Error("Kayak Meet is not connected to the portal yet. It will be after the next deploy."), { status: 503 });
  return c.env.MEET_DB;
};
const key = (c: any): string => {
  if (!c.env.MEET_SIGNING_KEY) throw Object.assign(new Error("Kayak Meet's signing key is missing. Run the deploy workflow once with meet included."), { status: 503 });
  return c.env.MEET_SIGNING_KEY;
};
const canManage = (u: User, m: any) => m.created_by === u.id || m.host_email === u.email || atLeast(u, "admin");

async function staffLink(c: any, m: any, u: User) {
  const role: MeetRole = canManage(u, m) ? "host" : "member";
  const t = await signMeet(key(c), { r: m.id, role, n: u.name || u.email, e: u.email, x: Date.now() + 30 * DAY });
  return `${MEET_URL}/${m.id}?t=${t}`;
}
async function guestLink(c: any, m: any, email?: string) {
  const until = Math.max(Date.now(), m.starts_at ? Date.parse(m.starts_at) : 0) + 14 * DAY;
  const t = await signMeet(key(c), { r: m.id, role: "guest", e: email, x: until });
  return `${MEET_URL}/${m.id}?t=${t}`;
}

meet.get("/", async (c) => {
  const D = db(c);
  const now = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const [up, recent, stats] = await D.batch([
    D.prepare("SELECT * FROM meetings WHERE status IN ('scheduled','live') AND (starts_at IS NULL OR starts_at >= ? OR status = 'live') ORDER BY COALESCE(starts_at, created_at) LIMIT 50").bind(now),
    D.prepare("SELECT * FROM meetings WHERE status = 'ended' ORDER BY ended_at DESC LIMIT 30"),
    D.prepare("SELECT COUNT(*) n, ROUND(AVG(overall),2) avg FROM feedback WHERE at >= ?").bind(new Date(Date.now() - 30 * DAY).toISOString()),
  ]);
  return c.json({ upcoming: up.results, recent: recent.results, feedback: stats.results[0] });
});

meet.post("/", async (c) => {
  const u = c.get("user");
  const b = await readJson<any>(c, 8192);
  const title = str(b.title, 140) || "Kayak meeting";
  const kind = ["meeting", "client", "webinar"].includes(b.kind) ? b.kind : "meeting";
  const starts = b.startsAt ? new Date(b.startsAt) : null;
  if (starts && isNaN(+starts)) return c.json({ error: "Check the date and time." }, 400);
  const invitees = (Array.isArray(b.invitees) ? b.invitees : String(b.invitees || "").split(/[\s,;]+/)).map((e: string) => e.trim().toLowerCase()).filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)).slice(0, 50);
  const id = newRoomId();
  await db(c).prepare("INSERT INTO meetings (id, title, kind, host_email, host_name, starts_at, duration_min, lobby, invitees, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,'scheduled',?,?)")
    .bind(id, title, kind, u.email, u.name || u.email, starts ? starts.toISOString() : null, Math.min(480, Math.max(15, Number(b.duration) || 30)), kind === "client" || b.lobby ? 1 : 0, JSON.stringify(invitees), u.id, new Date().toISOString()).run();
  await audit(c, c.env.DB, u.id, "meet.created", { id, title, kind, invitees: invitees.length });
  return c.json({ id });
});

meet.get("/:id", async (c) => {
  const u = c.get("user");
  const D = db(c);
  const id = c.req.param("id");
  const m = await D.prepare("SELECT * FROM meetings WHERE id = ?").bind(id).first<any>();
  if (!m) return c.json({ error: "Meeting not found." }, 404);
  const [att, tr, mi, rec, fb] = await D.batch([
    D.prepare("SELECT name, email, role, joined_at, left_at FROM attendance WHERE meeting_id = ? ORDER BY id").bind(id),
    D.prepare("SELECT at, speaker, text, text_en, lang FROM transcript WHERE meeting_id = ? ORDER BY id LIMIT 5000").bind(id),
    D.prepare("SELECT summary, created_at FROM minutes WHERE meeting_id = ?").bind(id),
    D.prepare("SELECT id, size, by_name, started_at, ended_at, status FROM recordings WHERE meeting_id = ? ORDER BY started_at").bind(id),
    D.prepare("SELECT name, role, overall, audio, video, ease, issues, comment, at FROM feedback WHERE meeting_id = ? ORDER BY id").bind(id),
  ]);
  const manage = canManage(u, m);
  return c.json({
    meeting: { ...m, invitees: JSON.parse(m.invitees || "[]") }, manage,
    links: { mine: await staffLink(c, m, u), guest: manage ? await guestLink(c, m) : null, staff: `${MEET_URL}/${m.id}` },
    attendance: att.results, transcript: tr.results, minutes: mi.results[0] || null, recordings: rec.results, feedback: fb.results,
  });
});

meet.post("/:id/invite", async (c) => {
  const u = c.get("user");
  const m = await db(c).prepare("SELECT * FROM meetings WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!m || !canManage(u, m)) return c.json({ error: "Only the host can send invitations." }, 403);
  if (!mailEnabled(c.env)) return c.json({ error: "Email is not set up yet (RESEND_API_KEY). Copy the guest link and send it yourself." }, 503);
  const list: string[] = JSON.parse(m.invitees || "[]");
  if (!list.length) return c.json({ error: "Add invitees to the meeting first." }, 400);
  const when = m.starts_at ? new Date(m.starts_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }) + " IST" : "now";
  let sent = 0;
  for (const e of list) {
    const link = e.endsWith("@kayaksa.com") ? `${MEET_URL}/${m.id}` : await guestLink(c, m, e);
    const intro = `${u.name || u.email} invites you to <b>${m.title}</b> on Kayak Meet.<br><br><b>When:</b> ${when}<br><b>Length:</b> ${m.duration_min} minutes<br><br>Open the link in Chrome, Edge, Safari or Firefox on a computer or phone; nothing to install. Audio and video are encrypted end to end.${e.endsWith("@kayaksa.com") ? "<br><br>Kayak colleagues: open the meeting from Kayak Meet in the internal portal to join with your own link." : ""}`;
    if (await sendMail(c.env, e, `Invitation: ${m.title}`, mailHtml({ site: "MEET", title: m.title, intro, action: { label: "Join the meeting", url: e.endsWith("@kayaksa.com") ? "https://internal.kayaksa.com/app#/meet/" + m.id : link }, outro: "This link is personal to you. Please don't forward it." }))) sent++;
  }
  await audit(c, c.env.DB, u.id, "meet.invited", { id: m.id, sent });
  return c.json({ ok: true, sent });
});

meet.post("/:id/cancel", async (c) => {
  const u = c.get("user");
  const m = await db(c).prepare("SELECT * FROM meetings WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!m || !canManage(u, m)) return c.json({ error: "Only the host can cancel this meeting." }, 403);
  await db(c).prepare("UPDATE meetings SET status = 'cancelled' WHERE id = ?").bind(m.id).run();
  await audit(c, c.env.DB, u.id, "meet.cancelled", { id: m.id });
  return c.json({ ok: true });
});

meet.get("/:id/rec/:rid", async (c) => {
  const u = c.get("user");
  const D = db(c);
  const m = await D.prepare("SELECT * FROM meetings WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!m || !canManage(u, m)) return c.json({ error: "Only the host or an administrator can download recordings." }, 403);
  const r = await D.prepare("SELECT * FROM recordings WHERE id = ? AND meeting_id = ? AND status = 'ready'").bind(c.req.param("rid"), m.id).first<any>();
  if (!r || !c.env.MEET_REC) return c.json({ error: "Recording not found." }, 404);
  const o = await c.env.MEET_REC.get(r.r2_key);
  if (!o) return c.json({ error: "Recording not found." }, 404);
  await audit(c, c.env.DB, u.id, "meet.recording_downloaded", { id: m.id, recording: r.id });
  return new Response(o.body, { headers: { "Content-Type": "video/webm", "Content-Disposition": `attachment; filename="${m.title.replace(/[^\w -]+/g, "").slice(0, 60) || "meeting"} ${r.started_at.slice(0, 10)}.webm"`, "Cache-Control": "private, no-store" } });
});

// ---------------------------------------------------------------- feedback and improvement log (admins)
meet.get("/x/quality", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  const D = db(c);
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const [agg, issues, recent, imp] = await D.batch([
    D.prepare("SELECT COUNT(*) n, ROUND(AVG(overall),2) overall, ROUND(AVG(audio),2) audio, ROUND(AVG(video),2) video, ROUND(AVG(ease),2) ease FROM feedback WHERE at >= ?").bind(since),
    D.prepare("SELECT j.value issue, COUNT(*) n FROM feedback, json_each(feedback.issues) j WHERE at >= ? GROUP BY j.value ORDER BY n DESC").bind(since),
    D.prepare("SELECT f.overall, f.issues, f.comment, f.stats, f.at, m.title FROM feedback f LEFT JOIN meetings m ON m.id = f.meeting_id ORDER BY f.id DESC LIMIT 40"),
    D.prepare("SELECT * FROM improvements ORDER BY CASE status WHEN 'proposed' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, id DESC LIMIT 100"),
  ]);
  return c.json({ summary: agg.results[0], issues: issues.results, recent: recent.results, improvements: imp.results });
});

// Turns recent feedback into proposed improvements. Nothing changes until an administrator approves.
meet.post("/x/improvements/draft", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "admin")) return c.json({ error: "Administrators only." }, 403);
  const D = db(c);
  const { results } = await D.prepare("SELECT overall, audio, video, ease, issues, comment, stats FROM feedback WHERE at >= ? ORDER BY id DESC LIMIT 300").bind(new Date(Date.now() - 30 * DAY).toISOString()).all<any>();
  if (results.length < 3) return c.json({ error: "Not enough feedback yet. Proposals need at least three responses from the last 30 days." }, 400);
  let items: { title: string; detail: string; evidence: string }[] = [];
  if (c.env.AI) {
    const r: any = await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any, {
      messages: [
        { role: "system", content: "You improve Kayak Meet, a browser video-meeting product. From user feedback, propose at most 5 concrete, testable product improvements, ordered by impact. Reply with JSON only: {\"items\":[{\"title\":\"...\",\"detail\":\"what to change and how to measure it\",\"evidence\":\"which feedback supports it, with counts\"}]}. Use British English. Do not invent feedback." },
        { role: "user", content: JSON.stringify(results).slice(0, 40_000) },
      ],
      max_tokens: 1200,
    } as any);
    try { const t = String(r?.response || ""); items = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)).items || []; } catch {}
  }
  if (!items.length) {
    // Without AI: rank the issues people reported.
    const count: Record<string, number> = {};
    for (const f of results) for (const i of JSON.parse(f.issues || "[]")) count[i] = (count[i] || 0) + 1;
    items = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([i, n]) => ({ title: `Reduce "${i}"`, detail: `Investigate and fix the causes of "${i}", then compare its rate in the next 30 days.`, evidence: `${n} of ${results.length} responses in the last 30 days.` }));
  }
  const now = new Date().toISOString();
  for (const it of items.slice(0, 5)) await D.prepare("INSERT INTO improvements (created_at, title, detail, evidence) VALUES (?,?,?,?)").bind(now, str(it.title, 160), str(it.detail, 1500), str(it.evidence, 800)).run();
  await audit(c, c.env.DB, u.id, "meet.improvements_drafted", { count: items.length });
  return c.json({ ok: true, count: items.length });
});

meet.post("/x/improvements/:id", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "admin")) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 1024);
  if (!["approved", "rejected", "done"].includes(b.status)) return c.json({ error: "Bad status." }, 400);
  await db(c).prepare("UPDATE improvements SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?").bind(b.status, u.email, new Date().toISOString(), Number(c.req.param("id"))).run();
  await audit(c, c.env.DB, u.id, "meet.improvement_" + b.status, { id: c.req.param("id") });
  return c.json({ ok: true });
});
