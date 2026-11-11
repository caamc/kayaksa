import { api, esc, ico, toast, confirmDialog, fmtDateTime } from "/_shared/js/ui.js";

// Briefing & Capability Studio and the Kayak Benchmark Tool. Kayak AI researches the sector and the
// client from public sources, finds why-now news for the proposed service, writes Kayak's capability
// and illustrative scenarios, and lays it all out in the chosen brand, ready to print as a PDF.
const BRANDS = {
  ksa: { name: "Kayak Strategic Advisors", logo: "/app/logos/kayak-logo.svg", c: "#17807E", pat: "09-current-brand-dark" },
  group: { name: "Kayak Group", logo: "/app/logos/kayak-group-reversed.svg", c: "#0E2F3C", pat: "04-monogram-canvas-brand-dark", dark: true },
  innovations: { name: "Kayak Innovations", logo: "/app/logos/kayak-innovations.svg", c: "#EE9B1E", pat: "01-confluence-brand-dark" },
  technology: { name: "Kayak Technology Solutions", logo: "/app/logos/kayak-technology-solutions.svg", c: "#2D6A9F", pat: "11-chart-contours-brand-dark" },
  nexapair: { name: "NexaPair", logo: "/app/logos/nexapair-horizontal.svg", c: "#0BA3AA", pat: "02-paddle-rhythm-brand-dark" },
  sayusnow: { name: "SayUsNow", logo: "/app/logos/sayusnow-horizontal.svg", c: "#5E4B78", pat: "10-soundings-brand-dark" },
  docuvow: { name: "DocuVow", logo: "/app/logos/docuvow-horizontal.svg", c: "#9C630E", pat: "03-delta-brand-dark" },
};
const STEPN = { sector: "Sector research", client: "Client briefing", news: "Why now: news for this service", capability: "Kayak's capability", cases: "Illustrative scenarios", peers: "Choose peers", metrics: "Benchmark the metrics" };

export async function render(main, { rest, me }) {
  if (rest[0]) return detail(main, rest[0], me);
  const [{ briefs }, meta] = await Promise.all([api("/api/briefs"), api("/api/briefs/meta")]);
  const groups = [...new Set(meta.capabilities.map((c) => c.group))];
  main.innerHTML = `<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Studio · Kayak AI</span><h1>Briefing & Capability Studio</h1><p class="lead">Name the client and the service. Kayak AI researches the sector (IBEF, Statista, MeitY, regulators, industry bodies), builds a sourced briefing on the client, finds why-now news among its peers, and writes Kayak's capability with illustrative scenarios, in the brand you choose.</p></div></div>
    ${meta.ai ? "" : `<div class="note warn">Claude is not configured, so research cannot run yet. Add ANTHROPIC_API_KEY in GitHub.</div>`}
    <form class="card stack" id="f">
      <div class="seg" role="radiogroup" aria-label="What to make"><button type="button" data-k="briefing" aria-pressed="true">Client briefing and capability document</button><button type="button" data-k="benchmark" aria-pressed="false">Benchmark report</button></div>
      <div class="dgrid">
        <div class="field s6"><label for="client">Client name</label><input class="input" id="client" name="client" required placeholder="For example: Tata Power"></div>
        <div class="field s6"><label for="industry">Industry</label><input class="input" id="industry" name="industry" placeholder="For example: power generation and distribution"></div>
        <div class="field s6 kb"><label for="service">Capability needed</label><select class="input" id="service" name="service"><option value="">Choose a cluster, service or Kayak solution</option>${groups.map((g) => `<optgroup label="${esc(g)}">${meta.capabilities.filter((c) => c.group === g).map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</optgroup>`).join("")}</select></div>
        <div class="field s6"><label for="brand">Brand</label><select class="input" id="brand" name="brand">${Object.entries(BRANDS).map(([k, b]) => `<option value="${k}">${esc(b.name)}</option>`).join("")}</select></div>
        <div class="field s12 kb"><label for="details">What you know (optional)</label><textarea class="input" id="details" name="details" rows="2" placeholder="Context from the meeting, the decision they face, who will read this"></textarea></div>
        <div class="field s6 km" hidden><label for="peers">Peers (optional)</label><input class="input" id="peers" name="peers" placeholder="Comma-separated; leave blank to let Kayak AI choose"></div>
        <div class="field s6 km" hidden><label for="metrics">Metrics (optional)</label><input class="input" id="metrics" name="metrics" placeholder="Revenue, growth, EBITDA margin, employees"></div>
      </div>
      <div class="row"><button class="btn btn-primary" type="submit" ${meta.ai ? "" : "disabled"}>${ico("spark")} Start the research</button><span class="small muted">Takes three to six minutes. Every fact carries its source.</span></div>
    </form>
    <section class="stack-sm"><h2 style="font-size:1.05rem">Recent documents</h2>${briefs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Type</th><th>Brand</th><th>Status</th><th>By</th><th>Updated</th></tr></thead><tbody>${briefs.map((b) => `<tr><td><a href="#/briefs/${esc(b.id)}"><b>${esc(b.client)}</b></a><br><span class="small muted">${esc(b.industry || "")}</span></td><td>${b.kind === "benchmark" ? "Benchmark" : "Briefing"}</td><td>${esc(BRANDS[b.brand]?.name || b.brand)}</td><td><span class="badge ${b.status === "ready" ? "ok" : "warn"}">${esc(b.status)}</span></td><td class="small">${esc(b.created_by || "")}</td><td class="small">${fmtDateTime(b.updated_at)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">Nothing yet.</p>`}</section></div>`;
  let kind = "briefing";
  main.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { kind = b.dataset.k; main.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); main.querySelectorAll(".km").forEach((x) => (x.hidden = kind !== "benchmark")); main.querySelectorAll(".kb").forEach((x) => (x.hidden = kind === "benchmark")); }));
  main.querySelector("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    if (!v.client) return toast("Name the client.", "err");
    if (kind === "briefing" && !v.service) return toast("Choose the capability needed.", "err");
    try { const r = await api("/api/briefs", { body: { ...v, kind } }); location.hash = `#/briefs/${r.id}`; } catch (err) { toast(err.message, "err"); }
  });
}

