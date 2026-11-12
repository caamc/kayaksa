// Two-way calendar sync with Outlook (Microsoft 365) and Google Calendar.
//
//   Meet → calendar: a scheduled meeting is added to the host's connected calendars, and to those of
//                    invited Meet members who connected theirs; rescheduling or cancelling updates them.
//   Calendar → Meet: your calendar's events show in Planner beside your to-dos and deliverables, and if
//                    the host moves a Meet meeting in Outlook or Google, the meeting moves in Meet too.
//
// Sign-in uses each provider's standard OAuth flow on the server. Access and refresh tokens are
// encrypted (AES-GCM) before they are stored; the browser never sees them. Disconnecting deletes them.
// Switched on by app registrations kept in GitHub secrets (MS_CLIENT_ID/SECRET, GOOGLE_CLIENT_ID/SECRET).
import { Hono } from "hono";
import { seal, unseal, randomToken } from "../../../packages/core/src/crypto";
import { auditFull } from "../../../packages/core/src/shield";
import { needMember, currentMember, now, type Member } from "./auth";
import type { Env } from "./env";

type P = "microsoft" | "google";
const MEET = "https://meet.kayaksa.com";
const NAMES: Record<P, string> = { microsoft: "Outlook", google: "Google Calendar" };
const STATE_COOKIE = "__Host-kcal_state";

export const configured = (env: Env, p: P) => (p === "microsoft" ? !!(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET) : !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET));
const keyOf = (env: Env) => "cal:" + (env.MEET_SIGNING_KEY || "");
const redirect = (p: P) => `${MEET}/calendar/callback/${p}`;
const msBase = (env: Env) => `https://login.microsoftonline.com/${env.MS_TENANT || "organizations"}/oauth2/v2.0`;
const MS_SCOPE = "offline_access openid email User.Read Calendars.ReadWrite";
const G_SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";

