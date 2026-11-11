import { api, esc, ico, identifier } from "/_shared/js/ui.js";
import { area, bars, donut, spark, gauge, hours, bindCharts, fmt, compact, PAL } from "/app/charts.js";

// Home: a live dashboard of www.kayaksa.com and learn.kayaksa.com, with the work that matters this week.
let timer = 0;
const TILES = [
  ["digital", "activity", "Digital Dashboard"], ["ai", "spark", "Kayak AI"], ["launch", "bolt", "Launch monitor"], ["certs", "award", "Certifications"],
  ["briefs", "briefcase", "Briefing studio"], ["board", "palette", "Whiteboard"], ["clienttools", "tools", "Client tools"], ["updates", "send", "Kayakers Update"],
];

function delta(cur, prev) {
  if (!prev && !cur) return `<span class="delta">no change</span>`;
  if (!prev) return `<span class="delta up">▲ new</span>`;
  const p = ((cur - prev) / prev) * 100;
  return `<span class="delta ${p > 0.5 ? "up" : p < -0.5 ? "down" : ""}">${p > 0.5 ? "▲" : p < -0.5 ? "▼" : "■"} ${Math.abs(p).toFixed(0)}%</span>`;
}
function series(daily, days, since, key = "n") {
  const out = [], labels = [];
  const m = new Map(daily.map((r) => [r.day, r[key] || 0]));
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.parse(since) + i * 86400_000).toISOString().slice(0, 10);
    labels.push(new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
    out.push(m.get(d) || 0);
  }
  return { labels, values: out };
}
const kpi = (t, v, d, sp, sub, color) => `<div class="kpi2"><span class="t">${esc(t)}${d || ""}</span><b class="count-up" data-to="${typeof v === "number" ? v : ""}">${typeof v === "number" ? "0" : esc(v)}</b>${sp || ""}<small>${esc(sub || "")}</small></div>`;

