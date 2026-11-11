// Grow & Connect: Kayak Network groups, referral tracking, group emails and statistics (14);
// website section analytics, consent statistics and the competitor watch (17, 19); Kay enquiry
// triage (16). Competitor watch reads public listing pages once a day, keeps only headlines and
// links (never article text), identifies itself, and skips any page that robots.txt disallows.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { readJson, str } from "../../../packages/core/src/http";
import { mailEnabled, mailHtml, sendMail } from "../../../packages/core/src/mail";
import { modelFor } from "../../../packages/core/src/ai";
import { Env, User, atLeast, uid } from "./env";
import { GROUPS } from "./directory";
import { recordUsage } from "./assistant";
import SITE from "../../www/src/site-data.json";

type V = { Bindings: Env; Variables: { user: User } };
export const grow = new Hono<V>();
const now = () => new Date().toISOString();
const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const GROUP_LABEL: Record<string, string> = { client: "Clients", bp_consulting: "Business Partners: Consulting", bp_vendor: "Business Partners: Vendors", senior_advisor: "Senior Advisors", affiliate: "Group and affiliates" };
const STAGES = ["introduced", "meeting", "proposal", "won", "lost", "parked"];
const editor = (c: any) => atLeast(c.get("user"), "editor");

// ------------------------------------------------------------------ 14 · network statistics
grow.get("/network/stats", async (c) => {
  const d = c.env.DB;
  const [byGrp, refs, recent, mails] = await Promise.all([
    d.prepare("SELECT grp, status, COUNT(*) n FROM partners GROUP BY grp, status").all<any>(),
    d.prepare("SELECT r.*, p.name partner, p.grp FROM referrals r JOIN partners p ON p.id = r.partner_id ORDER BY r.referred_on DESC, r.created_at DESC LIMIT 500").all<any>(),
    d.prepare("SELECT id, name, grp, updated_at FROM partners ORDER BY updated_at DESC LIMIT 8").all<any>(),
    d.prepare("SELECT m.*, u.name by_name FROM network_mail m LEFT JOIN users u ON u.id = m.by_user ORDER BY m.created_at DESC LIMIT 20").all<any>(),
  ]);
  const R = refs.results;
  const sum = (a: any[], k: string) => a.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const closed = R.filter((r) => r.status === "won" || r.status === "lost");
  const won = R.filter((r) => r.status === "won");
  const byPartner: Record<string, any> = {};
  for (const r of R) {
    const p = (byPartner[r.partner_id] ||= { partner: r.partner, grp: r.grp, in: 0, out: 0, won: 0, value: 0 });
    p[r.direction]++; if (r.status === "won") { p.won++; p.value += r.value_inr; }
  }
  return c.json({
    groups: GROUPS.map((g) => ({ id: g, label: GROUP_LABEL[g], total: byGrp.results.filter((x) => x.grp === g).reduce((s, x) => s + x.n, 0), active: byGrp.results.find((x) => x.grp === g && x.status === "active")?.n || 0 })),
    referrals: R,
    totals: {
      in: R.filter((r) => r.direction === "in").length, out: R.filter((r) => r.direction === "out").length,
      open: R.filter((r) => !["won", "lost", "parked"].includes(r.status)).length,
      won: won.length, conversion: closed.length ? Math.round((won.length / closed.length) * 100) : null,
      wonValue: sum(won, "value_inr"), pipeline: sum(R.filter((r) => !["won", "lost", "parked"].includes(r.status)), "value_inr"),
      feesDue: Math.round(won.filter((r) => r.direction === "in" && !r.fee_paid).reduce((s, r) => s + (r.value_inr * r.fee_pct) / 100, 0)),
    },
    stages: STAGES.map((s) => ({ stage: s, n: R.filter((r) => r.status === s).length, value: sum(R.filter((r) => r.status === s), "value_inr") })),
    leaders: Object.values(byPartner).sort((a: any, b: any) => b.value - a.value || b.in + b.out - (a.in + a.out)).slice(0, 8),
    recent: recent.results, mails: mails.results,
  });
});

