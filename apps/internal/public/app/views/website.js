import { $, $$, api, esc, html, raw, ico, toast, dialog, fmtDateTime, fmtDate } from "/_shared/js/ui.js";

const TABS = [["overview", "Overview"], ["enquiries", "Enquiries"], ["kay", "Kay's answers"], ["articles", "Confluence"], ["cases", "SeeCounter cases"]];
const ST = { new: ["New", "accent"], in_progress: ["In progress", "warn"], closed: ["Closed", "ok"], spam: ["Spam", ""] };

export async function render(main, ctx) {
  const tab = TABS.some((t) => t[0] === ctx.rest[0]) ? ctx.rest[0] : "overview";
  main.innerHTML = String(html`<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">www.kayaksa.com</span><h1>Website</h1><p class="lead">Enquiries, Kay's answers, Confluence, SeeCounter and how the site is performing.</p></div>
      <a class="btn btn-ghost" href="https://www.kayaksa.com" target="_blank" rel="noopener">${ico("external")} Open the website</a></div>
    <nav class="chips" aria-label="Website sections">${TABS.map(([id, l]) => raw(`<a class="chip${id === tab ? " on" : ""}" href="#/website/${id}">${esc(l)}</a>`))}</nav>
    <div id="wb"><div class="row muted"><span class="spinner"></span> Loading…</div></div></div>`);
  const box = $("#wb");
  try { await ({ overview, enquiries, kay, articles, cases })[tab](box, ctx.me); }
  catch (e) { box.innerHTML = String(html`<div class="note danger">${e.message}</div>`); }
}

const kpi = (n, l) => `<div class="card flat kpi"><b>${esc(n)}</b><span>${esc(l)}</span></div>`;

