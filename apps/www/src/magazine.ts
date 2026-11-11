// Confluence, the magazine reader. The server renders every page as plain, readable HTML (for search
// engines, screen readers and anyone without JavaScript); /assets/magazine.js turns the pages into a
// book with turning pages.
import { EDITION, NOTICE, type Story, type Edition } from "../content/editions/2026-11";
export type { Edition };

/** Issues built into the code. Later issues are drafted in the internal portal and stored in D1. */
export const BUILT_IN: Record<string, Edition> = { [EDITION.id]: EDITION };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const COLOR: Record<Story["section"], string> = { Regulatory: "#9C630E", Financial: "#2D6A9F", Deals: "#17807E", Business: "#5E4B78", Technology: "#0B5654" };

const WM = `<svg class="wm" viewBox="0 0 416 100" aria-hidden="true"><g fill="currentColor"><path d="M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z"/><path transform="translate(92 0)" d="M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z"/><path transform="translate(161 0)" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/><path transform="translate(232 0)" d="M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z"/><path transform="translate(332 0)" d="M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z"/></g><path transform="translate(161 0)" fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path transform="translate(161 0)" fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/></svg>`;
const MARK = `<svg class="mk" viewBox="-4 -4 100 108" aria-hidden="true"><path fill="#17807E" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="currentColor" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></svg>`;

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
    <span class="kick">From the editor</span>
    <h2 class="h">${esc(E.editorsTitle)}</h2>
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
      ${E.spotlight ? `<li style="--c:#EE9B1E"><a data-go="${spotPage}" href="#p${spotPage}"><em>Spotlight</em><span>${esc(E.spotlight.tool)}</span><i>${spotPage}</i></a></li>` : ""}
      <li><a data-go="${agendaPage}" href="#p${agendaPage}"><em>Boardroom</em><span>Your ${esc(monthName(E))} agenda</span><i>${agendaPage}</i></a></li>
      <li><a data-go="${agendaPage + 1}" href="#p${agendaPage + 1}"><span>Important notice</span><i>${agendaPage + 1}</i></a></li>
    </ol>`, { label: "Contents" });

  // 4 Numbers
  add("nums", `
    <span class="kick">The month in numbers</span>
    <h2 class="h">${esc(E.periodShort)}</h2>
    <div class="ngrid">${E.numbers.map(([n, t, ic, cmp]) => `<div>${ic && /^[a-z-]+$/.test(ic) ? `<img class="nic" src="${A}/assets/icons/ksa/ksa-icon-${ic}.svg" alt="">` : ""}<b>${esc(n)}</b><span>${esc(t)}</span>${cmp ? `<p class="cmp ${cmp.dir || ""}">${cmp.was ? `<s>${esc(cmp.was)}</s><i aria-hidden="true"></i><em>${esc(n)}</em><br>` : cmp.dir ? `<i aria-hidden="true"></i>` : ""}${esc(cmp.note)}</p>` : ""}</div>`).join("")}</div>
    <p class="fn">Figures and comparisons as reported in the sources cited on each story's page.</p>`, { label: "The month in numbers" });

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
      <div class="st-img" style="background-image:url('${A}/assets/hero/${s.image || "boardroom"}-960.webp')"><span class="tint"></span><span class="sec">${esc(s.section)} · ${esc(s.kicker)}</span></div>
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
      <div class="qs"><span class="tab"><b>?</b>Questions a board might ask</span><ol>${s.questions.map((q, i) => `<li><i>${String(i + 1).padStart(2, "0")}</i><span>${esc(q)}</span></li>`).join("")}</ol></div>
      ${s.postscript ? `<p class="ps"><b>Postscript.</b> ${esc(s.postscript)}</p>` : ""}
      <aside class="caveat"><p>${esc(NOTICE.short)}</p></aside>
      <p class="src fn"><b>Sources</b> ${s.sources.map(([t, u], i) => `<span><sup>${i + 1}</sup> <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a></span>`).join(" ")}</p>`, { label: `${s.title}: Kayak's perspective`, style: `--c:${c}` });
  }

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
    <span class="kick">Boardroom</span>
    <h2 class="h">Your ${esc(monthName(E))} agenda</h2>
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
  add("backcover", `
    <div class="bk">${MARK}
      <p class="bk-line">Consult rather than decide alone.</p>
      <p class="bk-sub">For more details on anything in Confluence, or to discuss your own situation with our experts:</p>
      <p class="bk-mail"><a href="mailto:advisory@kayaksa.com">advisory@kayaksa.com</a></p>
      <p class="bk-next">Next issue<b>${esc(nextIssue(E))}</b>Subscribe at www.kayaksa.com/insights</p>
      <ul class="bk-cl"><li>Strategy, Deal &amp; Transactions</li><li>Tax, Legal &amp; Regulatory</li><li>Crisis &amp; Resilience</li><li>Technology &amp; AI</li><li>Managed Services</li><li>International Desk</li></ul>
      <div class="bk-foot">${WM}<span>www.kayaksa.com · Mumbai and Thane</span></div></div>`, { label: "Back cover", noFoot: true });

  const title = `Confluence, ${E.month}: ${E.coverTitle}`;
  const desc = `${E.coverDek} Covering ${E.period}.`;
  const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)} | Kayak Strategic Advisors</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${origin}/confluence/${E.id}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${origin}/assets/hero/cover-01-1024.webp"><meta property="og:type" content="article">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="${A}/_shared/fonts/Archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${A}/assets/magazine.css?v=2">${opts.preview ? `<meta name="robots" content="noindex,nofollow">` : ""}
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "PublicationIssue", name: title, issueNumber: "1", datePublished: E.published, description: desc, isPartOf: { "@type": "Periodical", name: "Confluence", publisher: { "@type": "Organization", name: "Kayak Strategic Advisors" } } }).replace(/</g, "\\u003c")}</script>
<script src="${A}/assets/magazine.js?v=2" defer></script></head>
<body>${opts.preview ? `<div class="preview-flag">PREVIEW · NOT RELEASED · awaiting approval</div>` : ""}<a class="skip" href="#book">Skip to the magazine</a>
<header class="mz-bar"><a class="mz-home" href="/insights" aria-label="Back to Confluence on kayaksa.com">${WM}</a><span class="mz-t"><b>Confluence</b> · ${esc(E.issue)} · ${esc(E.month)}</span>
  <nav class="mz-tools" aria-label="Magazine controls"><button type="button" data-act="contents">Contents</button><button type="button" data-act="mode" aria-pressed="false">Single page</button></nav></header>
<main id="book" class="book" tabindex="-1">${pages.join("\n")}</main>
<div class="mz-nav" hidden><button type="button" class="nb prev" data-act="prev" aria-label="Previous page">‹</button><span class="pos" aria-live="polite"></span><input type="range" class="seek" min="1" max="${pages.length}" value="1" aria-label="Go to page"><button type="button" class="nb next" data-act="next" aria-label="Next page">›</button></div>
<noscript><p class="nojs">You are reading the text version of Confluence. Turn on JavaScript to read it as a magazine.</p></noscript>
</body></html>`;
  return { html, title };
}