function countUp(root) {
  root.querySelectorAll(".count-up[data-to]").forEach((el) => {
    const to = Number(el.dataset.to); if (!Number.isFinite(to) || el.dataset.to === "") return;
    const fmtd = el.dataset.money ? (n) => "₹" + compact(n) : (n) => fmt(n);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = fmtd(to); return; }
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmtd(Math.round(to * e)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

export async function render(main, { me }) {
  clearInterval(timer);
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (me.name || "").split(" ")[0];
  let days = Number(sessionStorage.getItem("ksa-dash-days")) || 30;

  const draw = async () => {
    const d = await api(`/api/dash?days=${days}`);
    const since = d.range.since;
    const ww = series(d.www.daily, days, since), lw = series(d.learn.daily, days, since);
    const enq = series(d.enquiries.daily, days, since), sig = series(d.signups.daily, days, since), rev = series(d.sales.daily, days, since, "paise");
    const kay = series(d.kay.daily, days, since, "chats");
    const sec = (() => { const m = {}; d.security.daily.forEach((r) => { (m[r.severity] ||= []).push(r); }); return ["high", "medium", "low"].map((s, i) => ({ name: s[0].toUpperCase() + s.slice(1), color: ["#B4472F", "#EE9B1E", "#8B9A9C"][i], values: series(m[s] || [], days, since).values })); })();
    const aiBy = {}; d.ai.forEach((r) => { const k = r.model.includes("haiku") ? "Haiku (light)" : r.model.includes("sonnet") ? "Sonnet" : r.model.includes("workers-ai") || r.model.includes("llama") ? "Kayak AI on Cloudflare" : r.model === "kayak-store" ? "Kayak answer store" : r.model; aiBy[k] = (aiBy[k] || 0) + r.calls; });
    const own = (aiBy["Kayak AI on Cloudflare"] || 0) + (aiBy["Kayak answer store"] || 0), aiTot = Object.values(aiBy).reduce((a, b) => a + b, 0);
    const vit = (v, n) => `<div class="gauges">${gauge(v.lcp != null ? v.lcp / 1000 : null, { max: 6, label: "LCP, seconds", unit: "s", good: 2.5, poor: 4 })}${gauge(v.inp, { max: 800, label: "INP, ms", unit: "", good: 200, poor: 500 })}${gauge(v.cls, { max: 0.5, label: "CLS", good: 0.1, poor: 0.25 })}</div><p class="small muted">${fmt(v.samples)} real-user samples, 75th percentile, ${esc(n)}.</p>`;
    $("#dash").innerHTML = `
      <section class="kpis">
        ${kpi("Website views", d.www.total, delta(d.www.total, d.www.prevTotal), spark(ww.values), `www.kayaksa.com · last ${days} days`)}
        ${kpi("Learn views", d.learn.total, delta(d.learn.total, d.learn.prevTotal), spark(lw.values, { color: "#2D6A9F" }), "learn.kayaksa.com")}
        ${kpi("Enquiries", d.enquiries.total, delta(d.enquiries.total, d.enquiries.prevTotal), spark(enq.values, { color: "#9C630E" }), "from the website")}
        ${kpi("Learn sign-ups", d.signups.total, delta(d.signups.total, d.signups.prevTotal), spark(sig.values, { color: "#5E4B78" }), "new learner accounts")}
        <div class="kpi2"><span class="t">Learn revenue${delta(d.sales.revenue, d.sales.prevRevenue)}</span><b class="count-up" data-to="${Math.round(d.sales.revenue)}" data-money="1">₹0</b>${spark(rev.values.map((v) => v / 100), { color: "#4B7A4E" })}<small>${fmt(d.sales.orders)} paid orders, incl. GST</small></div>
        ${kpi("Kay conversations", d.kay.chats, "", spark(kay.values, { color: "#0B5654" }), `${fmt(d.kay.voice)} by voice`)}
        ${kpi("Confluence subscribers", d.subscribers, "", "", "active")}
        ${kpi("Threats blocked now", d.security.activeBlocks, "", spark(sec[0].values.map((v, i) => v + sec[1].values[i]), { color: "#B4472F" }), "4-hour blocks in force")}
      </section>
      <section class="dgrid">
        <div class="panel2 s8"><h3>Traffic, www and Learn <small>daily page views · hover for detail</small></h3>${area(ww.labels, [{ name: "www.kayaksa.com", values: ww.values, color: "#17807E" }, { name: "learn.kayaksa.com", values: lw.values, color: "#EE9B1E" }], { title: "Daily page views" })}</div>
        <div class="panel2 s4"><h3>Devices <small>www</small></h3>${donut(d.www.devices.map((r) => [r.value, r.n]))}<h3>Browsers <small>www</small></h3>${bars(d.www.browsers.map((r) => [r.value, r.n]), { beacon: -1 })}</div>
        <div class="panel2 s6"><h3>Most-read pages <small>www.kayaksa.com</small></h3>${bars(d.www.top.map((r) => [r.path, r.n]))}</div>
        <div class="panel2 s6"><h3>Most-read pages <small>learn.kayaksa.com</small></h3>${bars(d.learn.top.map((r) => [r.path, r.n]), { color: "#2D6A9F" })}</div>
        <div class="panel2 s4"><h3>Where visitors come from</h3>${bars(d.www.referrers.map((r) => [r.value, r.n]), { beacon: -1 })}</div>
        <div class="panel2 s4"><h3>Countries</h3>${bars(d.www.countries.map((r) => [r.value === "XX" ? "Unknown" : new Intl.DisplayNames(["en"], { type: "region" }).of(r.value) || r.value, r.n]), { beacon: -1, color: "#2D6A9F" })}</div>
        <div class="panel2 s4"><h3>When they visit <small>hour of day, IST</small></h3>${hours(d.www.hoursIst)}<p class="small muted">Busiest hour: ${String(d.www.hoursIst.indexOf(Math.max(...d.www.hoursIst))).padStart(2, "0")}:00 IST.</p></div>
        <div class="panel2 s6"><h3>Core Web Vitals <small>www</small></h3>${vit(d.www.vitals, "www.kayaksa.com")}</div>
        <div class="panel2 s6"><h3>Core Web Vitals <small>Learn</small></h3>${vit(d.learn.vitals, "learn.kayaksa.com")}</div>
        <div class="panel2 s6"><h3>Launches <a class="small" href="#/launch">Open the monitor ${ico("arrow")}</a></h3><div class="tlist">${d.launches.length ? d.launches.map((l) => { const dl = Math.round((Date.parse(l.target_date) - Date.now()) / 86400_000); const p = l.items ? Math.round((l.done / l.items) * 100) : 0; return `<div><span class="ring" style="--p:${p}" data-v="${p}%"></span><span><b>${esc(l.app)}</b><br><span class="small muted">${l.done}/${l.items} tasks done</span></span><span class="small ${dl < 0 ? "danger" : ""}">${dl < 0 ? `${-dl} days late` : `${dl} days to go`}</span></div>`; }).join("") : `<p class="small muted">No launches planned.</p>`}</div></div>
        <div class="panel2 s6"><h3>Certification journeys <a class="small" href="#/certs">Open the tracker ${ico("arrow")}</a></h3><div class="tlist">${d.certifications.length ? d.certifications.slice(0, 6).map((c) => { const p = c.steps ? Math.round((c.done / c.steps) * 100) : 0; return `<div><span class="ring" style="--p:${p}" data-v="${p}%"></span><span><b>${esc(c.standard)}</b><br><span class="small muted">${esc(c.entity)} · ${esc(c.status.replace("_", " "))}</span></span><span class="small">${c.target_date ? new Date(c.target_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : ""}</span></div>`; }).join("") : `<p class="small muted">Open the tracker to load the suggested journeys.</p>`}</div></div>
        <div class="panel2 s6"><h3>Kayak AI <small>${fmt(aiTot)} answers · ${aiTot ? Math.round((own / aiTot) * 100) : 0}% without outside AI</small></h3>${Object.keys(aiBy).length ? donut(Object.entries(aiBy)) : `<p class="small muted">No AI use recorded yet in this period.</p>`}</div>
        <div class="panel2 s6"><h3>Security events <small>by severity</small></h3>${area(ww.labels, sec, { h: 160, title: "Security events" })}</div>
      </section>
      <section class="stack-sm"><h2 style="font-size:1.1rem">Jump to</h2><div class="tiles">${TILES.map(([id, i, t]) => `<a class="tile" style="min-height:0" href="#/${id}"><span class="tile-ico">${ico(i)}</span><h3>${esc(t)}</h3></a>`).join("")}</div></section>`;
    bindCharts($("#dash")); countUp($("#dash"));
  };
  const live = async () => {
    try {
      const l = await api("/api/dash/live");
      $("#pulse").innerHTML = `<div><span><i class="live-dot"></i> www today</span><b>${fmt(l.www.today)}</b></div><div><span><i class="live-dot"></i> Learn today</span><b>${fmt(l.learn.today)}</b></div><div><span>www this hour</span><b>${fmt(l.www.hour)}</b></div><div><span>Learn this hour</span><b>${fmt(l.learn.hour)}</b></div>`;
    } catch {}
  };
  const $ = (s) => main.querySelector(s);
  main.innerHTML = `<div class="page">
    <section class="dash-hero"><div class="stack-sm">
      <span class="eyebrow" style="color:#F5C46D">${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}</span>
      <h1>${greet}${first ? `, ${esc(first)}` : ""}.</h1>
      <p>Live view of www.kayaksa.com and learn.kayaksa.com. Counts are cookieless and exclude bots; the pulse refreshes every 30 seconds.</p>
      <div class="row wrap-row"><div class="seg" role="group" aria-label="Period">${[7, 30, 90, 365].map((n) => `<button type="button" data-d="${n}" aria-pressed="${n === days}">${n === 365 ? "12 months" : `${n} days`}</button>`).join("")}</div><a class="btn btn-saffron btn-sm" href="#/digital">${ico("activity")} Digital Dashboard</a></div>
    </div><div class="pulse" id="pulse" aria-live="polite"></div></section>
    <div id="dash" class="stack"><div class="row muted"><span class="spinner"></span> Loading the dashboard…</div></div>
  </div>`;
  main.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", async () => {
    days = Number(b.dataset.d); sessionStorage.setItem("ksa-dash-days", String(days));
    main.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    await draw().catch((e) => ($("#dash").innerHTML = `<div class="note danger">${esc(e.message)}</div>`));
  }));
  await Promise.all([draw().catch((e) => ($("#dash").innerHTML = `<div class="note danger">${esc(e.message)}</div>`)), live()]);
  timer = setInterval(() => { if (!document.body.contains(main.querySelector("#pulse"))) return clearInterval(timer); live(); }, 30_000);
}