async function overview(box) {
  const o = await api("/api/website/overview");
  const total = o.views.reduce((a, r) => a + r.n, 0);
  const k = o.kay; const answered = (k.memory || 0) + (k.lite || 0) + (k.claude || 0);
  const saved = answered ? Math.round((((k.memory || 0) + (k.lite || 0)) / answered) * 100) : 0;
  const max = Math.max(1, ...o.views.map((r) => r.n));
  const v = o.vitals;
  const grade = (val, good, ok) => (val == null ? "—" : val <= good ? "Good" : val <= ok ? "Needs work" : "Poor");
  box.innerHTML = `<div class="stack">
    <section class="grid">${kpi(total.toLocaleString("en-IN"), "Page views, 30 days")}${kpi(o.enquiries30, "Enquiries, 30 days")}${kpi(o.newEnquiries, "Enquiries awaiting reply")}${kpi(o.subscribers.reduce((a, r) => a + r.n, 0), "Active subscribers")}${kpi(k.chats || 0, "Conversations with Kay")}${kpi(saved + "%", "Kay replies without Claude")}</section>
    ${o.pendingAnswers ? `<div class="note warn row between"><span>${o.pendingAnswers} answer${o.pendingAnswers === 1 ? "" : "s"} for Kay ${o.pendingAnswers === 1 ? "is" : "are"} waiting for approval.</span><a class="btn btn-primary btn-sm" href="#/website/kay">Review</a></div>` : ""}
    <div class="card stack-sm"><h3>Daily page views</h3>${o.views.length ? `<div class="bars" role="img" aria-label="Daily page views for the last 30 days">${o.views.map((r) => `<span title="${esc(r.day)}: ${r.n}" style="height:${Math.max(3, (r.n / max) * 100)}%"></span>`).join("")}</div>` : `<p class="muted">No visits recorded yet. Statistics are counted without cookies.</p>`}</div>
    <div class="grid wide">
      <div class="card stack-sm"><h3>Most-read pages</h3>${o.top.length ? `<table class="table"><tbody>${o.top.map((r) => `<tr><td>${esc(r.path)}</td><td class="num">${r.n}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Nothing yet.</p>`}</div>
      <div class="card stack-sm"><h3>Where visitors came from</h3>${o.referrers.length ? `<table class="table"><tbody>${o.referrers.map((r) => `<tr><td>${esc(r.value)}</td><td class="num">${r.n}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Nothing yet.</p>`}</div>
      <div class="card stack-sm"><h3>Speed (Core Web Vitals, 75th percentile)</h3><table class="table"><tbody>
        <tr><td>Largest paint</td><td>${v.lcp == null ? "—" : (v.lcp / 1000).toFixed(1) + " s"}</td><td>${grade(v.lcp, 2500, 4000)}</td></tr>
        <tr><td>Layout shift</td><td>${v.cls == null ? "—" : v.cls}</td><td>${grade(v.cls, 0.1, 0.25)}</td></tr>
        <tr><td>Responsiveness</td><td>${v.inp == null ? "—" : v.inp + " ms"}</td><td>${grade(v.inp, 200, 500)}</td></tr></tbody></table><p class="small muted">${v.samples} visits measured.</p></div>
      <div class="card stack-sm"><h3>Kay, last 30 days</h3><table class="table"><tbody>
        <tr><td>Answered from memory (free)</td><td class="num">${k.memory || 0}</td></tr><tr><td>Answered by Gemini Lite</td><td class="num">${k.lite || 0}</td></tr>
        <tr><td>Answered by Claude</td><td class="num">${k.claude || 0}</td></tr><tr><td>Voice conversations</td><td class="num">${k.voice || 0}</td></tr>
        <tr><td>Spoken characters / replayed from cache</td><td class="num">${(k.tts || 0).toLocaleString("en-IN")} / ${k.cached || 0}</td></tr></tbody></table></div>
    </div></div>`;
}

async function enquiries(box, me) {
  const { enquiries: list } = await api("/api/website/enquiries");
  if (!list.length) { box.innerHTML = `<div class="empty">No enquiries yet. New ones from the website and from Kay appear here, and are emailed to enquiries@kayaksa.com when email is switched on.</div>`; return; }
  box.innerHTML = `<div class="stack">${list.map((e) => { const [l, k] = ST[e.status] || [e.status, ""]; return `<article class="card stack-sm" data-id="${esc(e.id)}">
    <div class="row between"><div><b>${esc(e.name)}</b>${e.organisation ? ` · ${esc(e.organisation)}` : ""} <span class="badge ${k}">${l}</span> ${e.source === "kay" ? `<span class="badge">Via Kay</span>` : ""} ${e.kind === "career" ? `<span class="badge">Careers</span>` : ""}</div><span class="small muted">${fmtDateTime(e.created_at)}</span></div>
    <div class="small"><a href="mailto:${esc(e.email)}">${esc(e.email)}</a>${e.phone ? ` · ${esc(e.phone)}` : ""}${e.area ? ` · ${esc(e.area)}` : ""}${e.link ? ` · <a href="${esc(e.link)}" target="_blank" rel="noopener">link</a>` : ""}</div>
    <p style="white-space:pre-wrap;margin:0">${esc(e.message)}</p>
    ${e.transcript ? `<details><summary class="small">Conversation with Kay</summary><pre class="small" style="white-space:pre-wrap">${esc(e.transcript)}</pre></details>` : ""}
    <div class="row"><select class="select" data-st aria-label="Status">${Object.entries(ST).map(([v, [lab]]) => `<option value="${v}"${v === e.status ? " selected" : ""}>${lab}</option>`).join("")}</select>
      <input class="input" data-notes value="${esc(e.notes)}" placeholder="Internal notes" style="flex:1 1 260px"><button class="btn btn-ghost btn-sm" data-save>Save</button></div></article>`; }).join("")}</div>`;
  $$("[data-save]", box).forEach((b) => (b.onclick = async () => {
    const card = b.closest("[data-id]");
    try { await api(`/api/website/enquiries/${card.dataset.id}`, { body: { status: $("[data-st]", card).value, notes: $("[data-notes]", card).value } }); toast("Saved."); } catch (e) { toast(e.message, "err"); }
  }));
}

async function kay(box, me) {
  const { memory, feedback, questions } = await api("/api/website/kay");
  const can = me.can.edit;
  box.innerHTML = `<div class="stack">
    <div class="note"><b>How Kay learns.</b> Kay answers from these approved answers instantly, without paying for an AI call. Every Monday he drafts new answers for the questions visitors asked most; nothing is used until someone approves it here. Edit freely before approving.</div>
    ${can ? `<div><button class="btn btn-primary" id="addk">${ico("plus")} Add an answer</button></div>` : ""}
    <div class="stack">${memory.map((m) => `<article class="card stack-sm" data-id="${esc(m.id)}">
      <div class="row between"><b>${esc(m.question)}</b><span><span class="badge ${m.status === "approved" ? "ok" : m.status === "pending" ? "accent" : ""}">${esc(m.status)}</span> ${m.asked ? `<span class="badge">asked ${m.asked}×</span>` : ""} ${m.hits ? `<span class="badge">used ${m.hits}×</span>` : ""}</span></div>
      <p style="margin:0">${esc(m.answer)}</p>${m.voice_answer ? `<p class="small muted" style="margin:0"><b>Spoken:</b> ${esc(m.voice_answer)}</p>` : ""}
      ${can ? `<div class="row">${m.status !== "approved" ? `<button class="btn btn-primary btn-sm" data-act="approved">${ico("check")} Approve</button>` : ""}<button class="btn btn-ghost btn-sm" data-edit>${ico("edit")} Edit</button>${m.status !== "rejected" ? `<button class="btn btn-quiet btn-sm" data-act="rejected">Reject</button>` : ""}</div>` : ""}</article>`).join("")}</div>
    <div class="grid wide"><div class="card stack-sm"><h3>Recent questions (personal details removed)</h3><table class="table"><tbody>${questions.map((q) => `<tr><td>${esc(q.question)}</td><td class="small muted">${esc(q.answered_by)}</td></tr>`).join("") || "<tr><td class='muted'>None yet.</td></tr>"}</tbody></table></div>
      <div class="card stack-sm"><h3>Ratings</h3><table class="table"><tbody>${feedback.map((f) => `<tr><td>${f.rating > 0 ? "👍" : "👎"}</td><td class="small">${esc(f.question)}</td></tr>`).join("") || "<tr><td class='muted'>None yet.</td></tr>"}</tbody></table></div></div></div>`;
  const save = (m, status) => api("/api/website/kay", { body: { id: m.id, question: m.question, answer: m.answer, voice: m.voice_answer, status } });
  $$("[data-act]", box).forEach((b) => (b.onclick = async () => { const m = memory.find((x) => x.id === b.closest("[data-id]").dataset.id); try { await save(m, b.dataset.act); toast(b.dataset.act === "approved" ? "Approved. Kay will use it within the hour." : "Rejected."); kay(box, me); } catch (e) { toast(e.message, "err"); } }));
  const editor = (m = { question: "", answer: "", voice_answer: "", status: "approved" }) => dialog({ title: m.id ? "Edit answer" : "Add an answer", wide: true,
    body: `<div class="stack-sm"><div class="field"><label for="kq">Question</label><input class="input" id="kq" value="${esc(m.question)}" maxlength="300"></div>
      <div class="field"><label for="ka">Answer for chat. You may end with [[go:/services/tax-legal-regulatory|Tax, Legal & Regulatory]] or [[handoff]].</label><textarea class="input" id="ka" rows="5" maxlength="2000">${esc(m.answer)}</textarea></div>
      <div class="field"><label for="kv">Spoken version (one or two sentences, no links)</label><textarea class="input" id="kv" rows="2" maxlength="600">${esc(m.voice_answer)}</textarea></div></div>`,
    actions: [{ id: "x", label: "Cancel" }, { id: "s", label: "Save and approve", kind: "primary", handler: async (d) => { await api("/api/website/kay", { body: { id: m.id, question: $("#kq", d).value, answer: $("#ka", d).value, voice: $("#kv", d).value, status: "approved" } }); toast("Saved."); kay(box, me); } }] });
  $$("[data-edit]", box).forEach((b) => (b.onclick = () => editor(memory.find((x) => x.id === b.closest("[data-id]").dataset.id))));
  $("#addk")?.addEventListener("click", () => editor());
}

async function articles(box, me) {
  const { articles: list } = await api("/api/website/articles");
  box.innerHTML = `<div class="stack"><div class="note">Articles published here appear on www.kayaksa.com/insights within two minutes, ahead of the built-in issue. Paragraphs are separated by a blank line; start a line with "## " for a heading.</div>
    ${me.can.edit ? `<div><button class="btn btn-primary" id="adda">${ico("plus")} New article</button></div>` : ""}
    ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Title</th><th>Section</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>${list.map((a) => `<tr><td><b>${esc(a.title)}</b></td><td>${esc(a.section)}</td><td><span class="badge ${a.status === "published" ? "ok" : ""}">${esc(a.status)}</span></td><td>${fmtDate(a.updated_at)}</td><td>${me.can.edit ? `<button class="btn btn-ghost btn-sm" data-ed="${esc(a.id)}">Edit</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No articles written here yet.</div>`}</div>`;
  const ed = (a = { title: "", section: "Signal", dek: "", body: "[]", status: "draft", cluster: "" }) => dialog({ title: a.id ? "Edit article" : "New article", wide: true,
    body: `<div class="stack-sm"><div class="field"><label for="at">Title</label><input class="input" id="at" value="${esc(a.title)}"></div>
      <div class="row"><div class="field" style="flex:1"><label for="as">Section</label><select class="select" id="as">${["The Heading", "Cover Story", "Deal Water", "Regulatory Radar", "Storm Watch", "Signal", "Across the Water", "By the Numbers", "In Conversation", "Soundings"].map((s) => `<option${s === a.section ? " selected" : ""}>${s}</option>`).join("")}</select></div>
      <div class="field" style="flex:1"><label for="ac">Cluster</label><select class="select" id="ac"><option value="">None</option>${["strategy-deals", "tax-legal-regulatory", "crisis-resilience", "technology-ai", "managed-services", "international-desk"].map((s) => `<option${s === a.cluster ? " selected" : ""}>${s}</option>`).join("")}</select></div>
      <div class="field" style="flex:1"><label for="ast">Status</label><select class="select" id="ast">${["draft", "published", "archived"].map((s) => `<option${s === a.status ? " selected" : ""}>${s}</option>`).join("")}</select></div></div>
      <div class="field"><label for="ad">Standfirst</label><input class="input" id="ad" value="${esc(a.dek)}"></div>
      <div class="field"><label for="ab">Body</label><textarea class="input" id="ab" rows="14">${esc(JSON.parse(a.body || "[]").join("\n\n"))}</textarea></div></div>`,
    actions: [{ id: "x", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (d) => { await api("/api/website/articles", { body: { id: a.id, title: $("#at", d).value, section: $("#as", d).value, cluster: $("#ac", d).value, status: $("#ast", d).value, dek: $("#ad", d).value, body: $("#ab", d).value } }); toast("Saved."); articles(box, me); } }] });
  $("#adda")?.addEventListener("click", () => ed());
  $$("[data-ed]", box).forEach((b) => (b.onclick = () => ed(list.find((x) => x.id === b.dataset.ed))));
}

async function cases(box, me) {
  const { cases: list } = await api("/api/website/cases");
  box.innerHTML = `<div class="stack"><div class="note">Only add cases you have checked against a public source (a court order, an authority's release or reliable reporting). A published case must carry its source link.</div>
    ${me.can.edit ? `<div><button class="btn btn-primary" id="addc">${ico("plus")} Add a case</button></div>` : ""}
    ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Case</th><th>Action</th><th>Date</th><th>Published</th><th></th></tr></thead><tbody>${list.map((x) => `<tr><td><b>${esc(x.title)}</b><br><span class="small muted">${esc([x.brand, x.category, x.jurisdiction].filter(Boolean).join(" · "))}</span></td><td>${esc(x.action)}</td><td>${fmtDate(x.action_date)}</td><td>${x.published ? "Yes" : "No"}</td><td>${me.can.edit ? `<button class="btn btn-ghost btn-sm" data-ed="${esc(x.id)}">Edit</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No cases yet.</div>`}</div>`;
  const f = (id, label, v = "", type = "text") => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type}" value="${esc(v)}"></div>`;
  const ed = (x = {}) => dialog({ title: x.id ? "Edit case" : "Add a case", wide: true,
    body: `<div class="stack-sm">${f("ct", "Title", x.title)}<div class="field"><label for="cs">Summary</label><textarea class="input" id="cs" rows="4">${esc(x.summary || "")}</textarea></div>
      <div class="grid">${f("cb", "Brand", x.brand)}${f("cc", "Product category", x.category)}<div class="field"><label for="ca">Type of action</label><select class="select" id="ca">${["Court order", "Raid", "Seizure", "Takedown", "Regulatory action", "Conviction"].map((s) => `<option${s === x.action ? " selected" : ""}>${s}</option>`).join("")}</select></div>
      ${f("cj", "Jurisdiction", x.jurisdiction)}${f("cau", "Court or authority", x.authority)}${f("cd", "Date of action", x.action_date, "date")}</div>
      ${f("cu", "Public source link (https://)", x.source_url, "url")}
      <div class="row"><label class="row small"><input type="checkbox" id="co" ${x.status === "closed" ? "checked" : ""}> Concluded</label><label class="row small"><input type="checkbox" id="cp" ${x.published ? "checked" : ""}> Published on the website</label></div></div>`,
    actions: [{ id: "x", label: "Cancel" }, { id: "s", label: "Save", kind: "primary", handler: async (d) => { await api("/api/website/cases", { body: { id: x.id, title: $("#ct", d).value, summary: $("#cs", d).value, brand: $("#cb", d).value, category: $("#cc", d).value, action: $("#ca", d).value, jurisdiction: $("#cj", d).value, authority: $("#cau", d).value, action_date: $("#cd", d).value, source_url: $("#cu", d).value, status: $("#co", d).checked ? "closed" : "ongoing", published: $("#cp", d).checked } }); toast("Saved."); cases(box, me); } }] });
  $("#addc")?.addEventListener("click", () => ed());
  $$("[data-ed]", box).forEach((b) => (b.onclick = () => ed(list.find((x) => x.id === b.dataset.ed))));
}
