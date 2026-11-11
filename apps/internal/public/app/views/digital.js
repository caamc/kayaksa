import { api, esc, ico, toast, dialog, fmtDateTime } from "/_shared/js/ui.js";
import { gauge, bars, fmt } from "/app/charts.js";

// Kayak Digital Dashboard: the health of Kayak's whole digital estate in one view, plus the
// digital footprint report that Kayak AI prepares from public sources.
export async function render(main, { me, rest }) {
  if (rest[0] === "report" && rest[1]) return report(main, rest[1]);
  main.innerHTML = `<div class="page"><div class="row muted"><span class="spinner"></span> Checking every property…</div></div>`;
  const d = await api("/api/dash/digital");
  const up = d.properties.filter((p) => p.ok).length;
  const hdr = d.security.headers.filter((h) => h[1]).length;
  const intOk = d.integrations.filter((i) => i[1]).length;
  const live = d.socials.filter((s) => s.status === "live").length;
  const score = Math.round((up / d.properties.length) * 30 + (hdr / d.security.headers.length) * 20 + ((d.security.spf ? 1 : 0) + (d.security.dmarc ? 1 : 0)) * 7.5 + (d.seo.sitemapUrls ? 10 : 0) + (live / Math.max(1, d.socials.length)) * 15 + (intOk / d.integrations.length) * 10);
  main.innerHTML = `<div class="page">
    <section class="dash-hero"><div class="stack-sm"><span class="eyebrow" style="color:#F5C46D">Kayak Digital Dashboard</span><h1>Kayak's digital estate, at a glance</h1>
      <p>Every public property, its security posture, search readiness, social presence and integrations. Checked live at ${new Date(d.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.</p>
      <div class="row wrap-row"><button class="btn btn-saffron btn-sm" id="refresh">${ico("refresh")} Check again</button>${me.can.admin ? `<button class="btn btn-ghost btn-sm" style="color:#fff;border-color:rgba(255,255,255,.4)" id="fp">${ico("search")} Run a digital footprint report</button><a class="btn btn-ghost btn-sm" style="color:#fff;border-color:rgba(255,255,255,.4)" href="#/brain">${ico("spark")} Kayak AI memory</a>` : ""}</div></div>
      <div class="pulse"><div><span>Digital health score</span><b>${score}<small style="font-size:.9rem;color:var(--on-deep-muted)">/100</small></b></div><div><span><i class="live-dot"></i> Properties up</span><b>${up}/${d.properties.length}</b></div><div><span>Security headers</span><b>${hdr}/${d.security.headers.length}</b></div><div><span>Social profiles live</span><b>${live}/${d.socials.length}</b></div></div></section>
    <section class="dgrid">
      <div class="panel2 s8"><h3>Properties <small>live check from Cloudflare</small></h3><div class="tlist">${d.properties.map((p) => `<div><span class="statusdot ${p.ok ? "ok" : "bad"}"></span><span><b>${esc(p.label)}</b><br><a class="small" href="https://${esc(p.name)}" target="_blank" rel="noopener">${esc(p.name)}</a></span><span class="small">${p.ok ? `${fmt(p.ms)} ms` : esc(p.error || `HTTP ${p.status}`)}</span></div>`).join("")}</div></div>
      <div class="panel2 s4"><h3>Response time <small>ms</small></h3>${bars(d.properties.map((p) => [p.label, p.ms]), { beacon: d.properties.reduce((bi, p, i, a) => (p.ms > a[bi].ms ? i : bi), 0) })}</div>
      <div class="panel2 s4"><h3>Search readiness</h3><div class="tlist">
        <div><span class="statusdot ${d.seo.sitemapUrls ? "ok" : "bad"}"></span><span>Sitemap</span><span class="small">${d.seo.sitemapUrls ?? "–"} URLs</span></div>
        <div><span class="statusdot ${d.seo.homeStatus === 200 ? "ok" : "bad"}"></span><span>Home page</span><span class="small">HTTP ${d.seo.homeStatus} · ${fmt(d.seo.homeMs)} ms</span></div>
        <div><span class="statusdot"></span><span>Search Console and Bing</span><span class="small">verify by hand</span></div></div></div>
      <div class="panel2 s4"><h3>Email authentication <small>kayaksa.com</small></h3><div class="tlist">
        <div><span class="statusdot ${d.security.spf ? "ok" : "bad"}"></span><span>SPF</span><span class="small">${d.security.spf ? "present" : "missing"}</span></div>
        <div><span class="statusdot ${d.security.dmarc ? "ok" : "bad"}"></span><span>DMARC</span><span class="small">${d.security.dmarc ? esc((d.security.dmarc.match(/p=(\w+)/) || [])[1] || "present") : "missing"}</span></div></div>
        ${d.security.spf && d.security.dmarc ? "" : `<p class="small muted">Add the records Resend gives you, then a DMARC record such as <code>v=DMARC1; p=quarantine; rua=mailto:advisory@kayaksa.com</code>.</p>`}</div>
      <div class="panel2 s4"><h3>Security headers <small>www</small></h3><div class="tlist">${d.security.headers.map(([n, ok]) => `<div><span class="statusdot ${ok ? "ok" : "bad"}"></span><span>${esc(n)}</span><span class="small">${ok ? "set" : "missing"}</span></div>`).join("")}</div></div>
      <div class="panel2 s6"><h3>Content inventory</h3><div class="kpis">${[["Articles", d.content.articles], ["Confluence issues", d.content.editions], ["White papers and toolkits", d.content.resources], ["Kay answers approved", d.content.kayApproved], ["Kay answers waiting", d.content.kayPending], ["Subscribers", d.content.subscribers]].map(([t, v]) => `<div class="kpi2"><span class="t">${esc(t)}</span><b>${fmt(v)}</b></div>`).join("")}</div></div>
      <div class="panel2 s6"><h3>Integrations <small>configured or not; no secrets shown</small></h3><div class="tlist">${d.integrations.map(([n, ok]) => `<div><span class="statusdot ${ok ? "ok" : "bad"}"></span><span>${esc(n)}</span><span class="small">${ok ? "connected" : "not connected"}</span></div>`).join("")}</div></div>
      <div class="panel2 s6"><h3>Social profiles ${me.can.admin ? `<button class="btn btn-ghost btn-sm" id="editsoc">${ico("edit")} Edit</button>` : ""}</h3><div class="tlist">${d.socials.map((s) => `<div><span class="statusdot ${s.status === "live" ? "ok" : ""}"></span><span><b>${esc(s.name)}</b>${s.handle ? `<br><span class="small muted">${esc(s.handle)}</span>` : ""}</span><span class="small">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.status)}</a>` : esc(s.status)}</span></div>`).join("")}</div></div>
      <div class="panel2 s6"><h3>Digital footprint reports</h3>${d.reports.length ? `<div class="tlist">${d.reports.map((r) => `<div><span class="statusdot ${r.status === "done" ? "ok" : r.status === "failed" ? "bad" : ""}"></span><span>${fmtDateTime(r.created_at)}</span><a class="small" href="#/digital/report/${esc(r.id)}">${esc(r.status === "done" ? "Open" : r.status)}</a></div>`).join("")}</div>` : `<p class="small muted">No reports yet. A report searches the public web for Kayak, its affiliates, its solutions and its leadership, and lists presence, gaps, risks and fixes, with sources.</p>`}</div>
    </section></div>`;
  main.querySelector("#refresh").onclick = () => render(main, { me, rest: [] });
  main.querySelector("#fp")?.addEventListener("click", async (e) => {
    e.target.disabled = true; e.target.textContent = "Researching… this takes one to two minutes";
    try { const r = await api("/api/ai/footprint", { body: {} }); location.hash = `#/digital/report/${r.id}`; } catch (err) { toast(err.message, "err"); e.target.disabled = false; }
  });
  main.querySelector("#editsoc")?.addEventListener("click", () => dialog({
    title: "Social profiles",
    body: `<p class="small muted">Create the profiles yourself on each network, then add the links here. Only https links are accepted.</p>${d.socials.map((s, i) => `<fieldset class="stack-sm" style="border:1px solid var(--line);padding:10px"><legend><b>${esc(s.name)}</b></legend><input class="input" data-i="${i}" data-k="url" placeholder="https://…" value="${esc(s.url)}"><input class="input" data-i="${i}" data-k="handle" placeholder="@handle" value="${esc(s.handle)}"><select class="input" data-i="${i}" data-k="status">${["planned", "live", "paused"].map((o) => `<option ${o === s.status ? "selected" : ""}>${o}</option>`).join("")}</select></fieldset>`).join("")}`,
    actions: [{ id: "c", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (dl) => {
      const list = d.socials.map((s) => ({ ...s }));
      dl.querySelectorAll("[data-i]").forEach((el) => (list[el.dataset.i][el.dataset.k] = el.value.trim()));
      await api("/api/dash/socials", { body: { socials: list } }); toast("Saved."); render(main, { me, rest: [] });
    } }],
  }));
}

