// Confluence, the magazine reader. The server renders every page as plain, readable HTML (for search
// engines, screen readers and anyone without JavaScript); /assets/magazine.js turns the pages into a
// book with turning pages.
import { EDITION, NOTICE, type Story } from "../content/editions/2026-11";

export const EDITIONS: Record<string, typeof EDITION> = { [EDITION.id]: EDITION };
export const LATEST = EDITION.id;

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const COLOR: Record<Story["section"], string> = { Regulatory: "#9C630E", Financial: "#2D6A9F", Deals: "#17807E", Business: "#5E4B78", Technology: "#0B5654" };

const WM = `<svg class="wm" viewBox="0 0 416 100" aria-hidden="true"><g fill="currentColor"><path d="M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z"/><path transform="translate(92 0)" d="M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z"/><path transform="translate(161 0)" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/><path transform="translate(232 0)" d="M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z"/><path transform="translate(332 0)" d="M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z"/></g><path transform="translate(161 0)" fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path transform="translate(161 0)" fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/></svg>`;
const MARK = `<svg class="mk" viewBox="-4 -4 100 108" aria-hidden="true"><path fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="currentColor" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></svg>`;

export function magazinePage(id: string, origin: string): { html: string; title: string } | null {
  const E = EDITIONS[id];
  if (!E) return null;
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
  const agendaPage = first + E.stories.length * 2;

  // 1 Cover
  add("cover", `
    <img class="cv-img" src="/assets/hero/cover-01-1024.webp" alt="" fetchpriority="high">
    <div class="cv-tint"></div>
    <div class="cv-top">${WM}<span>A Kayak Strategic Advisors publication</span></div>
    <h1 class="cv-mast">CONFLUENCE</h1>
    <div class="cv-issue"><span>${esc(E.issue)}</span><span>${esc(E.month)}</span><span>Covering ${esc(E.periodShort)}</span></div>
    <div class="cv-main"><span class="cv-kick">Cover story</span><h2>${esc(E.coverTitle)}</h2><p>${esc(E.coverDek)}</p></div>
    <ul class="cv-lines">${E.coverLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    ${MARK}`, { label: "Cover", noFoot: true });

  // 2 Editor's note
  add("note", `
    <span class="kick">From the editor</span>
    <h2 class="h">Two currents, one month</h2>
    ${E.editorsNote.map((p, i) => `<p class="${i ? "" : "lead"}">${esc(p)}</p>`).join("")}
    <p class="sig">The Confluence desk<br><span>Kayak Strategic Advisors, Mumbai</span></p>
    <aside class="box"><b>How to read Kayak's perspective</b><p>${esc(NOTICE.short)}</p></aside>`, { label: "From the editor" });

  // 3 Contents
  add("toc", `
    <span class="kick">In this issue</span>
    <h2 class="h">Contents</h2>
    <p class="period">News and decisions from ${esc(E.period)}</p>
    <ol class="toc-list">
      <li><a data-go="4" href="#p4"><span>The month in numbers</span><i>4</i></a></li>
      <li><a data-go="5" href="#p5"><span>The Relativity Index: our cast</span><i>5</i></a></li>
      ${E.stories.map((s, i) => `<li style="--c:${COLOR[s.section]}"><a data-go="${storyPage(i)}" href="#p${storyPage(i)}"><em>${esc(s.section)}</em><span>${esc(s.title)}</span><i>${storyPage(i)}</i></a></li>`).join("")}
      <li><a data-go="${agendaPage}" href="#p${agendaPage}"><em>Boardroom</em><span>Your November agenda</span><i>${agendaPage}</i></a></li>
      <li><a data-go="${agendaPage + 1}" href="#p${agendaPage + 1}"><span>Important notice</span><i>${agendaPage + 1}</i></a></li>
    </ol>`, { label: "Contents" });

  // 4 Numbers
  add("nums", `
    <span class="kick">The month in numbers</span>
    <h2 class="h">${esc(E.periodShort)}</h2>
    <div class="ngrid">${E.numbers.map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join("")}</div>
    <p class="small">Figures as reported in the sources cited on each story's page.</p>`, { label: "The month in numbers" });

  // 5 Relativity Index
  add("cast", `
    <span class="kick">The Relativity Index</span>
    <h2 class="h">Meet the people in our scenarios</h2>
    <p>Every Kayak perspective in Confluence is built around a scenario. To make each one easy to follow, we use the same fictional cast and fictional companies. They help you see how an idea works in a particular situation, and how it might not.</p>
    <dl class="castlist">${E.cast.map(([n, r]) => `<div><dt>${esc(n)}</dt><dd>${esc(r)}</dd></div>`).join("")}<div><dt>A, B, C</dt><dd>Fictional companies, listed or unlisted</dd></div><div><dt>P, Q, R</dt><dd>Fictional funds, start-ups and counterparties</dd></div></dl>
    <aside class="box"><p>All people and companies in our scenarios are fictional, and any resemblance to real persons or entities is coincidental. A perspective that fits one scenario should not be applied universally to every scenario.</p></aside>`, { label: "The Relativity Index" });

  // Stories: a spread each
  for (const s of E.stories) {
    const c = COLOR[s.section];
    add("story-l", `
      <div class="st-img" style="background-image:url('/assets/hero/${s.image || "boardroom"}-960.webp')"><span class="tint"></span><span class="sec">${esc(s.section)} · ${esc(s.kicker)}</span></div>
      <h2 class="st-h">${esc(s.title)}</h2>
      <p class="st-dek">${esc(s.dek)}</p>
      <h3 class="lbl">What happened</h3>
      <ul class="facts">${s.facts.map((f) => `<li><time>${esc(f.date)}</time><span>${esc(f.text)}</span></li>`).join("")}</ul>
      ${s.numbers ? `<div class="mini">${s.numbers.map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join("")}</div>` : ""}
      <h3 class="lbl">Why it matters</h3>
      ${s.matters.map((m) => `<p>${esc(m)}</p>`).join("")}`, { label: s.title, style: `--c:${c}` });
    add("story-r", `
      <span class="kick" style="color:${c}">Kayak's perspective</span>
      <div class="ri"><b>Relativity Index</b>${s.cast.map(([n, r]) => `<span><em>${esc(n)}</em> ${esc(r)}</span>`).join("")}</div>
      <h3 class="lbl">The scenario</h3>
      ${s.scenario.map((p) => `<p class="scn">${esc(p)}</p>`).join("")}
      <h3 class="lbl">Our perspective</h3>
      ${s.perspective.map((p) => `<p>${esc(p)}</p>`).join("")}
      <div class="qs"><b>Questions a board might ask</b><ul>${s.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul></div>
      ${s.postscript ? `<p class="ps"><b>Postscript.</b> ${esc(s.postscript)}</p>` : ""}
      <aside class="caveat"><p>${esc(NOTICE.short)}</p></aside>
      <p class="src"><b>Sources:</b> ${s.sources.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`).join("; ")}</p>`, { label: `${s.title}: Kayak's perspective`, style: `--c:${c}` });
  }

  // Agenda
  add("agenda", `
    <span class="kick">Boardroom</span>
    <h2 class="h">Your November agenda</h2>
    <p class="lead">Six questions that this month's developments put on the table for boards, promoters and family offices.</p>
    <ol class="ag">${E.agenda.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
    <aside class="box"><b>Talk to us</b><p>Every situation is different. If any of these questions applies to you, our experts would be glad to talk it through. Write to <a href="mailto:advisory@kayaksa.com">advisory@kayaksa.com</a>.</p></aside>`, { label: "Your November agenda" });

  // Notice
  add("notice", `
    <span class="kick">Please read</span>
    <h2 class="h">Important notice</h2>
    ${NOTICE.full.map((p) => `<p>${esc(p)}</p>`).join("")}
    <p class="small">© 2026 Kayak Strategic Advisors Private Limited. Confluence may be shared in full with attribution.</p>`, { label: "Important notice" });

  // Back cover
  add("backcover", `
    <div class="bk">${MARK}
      <p class="bk-line">Consult rather than decide alone.</p>
      <p class="bk-sub">For more details on anything in Confluence, or to discuss your own situation with our experts:</p>
      <p class="bk-mail"><a href="mailto:advisory@kayaksa.com">advisory@kayaksa.com</a></p>
      <p class="bk-next">Next issue<b>December 2026, covering 25 October – 25 November</b>Subscribe at www.kayaksa.com/insights</p>
      <ul class="bk-cl"><li>Strategy, Deal &amp; Transactions</li><li>Tax, Legal &amp; Regulatory</li><li>Crisis &amp; Resilience</li><li>Technology &amp; AI</li><li>Managed Services</li><li>International Desk</li></ul>
      <div class="bk-foot">${WM}<span>www.kayaksa.com · Mumbai and Thane</span></div></div>`, { label: "Back cover", noFoot: true });

  const title = `Confluence, ${E.month}: ${E.coverTitle}`;
  const desc = `${E.coverDek} Covering ${E.period}.`;
  const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)} | Kayak Strategic Advisors</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${origin}/confluence/${E.id}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${origin}/assets/hero/cover-01-1024.webp"><meta property="og:type" content="article">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="/_shared/fonts/Archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/magazine.css?v=1">
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "PublicationIssue", name: title, issueNumber: "1", datePublished: E.published, description: desc, isPartOf: { "@type": "Periodical", name: "Confluence", publisher: { "@type": "Organization", name: "Kayak Strategic Advisors" } } }).replace(/</g, "\\u003c")}</script>
<script src="/assets/magazine.js?v=1" defer></script></head>
<body><a class="skip" href="#book">Skip to the magazine</a>
<header class="mz-bar"><a class="mz-home" href="/insights" aria-label="Back to Confluence on kayaksa.com">${WM}</a><span class="mz-t"><b>Confluence</b> · ${esc(E.issue)} · ${esc(E.month)}</span>
  <nav class="mz-tools" aria-label="Magazine controls"><button type="button" data-act="contents">Contents</button><button type="button" data-act="mode" aria-pressed="false">Single page</button></nav></header>
<main id="book" class="book" tabindex="-1">${pages.join("\n")}</main>
<div class="mz-nav" hidden><button type="button" class="nb prev" data-act="prev" aria-label="Previous page">‹</button><span class="pos" aria-live="polite"></span><input type="range" class="seek" min="1" max="${pages.length}" value="1" aria-label="Go to page"><button type="button" class="nb next" data-act="next" aria-label="Next page">›</button></div>
<noscript><p class="nojs">You are reading the text version of Confluence. Turn on JavaScript to read it as a magazine.</p></noscript>
</body></html>`;
  return { html, title };
}
