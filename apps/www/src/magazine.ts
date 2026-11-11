// Confluence, the magazine reader. The server renders every page as plain, readable HTML (for search
// engines, screen readers and anyone without JavaScript); /assets/magazine.js turns the pages into a
// book with turning pages.
import { EDITION, NOTICE, type Story, type Edition } from "../content/editions/2026-11";
import { exhibitHtml, cleanExhibit } from "./exhibit";
export type { Edition };

/** Issues built into the code. Later issues are drafted in the internal portal and stored in D1. */
export const BUILT_IN: Record<string, Edition> = { [EDITION.id]: EDITION };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// Section colours and names follow the Confluence issue architecture in the Design & Visual Guidelines (10 · Confluence).
const COLOR: Record<Story["section"], string> = { Regulatory: "#9C630E", Financial: "#3E5563", Deals: "#17807E", Business: "#2D6A9F", Technology: "#2D6A9F" };
const SECTION: Record<Story["section"], string> = { Regulatory: "Regulatory Radar", Financial: "Storm Watch", Deals: "Deal Water", Business: "Signal", Technology: "Signal" };
// One pattern per spread, chosen by section: [file, tile width in page units]
const PATTERN: Record<Story["section"], [string, number]> = { Regulatory: ["03-delta", 20], Financial: ["09-current", 24], Deals: ["02-paddle-rhythm", 9.6], Business: ["11-chart-contours", 30], Technology: ["10-soundings", 5] };
// Pull-quote marks: blade pairs at cap height, Open Water opens and saffron closes.
const QO = `<svg class="qm" viewBox="0 0 22 18" aria-hidden="true"><path fill="#17807E" d="M0 0 H5.5 L10 18 H4.5 Z M10 0 H15.5 L20 18 H14.5 Z"/></svg>`;
const QC = `<svg class="qm" viewBox="0 0 22 18" aria-hidden="true"><path fill="#EE9B1E" d="M6 0 H11.5 L7 18 H1.5 Z M16 0 H21.5 L17 18 H11.5 Z"/></svg>`;
/** Content-type label (05 · Badges & seals): square corners, flat end on the 62° blade angle. */
const label = (t: string, tone = "") => `<span class="ctl ${tone}"><i></i>${esc(t)}</span>`;

const WM = `<svg class="wm" viewBox="0 0 416 100" aria-hidden="true"><g fill="currentColor"><path d="M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z"/><path transform="translate(92 0)" d="M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z"/><path transform="translate(161 0)" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/><path transform="translate(232 0)" d="M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z"/><path transform="translate(332 0)" d="M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z"/></g><path transform="translate(161 0)" fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path transform="translate(161 0)" fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/></svg>`;
const MARK = `<svg class="mk" viewBox="-4 -4 100 108" aria-hidden="true"><path fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="currentColor" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></svg>`;

/** Edition seal (05 · Badges & seals): octagon, Insight Series, the Confluence Y, issue number. */
const seal = (E: Edition) => `<svg class="seal" viewBox="0 0 120 120" role="img" aria-label="Kayak Insight Series, ${esc(E.issue)}"><path d="M35 4 H85 L116 35 V85 L85 116 H35 L4 85 V35 Z" fill="#0E2F3C"/><path d="M38 11 H82 L109 38 V82 L82 109 H38 L11 82 V38 Z" fill="none" stroke="#ffffff66" stroke-width="1.2"/><text x="60" y="33" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing="1.6" fill="#fff" font-family="Archivo,sans-serif">KAYAK</text><text x="60" y="44" text-anchor="middle" font-size="8.5" font-weight="800" letter-spacing="1.2" fill="#fff" font-family="Archivo,sans-serif">INSIGHT SERIES</text><g transform="translate(47 52) scale(.28)"><path fill="#3FB0A9" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="#fff" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></g><text x="60" y="96" text-anchor="middle" font-size="7" font-weight="600" letter-spacing="1.4" fill="#ffffffcc" font-family="Archivo,sans-serif">Nº ${esc(E.issue.replace(/\D/g, "").padStart(2, "0"))} · ${esc(E.month.toUpperCase())}</text></svg>`;

