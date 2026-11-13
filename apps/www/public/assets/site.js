
// www.kayaksa.com: the page data arrives inline from the server (published articles and
// SeeCounter cases come from the database); product logos load once and are cached.
const DATA = JSON.parse(document.getElementById("site-data").textContent);
[DATA.logos, DATA.services] = await Promise.all([
  fetch("/assets/logos.json").then((r) => r.json()).catch(() => ({})),
  fetch("/assets/services.json?v=3").then((r) => r.json()).catch(() => []),
]);
const FLAGS = DATA.flags || {};
const CFG = DATA.config || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ic = (id, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const ii = (slug, cls = "ico") => `<svg class="${cls}" aria-hidden="true"><use href="#ind-${slug}"/></svg>`;
const arrow = ic("arrow-right");
const C = Object.fromEntries(DATA.clusters.map((c) => [c.id, c]));
const G = Object.fromEntries(DATA.groups.map((g) => [g.id, g]));
const A = Object.fromEntries(DATA.articles.map((a) => [a.id, a]));
const T = Object.fromEntries(DATA.tools.map((t) => [t.id, t]));
const SV = Object.fromEntries((DATA.services || []).map((x) => [x.slug, x]));
const svcOf = (cid) => (DATA.services || []).filter((x) => x.cluster === cid);
const svcAt = (cid, i) => svcOf(cid)[i];
const SOLUTIONS_LINE = "Thought, Designed and Developed in India for the World";
let _lgu = 0;
const LG = (id, v) => (DATA.logos[id]?.[v] || `<span class="lgo-fallback">${esc(T[id]?.name || id)}</span>`).replaceAll("__U__", "u" + (++_lgu));
const pmark = (t, big = false) => `<span class="pmark${big ? " big" : ""}" style="--c:${t.color}"><span class="pm">${LG(t.id, "mark")}</span>${esc(t.name)}</span>`;
const PH = (slot) => (DATA.photos && DATA.photos[slot]) || null;
const realMods = (t) => t.modules.filter((m) => !m[2].startsWith("["));
function toolCard(t) {
  const extra = t.modules.length - realMods(t).length;
  const top = `<div class="plate" style="--c:${t.color}">${LG(t.id, "card")}</div>`;
  return `<a class="tcard" href="#${t.id}">${top}
  <div class="body">${pmark(t)}<p>${esc(t.line)}</p><div class="mods">${realMods(t).map((m) => `<span>${esc(m[1])}</span>`).join("")}${extra ? `<span>+${extra} more</span>` : ""}</div><span class="textlink">Explore ${esc(t.name)} ${arrow}</span>${t.site ? `<small class="tsite">${esc(t.site.replace("www.", ""))}${t.soon ? ` · ${esc(t.soon)} coming soon` : ""}</small>` : ""}</div></a>`;
}
const moreTools = `<div class="tcard more"><div class="body">${ic("plus", "ico big")}<h3>More Kayak Solutions</h3><p>Further tools are in development across our six clusters. Tell us the problem you would like a tool to solve.</p><a class="textlink" href="#contact" data-cluster="technology-ai">Talk to the Technology &amp; AI team ${arrow}</a></div></div>`;
const toolsGrid = (list = DATA.tools, more = true) => `<div class="tgrid">${list.map(toolCard).join("")}${more ? moreTools : ""}</div>`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

function coverStyle(cid) {
  const c = cid ? C[cid] : null;
  const pid = c ? c.id : "ksa";
  return `--c:${c ? c.color : "#0E2F3C"};--p:var(--pc-${pid});--ps:var(--ps-${pid})`;
}
// Covers: a photograph when we have one for the slot (brand manual p.18-19: natural colour, a
// Deep Current scrim under type, wake lines on hover), otherwise the cluster pattern.
function cover(cid, label, iconId, extra = "", slot = "") {
  const c = cid ? C[cid] : null;
  const ph = (slot && PH(slot)) || (cid && PH(cid));
  const img = ph ? `<img class="cph" src="${ph}" srcset="${ph.replace("-1536.", "-960.")} 960w, ${ph} 1536w" sizes="(max-width:760px) 100vw, 33vw" alt="" loading="lazy" decoding="async"><i class="wake"></i>` : "";
  return `<div class="cover ${extra}${ph ? " has-ph" : ""}" style="${coverStyle(cid)}${ph ? `;--photo:url('${ph}')` : ""}" aria-hidden="true">${img}<span class="ct">${esc(label)}</span>${ic(iconId || (c ? c.icon : "navigation"), "ico ci")}</div>`;
}
const artIcon = (a) => (a.cluster ? C[a.cluster].icon : a.id === "why-confluence" ? "report" : "navigation");
function acard(a) {
  return `<a class="acard" href="#insight-${a.id}" data-cluster="${a.cluster || ""}" data-section="${esc(a.section)}">
    ${cover(a.cluster, a.section, artIcon(a), "", a.id)}
    <div class="body"><div class="meta"><b>${esc(a.section)}</b><span>${a.mins} min read</span></div>
    <h3>${esc(a.title)}</h3><p>${esc(a.dek)}</p></div></a>`;
}
// One pattern per content type (Guidelines 07 · Website · Insights), so a reader can tell types apart at a glance.
const TYPE_PAT = { Magazine: "01-confluence", Article: "05-wake-lines", "White paper": "11-chart-contours", Brochure: "03-delta", Checklist: "07-k-lattice", Questionnaire: "07-k-lattice", Playbook: "10-soundings", Toolkit: "07-k-lattice", Template: "08-pinstripe" };
const TYPE_GROUP = { Magazine: "Confluence", Article: "Articles", "White paper": "White papers", Brochure: "Brochures", Checklist: "Toolkits and templates", Questionnaire: "Toolkits and templates", Playbook: "Toolkits and templates", Toolkit: "Toolkits and templates", Template: "Toolkits and templates" };
const ctl = (t) => `<span class="ctl"><i></i>${esc(t)}</span>`;
function rcard(r) {
  const tool = (DATA.tools || []).find((t) => t.id === r.tool);
  return `<a class="rcard" href="${esc(r.file)}" target="_blank" rel="noopener" data-group="${esc(TYPE_GROUP[r.type] || "Toolkits and templates")}" data-cluster="${esc(r.cluster || "")}" data-q="${esc((r.title + " " + r.desc + " " + r.regs.join(" ") + " " + (tool ? tool.name : "")).toLowerCase())}">
    <figure style="--pt:url('/assets/patterns/${TYPE_PAT[r.type] || "07-k-lattice"}-tonal-light.svg')"><img src="${esc(r.thumb)}" alt="" loading="lazy" width="210" height="297"></figure>
    <div class="body">${ctl(r.type)}<h3>${esc(r.title)}</h3><p>${esc(r.desc)}</p>
    <div class="rregs">${r.regs.map((x) => `<em>${esc(x)}</em>`).join("")}</div>
    <div class="rmeta"><span>${tool ? esc(tool.name) + " · " : ""}PDF · ${r.pages} pages</span><span>${esc(r.code)} ${ic("external-link")}</span></div></div></a>`;
}

function crumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><a href="#home">Home</a>${items.map((i) => `${ic("chevron-right")}${i[1] ? `<a href="#${i[1]}">${esc(i[0])}</a>` : `<span aria-current="page">${esc(i[0])}</span>`}`).join("")}</nav>`;
}
const strokes = (list = DATA.strokes) => `<div class="strokes">${list.map((s, i) => `<div class="stroke"><div class="n">${i + 1}</div>${s[0] ? `<span class="k">${esc(s[0])}</span>` : ""}<h3>${esc(s[1])}</h3><p>${esc(s[2])}</p></div>`).join("")}</div>`;
const subscribeForm = (id) => `<form class="subscribe js-form" id="${id}" novalidate data-kind="subscribe">
  <label class="sr" for="${id}-email">Work email</label>
  <input id="${id}-email" name="email" type="email" placeholder="Your work email" required autocomplete="email">
  <button class="btn btn-saffron" type="submit">Subscribe ${arrow}</button></form>`;


/* ---------- Premium hero: four scenes that turn slowly ---------- */
const HERO = [
  { img: "kayak", pos: "78% 45%", eyebrow: "Kayak Strategic Advisors", h: "Clear advice for <em>consequential</em> decisions", p: "Strategy, deals, regulation and resilience for India's boards, promoters and investors. Independent, senior-led and built to be carried out.", cta: ["Explore our services", "services"], alt: ["Talk to us", "contact"] },
  { img: "boardroom", pos: "62% 50%", eyebrow: "For boards and promoters", h: "The questions that keep a board <em>awake</em>, answered plainly", p: "One lead partner, every discipline at one table: growth and protection decided together, never in separate rooms.", cta: ["How we work", "about"], alt: ["Start a confidential conversation", "contact"] },
  null, // the Confluence slide: always the latest released issue (see confSlide)
  { img: "mumbai", pos: "80% 50%", eyebrow: "Mumbai · Thane · the world", h: "Rooted in India. <em>Ready</em> for the world.", p: "Wide industry and sector exposure at home, an International Desk for cross-border work, and solutions thought, designed and developed in India for the world.", cta: ["Kayak Solutions", "tools"], alt: ["International Desk", "international-desk"] },
];
// The third scene announces the latest Confluence issue. It changes by itself when the next issue is released.
const confSlide = () => {
  const c = DATA.confluence || {};
  return { img: "confluence", pos: "68% 50%", eyebrow: `New · Confluence · ${c.issue || "Issue 01"} · ${c.month || ""}`, h: `<em>${esc(c.coverTitle || "Confluence")}</em>: the month in review`, p: `${c.coverDek || ""} Covering ${c.period || ""}.${c.spotlight ? ` In the spotlight: ${c.spotlight}.` : ""}`, cta: ["Open the magazine", `/confluence/${c.id || ""}`], alt: ["All of Confluence", "insights"] };
};
const heroCarousel = () => {
  const HERO_NOW = HERO.map((x) => x || confSlide());
  return heroCarouselOf(HERO_NOW);
};
const heroCarouselOf = (HERO) => `
<section class="hx" aria-roledescription="carousel" aria-label="Kayak at a glance">
  ${HERO.map((x, i) => `<div class="hx-slide${i ? "" : " on"}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${HERO.length}" ${i ? 'aria-hidden="true"' : ""}>
    <picture class="hx-bg"><source media="(max-width: 760px)" srcset="/assets/hero/${x.img}-960.webp"><img src="/assets/hero/${x.img}-1536.webp" style="object-position:${x.pos}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></picture>
    <div class="hx-tint" aria-hidden="true"></div>
    <div class="wrap hx-in"><div class="hx-copy">
      <span class="eyebrow">${x.eyebrow}</span>
      <${i ? "h2" : "h1"} class="hx-h">${x.h}</${i ? "h2" : "h1"}>
      <p class="lead">${esc(x.p)}</p>
      <div class="ctas"><a class="btn btn-saffron" href="${x.cta[1].startsWith("/") ? x.cta[1] : "#" + x.cta[1]}" ${i ? 'tabindex="-1"' : ""}>${esc(x.cta[0])} ${arrow}</a><a class="btn btn-ghost light" href="#${x.alt[1]}" ${i ? 'tabindex="-1"' : ""}>${esc(x.alt[0])}</a></div>
    </div></div>
  </div>`).join("")}
  <svg class="hx-mark" viewBox="-4 -4 100 108" aria-hidden="true"><path fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="#F3F7F6" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></svg>
</section>`;
let hxTimer = null, hxPaused = matchMedia("(prefers-reduced-motion: reduce)").matches;
function armHero() {
  const root = $("#main .hx"); clearInterval(hxTimer);
  if (!root) return;
  let cur = 0;
  const show = (n) => {
    cur = (n + HERO.length) % HERO.length;
    $$(".hx-slide", root).forEach((el, i) => { el.classList.toggle("on", i === cur); el.setAttribute("aria-hidden", String(i !== cur)); $$("a", el).forEach((a) => (i === cur ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1"))); });
    $$(".hx-dots button", root).forEach((b, i) => { b.setAttribute("aria-selected", String(i === cur)); b.classList.remove("run"); if (i === cur && !hxPaused) { void b.offsetWidth; b.classList.add("run"); } });
  };
  const start = () => { clearInterval(hxTimer); if (!hxPaused) hxTimer = setInterval(() => show(cur + 1), 7000); show(cur); };
  root.addEventListener("mouseenter", () => clearInterval(hxTimer));
  root.addEventListener("mouseleave", () => start());
  root.addEventListener("focusin", () => clearInterval(hxTimer));
  let x0 = null; root.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  root.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { cur += dx < 0 ? 1 : -1; start(); } x0 = null; });
  start();
}

/* ---------- Confluence cover: full-bleed photograph with Kayak tints ---------- */
const MAG = () => `/confluence/${DATA.confluence?.id || ""}`;
const magCover = (big = false) => { const c = DATA.confluence || {}; return `
<a class="mcover${big ? " big" : ""}" href="${MAG()}" aria-label="Open Confluence, ${esc(c.issue || "")}, ${esc(c.month || "")}: ${esc(c.coverTitle || "")}. Covering ${esc(c.period || "")}">
  <img src="/assets/hero/cover-01-${big ? "1024" : "640"}.webp" alt="" loading="lazy" decoding="async">
  <span class="mc-tint" aria-hidden="true"></span>
  <span class="mc-top"><svg class="mc-wm" viewBox="0 0 416 100" aria-hidden="true"><use href="#logo-wm"/></svg><span class="mc-by">A Kayak Strategic Advisors publication</span></span>
  <span class="mc-mast">CONFLUENCE</span>
  <span class="mc-issue"><span>${esc(c.issue || "")}</span><span>${esc(c.month || "")}</span><span>${esc((c.period || "").replace(/ (September|October|November|December|January|February|March|April|May|June|July|August)/g, (m) => " " + m.trim().slice(0, 3)).replace(/ \d{4}$/, ""))}</span></span>
  <span class="mc-lines">
    <span class="mc-kicker">Cover story</span>
    <span class="mc-head">${esc(c.coverTitle || "")}</span>
    <span class="mc-dek">${esc(c.coverDek || "")}</span>
    <span class="mc-more">${(c.coverLines || []).slice(0, 3).map((l) => `<span>${esc(l)}</span>`).join("")}</span>
  </span>
  <svg class="mc-mark" viewBox="-4 -4 100 108" aria-hidden="true"><path fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="#F3F7F6" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></svg>
</a>`; };

/* ---------- Pages ---------- */
const P = {};

P.home = () => {
  const feat = ["growth-and-risk", "data-protection-board", "ai-five-questions"].map((id) => A[id]);
  return `
${heroCarousel()}
<section class="featured"><div class="wrap"><div class="grid">
  ${feat.map((a) => `<a class="feat" href="#insight-${a.id}">${cover(a.cluster, "Confluence · " + a.section, artIcon(a), "", a.id)}<div class="body"><div class="meta"><b>${esc(a.section)}</b><span>${a.mins} min read</span></div><h3>${esc(a.title)}</h3><p>${esc(a.dek)}</p></div></a>`).join("")}
</div></div></section>

<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">The water we all cross</span><h2>Indian business is moving faster, through rougher water</h2></div></div>
  <div class="context-grid">${DATA.context.map((c) => `<article><h3>${esc(c[0])}</h3><p>${esc(c[1])}</p></article>`).join("")}</div>
</div></section>

<section class="sec alt"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">How we can help</span><h2>Six clusters. One lead partner.</h2><p class="lead">Each client has a single lead partner who draws on whichever clusters the question needs, so growth and protection are decided at one table.</p></div><a class="textlink" href="#services">All services ${arrow}</a></div>
  <div class="clusters">${DATA.clusters.map((c) => `<a class="ctile${PH(c.id) ? " has-ph" : ""}" href="#${c.id}" style="--c:${c.color}">${PH(c.id) ? `<span class="cph" style="background-image:url('${PH(c.id)}')" aria-hidden="true"></span>` : ""}<span class="swatch">${ic(c.icon)}</span><h3>${esc(c.name)}</h3><div><p>${esc(c.line)}</p><ul>${c.services.slice(0, 3).map((s) => `<li>${esc(s[1])}</li>`).join("")}</ul></div><span class="textlink">Explore ${esc(c.short)} ${arrow}</span></a>`).join("")}</div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Kayak Solutions</span><h2>${SOLUTIONS_LINE}</h2><p class="lead">Platforms born of our advisory work, built by Kayak Technology Solutions. Our advisers use them on client engagements, and clients run them as their own, with our team on hand when they need it.</p></div><a class="textlink" href="#technology-ai">Technology &amp; AI ${arrow}</a></div>
  ${toolsGrid()}
</div></section>

<section class="sec alt"><div class="wrap ind-band">
  <div><span class="eyebrow">Industries</span><h2>Wide industry and sector exposure, one consistent way of reading it</h2><p class="lead">From financial services and healthcare to manufacturing, infrastructure, consumer and technology, we read every sector the same way: its value chain, its regulators and the questions its boards ask most.</p><p style="margin-top:24px"><a class="btn btn-ghost" href="#industries">Explore industries ${arrow}</a></p></div>
  <div class="groups-grid">${DATA.groups.map((g) => `<a class="gchip" href="#industries" data-scroll="g-${g.id}">${ii(g.icon)}<span>${esc(g.name)}</span></a>`).join("")}</div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Our approach</span><h2>Four strokes, from first look to lasting result</h2><p class="lead">Every engagement follows the same four strokes, whether it is a two-week diligence or a year-long transformation. The fourth is where most advisers stop, and where we stay.</p></div></div>
  ${strokes()}
</div></section>

<section class="band-deep sec"><div class="wrap mag">
  ${magCover()}
  <div><span class="eyebrow">Our monthly magazine</span><h2>Confluence: where strategy and risk meet</h2>
    <p class="lead">Named after the meeting of two streams in our identifier. Each issue brings one cover story and a monthly read across all six clusters, free to clients and subscribers on the first Tuesday of every month.</p>
    <ul class="sections-list">${DATA.sections.slice(2, 8).map((s) => `<li>${esc(s[0])}</li>`).join("")}</ul>
    ${subscribeForm("sub-home")}
    <p class="form-note">One email a month. Unsubscribe at any time.</p>
  </div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Why Kayak</span><h2>A boutique's attention, with the reach of a full firm</h2></div><a class="textlink" href="#about">About us ${arrow}</a></div>
  <div class="why">${DATA.why.map((w) => `<article>${ic(w[0])}<h3>${esc(w[1])}</h3><p>${esc(w[2])}</p></article>`).join("")}</div>
</div></section>

<section class="sec tight"><div class="wrap duo">
  <div class="panel dark"><span class="eyebrow">Start a conversation</span><h2>Bring us the question</h2><p>A confidential first conversation, a two-page scoping note and a clear proposal with the fee agreed before work begins.</p><a class="btn btn-saffron" href="#contact">Contact us ${arrow}</a></div>
  <div class="panel light"><span class="eyebrow">Careers</span><h2>Build the firm with us</h2><p>We are assembling a senior, multidisciplinary founding team across all six clusters.</p><a class="btn btn-ghost" href="#careers">Join us ${arrow}</a></div>
</div></section>`;
};

P.services = () => `
<section class="phero"><div class="wrap">${crumbs([["Services"]])}<h1>Services</h1><p class="lead">Six clusters that sit at one table. Growth, deals, regulation, risk, technology and cross-border work, led by one partner who stays with you from the first question to the result.</p></div></section>
<section class="sec"><div class="wrap"><div class="svc-list">
${DATA.clusters.map((c) => `<div class="svc-row" style="--c:${c.color}">
  <div class="t"><span class="swatch">${ic(c.icon)}</span><div><h2>${esc(c.name)}</h2><p>${esc(c.line)}</p></div></div>
  <ul>${c.services.map((s) => `<li>${ic(s[0])}<span>${esc(s[1])}</span></li>`).join("")}</ul>
  <a class="btn btn-ghost" href="#${c.id}">Explore ${arrow}</a></div>`).join("")}
</div></div></section>
<section class="sec alt"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Kayak Solutions</span><h2>Bespoke platforms</h2><p class="lead">Built and supported by our Technology &amp; AI cluster, and used across our services.</p></div></div>
  ${toolsGrid()}
</div></section>
<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Ways to work with us</span><h2>Four engagement models, one standard</h2><p class="lead">Fees are agreed before work starts and set out in the proposal: fixed, milestone-based or retainer, depending on the model.</p></div></div>
  <div class="models">${DATA.models.map((m) => `<article class="model">${ic(m[0])}<h3>${esc(m[1])}</h3><p>${esc(m[2])}</p></article>`).join("")}</div>
</div></section>
<section class="sec alt"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Our approach</span><h2>Four strokes, from first look to lasting result</h2></div></div>${strokes()}
</div></section>`;

P.service = (x) => {
  const c = C[x.cluster];
  const sibs = svcOf(c.id).filter((o) => o.slug !== x.slug);
  const idx = c.services.findIndex((s, i) => svcAt(c.id, i)?.slug === x.slug);
  const icon = c.services[idx]?.[0] || c.icon;
  return `
<section class="phero colored svc-hero" style="--c:${c.color};--p:var(--pc-${c.id});--ps:var(--ps-${c.id})"><div class="wrap">
  ${crumbs([["Services", "services"], [c.name, c.id], [x.name]])}
  <div style="margin-top:22px" class="hico">${ic(icon)}</div>
  <span class="eyebrow" style="color:var(--on-deep-muted);margin-top:14px;display:block">${esc(c.name)}</span>
  <h1>${esc(x.name)}</h1><p class="lead">${esc(x.summary)}</p>
  <div class="ctas" style="margin-top:26px"><a class="btn btn-saffron" href="#contact" data-cluster="${c.id}">Start a confidential conversation ${arrow}</a></div>
</div></section>
<section class="sec"><div class="wrap intro-grid" style="--c:${c.color}">
  <div class="svc-overview">${x.overview.map((p, i) => `<p class="${i ? "" : "serif"}">${esc(p)}</p>`).join("")}</div>
  <div class="aside"><h3>When to call us</h3><ul class="ticks">${x.when.map((w) => `<li>${esc(w)}</li>`).join("")}</ul><a class="textlink" href="#contact" data-cluster="${c.id}">Talk to the ${esc(c.short)} team ${arrow}</a></div>
</div></section>
${x.note ? `<section class="sec tight"><div class="wrap"><aside class="legal-note" style="--c:${c.color}"><span class="eyebrow">How legal work is delivered</span><p>${esc(x.note)}</p></aside></div></section>` : ""}
<section class="sec alt" style="--c:${c.color}"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">What we do</span><h2>The work, in detail</h2></div></div>
  <ol class="svc-what">${x.what.map((w, i) => `<li><span class="n">${String(i + 1).padStart(2, "0")}</span><p>${esc(w)}</p></li>`).join("")}</ol>
</div></section>
<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">How we work</span><h2>Four strokes, start to finish</h2><p class="lead">The same senior team leads every stroke, and stays until the result is in place.</p></div></div>
  ${strokes(x.approach.map((a, i) => [["Diagnose", "Decide", "Deliver", "Sustain"][i], a[0], a[1]]))}
</div></section>
<section class="band-deep sec"><div class="wrap svc-out">
  <div><span class="eyebrow">What you receive</span><ul class="ticks light">${x.deliverables.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></div>
  <div><span class="eyebrow">What changes</span><ul class="outcomes">${x.outcomes.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div>
</div></section>
<section class="sec tight"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Also in ${esc(c.name)}</span></div><a class="textlink" href="#${c.id}">All ${esc(c.short)} services ${arrow}</a></div>
  <div class="svc-related">${sibs.map((o) => `<a href="#svc-${o.slug}" style="--c:${c.color}"><b>${esc(o.name)}</b><span>${esc(o.summary)}</span></a>`).join("")}</div>
</div></section>
${ctaBand(`Begin a conversation: ${x.name}`, c.id)}`;
};

P.cluster = (c) => {
  const groups = DATA.groups.filter((g) => g.clusters.includes(c.id));
  const arts = DATA.articles.filter((a) => a.cluster === c.id);
  const rel = arts.length ? arts : [A["growth-and-risk"]];
  const tools = DATA.tools.filter((t) => t.clusters.includes(c.id));
  return `
<section class="phero colored" style="--c:${c.color};--p:var(--pc-${c.id});--ps:var(--ps-${c.id})"><div class="wrap">
  ${crumbs([["Services", "services"], [c.name]])}
  <div style="margin-top:22px" class="hico">${ic(c.icon)}</div>
  <h1>${esc(c.name)}</h1><p class="lead">${esc(c.line)}</p>
</div></section>
<section class="sec"><div class="wrap intro-grid" style="--c:${c.color}">
  <p class="serif">${esc(c.intro)}</p>
  <div class="aside"><h3>How we engage</h3><p>A defined project, an advisory retainer, a managed service or a rapid response when time is short. One lead partner throughout.</p><a class="textlink" href="#contact" data-cluster="${c.id}">Talk to the ${esc(c.short)} team ${arrow}</a></div>
</div></section>
${c.note ? `<section class="sec tight"><div class="wrap"><aside class="legal-note" style="--c:${c.color}"><span class="eyebrow">How legal work is delivered</span><p>${esc(c.note)}</p></aside></div></section>` : ""}
<section class="sec alt" style="--c:${c.color}"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">What we do</span><h2>${esc(c.short)} services</h2></div></div>
  <div class="svc-grid">${c.services.map((s, i) => { const x = svcAt(c.id, i); return x ? `<a class="svc-card link" href="#svc-${x.slug}">${ic(s[0])}<h3>${esc(s[1])}</h3><p>${esc(s[2])}</p><span class="textlink">Explore ${arrow}</span></a>` : `<article class="svc-card">${ic(s[0])}<h3>${esc(s[1])}</h3><p>${esc(s[2])}</p></article>`; }).join("")}</div>
</div></section>
${tools.length ? `<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Kayak Solutions</span><h2>${c.id === "technology-ai" ? "Bespoke platforms we build and run" : "Tools behind this work"}</h2>${c.id === "technology-ai" ? `<p class="lead">Alongside advisory work, our Technology &amp; AI team builds and supports Kayak's own platforms.</p>` : ""}</div></div>
  ${toolsGrid(tools, c.id === "technology-ai")}</div></section>` : ""}
<section class="sec${tools.length ? " alt" : ""}" style="--c:${c.color}"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Questions we help boards answer</span></div></div>
  <div class="qs">${c.questions.map((q) => `<blockquote>${esc(q)}</blockquote>`).join("")}</div>
</div></section>
<section class="sec tight${tools.length ? "" : " alt"}"><div class="wrap" style="display:grid;gap:40px">
  <div><span class="eyebrow">Where this matters most</span><div class="chips" style="margin-top:14px">${groups.map((g) => `<a class="chip" href="#industries" data-scroll="g-${g.id}">${ii(g.icon)}${esc(g.name)}</a>`).join("")}</div></div>
  <div><span class="eyebrow">From Confluence</span><div class="agrid" style="margin-top:14px">${rel.map(acard).join("")}</div></div>
</div></section>
<section class="sec tight"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Other clusters</span></div></div>
  <div class="others">${DATA.clusters.filter((o) => o.id !== c.id).map((o) => `<a href="#${o.id}" style="--c:${o.color}"><span class="swatch" style="color:#fff">${ic(o.icon)}</span>${esc(o.name)}</a>`).join("")}</div>
</div></section>
${ctaBand(`Talk to the ${c.short} team`, c.id)}`;
};

const ctaBand = (title, cid = "", label = "Contact us") => `<section class="band-deep sec tight"><div class="wrap" style="display:flex;flex-wrap:wrap;gap:24px 48px;align-items:center;justify-content:space-between">
  <div style="max-width:640px;min-width:0"><span class="eyebrow">Next step</span><h2 style="font-size:var(--step3);margin-top:10px">${esc(title)}</h2><p class="lead" style="color:var(--on-deep-muted);margin-top:12px">Start with a confidential conversation. You tell us the question; we listen and ask what matters.</p></div>
  <a class="btn btn-saffron" href="#contact" data-cluster="${cid}">${label} ${arrow}</a></div></section>`;

P.tool = (t) => {
  const other = DATA.tools.filter((x) => x.id !== t.id);
  return `
<section class="phero colored" style="--c:${t.color};--p:var(--pc-${t.id});--ps:var(--ps-${t.id})"><div class="wrap">
  ${crumbs([["Kayak Solutions", "tools"], [t.name]])}
  <div class="thead"><div>
  <div style="margin-top:22px" class="hico">${ic(t.icon)}</div>
  <span class="eyebrow">${esc(t.kind)}</span>
  <h1 style="margin-top:8px">${esc(t.name)}</h1>${t.tagline ? `<p class="serif" style="font-style:italic;font-size:var(--step2);margin:-6px 0 10px">${esc(t.tagline)}</p>` : ""}<p class="lead">${esc(t.line)}</p>
  <div class="ctas" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:28px"><a class="btn btn-saffron" href="#contact" data-cluster="${t.id}">Request a demo ${arrow}</a><a class="btn btn-ghost" style="color:#fff" href="#${t.id}" data-scroll="modules">See the modules</a>${t.site ? `<a class="btn btn-ghost" style="color:#fff" href="https://${t.site}" target="_blank" rel="noopener">Visit ${esc(t.site.replace("www.", ""))} ${ic("external-link")}</a>` : ""}${t.soon ? `<span class="btn btn-ghost" style="color:#fff;opacity:.75;cursor:default">${esc(t.soon)} · coming soon</span>` : ""}</div>
  </div><figure class="tplate">${LG(t.id, "full")}<button type="button" class="replay" data-replay aria-label="Replay the ${esc(t.name)} logo animation">${ic("timeline")} Replay</button></figure></div>
</div></section>
<section class="sec"><div class="wrap intro-grid" style="--c:${t.color}">
  <p class="serif">${esc(t.intro)}</p>
  <div class="aside"><h3>Built for</h3><ul class="plain">${t.for.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>
</div>${t.pillars ? `<div class="wrap"><div class="pillars" style="--c:${t.color}">${t.pillars.map((p) => `<article>${ic(p[0])}<h3>${esc(p[1])}</h3><p>${esc(p[2])}</p></article>`).join("")}</div></div>` : ""}</section>
<section class="sec alt" id="modules" style="--c:${t.color}"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Modules</span><h2>${t.modules.length} modules, one platform</h2><p class="lead">Start with the modules you need and add the rest as the programme grows. Every module shares the same records, permissions and reporting.</p></div></div>
  <div class="modgrid" style="--n:${t.modules.length % 3 === 0 ? 3 : 4}">${t.modules.map((m) => `<article class="svc-card${m[2].startsWith("[") ? " ph" : ""}">${ic(m[0])}<h3>${esc(m[1])}</h3><p>${esc(m[2])}</p></article>`).join("")}</div>
</div></section>
${t.vat ? vatSection(t) : ""}
${t.regulation ? regSection(t) : ""}
<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">How it works</span><h2>Software, with Kayak's people behind it</h2></div></div>
  ${strokes(t.how.map((h) => ["", h[0], h[1]]))}
</div></section>
${resSection(t)}
<section class="sec tight alt"><div class="wrap" style="display:grid;gap:40px">
  <div><span class="eyebrow">Backed by our services</span><div class="chips" style="margin-top:14px">${t.clusters.map((id) => `<a class="chip" href="#${id}" style="--c:${C[id].color}"><i></i>${esc(C[id].name)}</a>`).join("")}</div></div>
  <div><span class="eyebrow">Other Kayak tools</span><div style="margin-top:14px">${toolsGrid(other, true)}</div></div>
</div></section>
${ctaBand(`See ${t.name} in action`, t.id, "Request a demo")}`;
};

function vatSection(t) {
  const v = t.vat;
  return `<section class="sec vat" id="nexavatveri" style="--c:${t.color}"><div class="wrap">
  <div class="vat-head"><div>${ctl("New module")}<h2><span>${esc(v.name)}</span> ${esc(v.title)}</h2><p class="lead">${esc(v.lead)}</p><p>${esc(v.why)}</p></div>
    <aside class="vat-bands"><span class="eyebrow">The thresholds that decide the depth of checks</span>${v.bands.map((b, i) => `<div class="${i === 2 ? "hi" : ""}"><b>${esc(b[0])}</b><span>${esc(b[1])}</span></div>`).join("")}</aside></div>
  <ol class="vat-steps">${v.steps.map((s2, i) => `<li><i>${String(i + 1).padStart(2, "0")}</i>${ic(s2[0])}<h3>${esc(s2[1])}</h3><p>${esc(s2[2])}</p></li>`).join("")}</ol>
  <p class="vat-next">${ic("timeline")} ${esc(v.next)}</p>
  <div class="vat-foot"><a class="btn btn-primary" href="#contact" data-cluster="${t.id}">Ask for a ${esc(v.name)} walkthrough ${arrow}</a><p class="small">Summary for information, not tax advice. Sources: ${v.sources.map((x) => `<a href="${esc(x[1])}" target="_blank" rel="noopener noreferrer">${esc(x[0])}</a>`).join("; ")}.</p></div>
</div></section>`;
}
function regSection(t) {
  const g = t.regulation, R = Object.fromEntries((DATA.resources || []).map((r) => [r.id, r]));
  return `<section class="sec alt" id="regulation"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Regulation</span><h2>Built around the rules you are examined on</h2><p class="lead">${esc(g.intro)}</p></div></div>
  <div class="regs">${g.items.map((it) => `<article><span class="rtag">${esc(it.tag)}</span><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p>
    <ul>${it.refs.map(([a, l, id]) => { const r = R[id]; const href = r ? r.file : id; return `<li><a href="${esc(href)}"${r ? ' target="_blank" rel="noopener"' : ""}><b>${esc(a)}</b><span>${esc(l)}${r ? ` · ${esc(r.type)}, PDF` : ""}</span>${ic("arrow-right")}</a></li>`; }).join("")}</ul></article>`).join("")}</div>
  <p class="small" style="margin-top:18px">${esc(g.note)}</p>
</div></section>`;
}
function resSection(t) {
  const list = (DATA.resources || []).filter((r) => r.tool === t.id);
  if (!list.length) return "";
  return `<section class="sec" id="resources"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Resource library</span><h2>White papers, toolkits and templates</h2><p class="lead">Free to download and use. Each one is published by ${esc(t.name)} and Kayak Strategic Advisors and maps to a named requirement.</p></div><a class="textlink" href="#insights" data-f="Toolkits and templates">All insights ${arrow}</a></div>
  <div class="rgrid">${list.map(rcard).join("")}</div>
</div></section>`;
}

P.tools = () => `
<section class="phero colored" style="--c:${C["technology-ai"].color};--p:var(--pc-technology-ai);--ps:var(--ps-technology-ai)"><div class="wrap">
  ${crumbs([["Kayak Solutions"]])}
  <span class="eyebrow" style="color:#F5C46D;display:block;margin-top:18px">${SOLUTIONS_LINE}</span>
  <h1>Kayak Solutions</h1><p class="lead">Platforms born of our advisory practice, for ethics and compliance, case intelligence, third-party risk and e-signatures.</p>
</div></section>
<section class="sec"><div class="wrap">${toolsGrid()}</div></section>
<section class="sec alt"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Tools and advice together</span><h2>Three ways to use them</h2></div></div>
  <div class="models three">${[["website", "Licence the platform", "Your team runs the tool, with onboarding, configuration and training from us."], ["calendar", "Run it with us", "Our Managed Services team operates the tool for you, with agreed service levels and regular reporting."], ["user", "Advisers on call", "When a report, an allegation or a vendor needs investigation, our clusters step in alongside the software."]].map((m) => `<article class="model">${ic(m[0])}<h3>${esc(m[1])}</h3><p>${esc(m[2])}</p></article>`).join("")}</div>
</div></section>
${ctaBand("Find the right tool for your programme", "technology-ai")}`;

P.industries = () => `
<section class="phero"><div class="wrap">${crumbs([["Industries"]])}<h1>Industries</h1><p class="lead">Wide industry and sector exposure, organised into sector families. For each, we map the value chain, the regulators and the questions boards ask most.</p></div></section>
<section class="sec"><div class="wrap">
  <div class="filter">${ic("search")}<label class="sr" for="indq">Filter industries</label><input id="indq" type="search" placeholder="Filter by industry, for example steel or insurance" autocomplete="off"></div>
  <div id="groups">${DATA.groups.map((g) => `<section class="group" id="g-${g.id}" data-g="${g.id}">
    <div><h2>${esc(g.name)}</h2><span class="eyebrow">Questions we hear</span><ul class="qlist" style="margin-top:10px">${g.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
    <div class="chips">${g.clusters.map((id) => `<a class="chip" href="#${id}" style="--c:${C[id].color}"><i></i>${esc(C[id].short)}</a>`).join("")}</div></div>
    <div class="itiles">${g.members.map((m) => `<div class="itile" data-name="${esc(m.name.toLowerCase())}">${ii(m.slug)}<span>${esc(m.name)}</span></div>`).join("")}</div>
  </section>`).join("")}</div>
  <p class="noresults" id="noind" hidden>No industry matches that search. Try a broader term, or <a href="#contact">ask us directly</a>.</p>
</div></section>
${ctaBand("Discuss your sector with us")}`;

P.insights = () => {
  const cs = A["growth-and-risk"];
  const cf = DATA.confluence || {};
  const items = [
    { kind: "issue" },
    ...DATA.articles.filter((a) => a.id !== "why-confluence").map((a) => ({ kind: "article", a })),
    ...(DATA.resources || []).map((r) => ({ kind: "res", r })),
  ];
  const groups = ["Confluence", "Articles", "White papers", "Toolkits and templates", "Brochures"];
  const count = (g) => items.filter((x) => (x.kind === "issue" ? "Confluence" : x.kind === "article" ? "Articles" : TYPE_GROUP[x.r.type]) === g).length;
  const card = (x) => x.kind === "issue"
    ? `<a class="icard" href="${MAG()}" data-group="Confluence" data-cluster="" data-q="confluence magazine ${esc((cf.coverTitle || "") + " " + (cf.coverDek || "")).toLowerCase()}"><div class="icov">${magCover(false).replace(/^\s*<a /, "<span ").replace(/<\/a>\s*$/, "</span>").replace(/ href="[^"]*"/, "").replace(/ aria-label="[^"]*"/, ' aria-hidden="true"')}</div><div class="body">${ctl("Magazine")}<h3>Confluence, ${esc(cf.month || "")}: ${esc(cf.coverTitle || "")}</h3><p>${esc(cf.coverDek || "")}</p><div class="rmeta"><span>${esc(cf.issue || "")} · 26 pages</span><span>Open the magazine ${arrow}</span></div></div></a>`
    : x.kind === "article" ? acard(x.a).replace('class="acard"', `class="acard" data-group="Articles" data-q="${esc((x.a.title + " " + x.a.dek + " " + x.a.section).toLowerCase())}"`) : rcard(x.r);
  return `
<section class="ins-hero" style="--pt:url('/assets/patterns/09-current-brand-dark.svg')"><div class="wrap">
  <div class="ih-l">${crumbs([["Insights"]]).replace('class="crumbs"', 'class="crumbs" style="color:var(--on-deep-muted)"')}
    <span class="ih-eye">Confluence · ${esc(cf.issue || "Issue 01")} · ${esc(cf.month || "")}</span>
    <h1>${esc(cf.coverTitle || "Confluence")}<span>: the month in review</span></h1>
    <p class="lead">${esc(cf.coverDek || "")} Covering ${esc(cf.period || "")}.</p>
    <div class="ih-ctas"><a class="btn btn-saffron" href="${MAG()}">Open the magazine ${arrow}</a><a class="btn btn-ghost" style="color:#fff" href="#insight-${cs.id}">Read the cover story</a></div>
    ${cf.coverLines ? `<ul class="ih-lines">${cf.coverLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}</div>
  <div class="ih-r">${magCover(true)}</div>
</div></section>
<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Insights</span><h2>Latest thinking</h2><p class="lead">Our monthly magazine, articles, white papers and working toolkits, in one library. Filter by type or by the question you are working on.</p></div></div>
  <div class="lib-bar">
    <div class="filters" role="group" aria-label="Filter by type"><button class="fbtn" type="button" aria-pressed="true" data-g="">All <i>${items.length}</i></button>${groups.filter(count).map((g) => `<button class="fbtn" type="button" aria-pressed="false" data-g="${esc(g)}">${esc(g)} <i>${count(g)}</i></button>`).join("")}</div>
    <div class="filter lib-q">${ic("search")}<label class="sr" for="libq">Search insights</label><input id="libq" type="search" placeholder="Search, for example Article 13 or GST" autocomplete="off"></div>
  </div>
  <div class="chips lib-topics" role="group" aria-label="Filter by topic"><button class="chip" type="button" data-t="" aria-pressed="true">All topics</button>${DATA.clusters.map((c) => `<button class="chip" type="button" data-t="${c.id}" aria-pressed="false" style="--c:${c.color}"><i></i>${esc(c.short || c.name)}</button>`).join("")}</div>
  <div class="lib" id="lib">${items.map(card).join("")}</div>
  <p class="noresults" id="nolib" hidden>Nothing matches that filter yet. Try another topic, or <a href="#contact">ask us directly</a>.</p>
</div></section>
${cf.exhibit ? `<section class="sec alt"><div class="wrap feat-ex">
  <div><span class="eyebrow">Featured exhibit</span><h2>${esc(cf.exhibit.story)}</h2><p class="lead">${esc(cf.exhibit.dek)}</p><a class="textlink" href="${MAG()}#p${cf.exhibit.page}">See it in Confluence ${arrow}</a></div>
  <div class="site-ex">${cf.exhibit.html}</div>
</div></section>` : ""}
<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">How we help</span><h2>Six clusters, one lead partner</h2></div><a class="textlink" href="#services">All services ${arrow}</a></div>
  <div class="helprow">${DATA.clusters.map((c, i) => `<a href="#${c.id}" style="--c:${c.color}" class="${i ? "" : "first"}">${ic(c.icon)}<span>${esc(c.name)}</span></a>`).join("")}</div>
</div></section>
<section class="sec alt"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">In every issue</span><h2>Eleven sections, one shape each month</h2></div><a class="textlink" href="#insight-why-confluence">Why Confluence ${arrow}</a></div>
  <div class="every">${DATA.sections.map((s) => `<div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`).join("")}</div>
</div></section>
<section class="deep brief"><div class="wrap"><div><span class="eyebrow" style="color:#F5C46D">The Kayak Brief, monthly</span><h2>Confluence in your inbox on the first Tuesday</h2><p>Free to clients and subscribers. One email a month; unsubscribe at any time.</p></div>${subscribeForm("sub-ins")}</div></section>`;
};

P.article = (a) => {
  const body = a.body.map((p) => (p.startsWith("## ") ? `<h2>${esc(p.slice(3))}</h2>` : `<p>${esc(p)}</p>`)).join("");
  const more = DATA.articles.filter((x) => x.id !== a.id).slice(0, 3);
  const c = a.cluster ? C[a.cluster] : null;
  return `
<article>
<header class="art-head"><div class="wrap">
  ${crumbs([["Insights", "insights"], [a.section]])}
  <h1>${esc(a.title)}</h1><p class="dek">${esc(a.dek)}</p>
  <div class="byline"><span>Confluence · Issue 01</span><span>${a.mins} min read</span>${c ? `<a class="chip" href="#${c.id}" style="--c:${c.color}"><i></i>${esc(c.name)}</a>` : `<span>Kayak Strategic Advisors</span>`}</div>
</div></header>
<div class="art-cover">${cover(a.cluster, a.section, artIcon(a), "blade", a.id)}</div>
<div class="wrap prose">${body}</div>
<div class="wrap" style="max-width:calc(68ch + 2*var(--gut))"><div class="share"><button class="btn btn-ghost" type="button" data-copy-link="insight-${a.id}">${ic("share")} Copy link</button><a class="btn btn-primary" href="#contact" data-cluster="${a.cluster || ""}">Discuss this with us ${arrow}</a></div></div>
</article>
<section class="sec alt"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">More from this issue</span></div><a class="textlink" href="#insights">All insights ${arrow}</a></div><div class="agrid">${more.map(acard).join("")}</div></div></section>`;
};

P.about = () => `
<section class="phero deepbg" style="--p:var(--pc-ksa);--ps:var(--ps-ksa)"><div class="wrap">${crumbs([["About us"]])}<h1>Two paddlers. One course.</h1><p class="lead">Kayak Strategic Advisors gives independent, structured advice and hands-on support, working beside our clients like two kayakers moving as one.</p></div></section>
<section class="sec"><div class="wrap story">
  <div><p class="serif">A kayak is a disciplined, agile craft. It crosses changing water through balance, direction and steady navigation.</p>
  <p style="margin-top:18px;color:var(--muted)">That is how we help clients through complex business, regulatory, technology and risk conditions. We are a strategy and risk advisory firm for boards, promoters and investors in India, built around six clusters and one standard of work.</p>
  <p style="color:var(--muted)">The name carries the story. Our identifier's two blades are the client and Kayak: two strokes that converge on one stem, one decision carried through.</p></div>
  <svg class="diagram" viewBox="-74 -18 256 140" role="img" aria-label="The Kayak identifier: the client blade and the Kayak blade converge on one stem, the decision">
    <path fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="var(--logo-ink)" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/>
    <line x1="10" y1="10" x2="-14" y2="10"/><text class="k" x="-16" y="7" text-anchor="end">CLIENT</text><text x="-16" y="20" text-anchor="end">first blade</text>
    <line x1="82" y1="10" x2="104" y2="10"/><text class="k" x="106" y="7">KAYAK</text><text x="106" y="20">second blade</text>
    <line x1="60" y1="84" x2="104" y2="84"/><text class="k" x="106" y="81">ONE DECISION</text><text x="106" y="94">carried through</text>
  </svg>
</div></section>
<section class="band-deep sec" id="values"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">What we stand for</span><h2 style="color:var(--on-deep)">Three values, drawn from the craft</h2></div></div>
  <div class="values">${DATA.values.map((v) => `<article><span class="eyebrow">${esc(v[0])}</span><h3>${esc(v[1])}</h3><p>${esc(v[2])}</p></article>`).join("")}</div>
</div></section>
<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">How we work</span><h2>Five promises to every client</h2><p class="lead">They decide who we hire, how we staff an engagement and what we put in front of a board.</p></div></div>
  <ol class="promises">${DATA.promises.map((p, i) => `<li><span class="n">0${i + 1}</span><h3>${esc(p[0])}</h3><p>${esc(p[1])}</p></li>`).join("")}</ol>
</div></section>
<section class="sec alt" id="standards"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Our standards</span><h2>Discretion is part of the work</h2><p class="lead">These standards apply to every engagement, from the first call.</p></div></div>
  <div class="standards">${DATA.standards.map((s) => `<article>${ic(s[0])}<h3>${esc(s[1])}</h3><p>${esc(s[2])}</p></article>`).join("")}</div>
</div></section>
<section class="sec affiliates" id="affiliates"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Affiliate entities</span><h2>One course, three specialist crews</h2><p class="lead">Kayak works alongside three affiliates connected through common leadership. Each brings a depth that would be hard to build inside a single firm, and each answers to the same standards of independence, confidentiality and evidence.</p></div></div>
  <div class="aff-grid">
    <article class="aff">${revealFig("ki", "Kayak Innovations")}
      <span class="eyebrow">Intellectual property</span><h3>Kayak Innovations (OPC) Private Limited</h3>
      <p>The custodian of Kayak's intellectual property. Kayak Innovations holds the IP in every Kayak solution, so that what we build from our advisory work is protected, owned in India and available to clients for the long term.</p></article>
    <article class="aff">${revealFig("bdi", "Brand Defence &amp; Integrity", "/assets/affiliates/bdi-logo.svg")}
      <span class="eyebrow">Market intelligence and IPR</span><h3>Brand Defence &amp; Integrity™</h3>
      <p>The Brand Defence &amp; Integrity™ name belongs to Kayak's leadership and is currently used by Brand Defence Consulting Private Limited, also known as Brand Defence India. The practice excels in market intelligence and intellectual-property matters.</p>
      <a class="textlink" href="https://www.bdiglobe.com" target="_blank" rel="noopener">www.bdiglobe.com ${arrow}</a></article>
    <article class="aff">${revealFig("kts", "Kayak Technology Solutions")}
      <span class="eyebrow">Technology and SaaS</span><h3>Kayak Technology Solutions</h3>
      <p>A partnership firm that develops and markets the SaaS solutions offered by the Kayak Group: thought, designed and developed in India for the world. Kayak Technology Solutions is led by Tan.ai, who also serves as Chief Technology Officer for the entire group.</p>
      <a class="textlink" href="https://tanai.online" target="_blank" rel="noopener">tanai.online ${arrow}</a></article>
  </div>
</div></section>
<section class="sec"><div class="wrap"><div class="sec-head"><div><span class="eyebrow">Our approach</span><h2>Four strokes, from first look to lasting result</h2></div></div>${strokes()}</div></section>
${FLAGS.leadership ? `<section class="sec alt" id="leadership"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Leadership</span><h2>The people you will work with</h2><p class="lead">Every engagement is led by a partner who stays with it from scoping to result.</p></div></div>
  <div class="people">${(DATA.people || []).map((x) => `<div class="person"><div class="ph">${esc(x.initials)}</div><h3>${esc(x.name)}</h3><p>${esc(x.role)}</p><p>${esc(x.line)}</p>${x.tag ? `<span class="tag">${esc(x.tag)}</span>` : ""}</div>`).join("")}</div>
</div></section>` : ""}
${ctaBand("Make the crossing with us")}`;

P.careers = () => `
<section class="phero" style="--p:var(--pc-managed-services);--ps:var(--ps-managed-services)"><div class="wrap">${crumbs([["Careers"]])}<h1>Build the firm with us</h1><p class="lead">We are a new firm assembling a senior, multidisciplinary founding team. If you want to do consequential work with people who stay close to it, we would like to hear from you.</p></div></section>
<section class="sec"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Why join Kayak</span><h2>Senior work, from day one</h2></div></div>
  <div class="why">${DATA.careers.why.map((w) => `<article>${ic(w[0])}<h3>${esc(w[1])}</h3><p>${esc(w[2])}</p></article>`).join("")}</div>
</div></section>
<section class="sec alt"><div class="wrap story" style="align-items:start">
  <div><span class="eyebrow">What we look for</span><h2 style="font-size:var(--step3);margin:10px 0 18px">Balance, clarity and direction</h2><p style="color:var(--muted)">Our values come from the craft, and we hire for them. We look for people who stay steady when conditions change, who read situations as they really are, and who are willing to commit to a recommendation and see it through.</p>
  <p style="color:var(--muted);margin-top:14px">Most of our roles suit experienced professionals from consulting, investigation, audit, law, technology and industry. We are open to people who have worked across more than one of these.</p></div>
  <div><span class="eyebrow">How we hire</span><ol class="steps" style="margin-top:16px">${DATA.careers.steps.map((s) => `<li><div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div></li>`).join("")}</ol></div>
</div></section>
${(DATA.careers.jobs || []).length ? `<section class="sec" id="roles"><div class="wrap">
  <div class="sec-head"><div><span class="eyebrow">Open roles</span><h2>Join us now</h2><p class="lead">${DATA.careers.jobs.length} ${DATA.careers.jobs.length === 1 ? "role is" : "roles are"} open. Read the full description, then apply below.</p></div></div>
  <div class="jobs">${DATA.careers.jobs.map((j) => `<article class="job" id="job-${esc(j.id)}">
    <div class="job-top"><div><span class="job-cl">${esc(C[j.cluster]?.name || "")}</span><h3><a href="/careers/${esc(j.id)}" class="job-link">${esc(j.title)}</a></h3><p>${esc(j.summary)}</p></div><button class="btn btn-primary" type="button" data-apply="${esc(j.title)}">Apply for this role ${arrow}</button></div>
    <ul class="job-facts"><li>${ic("user")}<span><b>Experience</b>${esc(j.experience)}</span></li><li>${ic("check")}<span><b>Qualification</b>${esc(j.qualification)}</span></li><li>${ic("location")}<span><b>Location</b>${esc(j.location)}</span></li><li>${ic("briefcase")}<span><b>Type</b>${esc(j.type)}</span></li></ul>
    <details class="job-jd"><summary>Read the full description</summary><div class="job-body">
      <h4>About the role</h4><p>${esc(j.about)}</p>
      <h4>What you will do</h4><ul>${j.do.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>What you will bring</h4><ul>${j.must.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <h4>Good to have</h4><ul>${j.nice.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="job-eeo">${esc(DATA.careers.eeo || "")}</p>
      <button class="btn btn-ghost" type="button" data-apply="${esc(j.title)}">Apply for this role ${arrow}</button>
    </div></details>
  </article>`).join("")}</div>
</div></section>` : ""}
<section class="sec" id="apply"><div class="wrap contact-grid">
  <div><span class="eyebrow">Apply</span><h2 style="font-size:var(--step3);margin:10px 0 12px">Tell us where you would fit</h2><p class="lead" style="margin-bottom:28px">${(DATA.careers.jobs || []).length ? "Apply for an open role, or send a general note if you would fit the founding team elsewhere. We reply to every application personally." : "We have no open listings yet. Send us a short note and we will reply personally."}</p>
  <form class="js-form" id="careerForm" novalidate data-kind="career"><div class="formgrid">
    ${field("c-name", "Full name", "text", true, "name")}${field("c-email", "Email", "email", true, "email")}
    ${(DATA.careers.jobs || []).length ? selectField("c-role", "Role you are applying for", DATA.careers.jobs.map((j) => j.title).concat(["General note (founding team)"]), true) : ""}
    ${selectField("c-cluster", "Area of interest", DATA.clusters.map((c) => c.name).concat(["Operations and firm building"]))}
    ${field("c-link", "LinkedIn or portfolio link", "url", false, "url")}
    <div class="field full"><label for="c-cv">Résumé <span style="color:var(--muted);font-weight:400">${(DATA.careers.jobs || []).length ? "(needed for an open role; PDF or Word, up to 2 MB)" : "(optional; PDF or Word, up to 2 MB)"}</span></label>
      <label class="cv-drop" for="c-cv"><input id="c-cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document">${ic("report")}<span class="cv-t">Choose a file or drop it here</span><span class="cv-n" aria-live="polite"></span></label>
      <span class="err" aria-live="polite"></span></div>
    <div class="field full"><label for="c-msg">A few lines about you${(DATA.careers.jobs || []).length ? ' <span style="color:var(--muted);font-weight:400">(your qualifications, years of experience and notice period)</span>' : ""}</label><textarea id="c-msg" name="msg" required></textarea><span class="err" aria-live="polite"></span></div>
    <div class="field full"><label class="check"><input id="c-consent" type="checkbox" required> I agree that Kayak may use these details to consider my application, as described in the privacy notice.</label><span class="err" aria-live="polite"></span></div>
    <div class="field full"><button class="btn btn-primary" type="submit" style="justify-self:start">Send note ${arrow}</button></div>
  </div></form></div>
  <div class="side"><div class="box"><h3>${ic("user")} Who we are looking for</h3><p>Partners, directors and senior consultants across all six clusters, and people who can help build the firm itself.</p></div>
  <div class="box"><h3>${ic("location")} Where</h3><p>Mumbai and Thane, with travel to clients across India and, for the International Desk, overseas.</p></div></div>
</div></section>`;

const field = (id, label, type, req, ac = "") => `<div class="field"><label for="${id}">${esc(label)}${req ? "" : ' <span style="color:var(--muted);font-weight:400">(optional)</span>'}</label><input id="${id}" name="${id}" type="${type}" ${req ? "required" : ""} ${ac ? `autocomplete="${ac}"` : ""}><span class="err" aria-live="polite"></span></div>`;
const selectField = (id, label, opts, full = false) => `<div class="field${full ? " full" : ""}"><label for="${id}">${esc(label)}</label><select id="${id}" name="${id}"><option value="">Choose one</option>${opts.map((o) => `<option>${esc(o)}</option>`).join("")}</select><span class="err" aria-live="polite"></span></div>`;

P.contact = () => `
<section class="phero"><div class="wrap">${crumbs([["Contact us"]])}<h1>Start with a confidential conversation</h1><p class="lead">Tell us the question. A senior member of the team will reply within one working day to arrange a call.</p></div></section>
<section class="sec"><div class="wrap contact-grid">
  <form class="js-form" id="contactForm" novalidate data-kind="contact"><div class="formgrid">
    ${field("f-name", "Full name", "text", true, "name")}${field("f-org", "Organisation", "text", true, "organization")}
    ${field("f-email", "Work email", "email", true, "email")}${field("f-phone", "Phone", "tel", false, "tel")}
    ${selectField("f-cluster", "Which area is closest to your question?", DATA.clusters.map((c) => c.name).concat(DATA.tools.map((t) => `${t.name} demo`), ["Not sure yet"]), true)}
    <div class="field full"><label for="f-msg">Your question</label><textarea id="f-msg" name="msg" required placeholder="Please do not include confidential details at this stage. We will agree a non-disclosure agreement before detailed discussions."></textarea><span class="err" aria-live="polite"></span></div>
    <div class="field full"><label class="check"><input id="f-consent" type="checkbox" required> I agree that Kayak may use these details to respond to my enquiry, as described in the privacy notice.</label><span class="err" aria-live="polite"></span></div>
    <div class="field full"><button class="btn btn-primary" type="submit" style="justify-self:start">Send enquiry ${arrow}</button></div>
  </div></form>
  <aside class="side">
    <div class="box alert"><h3>${ic("risk")} Rapid response</h3><p>For a crisis, an allegation or a deal deadline, call us. A senior team can mobilise at short notice.</p>${CFG.phone ? `<div class="copyrow"><code>${esc(CFG.phone)}</code><button type="button" data-copy="${esc(CFG.phone)}">Copy</button></div>` : `<p>Email <b>enquiries@kayaksa.com</b> with URGENT in the subject line, or ask Kay, our assistant, to flag your message.</p>`}</div>
    <div class="box"><h3>${ic("mail")} Email</h3><div class="copyrow"><code id="mailaddr">enquiries@kayaksa.com</code><button type="button" data-copy="enquiries@kayaksa.com">Copy</button></div></div>
    <div class="box"><h3>${ic("location")} Office</h3><p>${esc(CFG.address || "Mumbai, Maharashtra")}<br>India</p><p style="margin-top:8px">Also at Thane, Maharashtra.</p></div>
    <div class="box"><h3>${ic("timeline")} What happens next</h3><ol class="steps">${DATA.next.map((s) => `<li><div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div></li>`).join("")}</ol></div>
  </aside>
</div></section>`;

P.legal = () => `
<section class="phero"><div class="wrap">${crumbs([["Privacy and terms"]])}<h1>Privacy and terms</h1><p class="lead">How we handle personal data, how we measure the site without cookies, and the terms that apply to it.</p></div></section>
<section class="sec"><div class="wrap legal">
  
  <h2 id="privacy">Privacy notice</h2>
  <p>Kayak Strategic Advisors Private Limited ("Kayak"), Mumbai, processes personal data in line with the Digital Personal Data Protection Act, 2023. When you contact us, subscribe to Confluence or apply for a role, we use the details you give us only for that purpose.</p>
  <p>We keep personal data for as long as we need it for that purpose, protect it with reasonable security safeguards, and share it only with service providers who process it on our behalf. You can ask to access, correct or erase your personal data, or withdraw consent, by writing to enquiries@kayaksa.com with "Privacy" in the subject line. We respond within 30 days. If you are not satisfied, you may complain to the Data Protection Board of India.</p>
  <p>This notice is available in English and, on request, in any language in the Eighth Schedule to the Constitution. Notice version KSA-PN-2026-11.</p>
  <h2 id="choices">Your privacy choices</h2>
  <p>Kay never shows a consent banner when you arrive. Instead, Kay asks once, at the moment something becomes useful, and only for that one purpose. Your answer is recorded with a random code kept in this browser, never with your name, email or network address. You can change any answer here at any time; withdrawing is as easy as agreeing, and does not affect anything already done.</p>
  <div id="privacy-choices" class="pchoices"></div>
  <h2 id="cookies">Cookies and site statistics</h2>
  <p>This site sets no cookies. Your privacy choices and the topics Kay remembers (only if you agree) are kept in your browser's local storage, on your device. To learn which pages are useful, it counts page views and loading speed without cookies and without identifying you: we record the page, the referring website, the country, the type of device and browser, and timing measures, and we never store your network address or build a profile of you.</p>
  <h2 id="security">Security records</h2>
  <p>To protect this site and the people who use it, our firewall records the network (IP) address, browser details and a one-way device signature (a scrambled code, not your identity) when a request looks automated or malicious, and when you send us an enquiry, subscribe or apply. Automated scrapers and attack attempts are blocked for four hours. We use these records only to keep our services secure and to meet our legal duties, including the CERT-In Directions of 2022, which require security logs to be kept for 180 days. We delete them after that, and we never use them for marketing or profiling. Search engines and AI assistants that identify themselves honestly are welcome.</p>
  <h2 id="kay">Kay, our assistant</h2>
  <p>Kay is an AI assistant. Your messages are sent to our AI providers (Anthropic and Google) to generate replies. Kayak does not keep your conversation or who you are. To improve Kay, we keep the questions people ask, after automatically removing email addresses, phone numbers and identity numbers, for up to 90 days, together with any rating you give an answer. If you ask Kay to pass a message to our team, we keep that message as an enquiry. If you use voice, your speech is turned into text in your browser where possible, or by our provider, and no recording is kept. Please do not share confidential or sensitive personal information with Kay.</p>
  <h2 id="retention">How long we keep data</h2>
  <p>Enquiries: up to three years after our last contact. Applications: up to one year unless you join us. Subscriptions: until you unsubscribe, which you can do from any email. Security records: 180 days. Aggregated site statistics contain no personal data.</p>
  <h2 id="terms">Terms of use</h2>
  <p>Content on this site, including Confluence, is general information and not advice on any specific matter. Please contact us before acting on it. The Kayak name, identifier and brand assets belong to Kayak Strategic Advisors and may not be used without permission.</p>
</div></section>`;

P.notfound = () => `<section class="phero"><div class="wrap"><h1>Page not found</h1><p class="lead">The page you were looking for has moved or does not exist.</p><p style="margin-top:24px"><a class="btn btn-primary" href="#home">Go to the home page ${arrow}</a></p></div></section>`;

/* ---------- Menus ---------- */
function buildMenus() {
  $("#m-services").innerHTML = `<div class="wrap"><div class="mega-intro"><span class="eyebrow">Services</span><h3>Six clusters, one table</h3><p>Strategy, deals, regulation, risk, technology and cross-border work, led by one partner.</p><a class="btn btn-primary" href="#services">All services ${arrow}</a>
    <div class="mega-tools"><span class="eyebrow">Kayak Solutions</span>${DATA.tools.map((t) => `<a href="#${t.id}">${pmark(t)}<small>${esc(t.kind)}</small></a>`).join("")}<a class="textlink" href="#tools">All solutions ${arrow}</a></div></div>
    <div class="mega-cols">${DATA.clusters.map((c) => `<div class="mega-col"><h4><span class="swatch" style="background:${c.color}">${ic(c.icon)}</span><a href="#${c.id}">${esc(c.name)}</a></h4><ul>${c.services.map((s) => `<li><a href="#${svcAt(c.id, c.services.indexOf(s)) ? "svc-" + svcAt(c.id, c.services.indexOf(s)).slug : c.id}">${esc(s[1])}</a></li>`).join("")}</ul></div>`).join("")}</div></div>`;
  $("#m-industries").innerHTML = `<div class="wrap"><div class="mega-intro"><span class="eyebrow">Industries</span><h3>Wide sector exposure</h3><p>Every sector read the same way: value chain, regulators and the questions boards ask.</p><a class="btn btn-primary" href="#industries">All industries ${arrow}</a></div>
    <div class="mega-cols">${DATA.groups.map((g) => `<div class="mega-col"><h4><a href="#industries" data-scroll="g-${g.id}">${esc(g.name)}</a></h4><ul>${g.members.slice(0, 4).map((m) => `<li><a href="#industries" data-scroll="g-${g.id}">${esc(m.name)}</a></li>`).join("")}${g.members.length > 4 ? `<li><a href="#industries" data-scroll="g-${g.id}">and more</a></li>` : ""}</ul></div>`).join("")}</div></div>`;
  $("#m-insights").innerHTML = `<div class="wrap"><div class="mega-intro"><span class="eyebrow">Insights</span><h3>Confluence</h3><p>The Kayak monthly on strategy, risk and the decisions between them. Issue 01 is out now.</p><a class="btn btn-primary" href="#insights">Read Confluence ${arrow}</a></div>
    <div class="mega-cols"><div class="mega-col"><h4><a href="#insight-growth-and-risk">Cover story</a></h4><ul><li><a href="#insight-growth-and-risk">Growth and risk are one decision</a></li><li><a href="#insight-why-confluence">Why Confluence</a></li></ul></div>
    <div class="mega-col"><h4><a href="#insights">In this issue</a></h4><ul>${DATA.articles.filter((a) => a.cluster).slice(0, 6).map((a) => `<li><a href="#insight-${a.id}">${esc(a.section)}: ${esc(a.title)}</a></li>`).join("")}</ul></div>
    <div class="mega-col"><h4><a href="#insights">Subscribe</a></h4><ul><li><a href="#insights">Free to clients and subscribers</a></li><li><a href="#insights">First Tuesday of every month</a></li></ul></div></div></div>`;
  $("#m-about").innerHTML = `<div class="wrap"><div class="mega-intro"><span class="eyebrow">About us</span><h3>Two paddlers. One course.</h3><p>Independent, senior-led advice, working beside our clients like two kayakers moving as one.</p><a class="btn btn-primary" href="#about">About Kayak ${arrow}</a></div>
    <div class="mega-cols"><div class="mega-col"><h4><a href="#about">Who we are</a></h4><ul><li><a href="#about">Our story and name</a></li><li><a href="#about" data-scroll="values">Values</a></li><li><a href="#about" data-scroll="standards">Standards</a></li><li><a href="#about" data-scroll="affiliates">Affiliate entities</a></li></ul></div>
    ${FLAGS.leadership ? `<div class="mega-col"><h4><a href="#about" data-scroll="leadership">Leadership</a></h4><ul><li><a href="#about" data-scroll="leadership">The people you will work with</a></li></ul></div>` : `<div class="mega-col"><h4><a href="#about" data-scroll="standards">How we work</a></h4><ul><li><a href="#about" data-scroll="standards">Our standards</a></li><li><a href="#services">Our services</a></li></ul></div>`}
    <div class="mega-col"><h4><a href="#careers">Careers</a></h4><ul><li><a href="#careers">Why join Kayak</a></li><li><a href="#careers" data-scroll="apply">Founding team</a></li><li><a href="#contact">Contact us</a></li></ul></div></div></div>`;
  $("#f-services").innerHTML = DATA.clusters.map((c) => `<li><a href="#${c.id}">${esc(c.name)}</a></li>`).join("");
  $("#drawer").innerHTML = `<div class="wrap"><div class="drawer-top"><a class="brand" href="#home"><svg viewBox="0 0 416 100" style="height:24px;width:auto"><use href="#logo-wm"/></svg></a><button class="iconbtn" type="button" id="closeMenu" aria-label="Close menu">${ic("close")}</button></div>
    <details><summary>Services ${ic("plus")}</summary><ul><li><a href="#services">All services</a></li>${DATA.clusters.map((c) => `<li><a href="#${c.id}">${esc(c.name)}</a></li>`).join("")}</ul></details>
    <details><summary>Industries ${ic("plus")}</summary><ul><li><a href="#industries">All industries</a></li>${DATA.groups.map((g) => `<li><a href="#industries" data-scroll="g-${g.id}">${esc(g.name)}</a></li>`).join("")}</ul></details>
    <details><summary>Insights ${ic("plus")}</summary><ul><li><a href="#insights">Confluence</a></li>${DATA.articles.map((a) => `<li><a href="#insight-${a.id}">${esc(a.title)}</a></li>`).join("")}</ul></details>
    <details><summary>About us ${ic("plus")}</summary><ul><li><a href="#about">Who we are</a></li><li><a href="#about" data-scroll="values">Values</a></li><li><a href="#about" data-scroll="standards">Standards</a></li>${FLAGS.leadership ? `<li><a href="#about" data-scroll="leadership">Leadership</a></li>` : ""}</ul></details>
    <a class="solo" href="#careers">Careers</a><a class="solo" href="#contact">Contact us</a>
    <p style="margin-top:24px"><a class="btn btn-primary" href="#contact">Talk to us ${arrow}</a></p></div>`;
}

function closeMegas() {
  $$(".mega.open").forEach((m) => m.classList.remove("open"));
  $$(".mainnav button[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", "false"));
}
function openMega(btn) {
  const id = btn.dataset.mega, was = btn.getAttribute("aria-expanded") === "true";
  closeMegas();
  if (!was) { $("#" + id).classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
}

/* ---------- Router ---------- */
let pendingScroll = null, pendingCluster = null;
const ROUTE_SKIP = ["cluster", "article", "notfound", "tool"];
function isRouteKey(k) {
  return k === "home" || k === "top" || !!T[k] || !!C[k] || (k.startsWith("insight-") && !!A[k.slice(8)]) || (k.startsWith("svc-") && !!SV[k.slice(4)]) || (!!P[k] && !ROUTE_SKIP.includes(k));
}
function keyToPath(k) {
  if (!k || k === "home" || k === "top") return "/";
  if (k.startsWith("insight-")) return `/insights/${k.slice(8)}`;
  if (k.startsWith("svc-")) { const x = SV[k.slice(4)]; return `/services/${x.cluster}/${x.slug}`; }
  if (k === "tools") return "/solutions";
  if (T[k]) return `/solutions/${k}`;
  if (C[k]) return `/services/${k}`;
  return `/${k}`;
}
function pathToKey(p) {
  p = decodeURIComponent(p).replace(/\/+$/, "") || "/";
  if (p === "/") return "home";
  let m;
  if ((m = p.match(/^\/insights\/([\w-]+)$/))) return "insight-" + m[1];
  if (/^\/careers\/[\w-]+$/.test(p)) return "careers";
  if ((m = p.match(/^\/services\/[\w-]+\/([\w-]+)$/))) return "svc-" + m[1];
  if (p === "/solutions" || p === "/tools") return "tools";
  if ((m = p.match(/^\/(?:tools|solutions|services)\/([\w-]+)$/))) return m[1];
  return p.slice(1);
}
/** Turns the templates' #key links into real, crawlable paths. */
function linkify(root = document) {
  $$('a[href^="#"]', root).forEach((a) => {
    const k = a.getAttribute("href").slice(1);
    if (isRouteKey(k)) { a.dataset.route = k; a.setAttribute("href", keyToPath(k)); }
  });
}
function go(k, replace = false) {
  const path = keyToPath(k);
  if (replace) history.replaceState(null, "", path); else if (location.pathname !== path) history.pushState(null, "", path);
  route();
}
function route() {
  const key = pathToKey(location.pathname);
  let html, title, sec = key;
  if (key === "home" || key === "top") { html = P.home(); title = "Kayak Strategic Advisors"; sec = ""; }
  else if (T[key]) { html = P.tool(T[key]); title = `${T[key].name}: ${T[key].kind}`; sec = "services"; }
  else if (C[key]) { html = P.cluster(C[key]); title = C[key].name; sec = "services"; }
  else if (key.startsWith("svc-") && SV[key.slice(4)]) { const x = SV[key.slice(4)]; html = P.service(x); title = x.name; sec = "services"; }
  else if (key.startsWith("insight-") && A[key.slice(8)]) { const a = A[key.slice(8)]; html = P.article(a); title = a.title; sec = "insights"; }
  else if (P[key] && !["cluster", "article", "notfound", "tool", "service"].includes(key)) { html = P[key](); title = { services: "Services", industries: "Industries", insights: "Confluence insights", about: "About us", careers: "Careers", contact: "Contact us", legal: "Privacy and terms", tools: "Kayak Solutions" }[key]; if (key === "tools") sec = "services"; }
  else if (key === "main") { $("#main").focus(); return; }
  else { html = P.notfound(); title = "Page not found"; sec = ""; }
  const main = $("#main");
  main.innerHTML = `<div class="page">${html}</div>`;
  document.title = title === "Kayak Strategic Advisors" ? "Kayak Strategic Advisors (Kayak SA) | Advisory in Mumbai and Thane" : `${title} | Kayak Strategic Advisors`;
  $$(".mainnav [data-sec]").forEach((b) => b.classList.toggle("is-current", b.dataset.sec === sec));
  closeMegas(); $("#drawer").hidden = true; document.body.style.overflow = "";
  linkify(main);
  armHero();
  bindPage();
  applyPhotos(key);
  // A job's own address (/careers/<role>) opens that role.
  const jm = location.pathname.match(/^\/careers\/([\w-]+)\/?$/);
  if (key === "careers" && jm) { const card = document.getElementById("job-" + jm[1]); if (card) { card.querySelector("details").open = true; setTimeout(() => card.scrollIntoView({ block: "start" }), 60); } }
  armLogos();
  armReveals();
  afterRoute(key);
  if (pendingScroll && document.getElementById(pendingScroll)) {
    const el = document.getElementById(pendingScroll); pendingScroll = null;
    requestAnimationFrame(() => { const y = el.getBoundingClientRect().top + scrollY - ($(".site-head").offsetHeight + 12); scrollTo({ top: y }); });
  } else { pendingScroll = null; scrollTo({ top: 0 }); }
  if (pendingCluster && C[pendingCluster]) {
    const sel = $("#f-cluster"); if (sel) sel.value = C[pendingCluster].name;
  } else if (pendingCluster && T[pendingCluster]) {
    const sel = $("#f-cluster"); if (sel) sel.value = `${T[pendingCluster].name} demo`;
  }
  pendingCluster = null;
}

const HERO_SLOT = { home: "hero", top: "hero", services: "services", industries: "industries", insights: "insights", about: "about", careers: "careers", contact: "contact", tools: "tools" };
function applyPhotos(key) {
  let slot = HERO_SLOT[key] || (C[key] || T[key] ? key : key.startsWith("insight-") ? "insights" : null);
  if (key === "tools" && !PH("tools")) slot = "technology-ai";
  const hero = $("#main .hero, #main .phero, #main .issue-hero");
  if (hero && slot && PH(slot)) { hero.classList.add("has-photo"); hero.style.setProperty("--photo", `url('${PH(slot)}')`); }
  const mag = $("#main .mag-cover");
  if (mag && PH("insights")) { mag.classList.add("has-photo"); mag.style.setProperty("--photo", `url('${PH("insights")}')`); }
}
// Logo reveals: each affiliate's reveal film plays once when its card comes into view and then
// holds on the finished logo. Where we only hold the partner's live logo (BDI), the same reveal is
// drawn in CSS around it. Reduced-motion visitors see the finished logo.
function revealFig(id, alt, img) {
  const replay = `<button type="button" class="rv-replay" data-rv-replay aria-label="Replay the ${alt} logo reveal">${ic("timeline")}</button>`;
  if (img) return `<figure class="rv rv--live" data-rv><div class="rv-live"><i class="rv-b1"></i><i class="rv-b2"></i><img src="${img}" alt="${alt}" loading="lazy"></div>${replay}</figure>`;
  return `<figure class="rv" data-rv><video muted playsinline preload="none" poster="/assets/reveal/${id}.webp" aria-label="${alt} logo reveal"><source src="/assets/reveal/${id}.webm" type="video/webm"><source src="/assets/reveal/${id}.mp4" type="video/mp4"></video>${replay}</figure>`;
}
function playReveal(fig) {
  if (!fig || matchMedia("(prefers-reduced-motion: reduce)").matches) { fig?.classList.add("done"); return; }
  const v = $("video", fig);
  if (v) { try { v.currentTime = 0; } catch {} v.play().catch(() => fig.classList.add("done")); return; }
  fig.classList.remove("play"); void fig.offsetWidth; fig.classList.add("play");
}
let rvObs;
function armReveals() {
  rvObs?.disconnect();
  const figs = $$("#main [data-rv]");
  if (!figs.length) return;
  if (!("IntersectionObserver" in window)) { figs.forEach((f) => f.classList.add("done")); return; }
  rvObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { playReveal(e.target); rvObs.unobserve(e.target); } }), { threshold: 0.45 });
  figs.forEach((f) => rvObs.observe(f));
}
function playLogo(svg) {
  if (!svg || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  svg.classList.remove("play"); void svg.getBoundingClientRect(); svg.classList.add("play");
}
let logoObs;
function armLogos() {
  $$("#main .tplate .lgo").forEach(playLogo);
  if (logoObs) logoObs.disconnect();
  if (!("IntersectionObserver" in window)) return;
  logoObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { playLogo(e.target); logoObs.unobserve(e.target); } }), { rootMargin: "0px 0px 15% 0px" });
  $$("#main .plate .lgo").forEach((l) => logoObs.observe(l));
}
document.addEventListener("mouseover", (e) => {
  const card = e.target.closest(".tcard");
  if (!card || card.contains(e.relatedTarget)) return;
  const l = $(".plate .lgo", card);
  if (l && !l.dataset.busy) { l.dataset.busy = "1"; playLogo(l); setTimeout(() => delete l.dataset.busy, 2600); }
});