// ------------------------------------------------------------------ tokens
async function exchange(env: Env, p: P, params: Record<string, string>) {
  const body = new URLSearchParams(p === "microsoft"
    ? { client_id: env.MS_CLIENT_ID!, client_secret: env.MS_CLIENT_SECRET!, scope: MS_SCOPE, ...params }
    : { client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, ...params });
  const r = await fetch(p === "microsoft" ? `${msBase(env)}/token` : "https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "The calendar sign-in failed.");
  return j as { access_token: string; refresh_token?: string; expires_in: number; id_token?: string };
}
function emailFromIdToken(t?: string) {
  try { const p = JSON.parse(atob(t!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return String(p.email || p.preferred_username || "").slice(0, 200) || null; } catch { return null; }
}
/** A valid access token for a member's connected calendar, refreshing it when needed. */
async function access(env: Env, memberId: string, p: P): Promise<string | null> {
  const row: any = await env.DB.prepare("SELECT * FROM cal_links WHERE member_id = ? AND provider = ?").bind(memberId, p).first();
  if (!row || !configured(env, p)) return null;
  if (row.expires_at > Date.now() + 60_000) return unseal(row.access_token, keyOf(env));
  try {
    const t = await exchange(env, p, { grant_type: "refresh_token", refresh_token: await unseal(row.refresh_token, keyOf(env)) });
    await env.DB.prepare("UPDATE cal_links SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expires_at = ?, error = NULL WHERE member_id = ? AND provider = ?")
      .bind(await seal(t.access_token, keyOf(env)), t.refresh_token ? await seal(t.refresh_token, keyOf(env)) : null, Date.now() + t.expires_in * 1000, memberId, p).run();
    return t.access_token;
  } catch (e: any) {
    await env.DB.prepare("UPDATE cal_links SET error = ? WHERE member_id = ? AND provider = ?").bind("Sign in again to keep your calendar in sync.", memberId, p).run();
    return null;
  }
}
async function call(token: string, url: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
  const j: any = r.status === 204 ? {} : await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

// ------------------------------------------------------------------ Meet → calendar
function eventFor(p: P, m: any) {
  const start = new Date(m.starts_at), end = new Date(+start + (m.duration_min || 30) * 60_000);
  const link = `${MEET}/${m.id}`;
  const text = `Join on Meet by Kayak: ${link}\n\nSign in with your Meet by Kayak account to join. Guests use the link the host sends them.`;
  if (p === "microsoft") return {
    subject: m.title, body: { contentType: "HTML", content: `<p>Join on <b>Meet by Kayak</b>: <a href="${link}">${link}</a></p><p>Sign in with your Meet by Kayak account to join. Guests use the link the host sends them.</p>` },
    start: { dateTime: start.toISOString().slice(0, 19), timeZone: "UTC" }, end: { dateTime: end.toISOString().slice(0, 19), timeZone: "UTC" },
    location: { displayName: "Meet by Kayak", locationUri: link }, transactionId: `kmeet-${m.id}`,
  };
  return { summary: m.title, description: text, location: link, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, source: { title: "Meet by Kayak", url: link } };
}
/** Adds or updates a meeting in the connected calendars of its host and invited Meet members. */
export async function pushMeeting(env: Env, meetingId: string) {
  const m: any = await env.DB.prepare("SELECT * FROM meetings WHERE id = ?").bind(meetingId).first();
  if (!m || !m.starts_at) return;
  if (m.status === "cancelled") return removeMeeting(env, meetingId);
  const emails = [m.host_email, ...JSON.parse(m.invitees || "[]")].map((e: string) => String(e).toLowerCase());
  const qs = emails.map(() => "?").join(",");
  const { results: links } = await env.DB.prepare(`SELECT l.member_id, l.provider FROM cal_links l JOIN members mb ON mb.id = l.member_id WHERE lower(mb.email) IN (${qs})`).bind(...emails).all<any>();
  for (const l of links) {
    const p = l.provider as P;
    const token = await access(env, l.member_id, p); if (!token) continue;
    const have: any = await env.DB.prepare("SELECT event_id FROM cal_events WHERE meeting_id = ? AND member_id = ? AND provider = ?").bind(meetingId, l.member_id, p).first();
    const base = p === "microsoft" ? "https://graph.microsoft.com/v1.0/me/events" : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const r = have ? await call(token, `${base}/${encodeURIComponent(have.event_id)}`, "PATCH", eventFor(p, m)) : await call(token, base, "POST", eventFor(p, m));
    const eid = r.ok ? String(r.j.id || have?.event_id || "") : "";
    if (eid) await env.DB.prepare("INSERT INTO cal_events (meeting_id, member_id, provider, event_id, start_at) VALUES (?,?,?,?,?) ON CONFLICT(meeting_id, member_id, provider) DO UPDATE SET event_id = excluded.event_id, start_at = excluded.start_at")
      .bind(meetingId, l.member_id, p, eid, m.starts_at).run();
  }
}
export async function removeMeeting(env: Env, meetingId: string) {
  const { results } = await env.DB.prepare("SELECT * FROM cal_events WHERE meeting_id = ?").bind(meetingId).all<any>();
  for (const e of results) {
    const p = e.provider as P;
    const token = await access(env, e.member_id, p);
    if (token) await call(token, p === "microsoft" ? `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(e.event_id)}` : `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(e.event_id)}`, "DELETE");
  }
  await env.DB.prepare("DELETE FROM cal_events WHERE meeting_id = ?").bind(meetingId).run();
}

// ------------------------------------------------------------------ calendar → Meet
interface CalItem { id: string; title: string; start: string; end: string; link: string | null; provider: P; allDay: boolean }
async function fetchEvents(env: Env, memberId: string, p: P): Promise<CalItem[] | null> {
  const token = await access(env, memberId, p); if (!token) return null;
  const from = new Date(Date.now() - 86_400_000).toISOString(), to = new Date(Date.now() + 60 * 86_400_000).toISOString();
  if (p === "microsoft") {
    const r = await call(token, `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${from}&endDateTime=${to}&$top=200&$orderby=start/dateTime&$select=id,subject,start,end,webLink,isAllDay,isCancelled`, "GET", undefined, { Prefer: 'outlook.timezone="UTC"' });
    if (!r.ok) return null;
    return (r.j.value || []).filter((e: any) => !e.isCancelled).map((e: any) => ({ id: e.id, title: String(e.subject || "(no title)").slice(0, 200), start: e.start.dateTime.replace(/(\.\d+)?$/, "Z").replace("ZZ", "Z"), end: e.end.dateTime.replace(/(\.\d+)?$/, "Z").replace("ZZ", "Z"), link: e.webLink || null, provider: p, allDay: !!e.isAllDay }));
  }
  const r = await call(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(from)}&timeMax=${encodeURIComponent(to)}&singleEvents=true&orderBy=startTime&maxResults=200`);
  if (!r.ok) return null;
  return (r.j.items || []).filter((e: any) => e.status !== "cancelled").map((e: any) => ({ id: e.id, title: String(e.summary || "(no title)").slice(0, 200), start: e.start.dateTime || `${e.start.date}T00:00:00Z`, end: e.end.dateTime || `${e.end.date}T00:00:00Z`, link: e.htmlLink || null, provider: p, allDay: !e.start.dateTime }));
}
/** Refreshes a member's calendar events (at most every 5 minutes unless forced), and applies the host's moves. */
export async function syncMember(env: Env, m: Member, force = false): Promise<CalItem[]> {
  const { results: links } = await env.DB.prepare("SELECT provider, synced_at, cache FROM cal_links WHERE member_id = ?").bind(m.id).all<any>();
  const out: CalItem[] = [];
  for (const l of links) {
    const p = l.provider as P;
    let items: CalItem[] | null = null;
    if (!force && l.synced_at && Date.now() - Date.parse(l.synced_at) < 5 * 60_000 && l.cache) items = JSON.parse(l.cache);
    else {
      items = await fetchEvents(env, m.id, p);
      if (items) {
        await env.DB.prepare("UPDATE cal_links SET synced_at = ?, cache = ? WHERE member_id = ? AND provider = ?").bind(now(), JSON.stringify(items), m.id, p).run();
        // Two-way: the host moved a Meet meeting in their calendar → move it in Meet (and in everyone else's calendars).
        const { results: mine } = await env.DB.prepare("SELECT e.meeting_id, e.event_id, e.start_at, mt.duration_min FROM cal_events e JOIN meetings mt ON mt.id = e.meeting_id WHERE e.member_id = ? AND e.provider = ? AND mt.host_email = ? AND mt.status = 'scheduled'").bind(m.id, p, m.email).all<any>();
        for (const e of mine) {
          const ev = items.find((x) => x.id === e.event_id); if (!ev) continue;
          const start = new Date(ev.start), dur = Math.round((Date.parse(ev.end) - +start) / 60000);
          if (isNaN(+start) || Math.abs(+start - Date.parse(e.start_at)) < 60_000) continue;
          await env.DB.batch([
            env.DB.prepare("UPDATE meetings SET starts_at = ?, duration_min = ? WHERE id = ?").bind(start.toISOString(), Math.min(480, Math.max(15, dur || e.duration_min || 30)), e.meeting_id),
            env.DB.prepare("UPDATE cal_events SET start_at = ? WHERE meeting_id = ?").bind(start.toISOString(), e.meeting_id),
          ]);
          await pushMeeting(env, e.meeting_id);
        }
      } else items = l.cache ? JSON.parse(l.cache) : [];
    }
    out.push(...(items || []));
  }
  // Don't show Meet's own meetings twice.
  const { results: ours } = await env.DB.prepare("SELECT event_id FROM cal_events WHERE member_id = ?").bind(m.id).all<any>();
  const skip = new Set(ours.map((x: any) => x.event_id));
  return out.filter((x) => !skip.has(x.id));
}

// ------------------------------------------------------------------ routes
type V = { Bindings: Env; Variables: { member: Member } };
export const calApi = new Hono<V>();
calApi.use("*", needMember);
calApi.get("/", async (c) => {
  const m = c.get("member");
  const { results } = await c.env.DB.prepare("SELECT provider, account, created_at, synced_at, error FROM cal_links WHERE member_id = ?").bind(m.id).all<any>();
  return c.json({ providers: (["microsoft", "google"] as P[]).map((p) => { const l = results.find((x: any) => x.provider === p); return { id: p, name: NAMES[p], available: configured(c.env, p), connected: !!l, account: l?.account || null, since: l?.created_at || null, syncedAt: l?.synced_at || null, error: l?.error || null }; }) });
});
calApi.post("/sync", async (c) => c.json({ events: await syncMember(c.env, c.get("member"), true) }));
calApi.delete("/:p", async (c) => {
  const m = c.get("member"), p = c.req.param("p") as P;
  if (!NAMES[p]) return c.json({ error: "Unknown calendar." }, 400);
  await c.env.DB.batch([c.env.DB.prepare("DELETE FROM cal_links WHERE member_id = ? AND provider = ?").bind(m.id, p), c.env.DB.prepare("DELETE FROM cal_events WHERE member_id = ? AND provider = ?").bind(m.id, p)]);
  await auditFull(c as any, c.env.DB, m.id, "meet.calendar.disconnected", { provider: p });
  return c.json({ ok: true });
});

export const calPages = new Hono<{ Bindings: Env }>();
calPages.get("/connect/:p", async (c) => {
  const p = c.req.param("p") as P;
  const m = await currentMember(c);
  if (!m) return c.redirect(`/login?next=${encodeURIComponent("/app#calendar")}`);
  if (!NAMES[p] || !configured(c.env, p)) return c.redirect("/app#calendar-unavailable");
  const state = randomToken(24);
  const u = p === "microsoft"
    ? `${msBase(c.env)}/authorize?${new URLSearchParams({ client_id: c.env.MS_CLIENT_ID!, response_type: "code", redirect_uri: redirect(p), response_mode: "query", scope: MS_SCOPE, state, login_hint: m.email, prompt: "select_account" })}`
    : `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID!, response_type: "code", redirect_uri: redirect(p), scope: G_SCOPE, state, access_type: "offline", prompt: "consent", include_granted_scopes: "true", login_hint: m.email })}`;
  return new Response(null, { status: 302, headers: { Location: u, "Set-Cookie": `${STATE_COOKIE}=${state}.${m.id}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`, "Cache-Control": "no-store" } });
});
calPages.get("/callback/:p", async (c) => {
  const p = c.req.param("p") as P;
  const m = await currentMember(c);
  const cookie = (c.req.header("Cookie") || "").split(/;\s*/).find((x) => x.startsWith(STATE_COOKIE + "="))?.slice(STATE_COOKIE.length + 1) || "";
  const [state, mid] = cookie.split(".");
  const clear = `${STATE_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
  const back = (h: string) => new Response(null, { status: 302, headers: { Location: `/app#${h}`, "Set-Cookie": clear } });
  if (!m || !NAMES[p] || !configured(c.env, p) || !state || state !== c.req.query("state") || mid !== m.id) return back("calendar-failed");
  const code = c.req.query("code"); if (!code) return back("calendar-cancelled");
  try {
    const t = await exchange(c.env, p, { grant_type: "authorization_code", code, redirect_uri: redirect(p) });
    if (!t.refresh_token) return back("calendar-failed");
    let account = emailFromIdToken(t.id_token);
    if (!account && p === "microsoft") account = (await call(t.access_token, "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName")).j.mail || null;
    await c.env.DB.prepare("INSERT INTO cal_links (member_id, provider, account, access_token, refresh_token, expires_at, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(member_id, provider) DO UPDATE SET account = excluded.account, access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, error = NULL, cache = NULL, synced_at = NULL")
      .bind(m.id, p, account, await seal(t.access_token, keyOf(c.env)), await seal(t.refresh_token, keyOf(c.env)), Date.now() + t.expires_in * 1000, now()).run();
    await auditFull(c as any, c.env.DB, m.id, "meet.calendar.connected", { provider: p, account });
    // Add the meetings already scheduled for this person.
    const { results } = await c.env.DB.prepare("SELECT id FROM meetings WHERE status = 'scheduled' AND starts_at > ? AND (host_email = ? OR invitees LIKE ?) LIMIT 50").bind(now(), m.email, `%${m.email}%`).all<any>();
    c.executionCtx.waitUntil((async () => { for (const r of results) await pushMeeting(c.env, r.id).catch(() => {}); })());
    return back("calendar-connected");
  } catch { return back("calendar-failed"); }
});