grow.post("/referrals", async (c) => {
  if (!editor(c)) return c.json({ error: "Editors and administrators can record referrals." }, 403);
  const b = await readJson<any>(c, 8192);
  const p = await c.env.DB.prepare("SELECT id FROM partners WHERE id = ?").bind(str(b.partner_id, 60)).first();
  if (!p) return c.json({ error: "Choose the partner." }, 400);
  const opp = str(b.opportunity, 200);
  if (!opp) return c.json({ error: "Describe the opportunity." }, 400);
  const id = b.id ? str(b.id, 60) : uid();
  const status = STAGES.includes(b.status) ? b.status : "introduced";
  const closedOn = ["won", "lost"].includes(status) ? str(b.closed_on, 10) || now().slice(0, 10) : null;
  await c.env.DB.prepare(`INSERT INTO referrals (id, partner_id, direction, opportunity, client, cluster, status, value_inr, fee_pct, fee_paid, referred_on, closed_on, owner, notes, created_by, created_at, updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?16)
    ON CONFLICT(id) DO UPDATE SET partner_id=?2, direction=?3, opportunity=?4, client=?5, cluster=?6, status=?7, value_inr=?8, fee_pct=?9, fee_paid=?10, referred_on=?11, closed_on=?12, owner=?13, notes=?14, updated_at=?16`)
    .bind(id, p.id, b.direction === "out" ? "out" : "in", opp, str(b.client, 160), str(b.cluster, 60), status, Math.max(0, Math.round(Number(b.value_inr) || 0)),
      Math.max(0, Math.min(50, Number(b.fee_pct) || 0)), b.fee_paid ? 1 : 0, str(b.referred_on, 10) || now().slice(0, 10), closedOn, str(b.owner, 120), str(b.notes, 3000), c.get("user").id, now()).run();
  await audit(c, c.env.DB, c.get("user").id, "network.referral_saved", { id, status });
  return c.json({ id });
});
grow.post("/referrals/:id/delete", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  await c.env.DB.prepare("DELETE FROM referrals WHERE id = ?").bind(c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "network.referral_deleted", { id: c.req.param("id") });
  return c.json({ ok: true });
});

// Email one group. Each contact gets their own message (no shared recipient list), opted-out
// contacts are skipped, and every message says how to stop receiving them.
grow.post("/network/mail", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "admin")) return c.json({ error: "Administrators send network emails." }, 403);
  const b = await readJson<any>(c, 40_000);
  const grp = GROUPS.includes(b.grp) ? b.grp : null;
  const subject = str(b.subject, 160), body = str(b.body, 12_000);
  if (!grp || !subject || !body) return c.json({ error: "Choose a group, and write a subject and a message." }, 400);
  const { results } = await c.env.DB.prepare("SELECT id, name, contact_name, contact_email FROM partners WHERE grp = ? AND status = 'active' AND contact_email != '' AND email_opt_out = 0").bind(grp).all<any>();
  if (b.preview) return c.json({ recipients: results.map((r: any) => ({ name: r.contact_name || r.name, org: r.name, email: r.contact_email })) });
  if (!mailEnabled(c.env)) return c.json({ error: "Email sending is not set up yet (RESEND_API_KEY). Nothing was sent." }, 503);
  let sent = 0, skipped = 0;
  for (const r of results.slice(0, 300)) {
    const first = (r.contact_name || "").split(" ")[0];
    const intro = `${first ? `Dear ${esc(first)},<br><br>` : ""}${esc(body).replace(/\n/g, "<br>")}`;
    const res = await sendMail(c.env, r.contact_email, subject, mailHtml({ site: "NETWORK", title: subject, intro, outro: `You receive this because ${esc(r.name)} is part of the Kayak Network. To stop these emails, reply with the word unsubscribe and we will remove you.` }));
    res.sent ? sent++ : skipped++;
  }
  await c.env.DB.prepare("INSERT INTO network_mail (id, grp, subject, body, recipients, sent, skipped, by_user, created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(uid(), grp, subject, body, results.length, sent, skipped, u.id, now()).run();
  await audit(c, c.env.DB, u.id, "network.mailed", { grp, sent, skipped });
  return c.json({ sent, skipped });
});