const monthName = (E: Edition) => E.month.split(" ")[0];
function nextIssue(E: Edition) {
  const [y, m] = E.id.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // the month after this issue
  const name = d.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const from = new Date(Date.UTC(y, m - 2, 25)).toLocaleString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  const to = new Date(Date.UTC(y, m - 1, 25)).toLocaleString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${name}, covering ${from} – ${to}`;
}

export function magazinePage(E: Edition, origin: string, opts: { preview?: boolean; assetBase?: string } = {}): { html: string; title: string } {
  const A = opts.assetBase || "";
  const pages: string[] = [];
  const foot = (n: number, side: string) => `<footer class="pf ${side}"><span>${n}</span><span>Confluence · ${esc(E.month)}</span></footer>`;
  const add = (cls: string, body: string, opts: { label: string; noFoot?: boolean; style?: string } ) => {
    const n = pages.length + 1;
    const side = n % 2 ? "r" : "l";
    pages.push(`<section class="pg ${cls}" data-n="${n}" data-label="${esc(opts.label)}" aria-label="Page ${n}: ${esc(opts.label)}"${opts.style ? ` style="${opts.style}"` : ""}><div class="pi">${body}</div>${opts.noFoot ? "" : foot(n, side)}</section>`);
    return n;
  };

  // Work out page numbers for the contents before rendering.
  const first = 6;
  const storyPage = (i: number) => first + i * 2;
  const spotPage = E.spotlight ? first + E.stories.length * 2 : 0;
  const agendaPage = first + E.stories.length * 2 + (E.spotlight ? 2 : 0);

  // 1 Cover
  add("cover", `
    <img class="cv-img" src="${A}/assets/hero/${esc(E.coverImage || "cover-01-1024.webp")}" alt="" fetchpriority="high">
    <div class="cv-tint"></div>
    <div class="cv-top">${WM}<span>A Kayak Strategic Advisors publication</span></div>
    <h1 class="cv-mast">CONFLUENCE</h1>
    <div class="cv-issue"><span>${esc(E.issue)}</span><span>${esc(E.month)}</span><span>Covering ${esc(E.periodShort)}</span></div>
    <div class="cv-main"><span class="cv-kick">Cover story</span><h2>${esc(E.coverTitle)}</h2><p>${esc(E.coverDek)}</p></div>
    <ul class="cv-lines">${E.coverLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    ${MARK}`, { label: "Cover", noFoot: true });

  // 2 Editor's note
  add("note", `
    ${seal(E)}<span class="kick">The Heading · From the editor</span>
    <h2 class="h">${esc(E.editorsTitle)}</h2>
    ${E.editorsNote.map((p, i) => `<p class="${i ? "" : "lead"}">${esc(p)}</p>`).join("")}
    ${(() => { const q = (E.editorsNote.at(-1) || "").split(/(?<=\.)\s/).at(-1); return q ? `<blockquote class="pq sm">${QO}<p>${esc(q)}</p>${QC}</blockquote>` : ""; })()}
    <p class="sig">The Confluence desk<br><span>Kayak Strategic Advisors, Mumbai</span></p>
    <aside class="box"><b>How to read Kayak's perspective</b><p>${esc(NOTICE.short)}</p></aside>`, { label: "From the editor" });

  // 3 Contents
  add("toc", `
    <span class="kick">In this issue</span>
    <h2 class="h">Contents</h2>
    <p class="period">News and decisions from ${esc(E.period)}</p>
    <ol class="toc-list">
      <li><a data-go="4" href="#p4"><em>By the Numbers</em><span>The month in numbers</span><i>4</i></a></li>
      <li><a data-go="5" href="#p5"><em>The Heading</em><span>The Relativity Index: our cast</span><i>5</i></a></li>
      ${E.stories.map((s, i) => `<li style="--c:${COLOR[s.section]}"><a data-go="${storyPage(i)}" href="#p${storyPage(i)}"><em>${esc(SECTION[s.section])}</em><span>${esc(s.title)}</span><i>${storyPage(i)}</i></a></li>`).join("")}
      ${E.spotlight ? `<li style="--c:#EE9B1E"><a data-go="${spotPage}" href="#p${spotPage}"><em>Spotlight</em><span>${esc(E.spotlight.tool)}</span><i>${spotPage}</i></a></li>` : ""}
      <li><a data-go="${agendaPage}" href="#p${agendaPage}"><em>Soundings</em><span>Your ${esc(monthName(E))} agenda</span><i>${agendaPage}</i></a></li>
      <li><a data-go="${agendaPage + 1}" href="#p${agendaPage + 1}"><span>Important notice</span><i>${agendaPage + 1}</i></a></li>
    </ol>`, { label: "Contents" });

  // 4 Numbers
  add("nums", `
    <span class="kick">By the Numbers</span>
    <h2 class="h">${esc(E.periodShort)}</h2>
    <div class="ngrid">${E.numbers.map(([n, t, ic, cmp]) => `<div>${ic && /^[a-z-]+$/.test(ic) ? `<img class="nic" src="${A}/assets/icons/ksa/ksa-icon-${ic}.svg" alt="">` : ""}<b>${esc(n)}</b><span>${esc(t)}</span>${cmp ? `<p class="cmp ${cmp.dir || ""}">${cmp.was ? `<s>${esc(cmp.was)}</s><i aria-hidden="true"></i><em>${esc(n)}</em><br>` : cmp.dir ? `<i aria-hidden="true"></i>` : ""}${esc(cmp.note)}</p>` : ""}</div>`).join("")}</div>
    <p class="fn">Figures and comparisons as reported in the sources cited on each story's page.</p>`, { label: "The month in numbers" });

  // 5 Relativity Index
  add("cast", `
    <div class="half-pat" style="background-image:url('${A}/assets/patterns/04-monogram-canvas-brand-dark.svg');background-size:calc(48 * var(--u)) auto"></div>
    <div class="half-plate"><span class="kick">The Relativity Index</span><h2 class="h">Meet the people in our scenarios</h2></div>
    <p>Every Kayak perspective in Confluence is built around a scenario. To make each one easy to follow, we use the same fictional cast and fictional companies. They help you see how an idea works in a particular situation, and how it might not.</p>
    <dl class="castlist">${E.cast.map(([n, r]) => `<div><dt>${esc(n)}</dt><dd>${esc(r)}</dd></div>`).join("")}<div><dt>A, B, C</dt><dd>Fictional companies, listed or unlisted</dd></div><div><dt>P, Q, R</dt><dd>Fictional funds, start-ups and counterparties</dd></div></dl>
    <aside class="box"><p>All people and companies in our scenarios are fictional, and any resemblance to real persons or entities is coincidental. A perspective that fits one scenario should not be applied universally to every scenario.</p></aside>`, { label: "The Relativity Index" });

  // Stories: a spread each. Four compositions rotate so no two spreads in a row look alike:
  // photo opener, pattern half page, exhibit-led, and pull-quote. Every spread carries a section tag,
  // a chapter marker, an INSIGHT panel (why it matters) and a POINT OF VIEW page (Kayak's perspective).
  const ROT = ["photo", "pattern", "exhibit", "quote"] as const;
  let exN = 0;
  E.stories.forEach((s, i) => {
    const c = COLOR[s.section] || "#17807E", sec = SECTION[s.section] || s.section, lay = (["photo", "pattern", "exhibit", "quote"] as const).includes(s.layout as any) ? s.layout! : ROT[i % 4];
    const no = String(i + 1).padStart(2, "0");
    const tag = `<span class="stag" style="--c:${c}">${esc(sec)}</span><span class="skick">${esc(s.kicker)}</span>`;
    const exd = cleanExhibit(s.exhibit);
    const ex = exd ? exhibitHtml(exd, ++exN, { wide: lay === "exhibit" }) : "";
    const facts = `<h3 class="lbl">What happened</h3><ul class="facts">${s.facts.map((f) => `<li><time>${esc(f.date)}</time><span>${esc(f.text)}</span></li>`).join("")}</ul>`;
    const mini = !s.exhibit && s.numbers ? `<div class="mini">${s.numbers.map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join("")}</div>` : "";
    const insight = `<div class="insight">${label("Insight")}<h3>Why it matters</h3>${s.matters.map((m) => `<p>${esc(m)}</p>`).join("")}</div>`;
    const [pf, pw] = PATTERN[s.section] || ["11-chart-contours", 30];
    // Left page: the news and the evidence. Right page: Kayak's point of view.
    let left = "";
    if (lay === "photo") left = `<div class="st-img" style="background-image:url('${A}/assets/hero/${s.image || "boardroom"}-960.webp')"><span class="tint"></span><span class="chap">${no}</span><div class="st-tags">${tag}</div></div>
      <h2 class="st-h">${esc(s.title)}</h2><p class="st-dek">${esc(s.dek)}</p>${facts}${ex || mini}`;
    else if (lay === "pattern") left = `<div class="st-pat" style="background-image:url('${A}/assets/patterns/${pf}-brand-dark.svg');background-size:calc(${pw} * var(--u)) auto"><span class="chap">${no}</span></div>
      <div class="st-plate"><div class="st-tags">${tag}</div><h2 class="st-h">${esc(s.title)}</h2><p class="st-dek">${esc(s.dek)}</p></div>${facts}${ex || mini}`;
    else if (lay === "exhibit") left = `<div class="st-band" style="background-image:url('${A}/assets/patterns/08-pinstripe-tonal-light.svg')"></div><div class="st-top"><span class="chap ink">${no}</span><div class="st-tags">${tag}</div></div>
      <h2 class="st-h">${esc(s.title)}</h2><p class="st-dek">${esc(s.dek)}</p>${ex}${facts}${ex ? "" : mini}`;
    else left = `<div class="st-band k" style="background-image:url('${A}/assets/patterns/07-k-lattice-tonal-light.svg')"></div><div class="st-top"><span class="chap ink">${no}</span><div class="st-tags">${tag}</div></div>
      <h2 class="st-h big">${esc(s.title)}</h2><p class="st-dek">${esc(s.dek)}</p>${facts}${mini}${insight}`;
    const pull = (typeof s.pull === "string" && s.perspective.join(" ").includes(s.pull) ? s.pull : "") || (lay === "quote" ? (s.perspective.at(-1) || "").split(/(?<=\.)\s/).at(-1) : "");
    add(`story-l lay-${lay}`, left, { label: s.title, style: `--c:${c}` });
    add(`story-r lay-${lay}`, `
      <div class="pov-head">${label("Point of view", "rev")}<span class="pov-t">Kayak's perspective</span></div>
      ${lay === "quote" && pull ? `<blockquote class="pq">${QO}<p>${esc(pull)}</p>${QC}</blockquote>` : ""}
      <div class="ri"><b>Relativity Index</b>${s.cast.map(([n, r]) => `<span><em>${esc(n)}</em> ${esc(r)}</span>`).join("")}</div>
      <h3 class="lbl">The scenario</h3>
      ${s.scenario.map((p) => `<p class="scn">${esc(p)}</p>`).join("")}
      <h3 class="lbl">Our perspective</h3>
      ${s.perspective.map((p) => `<p>${esc(p)}</p>`).join("")}
      ${lay === "quote" ? ex : insight}
      <div class="qs"><span class="tab"><b>?</b>Questions a board might ask</span><ol>${s.questions.map((q, k) => `<li><i>${String(k + 1).padStart(2, "0")}</i><span>${esc(q)}</span></li>`).join("")}</ol></div>
      ${s.postscript ? `<p class="ps"><b>Postscript.</b> ${esc(s.postscript)}</p>` : ""}
      <aside class="caveat"><p>${esc(NOTICE.short)}</p></aside>
      <p class="src fn"><b>Sources</b> ${s.sources.map(([t, u], k) => `<span><sup>${k + 1}</sup> <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a></span>`).join(" ")}</p>`, { label: `${s.title}: Kayak's perspective`, style: `--c:${c}` });
  });

  // Spotlight on a Kayak solution: one composition across both pages. The photograph runs across the
  // gutter (each page shows its half), the saffron rule continues from page to page, and the reading
  // order flows left to right: why it matters, then what it does and what it looks like in practice.
  if (E.spotlight) {
    const S = E.spotlight;
    const [name, ...rest] = S.title.split(":");
    const sub = rest.join(":").trim().replace(/^./, (ch) => ch.toUpperCase());
    const img = `${A}/assets/hero/${esc(S.image || "mumbai-1536.webp")}`;
    const slug = (["nexapair", "sayusnow", "docuvow"] as const).find((k) => S.tool.toLowerCase().replace(/\s+/g, "").startsWith(k));
    const logo = S.logo || (slug ? `${slug}-horizontal.svg` : "");
    const icon = slug && slug !== "docuvow" ? `${A}/assets/logos/${slug}-icon.svg` : "";
    const plate = logo ? `<span class="sp-logo"><img src="${A}/assets/logos/${esc(logo)}" alt="${esc(S.tool.split(" ")[0])} logo"></span>` : "";
    const photo = (side: "l" | "r", inner: string) => `<div class="sp-photo ${side}" style="background-image:url('${img}')"><span class="sp-shade ${side}"></span>${inner}</div><span class="sp-rule"></span>`;
    add("spot spot-l", `
      ${photo("l", `${plate}<div class="sp-head"><span class="sp-kick">${esc(S.kicker)}</span><h2 class="sp-name">${esc(name.trim())}</h2>${sub ? `<p class="sp-sub">${esc(sub)}</p>` : ""}</div>`)}
      <div class="sp-body">
        <p class="sp-dek">${esc(S.dek)}</p>
        <h3 class="sp-lbl">Why now</h3>
        <ol class="sp-time">${S.regulation.slice(0, 3).map((r) => `<li><b>${esc(r.date)}</b><span>${esc(r.text)}</span></li>`).join("")}</ol>
        <h3 class="sp-lbl">Why it is necessary</h3>
        ${S.why.slice(0, 2).map((p) => `<p>${esc(p)}</p>`).join("")}
        ${S.helps.length ? `<div class="sp-teams"><b>Built for</b>${S.helps.map(([t]) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      </div>`, { label: `Spotlight: ${S.tool}` });
    add("spot spot-r", `
      ${photo("r", `<div class="sp-stats">${S.numbers.slice(0, 4).map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join("")}</div>`)}
      <div class="sp-body">
        <h3 class="sp-lbl">What it does</h3>
        <ul class="sp-mods">${S.modules.slice(0, 6).map(([n, st, t]) => `<li><div><b>${esc(n)}</b><em class="${st === "Live" ? "live" : "soon"}">${esc(st)}</em></div><span>${esc(t)}</span></li>`).join("")}</ul>
        <div class="sp-case"><span class="sp-ri">Relativity Index · ${S.cast.map(([n]) => esc(n)).join(" and ")}</span>
          <p>${esc(S.scenario[0] || "")}</p><p><b>${esc(S.howItHelps[0] || "")}</b></p></div>
        <p class="sp-cta">${icon ? `<img class="sp-ico" src="${icon}" alt="">` : ""}<span>${esc(S.cta)}</span><a href="${esc(S.url)}" target="_blank" rel="noopener">${esc(S.url.replace(/^https?:\/\//, ""))} →</a></p>
        <p class="sp-fine">${esc(S.disclosure)} Sources: ${S.sources.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`).join("; ")}.</p>
      </div>`, { label: `Spotlight: ${S.tool}: what it does` });
  }

  // Agenda
  add("agenda", `
    <div class="half-pat sm" style="background-image:url('${A}/assets/patterns/10-soundings-brand-dark.svg');background-size:calc(5 * var(--u)) auto"></div>
    <div class="half-plate"><span class="kick">Soundings · Boardroom</span>
    <h2 class="h">Your ${esc(monthName(E))} agenda</h2></div>
    <p class="lead">Six questions that this month's developments put on the table for boards, promoters and family offices.</p>
    <ol class="ag">${E.agenda.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
    <aside class="box"><b>Talk to us</b><p>Every situation is different. If any of these questions applies to you, our experts would be glad to talk it through. Write to <a href="mailto:advisory@kayaksa.com">advisory@kayaksa.com</a>.</p></aside>`, { label: `Your ${monthName(E)} agenda` });

  // Notice
  add("notice", `
    <span class="kick">Please read</span>
    <h2 class="h">Important notice</h2>
    ${NOTICE.full.map((p) => `<p>${esc(p)}</p>`).join("")}
    <p class="small">© 2026 Kayak Strategic Advisors Private Limited. Confluence may be shared in full with attribution.</p>`, { label: "Important notice" });

  // Back cover
  // Back cover, set like the outside back of a professional-services journal: the firm in one paragraph,
  // how to reach the experts, the practice and the solutions, a subscribe code, and the small print.
  add("backcover", `
    <div class="bk-band" style="background-image:url('${A}/assets/patterns/01-confluence-brand-dark.svg');background-size:calc(12 * var(--u)) auto"></div>
    <div class="bk2">
      <div class="bk2-head"><p class="bk-line">Consult rather than decide alone.</p>
        <p class="bk-sub">Every perspective in this issue fits the scenario we chose. Yours may differ, and that is where our experts come in.</p></div>
      <div class="bk2-grid">
        <div class="bk2-contact"><span class="bk2-l">Talk to our experts</span><a class="bk2-mail" href="mailto:advisory@kayaksa.com">advisory@kayaksa.com</a><p>www.kayaksa.com<br>Mumbai and Thane, Maharashtra, India</p></div>
        <div class="bk2-qr"><img src="${A}/assets/qr-insights.svg" alt="QR code for www.kayaksa.com/insights"><p><b>Subscribe to Confluence</b>Scan, or visit kayaksa.com/insights. Next issue: ${esc(nextIssue(E))}.</p></div>
      </div>
      <div class="bk2-cols">
        <div><span class="bk2-l">About Kayak</span><p>Kayak Strategic Advisors is an Indian advisory firm that helps boards, promoters, CFOs and family offices decide well on strategy, deals, regulation, risk and technology, with a desk for work across borders.</p></div>
        <div><span class="bk2-l">Our practice</span><ul><li>Strategy, Deal &amp; Transactions</li><li>Tax, Legal &amp; Regulatory</li><li>Crisis &amp; Resilience</li><li>Technology &amp; AI</li><li>Managed Services</li><li>International Desk</li></ul></div>
        <div><span class="bk2-l">Kayak Solutions</span><ul><li>NexaPair · third-party risk</li><li>SayUsNow · ethics and compliance</li><li>DocuVow · e-signatures</li><li>Kayak Learn · courses</li></ul></div>
      </div>
      <p class="bk2-fine">© ${esc(E.id.slice(0, 4))} Kayak Strategic Advisors Private Limited. All rights reserved. Kayak, Confluence and their identifiers are marks of Kayak Strategic Advisors Private Limited. This publication contains general information only, current as at the end of the period it covers. It is not legal, tax, accounting or investment advice, and it should not be relied on as a substitute for advice on your own facts. Kayak is not a law firm and does not practise law; legal advice is given by the client's advocates or independent law firms. Kayak is not registered with SEBI as an investment adviser or research analyst. Scenarios and the people and companies in them are fictional. No responsibility is accepted for any loss arising from action taken or not taken on the basis of this publication. Confluence may be shared in full with attribution.</p>
      <div class="bk2-foot"><span>Confluence · ${esc(E.issue)} · ${esc(E.month)} · KSA-CF-${esc(E.id)}</span><span class="bk2-sign">${WM}${MARK}</span></div>
    </div>`, { label: "Back cover", noFoot: true });

  const title = `Confluence, ${E.month}: ${E.coverTitle}`;
  const desc = `${E.coverDek} Covering ${E.period}.`;
  const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)} | Kayak Strategic Advisors</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${origin}/confluence/${E.id}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${origin}/assets/hero/cover-01-1024.webp"><meta property="og:type" content="article">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="${A}/_shared/fonts/Archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${A}/assets/magazine.css?v=3">${opts.preview ? `<meta name="robots" content="noindex,nofollow">` : ""}
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "PublicationIssue", name: title, issueNumber: "1", datePublished: E.published, description: desc, isPartOf: { "@type": "Periodical", name: "Confluence", publisher: { "@type": "Organization", name: "Kayak Strategic Advisors" } } }).replace(/</g, "\\u003c")}</script>
<script src="${A}/assets/magazine.js?v=3" defer></script></head>
<body>${opts.preview ? `<div class="preview-flag">PREVIEW · NOT RELEASED · awaiting approval</div>` : ""}<a class="skip" href="#book">Skip to the magazine</a>
<header class="mz-bar"><a class="mz-home" href="/insights" aria-label="Back to Confluence on kayaksa.com">${WM}</a><span class="mz-t"><b>Confluence</b> · ${esc(E.issue)} · ${esc(E.month)}</span>
  <nav class="mz-tools" aria-label="Magazine controls"><button type="button" data-act="contents">Contents</button><button type="button" data-act="mode" aria-pressed="false">Single page</button></nav></header>
<main id="book" class="book" tabindex="-1">${pages.join("\n")}</main>
<div class="mz-nav" hidden><button type="button" class="nb prev" data-act="prev" aria-label="Previous page">‹</button><span class="pos" aria-live="polite"></span><input type="range" class="seek" min="1" max="${pages.length}" value="1" aria-label="Go to page"><button type="button" class="nb next" data-act="next" aria-label="Next page">›</button></div>
<noscript><p class="nojs">You are reading the text version of Confluence. Turn on JavaScript to read it as a magazine.</p></noscript>
</body></html>`;
  return { html, title };
}