async function detail(main, id, me) {
  let r = await api(`/api/briefs/${id}`);
  const run = async () => {
    for (;;) {
      const left = r.steps.filter((s) => !r.data.done.includes(s));
      if (!left.length) break;
      paint(left[0]);
      try { await api(`/api/briefs/${id}/step`, { method: "POST" }); } catch (e) { paint(null, e.message); return; }
      r = await api(`/api/briefs/${id}`);
    }
    paint();
  };
  const paint = (running, error) => {
    const b = BRANDS[r.brand] || BRANDS.ksa;
    const ready = r.steps.every((s) => r.data.done.includes(s));
    main.innerHTML = `<div class="page">
      <div class="noprint"><a class="small" href="#/briefs">${ico("chevron")} Briefing & Capability Studio</a>
      <div class="row between wrap-row"><h1 style="font-size:1.4rem">${esc(r.client)} · ${r.kind === "benchmark" ? "Benchmark" : "Briefing and capability"}</h1>
        <div class="row wrap-row"><select class="input" id="brand" aria-label="Brand">${Object.entries(BRANDS).map(([k, x]) => `<option value="${k}" ${k === r.brand ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
        ${ready ? `<button class="btn btn-primary" id="print">${ico("download")} Save as PDF</button><button class="btn btn-ghost" id="html">${ico("download")} HTML</button>` : ""}<button class="btn btn-quiet" id="del">${ico("trash")}</button></div></div>
      <ol class="steps-plain">${r.steps.map((s) => `<li>${r.data.done.includes(s) ? "✓" : s === running ? '<span class="spinner"></span>' : "·"} ${esc(STEPN[s])}</li>`).join("")}</ol>
      ${error ? `<div class="note danger">${esc(error)} <button class="btn btn-ghost btn-sm" id="retry">Run it again</button></div>` : ""}</div>
      <div class="doc" id="doc" style="--bc:${b.c}">${r.kind === "benchmark" ? benchmarkDoc(r, b) : briefingDoc(r, b)}</div></div>`;
    main.querySelector("#retry")?.addEventListener("click", run);
    main.querySelector("#brand").onchange = async (e) => { await api(`/api/briefs/${id}/brand`, { body: { brand: e.target.value } }); r.brand = e.target.value; paint(running, error); };
    main.querySelector("#print")?.addEventListener("click", () => window.print());
    main.querySelector("#html")?.addEventListener("click", () => { const css = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((x) => x.cssText); } catch { return []; } }).filter((t) => /\.doc|:root/.test(t)).join("\n"); const html = `<!doctype html><meta charset="utf-8"><title>${esc(r.client)}</title><style>${css}</style>${main.querySelector("#doc").outerHTML.replace(/src="\//g, `src="${location.origin}/`)}`; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = `${r.client} - Kayak.html`; a.click(); });
    main.querySelector("#del").onclick = async () => { if (await confirmDialog("Delete this document?", "The research will be lost.", "Delete", true)) { await api(`/api/briefs/${id}/delete`, { body: {} }); location.hash = "#/briefs"; } };
  };
  if (r.steps.some((s) => !r.data.done.includes(s))) run(); else paint();
}

const src = (s, u) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(s || "source")}</a>` : esc(s || ""));
const cover = (r, b, kicker, title, sub) => `<section class="dp cover" style="--pt:url('/app/patterns/${b.pat}.svg')"><div class="dc-logo ${b.dark ? "dark" : ""}"><img src="${b.logo}" alt="${esc(b.name)}"></div><div class="dc-band"><span class="dk">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="dc-meta"><span>Prepared ${new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span><span>Confidential · prepared for discussion</span></div></section>`;
const notice = `<p class="dfine">Prepared by ${"Kayak Strategic Advisors"} from public sources, each cited. Figures are as reported by those sources and have not been audited by Kayak. Illustrative scenarios use fictional companies and are not past engagements. This document is for discussion and is not legal, tax or investment advice.</p>`;

function briefingDoc(r, b) {
  const d = r.data, cap = r.capability;
  const parts = [cover(r, b, "Client briefing and capability", r.client, `${r.industry || d.sector?.title || ""}${cap ? ` · ${cap.name}` : ""}`)];
  if (d.sector) parts.push(`<section class="dp"><span class="dk">01 · The sector</span><h2>${esc(d.sector.title)}</h2><p class="dlead">${esc(d.sector.overview)}</p>
    <div class="dstats">${(d.sector.facts || []).slice(0, 8).map((f) => `<div><b>${esc(f.value)}</b><span>${esc(f.metric)}${f.period ? `, ${esc(f.period)}` : ""}</span><small>${src(f.source, f.url)}</small></div>`).join("")}</div>
    <div class="dcols"><div><h3>Growth drivers</h3><ul>${(d.sector.drivers || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h3>Risks to watch</h3><ul>${(d.sector.risks || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
    <h3>Regulation that shapes it</h3><div class="dreg">${(d.sector.regulation || []).map((x) => `<div><b>${esc(x.name)}</b><span>${esc(x.what)}</span>${x.url ? `<small>${src("source", x.url)}</small>` : ""}</div>`).join("")}</div>
    <p class="dquote"><span class="qo">❝</span>${esc(d.sector.outlook || "")}</p></section>`);
  if (d.client) parts.push(`<section class="dp"><span class="dk">02 · The client</span><h2>${esc(r.client)}</h2><p class="dlead">${esc(d.client.overview)}</p>
    <table class="dtable"><tbody>${(d.client.facts || []).map((f) => `<tr><th>${esc(f.label)}</th><td>${esc(f.value)}</td><td class="s">${src(f.source, f.url)}</td></tr>`).join("")}</tbody></table>
    <div class="dcols"><div><h3>Recent news</h3><ul class="dnews">${(d.client.news || []).map((n) => `<li><time>${esc(n.date)}</time> ${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.headline)}</a>` : esc(n.headline)}</li>`).join("")}</ul></div>
    <div><h3>What the board is likely weighing</h3><ol class="dnum">${(d.client.themes || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>${(d.client.leadership || []).length ? `<h3>Leadership, public roles</h3><ul>${d.client.leadership.map((l) => `<li>${esc(l.name)}, ${esc(l.role)}</li>`).join("")}</ul>` : ""}</div></div></section>`);
  if (d.news) parts.push(`<section class="dp dark" style="--pt:url('/app/patterns/${b.pat}.svg')"><span class="dk">03 · Why now</span><h2>${esc(d.news.headline)}</h2>
    <div class="dtimeline">${(d.news.items || []).map((n) => `<div><time>${esc(n.date)}</time><b>${esc(n.company)}</b><span>${esc(n.what)}</span><em>${esc(n.relevance)}</em>${n.url ? `<small>${src("source", n.url)}</small>` : ""}</div>`).join("")}</div>
    <p class="dlead">${esc(d.news.takeaway)}</p></section>`);
  if (d.capability) parts.push(`<section class="dp"><span class="dk">04 · How ${esc(b.name)} would help</span><h2>${esc(d.capability.title)}</h2><p class="dlead">${esc(d.capability.promise)}</p>
    <div class="dphases">${(d.capability.approach || []).map((p, i) => `<div><i>${String(i + 1).padStart(2, "0")}</i><b>${esc(p.phase)}</b><span>${esc(p.what)}</span><small>${esc(p.weeks)}</small></div>`).join("")}</div>
    <div class="dcols"><div><h3>What you receive</h3><ul class="dtick">${(d.capability.deliverables || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h3>Who does the work</h3><p>${esc(d.capability.team)}</p></div>
    <div><h3>Why Kayak</h3><ul>${(d.capability.why_kayak || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h3>Questions for our first meeting</h3><ol class="dnum">${(d.capability.questions || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div></div></section>`);
  if (d.cases) parts.push(`<section class="dp"><span class="dk">05 · Illustrative scenarios</span><h2>What it looks like in practice</h2><div class="dcases">${(Array.isArray(d.cases) ? d.cases : []).map((c, i) => `<article><span class="dlabel">${esc(c.label || "Illustrative scenario, not a past engagement")}</span><h3>${esc(c.title)}</h3><p class="small"><b>${esc(c.company)}</b>. ${esc(c.situation)}</p><ol>${(c.what_we_would_do || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol><div class="dkpis">${(c.what_good_looks_like || []).map((k) => `<div><b>${esc(k.value)}</b><span>${esc(k.label)}</span></div>`).join("")}</div></article>`).join("")}</div></section>`);
  parts.push(`<section class="dp end"><div class="dc-logo ${b.dark ? "dark" : ""}"><img src="${b.logo}" alt="${esc(b.name)}"></div><h2>Let's talk it through</h2><p>advisory@kayaksa.com · www.kayaksa.com · Mumbai and Thane</p>${notice}</section>`);
  return parts.join("");
}

function benchmarkDoc(r, b) {
  const d = r.data, M = d.metrics;
  const parts = [cover(r, b, "Benchmark report", r.client, `Against ${(d.peers?.peers || []).map((p) => p.name).join(", ") || "selected peers"}${M?.period ? ` · ${M.period}` : ""}`)];
  if (d.peers) parts.push(`<section class="dp"><span class="dk">01 · The peer set</span><h2>Who we compared ${esc(r.client)} with, and why</h2><div class="dreg">${d.peers.peers.map((p) => `<div><b>${esc(p.name)}</b><span>${esc(p.why)}</span>${p.url ? `<small>${src("source", p.url)}</small>` : ""}</div>`).join("")}</div></section>`);
  if (M) {
    parts.push(`<section class="dp"><span class="dk">02 · The numbers</span><h2>${esc(r.client)} against its peers</h2>${(M.metrics || []).map((m, mi) => {
      const rows = (m.rows || []).filter((x) => x.value != null);
      const max = Math.max(...rows.map((x) => Math.abs(x.value)), 1);
      return `<figure class="dex"><span class="exn">Exhibit ${mi + 1}</span><h3>${esc(m.name)}</h3><p class="small">${esc(m.unit || "")}${M.period ? `, ${esc(M.period)}` : ""}${m.higher_is_better === false ? " · lower is better" : ""}</p>
        <ul class="kc-bars">${(m.rows || []).map((x, i) => `<li><span class="lb">${esc(x.company)}</span><span class="tr">${x.value != null ? `<i style="width:${Math.max(1.5, (Math.abs(x.value) / max) * 100)}%;background:${i === 0 ? "#EE9B1E" : "#17807E"}"></i>` : ""}</span><b>${x.value != null ? esc(x.display || x.value) : "n/a"}</b></li>`).join("")}</ul>
        <figcaption>Sources: ${(m.rows || []).filter((x) => x.url).map((x) => src(x.source || x.company, x.url)).join("; ") || "as listed"}; KSA analysis.</figcaption></figure>`;
    }).join("")}</section>`);
    parts.push(`<section class="dp"><span class="dk">03 · What stands out</span><ol class="dnum big">${(M.observations || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>${(M.caveats || []).length ? `<h3>Caveats</h3><ul>${M.caveats.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${notice}</section>`);
  }
  return parts.join("");
}