function bindPage() {
  const indq = $("#indq");
  if (indq) indq.addEventListener("input", () => {
    const q = indq.value.trim().toLowerCase(); let any = false;
    $$(".group").forEach((g) => {
      let n = 0;
      $$(".itile", g).forEach((t) => { const hit = !q || t.dataset.name.includes(q) || g.querySelector("h2").textContent.toLowerCase().includes(q); t.hidden = !hit; if (hit) n++; });
      g.hidden = n === 0; if (n) any = true;
    });
    $("#noind").hidden = any;
  });
  // Insights library: type, topic and search filters work together.
  const lib = $("#lib");
  if (lib) {
    const st = { g: "", t: "", q: "" };
    const run = () => {
      let n = 0;
      $$("#lib > a").forEach((c) => {
        const hit = (!st.g || c.dataset.group === st.g) && (!st.t || c.dataset.cluster === st.t) && (!st.q || (c.dataset.q || c.textContent.toLowerCase()).includes(st.q));
        c.hidden = !hit; if (hit) n++;
      });
      $("#nolib").hidden = n > 0;
    };
    $$(".lib-bar .fbtn").forEach((b) => b.addEventListener("click", () => { $$(".lib-bar .fbtn").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); st.g = b.dataset.g; run(); }));
    $$(".lib-topics .chip").forEach((b) => b.addEventListener("click", () => { $$(".lib-topics .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); st.t = b.dataset.t; run(); }));
    $("#libq")?.addEventListener("input", (e) => { st.q = e.target.value.trim().toLowerCase(); run(); });
  }
  $$(".js-form").forEach(bindForm);
}

function bindForm(f) {
  f.dataset.t = String(Date.now());
  if (!$(".hp", f)) f.insertAdjacentHTML("beforeend", `<div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>`);
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    let ok = true;
    $$("input,textarea,select", f).forEach((el) => {
      const err = el.closest(".field")?.querySelector(".err");
      let msg = "";
      if (el.required && el.type === "checkbox" && !el.checked) msg = "Please tick this box to continue.";
      else if (el.required && !el.value.trim()) msg = "Please fill this in.";
      else if (el.type === "email" && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) msg = "Enter an email address like name@company.com.";
      if (err) err.textContent = msg;
      if (msg) { ok = false; el.setAttribute("aria-invalid", "true"); } else el.removeAttribute("aria-invalid");
    });
    if (!ok) { const first = $("[aria-invalid=true]", f); if (first) first.focus(); else toast("Please enter a valid email address."); return; }
    const name = $("input[autocomplete=name]", f)?.value.trim().split(" ")[0];
    const msgs = {
      subscribe: "Thank you. Check your inbox to confirm your subscription to Confluence.",
      cases: "Thank you. Check your inbox to confirm your SeeCounter alerts.",
      contact: `Thank you${name ? ", " + esc(name) : ""}. A senior member of the team will reply within one working day.`,
      career: `Thank you${name ? ", " + esc(name) : ""}. We read every note and will reply personally.`,
    };
    const fields = {};
    $$("input,textarea,select", f).forEach((el) => { if ((!el.name && !el.id) || el.type === "file") return; const k = (el.name || el.id).replace(/^[fc]-/, ""); fields[k] = el.type === "checkbox" ? el.checked : el.value.trim(); });
    const kind = f.dataset.kind;
    // Careers: attach the résumé (PDF or Word, up to 2 MB).
    const cvIn = $("#c-cv", f), cvFile = cvIn?.files?.[0];
    if (cvIn) {
      const err = cvIn.closest(".field").querySelector(".err");
      const msg = cvFile ? cvError(cvFile) : fields.role && !/^General/.test(fields.role) ? "Please attach your résumé (PDF or Word, up to 2 MB)." : "";
      err.textContent = msg;
      if (msg) { cvIn.closest(".field").classList.add("bad"); cvIn.focus(); return; }
      if (cvFile) fields.resume = { name: cvFile.name, data: await fileB64(cvFile) };
    }
    const body = { kind, fields, page: location.pathname, t: Number(f.dataset.t || 0) };
    if (kind === "cases") body.filters = Object.fromEntries(new FormData(f).entries());
    const btn = $("button[type=submit]", f);
    const label = btn?.innerHTML; if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    fetch("/api/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "We could not send this. Please try again, or email enquiries@kayaksa.com."); return d; })
      .then((d) => {
        const note = document.createElement("div");
        note.className = "form-ok"; note.setAttribute("role", "status");
        note.innerHTML = d.message ? esc(d.message) : msgs[kind];
        f.replaceWith(note);
      })
      .catch((err) => { toast(err.message); if (btn) { btn.disabled = false; btn.innerHTML = label; } });
  });
}

/* ---------- Careers: résumé field ---------- */
const CV_MAX = 2 * 1024 * 1024;
const cvError = (file) => (!/\.(pdf|docx?)$/i.test(file.name) ? "Please choose a PDF or Word document (.pdf, .doc or .docx)." : file.size > CV_MAX ? `That file is ${(file.size / 1048576).toFixed(1)} MB. Résumés can be up to 2 MB.` : file.size < 200 ? "That file looks empty." : "");
const fileB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(file); });
document.addEventListener("change", (e) => {
  if (e.target.id !== "c-cv") return;
  const file = e.target.files?.[0], fld = e.target.closest(".field"), msg = file ? cvError(file) : "";
  fld.querySelector(".cv-n").textContent = file ? `${file.name} · ${file.size < 1048576 ? Math.max(1, Math.round(file.size / 1024)) + " KB" : (file.size / 1048576).toFixed(1) + " MB"}` : "";
  fld.querySelector(".err").textContent = msg; fld.classList.toggle("bad", !!msg); fld.querySelector(".cv-drop").classList.toggle("has", !!file && !msg);
});
for (const ev of ["dragover", "dragleave", "drop"]) document.addEventListener(ev, (e) => {
  const d = e.target.closest?.(".cv-drop"); if (!d) return;
  e.preventDefault(); d.classList.toggle("over", ev === "dragover");
  if (ev === "drop" && e.dataTransfer.files[0]) { const inp = $("#c-cv"); inp.files = e.dataTransfer.files; inp.dispatchEvent(new Event("change", { bubbles: true })); }
});