async function report(main, id) {
  const r = await api(`/api/ai/footprint/${id}`);
  const R = r.report;
  main.innerHTML = `<div class="page"><a class="small" href="#/digital">${ico("chevron")} Digital Dashboard</a>
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Digital footprint report · ${fmtDateTime(r.created_at)}</span><h1>How Kayak appears in public</h1></div>${R ? `<div class="ring" style="--p:${R.score};width:72px;height:72px" data-v="${R.score}"></div>` : ""}</div>
    ${r.status !== "done" ? `<div class="note ${r.status === "failed" ? "danger" : ""}">${r.status === "failed" ? `The report failed: ${esc(r.error || "")}` : "Still researching. Refresh in a minute."}</div>` : `
    <p class="lead">${esc(R.summary)}</p>
    <div class="card stack-sm"><h3>Recommendations</h3><div class="tlist">${(R.recommendations || []).map((x) => `<div><span class="rag ${x.priority === "high" ? "red" : x.priority === "medium" ? "amber" : "green"}">${esc(x.priority)}</span><span><b>${esc(x.action)}</b><br><span class="small muted">${esc(x.why)}</span></span><span></span></div>`).join("")}</div></div>
    ${(R.sections || []).map((s) => `<div class="card stack-sm"><h3>${esc(s.subject)}</h3>
      ${(s.presence || []).length ? `<div class="tlist">${s.presence.map((p) => `<div><span class="statusdot ok"></span><span><b>${esc(p.where)}</b> · ${esc(p.what)}</span>${p.url ? `<a class="small" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">source</a>` : "<span></span>"}</div>`).join("")}</div>` : ""}
      ${(s.gaps || []).length ? `<p class="small"><b>Gaps:</b> ${s.gaps.map(esc).join("; ")}</p>` : ""}${(s.risks || []).length ? `<p class="small danger"><b>Risks:</b> ${s.risks.map(esc).join("; ")}</p>` : ""}</div>`).join("")}
    <p class="small muted">Prepared by Kayak AI from public web sources. Verify each item at its source before acting on it.</p>`}</div>`;
}
