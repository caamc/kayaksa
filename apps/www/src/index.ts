// www.kayaksa.com: the public website, served dynamically from a Cloudflare Worker.
// Pages are rendered on the server (titles, descriptions, structured data and readable content
// for search engines and AI assistants), then the browser app takes over for smooth navigation.
import { exhibitHtml, cleanExhibit } from "./exhibit";
import { shield, securityEvent, auditFull, pruneSecurity } from "../../../packages/core/src/shield";
import { magazinePage, BUILT_IN, type Edition } from "./magazine";
import { Hono } from "hono";
import { securityHeaders, sameOrigin, HttpError, str, email as cleanEmail, rateLimit, clientIp } from "../../../packages/core/src/http";
import { randomToken, sha256hex } from "../../../packages/core/src/crypto";
import { mailEnabled, mailHtml, sendMail } from "../../../packages/core/src/mail";
import BODY from "./body.html";
import STATIC_DATA from "./site-data.json";
import SERVICES from "../public/assets/services.json";
import { kayApi, redact } from "./kay";
import { syncMemory, weeklyDrafts, dailyCleanup, seedMemory } from "./learning";
import type { Env } from "./env";

type C = { Bindings: Env };
const app = new Hono<C>();
const D: any = STATIC_DATA;

app.use("*", securityHeaders({ permissions: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" }));
app.use("*", shield("www", (e) => e.DB, { allowGoodBots: true }));
app.use("/api/*", sameOrigin());
app.onError((e: any, c) => {
  const status = e instanceof HttpError ? e.status : e?.status || 500;
  if (status >= 500) console.error("www error", e?.stack || e);
  return c.json({ error: status >= 500 ? "Something went wrong on our side. Please try again, or email enquiries@kayaksa.com." : e.message }, status);
});

const LEADERSHIP_LIVE = Date.parse("2027-01-15T00:00:00+05:30");
const SV: any[] = SERVICES as any;
const site = (c: any) => (c.env.SITE_URL || "https://www.kayaksa.com").replace(/\/$/, "");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

// Apex domain and old preview links go to www.
app.use("*", async (c, next) => {
  const u = new URL(c.req.url);
  if (u.hostname === "kayaksa.com") return c.redirect(`https://www.kayaksa.com${u.pathname}${u.search}`, 301);
  await next();
  // Preview addresses must never compete with www.kayaksa.com in search results.
  if (u.hostname.endsWith(".workers.dev")) { c.res = new Response(c.res.body, c.res); c.res.headers.set("X-Robots-Tag", "noindex, nofollow"); }
});

/** Site data: the built-in content plus everything published from the internal portal. */
// ---------------------------------------------------------------- Confluence editions
// Built-in issues plus those released from the internal portal. Drafts are never public, except to
// someone holding the preview link the portal generates for reviewers.
async function releasedEditions(c: any): Promise<Record<string, Edition>> {
  const out: Record<string, Edition> = { ...BUILT_IN };
  try {
    const { results } = await c.env.DB.prepare("SELECT id, data FROM editions WHERE status = 'released'").all();
    for (const r of results as any[]) try { out[r.id] = JSON.parse(r.data); } catch {}
  } catch {}
  return out;
}
async function latestEdition(c: any): Promise<Edition> {
  const all = await releasedEditions(c);
  return all[Object.keys(all).sort().pop()!];
}

async function siteData(c: any) {
  const data: any = { ...D, articles: [...D.articles] };
  const ed = await latestEdition(c);
  data.confluence = { id: ed.id, issue: ed.issue, month: ed.month, period: ed.period, coverTitle: ed.coverTitle, coverDek: ed.coverDek, coverLines: ed.coverLines, spotlight: ed.spotlight?.tool || null };
  // The featured exhibit on the Insights page: the issue's first bar or column exhibit, drawn exactly as in the magazine.
  {
    const ROT = ["photo", "pattern", "exhibit", "quote"];
    let n = 0;
    for (const [i, s] of (ed.stories || []).entries()) {
      const x = cleanExhibit(s.exhibit);
      if (!x) continue;
      n++;
      if (x.kind === "bar" || x.kind === "column") {
        const lay = s.layout || ROT[i % 4];
        data.confluence.exhibit = { story: s.title, dek: s.dek, page: 6 + i * 2 + (lay === "quote" ? 1 : 0), html: exhibitHtml(x, n, { wide: true }) };
        break;
      }
    }
  }
  try {
    const rows = await c.env.DB.prepare("SELECT id, section, cluster, pattern, mins, title, dek, body, published_at FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 60").all();
    const live = (rows.results as any[]).map((r) => ({ ...r, cluster: r.cluster === "tax-regulatory" ? "tax-legal-regulatory" : r.cluster, body: JSON.parse(r.body || "[]") }));
    const ids = new Set(live.map((a) => a.id));
    data.articles = [...live, ...data.articles.filter((a: any) => !ids.has(a.id))];
  } catch (e: any) {
    console.error("articles unavailable", e?.message);
  }
  // The leadership section goes live on 15 January 2027 (IST). Until then nothing about it is sent to browsers.
  const leadership = Date.now() >= LEADERSHIP_LIVE;
  data.flags = { leadership };
  data.people = leadership ? [{ initials: "AC", name: "Anuj Matushankar Choudhary", role: "Founder and Director", line: "Leads Kayak Strategic Advisors, Kayak Innovations and Kayak Technology Solutions.", tag: "" }] : [];
  data.config = { phone: c.env.CONTACT_PHONE || "", address: "A/2, 314, Shah & Nahar Industrial Estate, Delisle Road, Mumbai 400013" };
  return data;
}

// ------------------------------------------------------------------ server rendering
interface PageMeta { status: number; title: string; desc: string; ssr: string; ld?: object; type?: string }
const STATIC_PAGES: Record<string, [string, string]> = {
  services: ["Services", "Six service clusters led by one partner: strategy and deals, tax and regulation, crisis and resilience, technology and AI, managed services and the International Desk."],
  industries: ["Industries", "Wide industry and sector exposure, from financial services and healthcare to manufacturing, infrastructure, consumer and technology."],
  insights: ["Confluence insights", "Confluence, the Kayak monthly on strategy, risk and the decisions between them."],
  about: ["About us", "Kayak Strategic Advisors: independent, senior-led advisory from Mumbai and Thane. Our values, promises and standards."],
  careers: ["Careers", "Join the founding team at Kayak Strategic Advisors."],
  contact: ["Contact us", "Start a confidential conversation with Kayak Strategic Advisors. A senior member of the team replies within one working day."],
  legal: ["Privacy and terms", "How Kayak Strategic Advisors handles personal data, measures this site without cookies, and the terms of use."],
  solutions: ["Kayak Solutions", "Thought, Designed and Developed in India for the World: SayUsNow, SeeCounter, NexaPair and DocuVow, platforms born of Kayak's advisory practice."],
};

function render(path: string, data: any): PageMeta {
  const p = decodeURIComponent(path).replace(/\/+$/, "") || "/";
  const C = (id: string) => data.clusters.find((x: any) => x.id === id);
  const T = (id: string) => data.tools.find((x: any) => x.id === id);
  const A = (id: string) => data.articles.find((x: any) => x.id === id);
  let m: RegExpMatchArray | null;
  if (p === "/") {
    return {
      status: 200, title: "Kayak Strategic Advisors", desc: "Clear, evidence-led advice on strategy, deals, regulation, risk and technology for India's boards, promoters and investors. Mumbai and Thane.",
      ssr: `<h1>Kayak Strategic Advisors</h1><p>Clear, evidence-led advice on strategy, deals, regulation, risk and technology for India's boards, promoters and investors.</p><h2>Services</h2><ul>${data.clusters.map((c: any) => `<li><a href="/services/${c.id}">${esc(c.name)}</a></li>`).join("")}</ul><h2>Kayak Solutions</h2><p>Thought, Designed and Developed in India for the World.</p><ul>${data.tools.map((t: any) => `<li><a href="/solutions/${t.id}">${esc(t.name)}</a>: ${esc(t.kind)}</li>`).join("")}</ul><h2>Confluence</h2><ul>${data.articles.slice(0, 8).map((a: any) => `<li><a href="/insights/${a.id}">${esc(a.title)}</a></li>`).join("")}</ul><p><a href="/contact">Contact us</a></p>`,
      ld: { "@context": "https://schema.org", "@type": "ProfessionalService", name: "Kayak Strategic Advisors Private Limited", url: "https://www.kayaksa.com/", email: "enquiries@kayaksa.com", logo: "https://www.kayaksa.com/assets/kayak-logo.svg", address: { "@type": "PostalAddress", streetAddress: "A/2, 314, Shah & Nahar Industrial Estate, Delisle Road", addressLocality: "Mumbai", postalCode: "400013", addressRegion: "Maharashtra", addressCountry: "IN" }, areaServed: "IN", ...(data.flags?.leadership ? { founder: { "@type": "Person", name: "Anuj Matushankar Choudhary" } } : {}), slogan: "Clear advice for consequential decisions", knowsAbout: data.clusters.map((c: any) => c.name), sameAs: [] },
    };
  }
  if ((m = p.match(/^\/services\/([\w-]+)$/)) && C(m[1])) {
    const c = C(m[1]);
    return { status: 200, title: c.name, desc: (c.line || c.intro || "").slice(0, 300), ssr: `<h1>${esc(c.name)}</h1><p>${esc(c.intro || c.line || "")}</p><h2>Services</h2><ul>${SV.filter((v) => v.cluster === c.id).map((v) => `<li><a href="/services/${c.id}/${v.slug}">${esc(v.name)}</a>: ${esc(v.summary)}</li>`).join("")}</ul><p><a href="/contact">Talk to us about ${esc(c.name)}</a></p>`,
      ld: { "@context": "https://schema.org", "@type": "Service", name: c.name, provider: { "@type": "Organization", name: "Kayak Strategic Advisors" }, areaServed: "IN", description: c.intro || c.line } };
  }
  if ((m = p.match(/^\/services\/([\w-]+)\/([\w-]+)$/))) {
    const x = SV.find((v) => v.cluster === m![1] && v.slug === m![2]);
    if (x) {
      const cl = C(x.cluster);
      return { status: 200, title: `${x.name} | ${cl.name}`, desc: x.summary, ssr: `<p><a href="/services/${cl.id}">${esc(cl.name)}</a></p><h1>${esc(x.name)}</h1><p><b>${esc(x.summary)}</b></p>${x.overview.map((o: string) => `<p>${esc(o)}</p>`).join("")}<h2>When to call us</h2><ul>${x.when.map((w: string) => `<li>${esc(w)}</li>`).join("")}</ul><h2>What we do</h2><ul>${x.what.map((w: string) => `<li>${esc(w)}</li>`).join("")}</ul><h2>How we work</h2><ol>${x.approach.map((a: string[]) => `<li><b>${esc(a[0])}</b>: ${esc(a[1])}</li>`).join("")}</ol><h2>What you receive</h2><ul>${x.deliverables.map((d: string) => `<li>${esc(d)}</li>`).join("")}</ul>${x.note ? `<p><small>${esc(x.note)}</small></p>` : ""}<p><a href="/contact">Start a confidential conversation</a></p>`,
        ld: { "@context": "https://schema.org", "@type": "Service", name: x.name, serviceType: cl.name, description: x.summary, provider: { "@type": "ProfessionalService", name: "Kayak Strategic Advisors Private Limited", url: "https://www.kayaksa.com/" }, areaServed: ["IN", "Worldwide"] } };
    }
  }
  if ((m = p.match(/^\/solutions\/([\w-]+)$/)) && T(m[1])) {
    const t = T(m[1]);
    return { status: 200, title: `${t.name}: ${t.kind}`, desc: (t.line || "").slice(0, 300), ssr: `<h1>${esc(t.name)}</h1><p><b>${esc(t.kind)}.</b> ${esc(t.intro || t.line)}</p><ul>${(t.modules || []).map((x: any) => `<li><b>${esc(x[1])}</b>: ${esc(String(x[2]).replace(/^\[Planned\]\s*/, "Planned: "))}</li>`).join("")}</ul>`,
      ld: { "@context": "https://schema.org", "@type": "SoftwareApplication", name: t.name, applicationCategory: "BusinessApplication", description: t.line, publisher: { "@type": "Organization", name: "Kayak Technology Solutions" } } };
  }
  if ((m = p.match(/^\/insights\/([\w-]+)$/)) && A(m[1])) {
    const a = A(m[1]);
    const body = (a.body || []).map((x: string) => (x.startsWith("## ") ? `<h2>${esc(x.slice(3))}</h2>` : `<p>${esc(x)}</p>`)).join("");
    return { status: 200, title: a.title, desc: (a.dek || "").slice(0, 300), type: "article", ssr: `<article><p>${esc(a.section)} · Confluence</p><h1>${esc(a.title)}</h1><p><em>${esc(a.dek)}</em></p>${body}</article>`,
      ld: { "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.dek, datePublished: a.published_at || "2026-11-03", publisher: { "@type": "Organization", name: "Kayak Strategic Advisors", logo: { "@type": "ImageObject", url: "https://www.kayaksa.com/assets/kayak-logo.svg" } }, mainEntityOfPage: `https://www.kayaksa.com/insights/${a.id}` } };
  }
  const key = p.slice(1);
  if (STATIC_PAGES[key]) {
    const [title, desc] = STATIC_PAGES[key];
    let extra = "";
    if (key === "services") extra = `<ul>${data.clusters.map((c: any) => `<li><a href="/services/${c.id}">${esc(c.name)}</a>: ${esc(c.line || "")}</li>`).join("")}</ul>`;
    if (key === "insights") extra = `<p><a href="/confluence/${data.confluence.id}">Open the latest issue of Confluence, the magazine</a></p><ul>${data.articles.map((a: any) => `<li><a href="/insights/${a.id}">${esc(a.title)}</a>: ${esc(a.dek || "")}</li>`).join("")}</ul>`;
    if (key === "solutions") extra = `<ul>${data.tools.map((t: any) => `<li><a href="/solutions/${t.id}">${esc(t.name)}</a>: ${esc(t.line)}</li>`).join("")}</ul>`;
    if (key === "industries") extra = data.groups.map((g: any) => `<h2>${esc(g.name)}</h2><p>${g.members.map((x: any) => esc(x.name)).join(", ")}</p>`).join("");
    if (key === "services") extra += SV.map((v) => `<p><a href="/services/${v.cluster}/${v.slug}">${esc(v.name)}</a></p>`).join("");
    if (key === "about") extra = `<h2>Values</h2><ul>${data.values.map((v: any) => `<li><b>${esc(v[1])}</b>: ${esc(v[2])}</li>`).join("")}</ul><h2>Promises</h2><ul>${data.promises.map((v: any) => `<li><b>${esc(v[0])}</b>: ${esc(v[1])}</li>`).join("")}</ul><h2>Affiliate entities</h2><ul><li><b>Kayak Innovations (OPC) Private Limited</b>: holds the intellectual property in every Kayak solution.</li><li><b>Brand Defence &amp; Integrity™</b>: the name belongs to Kayak's leadership and is currently used by Brand Defence Consulting Private Limited (Brand Defence India), known for market intelligence and IPR matters. <a href="https://www.bdiglobe.com">www.bdiglobe.com</a></li><li><b>Kayak Technology Solutions</b>: a partnership firm that develops and markets the Kayak Group's SaaS solutions, led by Tan.ai, CTO for the group.</li></ul>`;
    return { status: 200, title, desc, ssr: `<h1>${esc(title)}</h1><p>${esc(desc)}</p>${extra}` };
  }
  return { status: 404, title: "Page not found", desc: "The page you were looking for has moved or does not exist.", ssr: `<h1>Page not found</h1><p><a href="/">Go to the home page</a></p>` };
}

function page(c: any, meta: PageMeta, data: any, path: string) {
  const base = site(c);
  const canonical = `${base}${path === "/" ? "/" : path.replace(/\/+$/, "")}`;
  const full = meta.title === "Kayak Strategic Advisors" ? meta.title : `${meta.title} | Kayak Strategic Advisors`;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const head = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(full)}</title><meta name="description" content="${esc(meta.desc)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="Kayak Strategic Advisors"><meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.desc)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="${meta.type || "website"}"><meta property="og:image" content="${base}/assets/og.png"><meta property="og:locale" content="en_IN"><meta name="twitter:card" content="summary_large_image">
${meta.status === 404 ? '<meta name="robots" content="noindex">' : ""}<meta name="theme-color" content="#0E2F3C">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" href="/_shared/fonts/Archivo.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/logos.json" as="fetch" crossorigin><link rel="preload" href="/assets/services.json?v=2" as="fetch" crossorigin>${path === "/" ? '<link rel="preload" href="/assets/hero/kayak-1536.webp" as="image" media="(min-width: 761px)"><link rel="preload" href="/assets/hero/kayak-960.webp" as="image" media="(max-width: 760px)">' : ""}
<link rel="stylesheet" href="/assets/site.css?v=${VERSION}">
${meta.ld ? `<script type="application/ld+json">${JSON.stringify(meta.ld).replace(/</g, "\\u003c")}</script>` : ""}
<script type="application/json" id="site-data">${json}</script>
<script type="module" src="/assets/site.js?v=${VERSION}"></script>
</head><body>`;
  return new Response(head + BODY.replace("{{SSR}}", `<div class="page ssr">${meta.ssr}</div>`) + "</body></html>", {
    status: meta.status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=120, must-revalidate" },
  });
}
const VERSION = "2026-11-12c";

// ------------------------------------------------------------------ consent (DPDP Act, 2023)
// Kay asks for consent at the moment a purpose becomes relevant, one purpose at a time. Each
// decision is recorded against a random visitor id from the browser, with the notice version;
// no name, email or IP address is stored with it. Withdrawing is as easy as agreeing (s.6(4)).
const NOTICE_VERSION = "KSA-PN-2026-11";
const PURPOSES = ["personalise", "kay_memory", "updates", "followup"];
app.post("/api/consent", async (c) => {
  const ip = clientIp(c);
  if (!(await rateLimit(c.env.DB, `consent:${ip}`, 60, 3600))) return c.json({ error: "Too many requests." }, 429);
  const b: any = await c.req.json().catch(() => ({}));
  const vid = str(b.vid, 40);
  if (!/^[a-z0-9-]{16,40}$/i.test(vid) || !PURPOSES.includes(b.purpose)) return c.json({ error: "Not understood." }, 400);
  await c.env.DB.prepare("INSERT INTO consents (vid, purpose, granted, trigger, notice_version, page, at) VALUES (?,?,?,?,?,?,?)")
    .bind(vid, b.purpose, b.granted ? 1 : 0, str(b.trigger, 40), NOTICE_VERSION, str(b.page, 200), new Date().toISOString()).run();
  return c.json({ ok: true, notice: NOTICE_VERSION });
});

// ------------------------------------------------------------------ forms
const okEmail = (e: string) => !!cleanEmail(e);
app.post("/api/forms", async (c) => {
  const ip = clientIp(c);
  if (!(await rateLimit(c.env.DB, `form:${ip}`, 12, 3600))) return c.json({ error: "Too many submissions from this network. Please email enquiries@kayaksa.com." }, 429);
  const b: any = await c.req.json().catch(() => ({}));
  const f = b.fields || {};
  if (f.website || (b.t && Date.now() - Number(b.t) < 2500)) { // honeypot or faster than a human: pretend success to bots
    await securityEvent(c, c.env.DB, "www", { kind: "form.bot", severity: "low", detail: { form: str(b.kind, 20) } });
    return c.json({ ok: true });
  }
  const kind = String(b.kind || "");
  const now = new Date().toISOString();
  const country = (c.req.raw as any).cf?.country || "";

  if (kind === "subscribe" || kind === "cases") {
    const e = cleanEmail(f.email);
    if (!e) return c.json({ error: "Please enter a valid email address." }, 400);
    if (kind === "cases" && f.consent !== true) return c.json({ error: "Please tick the consent box." }, 400);
    const list = kind === "cases" ? "seecounter" : "confluence";
    const filters = kind === "cases" ? { keyword: str(f.keyword, 100), category: str(f.category, 100) } : {};
    const freq = ["instant", "daily", "weekly"].includes(f.frequency) ? f.frequency : "weekly";
    const token = randomToken(24);
    const pending = mailEnabled(c.env);
    await c.env.DB.prepare(`INSERT INTO subscribers (id, email, list, filters, frequency, status, token_hash, consent_at, created_at, confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(email, list) DO UPDATE SET filters = excluded.filters, frequency = excluded.frequency, token_hash = excluded.token_hash, status = CASE WHEN subscribers.status = 'active' THEN 'active' ELSE excluded.status END, consent_at = excluded.consent_at`)
      .bind(crypto.randomUUID(), e, list, JSON.stringify(filters), freq, pending ? "pending" : "active", await sha256hex(token), now, now, pending ? null : now).run();
    await auditFull(c, c.env.DB, null, `www.${list}.subscribed`, { email: e.replace(/^(.).*(@.*)$/, "$1***$2"), frequency: freq });
    if (pending) {
      const name = list === "seecounter" ? "SeeCounter alerts" : "Confluence";
      await sendMail(c.env, e, `Confirm your subscription to ${name}`, mailHtml({ site: "WWW", title: `Confirm your subscription to ${name}`,
        intro: list === "seecounter" ? "Please confirm that you would like SeeCounter alerts about new counterfeiting actions that match your filters." : "Please confirm that you would like Confluence, the Kayak monthly on strategy, risk and the decisions between them, on the first Tuesday of each month.",
        action: { label: "Confirm subscription", url: `${site(c)}/s/${token}` }, outro: "If you did not ask for this, ignore this email and nothing will happen." }));
      return c.json({ ok: true, message: "Thank you. Please check your inbox and confirm your subscription." });
    }
    return c.json({ ok: true, message: list === "seecounter" ? "Thank you. You are subscribed to SeeCounter alerts." : "Thank you. You are on the list for Confluence." });
  }

  if (kind === "contact" || kind === "career") {
    const name = str(f.name, 100), e = cleanEmail(f.email), msg = str(f.msg, 4000);
    if (!name || !e || !msg) return c.json({ error: "Please add your name, a valid email address and a message." }, 400);
    if (f.consent !== true) return c.json({ error: "Please tick the consent box so that we can reply." }, 400);
    const link = str(f.link, 300);
    if (link && !/^https:\/\//i.test(link)) return c.json({ error: "Links must start with https://" }, 400);
    const id = crypto.randomUUID();
    await c.env.DB.prepare("INSERT INTO enquiries (id, kind, source, name, email, organisation, phone, area, message, link, transcript, page, country, consent_at, created_at, notice_version, purpose) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, kind, b.source === "kay" ? "kay" : "form", name, e, str(f.org, 160), str(f.phone, 40), str(f.cluster, 120), msg, link, str(b.transcript, 12000), str(b.page, 200), country, now, now,
        NOTICE_VERSION, kind === "career" ? "Considering you for a role at Kayak" : "Replying to your enquiry").run();
    await auditFull(c, c.env.DB, null, `www.${kind}.submitted`, { id, via: b.source === "kay" ? "kay" : "form", page: str(b.page, 200) });
    if (mailEnabled(c.env) && c.env.ENQUIRY_TO) {
      const rows = [["Name", name], ["Email", e], ["Organisation", str(f.org, 160)], ["Phone", str(f.phone, 40)], ["Area", str(f.cluster, 120)], ["Link", link], ["Came via", b.source === "kay" ? "Kay" : "Website form"]].filter((r) => r[1]);
      c.executionCtx.waitUntil(sendMail(c.env, c.env.ENQUIRY_TO, `${kind === "career" ? "Careers note" : "New enquiry"}: ${name}${f.org ? `, ${str(f.org, 80)}` : ""}`, mailHtml({ site: "WWW",
        title: kind === "career" ? "A new careers note" : "A new enquiry",
        intro: `<table cellpadding="4">${rows.map((r) => `<tr><td style="color:#4E6470">${esc(r[0])}</td><td><b>${esc(r[1])}</b></td></tr>`).join("")}</table><p style="white-space:pre-wrap">${esc(msg)}</p>`,
        action: { label: "Open in Kayak Internal", url: "https://internal.kayaksa.com/app#/website" }, outro: "Reply within one working day, as the website promises." })).then(() => {}));
    }
    return c.json({ ok: true });
  }
  return c.json({ error: "Unknown form." }, 400);
});

app.get("/s/:token", async (c) => {
  const h = await sha256hex(c.req.param("token").slice(0, 100));
  const r = await c.env.DB.prepare("UPDATE subscribers SET status = 'active', confirmed_at = ? WHERE token_hash = ? AND status != 'unsubscribed' RETURNING list").bind(new Date().toISOString(), h).first<any>();
  return c.html(notice(r ? "Subscription confirmed" : "This link has expired", r ? `Thank you. You are subscribed to ${r.list === "seecounter" ? "SeeCounter alerts" : "Confluence"}. Every email includes a one-click unsubscribe link.` : "Please subscribe again from the website."));
});
app.get("/u/:token", async (c) => {
  const h = await sha256hex(c.req.param("token").slice(0, 100));
  const r = await c.env.DB.prepare("UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE token_hash = ? RETURNING list").bind(new Date().toISOString(), h).first<any>();
  return c.html(notice(r ? "You are unsubscribed" : "Link not recognised", r ? "You will not receive any more of these emails. You can subscribe again at any time." : "If you keep receiving emails, write to enquiries@kayaksa.com."));
});
const notice = (title: string, text: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | Kayak Strategic Advisors</title><link rel="stylesheet" href="/assets/site.css"></head><body><main style="max-width:640px;margin:12vh auto;padding:0 20px;font-family:var(--sans)"><p style="letter-spacing:.2em;font-weight:800">KAYAK</p><h1>${esc(title)}</h1><p>${esc(text)}</p><p><a href="/">Go to the home page</a></p></main></body></html>`;

// ------------------------------------------------------------------ SeeCounter cases
app.get("/api/cases", async (c) => {
  const q = str(c.req.query("q"), 100).toLowerCase(), action = str(c.req.query("action"), 40), status = str(c.req.query("status"), 10);
  const where = ["published = 1"], args: any[] = [];
  if (q) { where.push("(lower(title) LIKE ?1 OR lower(summary) LIKE ?1 OR lower(brand) LIKE ?1 OR lower(category) LIKE ?1 OR lower(jurisdiction) LIKE ?1 OR lower(authority) LIKE ?1)"); args.push(`%${q}%`); }
  if (action) { where.push(`action = ?${args.length + 1}`); args.push(action); }
  if (status === "ongoing" || status === "closed") { where.push(`status = ?${args.length + 1}`); args.push(status); }
  const [rows, total] = await Promise.all([
    c.env.DB.prepare(`SELECT id, title, summary, brand, category, action, status, jurisdiction, authority, action_date, source_url FROM cases WHERE ${where.join(" AND ")} ORDER BY action_date DESC LIMIT 50`).bind(...args).all(),
    c.env.DB.prepare("SELECT COUNT(*) n FROM cases WHERE published = 1").first<any>(),
  ]);
  return c.json({ cases: rows.results, total: total?.n || 0 }, 200, { "Cache-Control": "public, max-age=60" });
});

// ------------------------------------------------------------------ cookieless statistics
app.post("/api/a", async (c) => {
  const text = await c.req.text();
  if (text.length > 2000) return c.body(null, 204);
  let b: any; try { b = JSON.parse(text); } catch { return c.body(null, 204); }
  const ip = clientIp(c);
  if (!(await rateLimit(c.env.DB, `a:${await sha256hex(ip + (c.env.STATS_SALT || "kayak"))}`, 120, 600))) return c.body(null, 204);
  const day = new Date().toISOString().slice(0, 10);
  const path = String(b.p || "/").slice(0, 120).replace(/[^\w\/-]/g, "");
  const db = c.env.DB;
  if (b.t === "pv") {
    const ua = c.req.header("User-Agent") || "";
    if (/bot|crawl|spider|preview|headless/i.test(ua)) return c.body(null, 204);
    const device = Number(b.w) < 700 ? "mobile" : Number(b.w) < 1100 ? "tablet" : "desktop";
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Other";
    const ref = String(b.r || "").toLowerCase().replace(/^www\./, "").slice(0, 80) || "direct";
    const country = (c.req.raw as any).cf?.country || "XX";
    const up = (dim: string, v: string) => db.prepare("INSERT INTO stat_dims (day, dim, value, n) VALUES (?,?,?,1) ON CONFLICT(day, dim, value) DO UPDATE SET n = n + 1").bind(day, dim, v);
    await db.batch([
      db.prepare("INSERT INTO stat_views (day, path, views) VALUES (?,?,1) ON CONFLICT(day, path) DO UPDATE SET views = views + 1").bind(day, path),
      up("referrer", ref), up("country", country), up("device", device), up("browser", browser), up("hour", String(new Date().getUTCHours())),
    ]);
  } else if (b.t === "cwv") {
    const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);
    await db.prepare("INSERT INTO stat_vitals (day, path, lcp, cls, inp, ttfb) VALUES (?,?,?,?,?,?)").bind(day, path, n(b.lcp), n(b.cls), n(b.inp), n(b.ttfb)).run();
  }
  return c.body(null, 204);
});

// Visitors can rate Kay's answers; low ratings feed the weekly review.
app.post("/api/kay/feedback", async (c) => {
  if (!(await rateLimit(c.env.DB, `kayfb:${clientIp(c)}`, 30, 3600))) return c.json({ ok: true });
  const b: any = await c.req.json().catch(() => ({}));
  const rating = b.rating === 1 ? 1 : b.rating === -1 ? -1 : 0;
  if (!rating) return c.json({ error: "Rating missing." }, 400);
  await c.env.DB.prepare("INSERT INTO kay_feedback (at, rating, question, answer, comment) VALUES (?,?,?,?,?)").bind(new Date().toISOString(), rating, redact(str(b.question, 500)), str(b.answer, 2000), redact(str(b.comment, 500))).run();
  return c.json({ ok: true });
});
app.route("/api/kay", kayApi(siteData));
app.get("/api/health", (c) => c.json({ ok: true, site: "www", kay: !!(c.env.ANTHROPIC_API_KEY || c.env.GEMINI_API_KEY || c.env.OPENAI_API_KEY || c.env.XAI_API_KEY), voice: !!(c.env.GEMINI_API_KEY || c.env.OPENAI_API_KEY) }));
app.all("/api/*", (c) => c.json({ error: "Not found." }, 404));

// Brand Defence & Integrity's official logo, served from its own website and cached at the edge.
app.get("/assets/affiliates/bdi-logo.svg", async (c) => {
  const cache = (caches as any).default as Cache;
  const key = new Request("https://www.kayaksa.com/assets/affiliates/bdi-logo.svg");
  const hit = await cache.match(key);
  if (hit) return hit;
  const r = await fetch("https://www.bdiglobe.com/brand/bdi-logo.svg", { cf: { cacheTtl: 86400 } } as any);
  if (!r.ok) return c.text("Not found", 404);
  const out = new Response(await r.text(), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  c.executionCtx.waitUntil(cache.put(key, out.clone()));
  return out;
});
app.get("/tools", (c) => c.redirect("/solutions", 301));
app.get("/tools/:id", (c) => c.redirect(`/solutions/${c.req.param("id")}`, 301));

// ------------------------------------------------------------------ SEO and AI discoverability
// Confluence, the magazine: one page per edition, read as a book.
app.get("/confluence", async (c) => c.redirect(`/confluence/${(await latestEdition(c)).id}`, 302));
app.get("/confluence/:id", async (c) => {
  const id = c.req.param("id");
  const preview = c.req.query("preview");
  if (preview) {
    const row: any = await c.env.DB.prepare("SELECT data, status, preview_token FROM editions WHERE id = ?").bind(id).first().catch(() => null);
    if (row?.data && row.preview_token && row.preview_token.length >= 24 && preview === row.preview_token) {
      const m = magazinePage(JSON.parse(row.data), site(c), { preview: row.status !== "released" });
      return c.html(m.html, 200, { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" });
    }
    return c.text("This preview link is not valid.", 404);
  }
  const all = await releasedEditions(c);
  if (!all[id]) return c.redirect(`/confluence/${(await latestEdition(c)).id}`, 302);
  return c.html(magazinePage(all[id], site(c)).html, 200, { "Cache-Control": "public, max-age=300" });
});

// The cluster was renamed from "Tax & Regulatory" to "Tax, Legal & Regulatory" in November 2026.
app.get("/services/tax-regulatory", (c) => c.redirect("/services/tax-legal-regulatory", 301));
app.get("/services/tax-regulatory/:slug", (c) => c.redirect(`/services/tax-legal-regulatory/${c.req.param("slug")}`, 301));
// The KSA Toolbar's Office manifests link to these addresses for its privacy statement and terms.
app.get("/privacy", (c) => c.redirect("/legal", 301));
app.get("/terms", (c) => c.redirect("/legal#terms", 301));
app.get("/robots.txt", (c) => c.text(`# Search engines and AI assistants are welcome. Scrapers and SEO harvesters are not, and are blocked.\n${["SemrushBot", "AhrefsBot", "MJ12bot", "DotBot", "Bytespider", "PetalBot", "BLEXBot", "DataForSeoBot", "serpstatbot", "MegaIndex", "CCBot", "Diffbot", "omgili", "Timpibot", "ImagesiftBot"].map((b) => `User-agent: ${b}\nDisallow: /\n`).join("\n")}\nUser-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site(c)}/sitemap.xml\n`));
app.get("/sitemap.xml", async (c) => {
  const data = await siteData(c);
  const base = site(c);
  const paths = ["/", ...Object.keys(STATIC_PAGES).map((k) => `/${k}`), ...data.clusters.map((x: any) => `/services/${x.id}`), ...SV.map((x) => `/services/${x.cluster}/${x.slug}`), ...data.tools.map((x: any) => `/solutions/${x.id}`), ...data.articles.map((x: any) => `/insights/${x.id}`), ...Object.keys(await releasedEditions(c)).map((id) => `/confluence/${id}`)];
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${base}${p}</loc></url>`).join("")}</urlset>`, 200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
});
// A plain-text summary for AI assistants (https://llmstxt.org), kept in step with the site.
app.get("/llms.txt", async (c) => {
  const d = await siteData(c);
  const base = site(c);
  const t = [`# Kayak Strategic Advisors`, ``, `> Kayak Strategic Advisors Private Limited is an independent, senior-led Indian advisory firm in Mumbai and Thane. It advises boards, promoters and investors on strategy and deals, tax and regulation, crisis and resilience, technology and AI, managed services and cross-border work. Contact: enquiries@kayaksa.com.`, ``,
    `## Services`, ...d.clusters.map((x: any) => `- [${x.name}](${base}/services/${x.id}): ${x.line || ""}`), ``,
    `## Services in detail`, ...SV.map((x) => `- [${x.name}](${base}/services/${x.cluster}/${x.slug}): ${x.summary}`), ``,
    `## Kayak Solutions (Thought, Designed and Developed in India for the World)`, ...d.tools.map((x: any) => `- [${x.name}](${base}/solutions/${x.id}): ${x.kind}. ${x.line}`), ``,
    `## Confluence (monthly insights)`, ...d.articles.map((x: any) => `- [${x.title}](${base}/insights/${x.id}): ${x.dek || ""}`), ``,
    `## About`, `- [About us](${base}/about)`, `- [Contact](${base}/contact)`, `- [Kayak Learn: professional courses with verifiable certificates](https://learn.kayaksa.com)`, `- Affiliates: Kayak Innovations (OPC) Private Limited (holds the IP of Kayak's solutions); Brand Defence & Integrity™ (www.bdiglobe.com); Kayak Technology Solutions, a partnership firm that develops and markets Kayak's SaaS solutions, led by Tan.ai (https://tanai.online), CTO for the group.`];
  return c.text(t.join("\n"), 200, { "Cache-Control": "public, max-age=3600" });
});

// ------------------------------------------------------------------ pages
app.get("*", async (c) => {
  const path = new URL(c.req.url).pathname;
  if (/\.[a-z0-9]{2,5}$/i.test(path) || path.startsWith("/_shared/")) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404) return c.text("Not found", 404);
    const out = new Response(res.body, res);
    if (/\/(_shared\/fonts|assets\/kay-\d+)/.test(path) || /\?v=/.test(c.req.url)) out.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    else out.headers.set("Cache-Control", "public, max-age=3600");
    return out;
  }
  const data = await siteData(c);
  return page(c, render(path, data), data, path);
});

export default {
  fetch: app.fetch,
  // Daily housekeeping: drop stale rate-limit rows and keep detailed speed samples for 90 days.
  async scheduled(e: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (e.cron === "17 * * * *") { await seedMemory(env); await syncMemory(env); return; }
    if (e.cron === "45 3 * * 1") { await weeklyDrafts(env, await siteData({ env } as any)).catch((x) => console.error("weekly drafts", x?.message)); return; }
    // Daily housekeeping: drop stale rate-limit rows and keep detailed speed samples for 90 days.
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM stat_vitals WHERE day < ?").bind(cutoff),
      env.DB.prepare("DELETE FROM rate_limits"),
      env.DB.prepare("DELETE FROM enquiries WHERE created_at < ? AND status IN ('closed','spam')").bind(new Date(Date.now() - 3 * 365 * 86400_000).toISOString()),
      env.DB.prepare("DELETE FROM consents WHERE at < ?").bind(new Date(Date.now() - 7 * 365 * 86400_000).toISOString()),
    ]);
    await dailyCleanup(env);
    await pruneSecurity(env.DB);
  },
};