/* ---------- Careers: "Apply for this role" ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-apply]"); if (!b) return;
  const sel = $("#c-role"); if (sel) sel.value = b.dataset.apply;
  const j = DATA.careers.jobs?.find((x) => x.title === b.dataset.apply), cl = $("#c-cluster");
  if (j && cl && C[j.cluster]) cl.value = C[j.cluster].name;
  $("#apply")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  setTimeout(() => $("#c-name")?.focus({ preventScroll: true }), 450);
});

/* ---------- Search ---------- */
const INDEX = [
  ...[["Services", "services", "Six clusters, one lead partner"], ["Industries", "industries", "Wide industry and sector exposure"], ["Confluence", "insights", "Our monthly magazine"], ["About us", "about", "Who we are, values and standards"], ["Careers", "careers", "Join the founding team"], ["Kayak Solutions", "tools", "SayUsNow, SeeCounter, NexaPair and DocuVow"], ["Contact us", "contact", "Start a confidential conversation"], ["Kayak tools", "technology-ai", "SayUsNow, SeeCounter and NexaPair"]].map((p) => ({ t: p[0], s: p[2], h: p[1], g: "Pages", i: "website" })),
  ...DATA.clusters.map((c) => ({ t: c.name, s: c.line, h: c.id, g: "Services", i: c.icon })),
  ...DATA.clusters.flatMap((c) => c.services.map((s) => ({ t: s[1], s: c.name, h: c.id, g: "Services", i: s[0], k: s[2] }))),
  ...(DATA.services || []).map((x) => ({ t: x.name, s: C[x.cluster]?.name || "", h: "svc-" + x.slug, g: "Services", i: "target", k: x.summary + " " + x.what.join(" ") })),
  ...DATA.tools.map((t) => ({ t: t.name, s: t.kind, h: t.id, g: "Kayak Solutions", i: t.icon, k: t.line + " " + t.modules.map((m) => m[1]).join(" ") })),
  ...DATA.tools.flatMap((t) => realMods(t).map((m) => ({ t: `${t.name} ${m[1]}`, s: m[2], h: t.id, sc: "modules", g: "Kayak tools", i: m[0] }))),
  ...DATA.groups.flatMap((g) => g.members.map((m) => ({ t: m.name, s: g.name, h: "industries", sc: "g-" + g.id, g: "Industries", ind: m.slug }))),
  ...DATA.articles.map((a) => ({ t: a.title, s: `${a.section} · Confluence`, h: "insight-" + a.id, g: "Insights", i: "report", k: a.dek })),
];
function runSearch(q) {
  q = q.trim().toLowerCase();
  const box = $("#results");
  if (!q) { box.innerHTML = `<p class="empty">Try "due diligence", "DPDP", "steel" or "India entry".</p>`; return; }
  const words = q.split(/\s+/);
  const hits = INDEX.filter((x) => words.every((w) => (x.t + " " + x.s + " " + (x.k || "")).toLowerCase().includes(w))).slice(0, 24);
  if (!hits.length) { box.innerHTML = `<p class="empty">No results for "${esc(q)}". Try a broader word, or <a href="#contact">ask us directly</a>.</p>`; return; }
  const groups = {};
  hits.forEach((h) => (groups[h.g] = groups[h.g] || []).push(h));
  box.innerHTML = Object.entries(groups).map(([g, list]) => `<h5>${g}</h5>${list.map((h) => `<a href="#${h.h}" ${h.sc ? `data-scroll="${h.sc}"` : ""}>${h.ind ? ii(h.ind) : ic(h.i)}<span>${esc(h.t)}<small>${esc(h.s)}</small></span></a>`).join("")}`).join("");
  linkify(box);
}
function openSearch() { $("#searchOv").hidden = false; document.body.style.overflow = "hidden"; const q = $("#q"); q.value = ""; runSearch(""); setTimeout(() => q.focus(), 30); }
function closeSearch() { $("#searchOv").hidden = true; document.body.style.overflow = ""; }

