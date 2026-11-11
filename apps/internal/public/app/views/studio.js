import { api, esc, ico, toast } from "/_shared/js/ui.js";

// Kayak Studio: the creative home. A calm, encouraging space with the creative tools, a prompt for
// the day, a focus timer and the idea wall where anyone can post and upvote ideas.
const LINES = [
  "Clarity before speed.", "Balance, direction, purposeful navigation.", "Good minutes protect directors more than a good outcome does.",
  "One idea, proved with evidence.", "Calm water is made, not found.", "Say the hard thing plainly and kindly.", "Every exhibit makes one point.",
];
const PROMPTS = [
  "Sketch the client journey for a family office choosing its first adviser.", "Draw a 2×2 of our services by urgency and value to a board.",
  "Write the headline for next month's Confluence cover in six words.", "Design a one-page exhibit that explains NexaPair to a CFO in ten seconds.",
  "List three questions a new client should ask us, and our best answers.", "Map one regulation that changed this month to the clients it touches.",
  "Imagine Kayak in five years: what is the one thing we are known for?",
];
const TOOLS = [["board", "palette", "Whiteboard", "Sketch, map and plan on an open canvas."], ["briefs", "briefcase", "Briefing studio", "Client briefings, capability documents and benchmarks."], ["cards", "card", "Business cards", "Cards for every Kayak company."], ["decks", "slides", "Presentations", "Decks in the Kayak master."], ["brand", "brand", "Brand Portal", "Logos, colours, the mixer and templates."], ["confluence", "book", "Confluence", "The monthly magazine studio."], ["ai", "spark", "Kayak AI", "Draft, research and review."], ["store", "briefcase", "Kayakers Store", "Branded kit for the team."]];
const TAGS = [["idea", "Idea"], ["client", "For clients"], ["product", "Product"], ["brand", "Brand"], ["process", "How we work"]];
let tick = 0;

export async function render(main) {
  clearInterval(tick);
  const day = Math.floor(Date.now() / 86400_000);
  const draw = async () => {
    const { ideas } = await api("/api/workspace/ideas");
    main.innerHTML = `<div class="page">
      <section class="studio-hero"><div class="sh-glow" aria-hidden="true"></div><div class="stack" style="position:relative;max-width:760px">
        <span class="eyebrow" style="color:#F5C46D">Kayak Studio</span>
        <h1 class="sh-line" id="line">${esc(LINES[day % LINES.length])}</h1>
        <p>This is the place to think freely. Nothing here is a draft for anyone else until you say so. Start with today's prompt, or open a tool.</p>
        <div class="sh-prompt"><span class="eyebrow">Today's prompt</span><p>${esc(PROMPTS[day % PROMPTS.length])}</p><a class="btn btn-saffron btn-sm" href="#/board">${ico("palette")} Open a whiteboard</a></div>
      </div>
      <div class="focus" id="focus"><span class="eyebrow" style="color:#C9DAD8">Focus</span><b id="ft">25:00</b><div class="row"><button class="btn btn-ghost btn-sm" style="color:#fff;border-color:rgba(255,255,255,.4)" id="fgo">Start</button><button class="btn btn-quiet btn-sm" style="color:#C9DAD8" id="frs">Reset</button></div><span class="small" style="color:#A9C0C6">25 minutes of deep work, then a short break.</span></div></section>
      <section class="tiles">${TOOLS.map(([id, i, t, d]) => `<a class="tile" href="#/${id}"><span class="tile-ico">${ico(i)}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></a>`).join("")}</section>
      <section class="panel2"><h3>Idea wall <small>post anything; upvote what you would build first</small></h3>
        <form class="row wrap-row" id="f"><input class="input" id="t" placeholder="Your idea, in one line" maxlength="500" style="flex:1;min-width:220px"><select class="input" id="tg" style="width:auto">${TAGS.map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><button class="btn btn-primary" type="submit">${ico("plus")} Post</button></form>
        <div class="ideas">${ideas.length ? ideas.map((i) => `<article class="idea ${i.status}"><button class="vote ${i.voted ? "on" : ""}" data-v="${i.id}" aria-label="Upvote">▲<b>${i.votes}</b></button><div><p>${esc(i.text)}</p><span class="small muted">${esc(TAGS.find((t) => t[0] === i.tag)?.[1] || "Idea")} · ${esc(i.author || "")}${i.status !== "open" ? ` · <b>${esc(i.status)}</b>` : ""}</span></div></article>`).join("") : `<p class="muted">The wall is empty. Be the first.</p>`}</div></section></div>`;
    main.querySelector("#f").onsubmit = async (e) => { e.preventDefault(); const t = main.querySelector("#t").value.trim(); if (!t) return; await api("/api/workspace/ideas", { body: { text: t, tag: main.querySelector("#tg").value } }); toast("Posted to the wall."); draw(); };
    main.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", async () => { await api(`/api/workspace/ideas/${b.dataset.v}/vote`, { body: {} }); draw(); }));
    // Focus timer
    let left = 25 * 60, run = false;
    const show = () => (main.querySelector("#ft").textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`);
    main.querySelector("#fgo").onclick = (e) => { run = !run; e.target.textContent = run ? "Pause" : "Start"; };
    main.querySelector("#frs").onclick = () => { left = 25 * 60; run = false; main.querySelector("#fgo").textContent = "Start"; show(); };
    clearInterval(tick);
    tick = setInterval(() => { if (!document.body.contains(main.querySelector("#ft"))) return clearInterval(tick); if (run && left > 0) { left--; show(); if (!left) toast("Time for a short break. Well done."); } }, 1000);
    let li = day; setTimeout(function rot() { const el = main.querySelector("#line"); if (!el) return; li++; el.classList.add("fade"); setTimeout(() => { el.textContent = LINES[li % LINES.length]; el.classList.remove("fade"); }, 400); setTimeout(rot, 9000); }, 9000);
  };
  await draw();
}