// ------------------------------------------------------------------ 17 · website sections
const SECTION = (path: string) => {
  const p = path.split("?")[0];
  if (p === "/" || p === "") return "Home";
  if (/^\/confluence/.test(p)) return "Confluence magazine";
  if (/^\/(insights|insight-)/.test(p)) return "Insights";
  if (/^\/(services|svc-|strategy-deals|tax-legal-regulatory|crisis-resilience|technology-ai|managed-services|international-desk)/.test(p)) return "Services";
  if (/^\/(industries|ind-)/.test(p)) return "Industries";
  if (/^\/(solutions|tools|nexapair|sayusnow|seecounter|docuvow)/.test(p)) return "Kayak Solutions";
  if (/^\/about/.test(p)) return "About us";
  if (/^\/careers/.test(p)) return "Careers";
  if (/^\/contact/.test(p)) return "Contact";
  if (/^\/(legal|privacy|terms)/.test(p)) return "Legal and privacy";
  return "Other";
};
grow.get("/website/sections", async (c) => {
  const d = c.env.WWW_DB;
  if (!d) return c.json({ error: "The website database is not connected to the portal yet." }, 503);
  const day = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
  const [cur, prev, enq, consent] = await Promise.all([
    d.prepare("SELECT path, SUM(views) n FROM stat_views WHERE day >= ? GROUP BY path").bind(day(30)).all<any>(),
    d.prepare("SELECT path, SUM(views) n FROM stat_views WHERE day >= ? AND day < ? GROUP BY path").bind(day(60), day(30)).all<any>(),
    d.prepare("SELECT page, source, COUNT(*) n FROM enquiries WHERE created_at >= ? GROUP BY page, source").bind(day(30)).all<any>(),
    d.prepare("SELECT purpose, trigger, SUM(granted) yes, COUNT(*) n FROM consents WHERE at >= ? GROUP BY purpose, trigger").bind(day(30)).all<any>().catch(() => ({ results: [] as any[] })),
  ]);
  const agg = (rows: any[], key: string) => rows.reduce((m: any, r: any) => ((m[SECTION(r[key] || "")] = (m[SECTION(r[key] || "")] || 0) + r.n), m), {});
  const a = agg(cur.results, "path"), b = agg(prev.results, "path"), e = agg(enq.results, "page");
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const sections = names.map((s) => ({ section: s, views: a[s] || 0, prev: b[s] || 0, change: b[s] ? Math.round(((a[s] || 0) - b[s]) / b[s] * 100) : null, enquiries: e[s] || 0, conv: a[s] ? Math.round(((e[s] || 0) / a[s]) * 1000) / 10 : 0 }))
    .sort((x, y) => y.views - x.views);
  const kay = enq.results.filter((r: any) => r.source === "kay").reduce((s: number, r: any) => s + r.n, 0);
  return c.json({ sections, kayEnquiries: kay, consent: consent.results });
});