let tt;
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 2600); }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch (e) { const el = $("#mailaddr"); if (el && text.includes("@")) { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); } toast("Press Ctrl+C to copy"); }
}

/* ---------- Live sections ---------- */
const fmtD = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
function afterRoute(key) {
  if (key === "seecounter") casesSection();
  if (key === "legal") import("/assets/consent.js").then((m) => m.renderChoices($("#privacy-choices"))).catch(() => {});
  dispatchEvent(new CustomEvent("kayak:route"));
}
async function casesSection() {
  const host = $("#main .page");
  if (!host || $("#cases", host)) return;
  const sec = document.createElement("section");
  sec.className = "sec cases"; sec.id = "cases";
  sec.innerHTML = `<div class="wrap"><span class="eyebrow">Case repository</span><h2 style="font-size:var(--step3);margin:10px 0 8px">Counterfeiting actions, as they happen</h2>
    <p class="lead" style="margin-bottom:22px">Court orders, raids, seizures, takedowns and regulatory actions, each checked against its public source before it is added.</p>
    <form class="case-filters" id="cf" role="search">
      <label class="sr" for="cf-q">Search cases</label><input id="cf-q" name="q" type="search" placeholder="Brand, product, party or place">
      <select name="action" aria-label="Type of action"><option value="">All actions</option>${["Court order", "Raid", "Seizure", "Takedown", "Regulatory action", "Conviction"].map((x) => `<option>${x}</option>`).join("")}</select>
      <select name="status" aria-label="Status"><option value="">Past and ongoing</option><option value="ongoing">Ongoing</option><option value="closed">Concluded</option></select>
      <button class="btn btn-primary" type="submit">Search</button></form>
    <div id="caselist" class="caselist" aria-live="polite"><p class="muted">Loading cases…</p></div>
    <div class="box case-sub"><h3>${ic("mail")} Get new actions in your inbox</h3><p>Choose what you follow. We email only when something new matches, and every email has a one-click unsubscribe.</p>
      <form class="js-form subscribe-cases" novalidate data-kind="cases"><div class="formgrid">
        <div class="field"><label for="cs-email">Work email</label><input id="cs-email" name="email" type="email" required autocomplete="email"><span class="err" aria-live="polite"></span></div>
        <div class="field"><label for="cs-brand">Brand or keyword (optional)</label><input id="cs-brand" name="keyword" type="text"><span class="err"></span></div>
        <div class="field"><label for="cs-cat">Product category (optional)</label><input id="cs-cat" name="category" type="text" placeholder="For example pharmaceuticals"><span class="err"></span></div>
        <div class="field"><label for="cs-freq">How often</label><select id="cs-freq" name="frequency"><option value="instant">As it happens</option><option value="daily">Daily digest</option><option value="weekly" selected>Weekly digest</option></select><span class="err"></span></div>
        <div class="field full"><label class="check"><input id="cs-consent" name="consent" type="checkbox" required> I agree that Kayak may email me SeeCounter alerts, as described in the privacy notice.</label><span class="err" aria-live="polite"></span></div>
        <div class="field full"><button class="btn btn-saffron" type="submit" style="justify-self:start">Subscribe to alerts ${arrow}</button></div></div></form></div></div>`;
  const anchor = $(".phero, .hero, .tool-hero", host)?.closest("section") || host.firstElementChild;
  anchor.after(sec);
  bindForm($(".subscribe-cases", sec));
  const load = async () => {
    const q = new URLSearchParams(new FormData($("#cf")));
    const box = $("#caselist");
    try {
      const r = await fetch(`/api/cases?${q}`).then((x) => x.json());
      if (!r.cases.length) { box.innerHTML = `<p class="empty">${r.total ? "No cases match those filters." : "The first verified cases are being added. Subscribe below and we will tell you as soon as they are published."}</p>`; return; }
      box.innerHTML = r.cases.map((c) => `<article class="case"><div class="meta"><span class="tag ${c.status === "ongoing" ? "live" : ""}">${esc(c.status === "ongoing" ? "Ongoing" : "Concluded")}</span><span>${esc(c.action)}</span><span>${esc(fmtD(c.action_date))}</span><span>${esc(c.jurisdiction || "")}</span></div>
        <h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><p class="small">${c.brand ? `<b>Brand:</b> ${esc(c.brand)} · ` : ""}${c.category ? `<b>Category:</b> ${esc(c.category)} · ` : ""}${c.authority ? `<b>Court or authority:</b> ${esc(c.authority)}` : ""}</p>
        ${c.source_url ? `<a href="${esc(c.source_url)}" target="_blank" rel="noopener nofollow">Source ${ic("arrow-right")}</a>` : ""}</article>`).join("");
    } catch { box.innerHTML = `<p class="empty">Cases could not load. Please refresh the page.</p>`; }
  };
  $("#cf").addEventListener("submit", (e) => { e.preventDefault(); load(); });
  load();
}

