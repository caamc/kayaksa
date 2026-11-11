import { api, html, raw, ico, identifier } from "/_shared/js/ui.js";

const TILES = [
  ["brand", "brand", "Brand Portal", "Logos, colours, fonts, the brand manual, templates, the Office toolbar and icon libraries."],
  ["tools", "tools", "Kayak Tools", "NexaPair, SayUsNow, SeeCounter, DocuVow and our internal studio tools in one place."],
  ["network", "network", "Kayak Network", "Our partners, associate firms and subject experts, searchable by sector and service."],
  ["ai", "spark", "Kayak AI", "Draft, research and review with Claude, GPT/Codex or Grok, in Kayak's voice."],
  ["cards", "card", "Business Cards", "Describe the card you need and get a brand-correct design in SVG, PDF, PNG and JPG."],
  ["decks", "slides", "Presentations", "Sector- and service-specific decks in the Kayak master, ready for PowerPoint."],
  ["learn", "learn", "Kayak Learn", "Induction, ethics, compliance, risk, governance and AI courses with certificates."],
];

export async function render(main, { me }) {
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (me.name || "").split(" ")[0];
  const [progress, stats] = await Promise.all([api("/api/learn/me").catch(() => null), me.can.admin ? api("/api/admin/stats").catch(() => null) : null]);
  const certs = progress?.certificates?.length || 0;
  main.innerHTML = String(html`<div class="page">
    <section class="hero">
      <div class="stack" style="max-width:680px;position:relative;z-index:1">
        <span class="eyebrow" style="color:#F5C46D">${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</span>
        <h1>${greet}${first ? `, ${first}` : ""}.</h1>
        <p class="serif" style="font-size:1.12rem">Clear advice for consequential decisions. Everything you need to do that, in Kayak's own brand, is here.</p>
        <div class="row"><a class="btn btn-saffron" href="#/ai">${ico("spark")} Ask Kayak AI</a><a class="btn btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" href="#/brand">${ico("brand")} Brand Portal</a></div>
      </div>
      <div class="mark">${identifier(260)}</div>
    </section>
    ${stats ? html`<section class="grid">
      <div class="card flat kpi"><b>${stats.users}</b><span>People with access</span></div>
      <div class="card flat kpi"><b>${stats.invited}</b><span>Invitations pending</span></div>
      <div class="card flat kpi"><b>${stats.partners}</b><span>Partners in the network</span></div>
      <div class="card flat kpi"><b>${stats.certificates}</b><span>Certificates issued</span></div>
    </section>` : ""}
    <section class="stack">
      <div class="row between"><h2>Your workspace</h2></div>
      <div class="tiles">${TILES.map(([id, i, t, d]) => html`<a class="tile" href="#/${id}"><span class="tile-ico">${ico(i)}</span><h3>${t}</h3><p>${d}</p></a>`)}</div>
    </section>
    <section class="grid wide">
      <div class="card stack-sm"><span class="eyebrow">Kayak Learn</span><h3>${certs ? `${certs} certificate${certs === 1 ? "" : "s"} earned` : "Start with the Kayak induction"}</h3><p class="muted">${certs ? "Keep going with the next course in your learning path." : "Six short courses: who we are, how we work, confidentiality, independence and conflicts, information security and the Kayak brand."}</p><a class="textlink" href="#/learn">Open Kayak Learn ${ico("arrow")}</a></div>
      <div class="card stack-sm"><span class="eyebrow">Security</span><h3>Your account is protected</h3><p class="muted">Two-factor authentication is on. Keep your recovery codes safe and sign out on shared devices.</p><a href="#/account">Manage my account ${ico("arrow")}</a></div>
    </section>
  </div>`);
}