// Kay's enquiry triage: a two-line summary, the closest cluster and how soon to reply.
grow.post("/website/enquiries/:id/triage", async (c) => {
  const d = c.env.WWW_DB;
  if (!d) return c.json({ error: "The website database is not connected." }, 503);
  const e = await d.prepare("SELECT * FROM enquiries WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!e) return c.json({ error: "Not found." }, 404);
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ error: "Kayak AI is not configured." }, 503);
  const clusters = (SITE as any).clusters.map((x: any) => x.name).join("; ");
  const prompt = `Triage this enquiry to Kayak Strategic Advisors. Clusters: ${clusters}. Reply as JSON {"summary":"two short sentences","cluster":"one cluster name","priority":"today|this week|routine","next":"the first thing the reply should offer"}.\n\nFrom: ${e.organisation || "an individual"}\nArea chosen: ${e.area}\nMessage: ${String(e.message).slice(0, 3000)}\n${e.transcript ? `Conversation with Kay (excerpt): ${String(e.transcript).slice(-3000)}` : ""}`;
  const model = "claude-haiku-5-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": c.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model, max_tokens: 400, messages: [{ role: "user", content: prompt }] }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return c.json({ error: `Kayak AI: ${j?.error?.message || r.status}` }, 502);
  const text = (j.content || []).map((b: any) => b.text || "").join("");
  await recordUsage(c.env.DB, model, "triage", prompt.length, text.length);
  let t: any = {};
  try { t = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { return c.json({ error: "Kayak AI did not return a usable summary. Try again." }, 502); }
  const summary = [str(t.summary, 400), t.cluster && `Cluster: ${str(t.cluster, 80)}`, t.priority && `Reply: ${str(t.priority, 20)}`, t.next && `Offer: ${str(t.next, 200)}`].filter(Boolean).join("\n");
  await d.prepare("UPDATE enquiries SET summary = ? WHERE id = ?").bind(summary, e.id).run();
  return c.json({ summary });
});
grow.post("/website/enquiries/:id/owner", async (c) => {
  const d = c.env.WWW_DB!;
  const b = await readJson<any>(c, 512);
  await d.prepare("UPDATE enquiries SET owner = ?, status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END WHERE id = ?").bind(str(b.owner, 120), c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "website.enquiry_assigned", { id: c.req.param("id") });
  return c.json({ ok: true });
});
// Turn an enquiry into a Kayak Network client record (the enquirer agreed to be contacted).
grow.post("/website/enquiries/:id/to-network", async (c) => {
  if (!editor(c)) return c.json({ error: "Editors and administrators only." }, 403);
  const e = await c.env.WWW_DB!.prepare("SELECT * FROM enquiries WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!e) return c.json({ error: "Not found." }, 404);
  const id = uid(), t = now();
  await c.env.DB.prepare("INSERT INTO partners (id, name, kind, status, grp, contact_name, contact_email, contact_phone, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, e.organisation || e.name, "Client", "prospect", "client", e.name, e.email, e.phone || "", `From a website enquiry (${e.source === "kay" ? "via Kay" : "form"}) on ${String(e.created_at).slice(0, 10)}. Consent recorded ${String(e.consent_at).slice(0, 10)}.`, c.get("user").id, t, t).run();
  await audit(c, c.env.DB, c.get("user").id, "network.from_enquiry", { id });
  return c.json({ id });
});

// ------------------------------------------------------------------ 17 · competitor watch
grow.get("/competitors", async (c) => {
  const [list, items, brief] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM competitors ORDER BY sort, name").all<any>(),
    c.env.DB.prepare("SELECT i.*, c.name firm FROM competitor_items i JOIN competitors c ON c.id = i.competitor_id ORDER BY i.first_seen DESC, i.id DESC LIMIT 240").all<any>(),
    c.env.DB.prepare("SELECT b.*, u.name by_name FROM competitor_briefs b LEFT JOIN users u ON u.id = b.by_user ORDER BY b.id DESC LIMIT 1").first<any>(),
  ]);
  return c.json({ competitors: list.results, items: items.results, brief, ai: !!c.env.ANTHROPIC_API_KEY });
});
grow.post("/competitors", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 2048);
  const u = str(b.url, 300);
  if (!/^https:\/\/[^/]+\.[^/]+/.test(u)) return c.json({ error: "Enter the https:// address of the firm's insights page." }, 400);
  const id = b.id ? str(b.id, 40) : str(b.name, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await c.env.DB.prepare("INSERT INTO competitors (id, name, url, active) VALUES (?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET name=?2, url=?3, active=?4").bind(id, str(b.name, 80) || id, u, b.active === false ? 0 : 1).run();
  return c.json({ id });
});
grow.post("/competitors/check", async (c) => {
  if (!atLeast(c.get("user"), "editor")) return c.json({ error: "Editors and administrators only." }, 403);
  return c.json(await checkCompetitors(c.env));
});
grow.post("/competitors/brief", async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ error: "Kayak AI is not configured." }, 503);
  const { results } = await c.env.DB.prepare("SELECT c.name firm, i.title FROM competitor_items i JOIN competitors c ON c.id = i.competitor_id WHERE i.first_seen >= ? ORDER BY i.first_seen DESC LIMIT 160").bind(new Date(Date.now() - 45 * 86400_000).toISOString()).all<any>();
  if (results.length < 3) return c.json({ error: "Not enough headlines yet. Run a check first." }, 400);
  const ours = (SITE as any).clusters.map((x: any) => `${x.name}: ${x.line}`).join("\n");
  const prompt = `You advise Kayak Strategic Advisors, a senior-led Indian advisory boutique. Its practice:\n${ours}\n\nThese are recent public insight headlines from larger firms in India:\n${results.map((r: any) => `- [${r.firm}] ${r.title}`).join("\n")}\n\nWrite a short brief for Kayak's leadership in plain British English with these headings: "What they are talking about" (4-6 themes, which firms), "Where they are quiet" (gaps Kayak can own), "How Kayak can capitalise" (5 specific actions: an insight to publish, a Confluence section angle, a service page to sharpen, an event or webinar, an outreach list), and "Watch" (2 risks). Refer to the firms factually by name; no disparagement, no claims about their quality, and no copying of their wording. Under 450 words.`;
  const model = modelFor(c.env, "anthropic");
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": c.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model, max_tokens: 1400, messages: [{ role: "user", content: prompt }] }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) return c.json({ error: `Kayak AI: ${j?.error?.message || r.status}` }, 502);
  const body = (j.content || []).map((b: any) => b.text || "").join("").trim();
  await recordUsage(c.env.DB, model, "competitors", prompt.length, body.length);
  await c.env.DB.prepare("INSERT INTO competitor_briefs (body, model, by_user, created_at) VALUES (?,?,?,?)").bind(body, model, c.get("user").id, now()).run();
  return c.json({ body });
});