/* ---------- Site statistics (no cookies, no identifiers) ---------- */
function beacon() {
  if (navigator.webdriver || /bot|crawl|spider/i.test(navigator.userAgent)) return;
  const send = (body) => { try { navigator.sendBeacon("/api/a", JSON.stringify(body)); } catch {} };
  let last = "";
  const view = () => { if (location.pathname === last) return; last = location.pathname; send({ t: "pv", p: location.pathname, r: document.referrer && !document.referrer.startsWith(location.origin) ? new URL(document.referrer).hostname : "", w: innerWidth }); };
  view();
  window.addEventListener("popstate", view);
  document.addEventListener("click", () => setTimeout(view, 50), true);
  // Core Web Vitals, measured once per visit.
  const vit = {};
  try {
    new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) vit.lcp = Math.round(e.startTime); }).observe({ type: "largest-contentful-paint", buffered: true });
    let cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; vit.cls = Math.round(cls * 1000) / 1000; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) vit.inp = Math.max(vit.inp || 0, Math.round(e.duration)); }).observe({ type: "event", buffered: true, durationThreshold: 40 });
  } catch {}
  const nav = performance.getEntriesByType("navigation")[0];
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && !vit.sent) { vit.sent = 1; send({ t: "cwv", p: location.pathname, ttfb: nav ? Math.round(nav.responseStart) : null, ...vit }); } });
}

/* ---------- Global events ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest("a,button");
  if (!a) { if (!e.target.closest(".mega")) closeMegas(); return; }
  if (a.dataset.mega) { e.preventDefault(); openMega(a); return; }
  if (a.dataset.scroll) pendingScroll = a.dataset.scroll;
  if (a.dataset.cluster !== undefined && (a.dataset.route || (a.getAttribute("href") || "").slice(1)) === "contact") pendingCluster = a.dataset.cluster || null;
  if (a.hasAttribute("data-rv-replay")) { playReveal(a.closest("[data-rv]")); return; }
  if (a.hasAttribute("data-replay")) { playLogo(a.closest(".tplate").querySelector(".lgo")); return; }
  if (a.dataset.copy) { copy(a.dataset.copy); return; }
  if (a.dataset.copyLink) { copy("https://www.kayaksa.com" + keyToPath(a.dataset.copyLink)); return; }
  if (a.id === "openSearch") { openSearch(); return; }
  if (a.id === "closeSearch") { closeSearch(); return; }
  if (a.id === "openMenu") { $("#drawer").hidden = false; document.body.style.overflow = "hidden"; return; }
  if (a.id === "closeMenu") { $("#drawer").hidden = true; document.body.style.overflow = ""; return; }
  const href = a.getAttribute("href") || "";
  if (href === "#main") { e.preventDefault(); $("#main").focus(); return; }
  if (a.dataset.route && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && a.target !== "_blank") {
    e.preventDefault(); closeSearch(); go(a.dataset.route); return;
  }
  if (href.startsWith("#")) closeSearch();
});
$("#searchOv").addEventListener("click", (e) => { if (e.target.id === "searchOv") closeSearch(); });
$("#q").addEventListener("input", (e) => runSearch(e.target.value));
$("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); const f = $("#results a"); if (f) f.click(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeMegas(); closeSearch(); $("#drawer").hidden = true; document.body.style.overflow = ""; }
  if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
});
const nav = $(".mainnav");
let hoverT;
$$(".mainnav button[data-mega]").forEach((b) => {
  b.addEventListener("mouseenter", () => { if (matchMedia("(hover:hover)").matches && $(".mega.open")) { clearTimeout(hoverT); if (b.getAttribute("aria-expanded") !== "true") openMega(b); } });
});
$(".site-head").addEventListener("mouseleave", () => { hoverT = setTimeout(closeMegas, 250); });
$(".site-head").addEventListener("mouseenter", () => clearTimeout(hoverT));
window.addEventListener("popstate", route);
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && isRouteKey(h)) go(h, true); });

buildMenus();
linkify(document);
// Old #links (from the preview site or shared earlier) move to their real paths.
{ const h = location.hash.slice(1); if (h && isRouteKey(h)) history.replaceState(null, "", keyToPath(h)); }
route();
beacon();
import("/assets/kay.js").then((m) => m.mountKay({ data: DATA })).catch((e) => console.warn("Kay could not start", e));
import("/assets/consent.js").then((m) => m.mountConsent({ data: DATA })).catch(() => {});