const UA = "KayakMonitor/1.0 (+https://www.kayaksa.com/legal; competitor headline watch, once a day)";
async function allowed(u: URL): Promise<boolean> {
  try {
    const r = await fetch(`${u.origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return true;
    let applies = false; const dis: string[] = [];
    for (const raw of (await r.text()).split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim(); const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") applies = v === "*" || /kayakmonitor/i.test(v);
      else if (k === "disallow" && applies && v) dis.push(v);
    }
    return !dis.some((d) => u.pathname.startsWith(d.replace(/\*.*$/, "")));
  } catch { return true; }
}
const ARTICLE = /(insight|perspective|article|publication|report|thought|blog|news|research|point-of-view|issues|analysis|survey|outlook|budget|tax-alert|newsletter)/i;
export async function checkCompetitors(env: Env) {
  const { results } = await env.DB.prepare("SELECT * FROM competitors WHERE active = 1").all<any>();
  const out: any[] = [];
  for (const comp of results) {
    let status = "", added = 0;
    try {
      const u = new URL(comp.url);
      if (!(await allowed(u))) { status = "Skipped: the site's robots.txt asks automated readers not to visit this page."; }
      else {
        const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(12_000) });
        if (!r.ok) status = `The page answered ${r.status}.`;
        else {
          const html = (await r.text()).slice(0, 1_500_000);
          const seen = new Set<string>(); const found: { t: string; h: string }[] = [];
          for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,600}?)<\/a>/gi)) {
            const t = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
            if (t.length < 28 || t.length > 180 || /cookie|privacy|subscribe|sign in|log in|careers|contact us|read more|learn more|view all/i.test(t)) continue;
            let h: string; try { h = new URL(m[1], u).toString(); } catch { continue; }
            if (new URL(h).hostname.replace(/^www\./, "") !== u.hostname.replace(/^www\./, "") || !ARTICLE.test(h) || seen.has(h)) continue;
            seen.add(h); found.push({ t, h });
            if (found.length >= 40) break;
          }
          for (const f of found) {
            const res = await env.DB.prepare("INSERT OR IGNORE INTO competitor_items (competitor_id, title, url, first_seen) VALUES (?,?,?,?)").bind(comp.id, f.t, f.h, now()).run();
            added += res.meta.changes || 0;
          }
          status = found.length ? `Read ${found.length} headlines, ${added} new.` : "No headlines recognised on this page. Check the address.";
        }
      }
    } catch (e: any) { status = `Could not reach the page (${(e?.message || "error").slice(0, 60)}).`; }
    await env.DB.prepare("UPDATE competitors SET last_checked = ?, last_status = ?, items = (SELECT COUNT(*) FROM competitor_items WHERE competitor_id = ?) WHERE id = ?").bind(now(), status, comp.id, comp.id).run();
    out.push({ id: comp.id, status, added });
  }
  await env.DB.prepare("DELETE FROM competitor_items WHERE first_seen < ?").bind(new Date(Date.now() - 400 * 86400_000).toISOString()).run();
  return { checked: out };
}
