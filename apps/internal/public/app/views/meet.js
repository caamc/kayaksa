import { $, $$, api, esc, html, raw, ico, toast, dialog, confirmDialog, copyText, fmtDateTime, fmtBytes } from "/_shared/js/ui.js";

const KIND = { meeting: "Kayak meeting", client: "Client meeting", webinar: "Webinar" };
const mins = (a, b) => (a && b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null);

export async function render(main, ctx) {
  if (ctx.rest[0] === "quality") return quality(main);
  if (ctx.rest[0]) return detail(main, ctx.rest[0]);
  main.innerHTML = String(html`<div class="page"><div class="row muted"><span class="spinner"></span> Loading…</div></div>`);
  let r;
  try { r = await api("/api/meet"); } catch (e) { main.innerHTML = String(html`<div class="page"><div class="note warn">${e.message}</div></div>`); return; }
  const card = (m) => `<a class="card link stack-sm" href="#/meet/${esc(m.id)}">
      <div class="row between"><span class="eyebrow">${esc(KIND[m.kind] || m.kind)}</span>${m.status === "live" ? `<span class="badge danger">Live now</span>` : ""}</div>
      <h3>${esc(m.title)}</h3><span class="small muted">${m.starts_at ? fmtDateTime(m.starts_at) + ` · ${m.duration_min} min` : "Instant meeting"} · ${esc(m.host_name)}</span></a>`;
  main.innerHTML = `<div class="page">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">meet.kayaksa.com</span><h1>Kayak Meet</h1><p class="lead">Kayak's own meetings: browser to browser, end-to-end encrypted, with captions, minutes and recordings kept on Kayak's own platform.</p></div>
      <div class="row"><button class="btn btn-primary" id="now">${ico("play")} Meet now</button><button class="btn btn-ghost" id="sched">${ico("clock")} Schedule</button></div></div>
    <section class="grid"><div class="card flat kpi"><b>${r.upcoming.length}</b><span>Upcoming and live</span></div><div class="card flat kpi"><b>${r.recent.length}</b><span>Recent meetings</span></div><div class="card flat kpi"><b>${r.feedback?.avg ?? "—"}</b><span>Average rating, 30 days (${r.feedback?.n || 0} responses)</span></div></section>
    <section class="stack"><div class="row between"><h2>Upcoming</h2><a class="small" href="#/meet/quality">Feedback and improvements</a></div>
      ${r.upcoming.length ? `<div class="grid">${r.upcoming.map(card).join("")}</div>` : `<div class="empty"><p>No meetings scheduled.</p></div>`}</section>
    <section class="stack"><h2>Recent</h2>${r.recent.length ? `<div class="grid">${r.recent.map(card).join("")}</div>` : `<p class="muted">Meetings you've held appear here with their transcripts, minutes and recordings.</p>`}</section>
  </div>`;
  $("#now").onclick = async () => { const x = await api("/api/meet", { body: { title: "Instant meeting", kind: "meeting" } }); location.hash = `#/meet/${x.id}?go=1`; };
  $("#sched").onclick = () => schedule();
}

function schedule() {
  const d = new Date(Date.now() + 3600_000); d.setMinutes(0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  dialog({
    title: "Schedule a meeting",
    body: `<form id="sf" class="stack-sm">
      <div class="field"><label for="st">Title</label><input class="input" id="st" maxlength="140" required placeholder="Quarterly review with …"></div>
      <div class="field"><label for="sk">Type</label><select class="input" id="sk"><option value="meeting">Kayak meeting (colleagues)</option><option value="client">Client meeting (guests wait in a lobby)</option></select></div>
      <div class="row" style="gap:12px;flex-wrap:wrap"><div class="field" style="flex:1 1 200px"><label for="sw">When</label><input class="input" type="datetime-local" id="sw" value="${local}"></div>
      <div class="field" style="flex:0 1 140px"><label for="sd">Minutes</label><input class="input" type="number" id="sd" min="15" max="480" step="15" value="30"></div></div>
      <div class="field"><label for="si">Invite (emails, separated by commas)</label><textarea class="input" id="si" rows="3" placeholder="name@client.com, colleague@kayaksa.com"></textarea><span class="small muted">Each guest receives a personal link. Colleagues join from this portal.</span></div></form>`,
    actions: [{ id: "c", label: "Cancel" }, { id: "go", label: "Create meeting", kind: "primary", handler: async (dl) => {
      const title = $("#st", dl).value.trim();
      if (!title) { toast("Add a title.", "err"); return false; }
      const r = await api("/api/meet", { body: { title, kind: $("#sk", dl).value, startsAt: new Date($("#sw", dl).value).toISOString(), duration: +$("#sd", dl).value, invitees: $("#si", dl).value } });
      location.hash = `#/meet/${r.id}`;
    } }],
  });
}

async function detail(main, idq) {
  const [id, q] = idq.split("?");
  main.innerHTML = String(html`<div class="page"><div class="row muted"><span class="spinner"></span> Loading…</div></div>`);
  const r = await api(`/api/meet/${id}`);
  if (q === "go=1") { window.open(r.links.mine, "_blank", "noopener"); history.replaceState(null, "", `#/meet/${id}`); }
  const m = r.meeting;
  const ended = m.status === "ended";
  main.innerHTML = `<div class="page">
    <a class="small" href="#/meet">${ico("chevron")} Kayak Meet</a>
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">${esc(KIND[m.kind] || m.kind)} · ${esc(m.status)}</span><h1>${esc(m.title)}</h1>
      <p class="muted">${m.starts_at ? fmtDateTime(m.starts_at) + ` · ${m.duration_min} min` : "Instant meeting"} · Host ${esc(m.host_name)}${m.peak ? ` · up to ${m.peak} people` : ""}</p></div>
      <div class="row">${m.status !== "cancelled" ? `<a class="btn btn-primary" href="${esc(r.links.mine)}" target="_blank" rel="noopener">${ico("play")} ${r.manage ? "Start or join as host" : "Join"}</a>` : ""}</div></div>
    ${r.manage && m.status !== "cancelled" ? `<div class="card stack-sm"><h3>Invite people</h3>
      <div class="row wrap-row"><button class="btn btn-ghost btn-sm" id="cg">${ico("copy")} Copy guest link</button><button class="btn btn-ghost btn-sm" id="cs">${ico("copy")} Copy link for colleagues</button>${m.invitees.length ? `<button class="btn btn-ghost btn-sm" id="em">${ico("mail")} Email ${m.invitees.length} invitation${m.invitees.length > 1 ? "s" : ""}</button>` : ""}${!ended ? `<button class="btn btn-quiet btn-sm" id="cx">Cancel meeting</button>` : ""}</div>
      <p class="small muted">The guest link lets anyone who has it ask to join${m.kind === "client" ? "; you admit them from the lobby" : ""}. It expires 14 days after the meeting. Colleagues open the meeting from this portal to join with their own name.</p>
      ${m.invitees.length ? `<p class="small">Invited: ${m.invitees.map(esc).join(", ")}</p>` : ""}</div>` : ""}
    ${r.minutes ? `<div class="card stack-sm"><div class="row between"><h3>Minutes</h3><span class="small faint">Written by AI on Kayak's platform, ${fmtDateTime(r.minutes.created_at)}. Check before sharing.</span></div><div class="prose" id="mins"></div></div>` : ""}
    <div class="split">
      <div class="card stack-sm"><h3>Transcript</h3>${r.transcript.length ? `<div style="max-height:420px;overflow:auto" class="stack-sm">${r.transcript.map((t) => `<p class="small"><b>${esc(t.speaker)}</b> <span class="faint">${new Date(t.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span><br>${esc(t.text_en || t.text)}${t.text_en ? `<br><span class="faint">${esc(t.text)} (${esc(t.lang || "original")})</span>` : ""}</p>`).join("")}</div><button class="btn btn-ghost btn-sm" id="tx">${ico("download")} Download transcript</button>` : `<p class="muted small">No transcript. The host turns on captions during a meeting to create one. Speech in other languages is translated to English live.</p>`}</div>
      <div class="stack">
        <div class="card stack-sm"><h3>Attendance</h3>${r.attendance.length ? `<table class="table"><tbody>${r.attendance.map((a) => `<tr><td>${esc(a.name)}${a.email ? `<br><span class="small faint">${esc(a.email)}</span>` : ""}</td><td class="small">${esc(a.role)}</td><td class="small nowrap">${new Date(a.joined_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}${mins(a.joined_at, a.left_at) ? ` · ${mins(a.joined_at, a.left_at)} min` : ""}</td></tr>`).join("")}</tbody></table>` : `<p class="muted small">No one has joined yet.</p>`}</div>
        <div class="card stack-sm"><h3>Recordings</h3>${r.recordings.length ? r.recordings.map((x) => `<div class="row between"><span class="small">${fmtDateTime(x.started_at)} · ${fmtBytes(x.size)} · by ${esc(x.by_name)}</span>${x.status === "ready" && r.manage ? `<a class="btn btn-ghost btn-sm" href="/api/meet/${esc(m.id)}/rec/${esc(x.id)}">${ico("download")} Download</a>` : `<span class="badge">${esc(x.status)}</span>`}</div>`).join("") : `<p class="muted small">No recordings.</p>`}</div>
        <div class="card stack-sm"><h3>Feedback</h3>${r.feedback.length ? r.feedback.map((f) => `<p class="small"><b>${"★".repeat(f.overall)}${"☆".repeat(5 - f.overall)}</b> ${esc(f.name || "Anonymous")}${JSON.parse(f.issues || "[]").length ? ` · ${JSON.parse(f.issues).map(esc).join(", ")}` : ""}${f.comment ? `<br>${esc(f.comment)}` : ""}</p>`).join("") : `<p class="muted small">No feedback yet.</p>`}</div>
      </div></div></div>`;
  if (r.minutes) {
    const el = $("#mins");
    el.innerHTML = window.marked && window.DOMPurify ? window.DOMPurify.sanitize(window.marked.parse(r.minutes.summary)) : esc(r.minutes.summary).replace(/\n/g, "<br>");
  }
  $("#cg") && ($("#cg").onclick = () => copyText(r.links.guest));
  $("#cs") && ($("#cs").onclick = () => copyText(`${location.origin}/app#/meet/${m.id}`));
  $("#em") && ($("#em").onclick = async (e) => { e.target.disabled = true; try { const x = await api(`/api/meet/${m.id}/invite`, { method: "POST" }); toast(`${x.sent} invitation${x.sent === 1 ? "" : "s"} sent.`); } catch (x) { toast(x.message, "err"); } e.target.disabled = false; });
  $("#cx") && ($("#cx").onclick = async () => { if (await confirmDialog("Cancel this meeting?", "Invitation links stop working. People you invited are not told automatically.", "Cancel meeting", true)) { await api(`/api/meet/${m.id}/cancel`, { method: "POST" }); location.hash = "#/meet"; } });
  $("#tx") && ($("#tx").onclick = () => {
    const txt = `${m.title}\n${m.starts_at || ""}\n\n` + r.transcript.map((t) => `[${new Date(t.at).toLocaleTimeString("en-IN")}] ${t.speaker}: ${t.text_en ? `${t.text_en}\n    (original, ${t.lang || "?"}: ${t.text})` : t.text}`).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([txt], { type: "text/plain" })), download: `${m.title.replace(/[^\w -]+/g, "")} transcript.txt` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}

async function quality(main) {
  let r;
  try { r = await api("/api/meet/x/quality"); } catch (e) { main.innerHTML = String(html`<div class="page"><div class="note warn">${e.message}</div></div>`); return; }
  const s = r.summary || {};
  const ST = { proposed: ["Proposed", "warn"], approved: ["Approved", "ok"], rejected: ["Rejected", ""], done: ["Done", "accent"] };
  main.innerHTML = `<div class="page">
    <a class="small" href="#/meet">${ico("chevron")} Kayak Meet</a>
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayak Meet</span><h1>Feedback and improvements</h1><p class="lead">Every meeting ends with a short survey. Proposals are drafted from it, and nothing changes until an administrator approves.</p></div>
      <button class="btn btn-primary" id="draft">${ico("spark")} Draft improvements from feedback</button></div>
    <section class="grid">${[["Overall", s.overall], ["Sound", s.audio], ["Video", s.video], ["Ease of use", s.ease]].map(([l, v]) => `<div class="card flat kpi"><b>${v ?? "—"}</b><span>${l} (of 5)</span></div>`).join("")}<div class="card flat kpi"><b>${s.n || 0}</b><span>Responses, 90 days</span></div></section>
    ${r.issues.length ? `<div class="card stack-sm"><h3>Reported problems, 90 days</h3><div class="bars">${r.issues.map((i) => `<div class="row between"><span>${esc(i.issue)}</span><b>${i.n}</b></div>`).join("")}</div></div>` : ""}
    <section class="stack"><h2>Improvement log</h2>${r.improvements.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Proposal</th><th>Evidence</th><th>Status</th><th></th></tr></thead><tbody>${r.improvements.map((i) => `<tr><td><b>${esc(i.title)}</b><br><span class="small muted">${esc(i.detail)}</span></td><td class="small">${esc(i.evidence || "")}</td><td><span class="badge ${ST[i.status]?.[1] || ""}">${ST[i.status]?.[0] || esc(i.status)}</span>${i.decided_by ? `<br><span class="small faint">${esc(i.decided_by)}</span>` : ""}</td>
      <td class="nowrap">${i.status === "proposed" ? `<button class="btn btn-primary btn-sm" data-s="approved" data-id="${i.id}">Approve</button> <button class="btn btn-ghost btn-sm" data-s="rejected" data-id="${i.id}">Reject</button>` : i.status === "approved" ? `<button class="btn btn-ghost btn-sm" data-s="done" data-id="${i.id}">Mark done</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No proposals yet.</p>`}</section>
    <section class="stack"><h2>Latest responses</h2>${r.recent.length ? r.recent.map((f) => `<p class="small"><b>${"★".repeat(f.overall)}${"☆".repeat(5 - f.overall)}</b> ${esc(f.title || "")} · ${fmtDateTime(f.at)}${JSON.parse(f.issues || "[]").length ? ` · ${JSON.parse(f.issues).map(esc).join(", ")}` : ""}${f.comment ? `<br>${esc(f.comment)}` : ""}</p>`).join("") : `<p class="muted">No feedback yet.</p>`}</section></div>`;
  $("#draft").onclick = async (e) => { e.target.disabled = true; try { const x = await api("/api/meet/x/improvements/draft", { method: "POST" }); toast(`${x.count} proposals added for review.`); quality(main); } catch (x) { toast(x.message, "err"); e.target.disabled = false; } };
  $$("[data-s]").forEach((b) => (b.onclick = async () => { await api(`/api/meet/x/improvements/${b.dataset.id}`, { body: { status: b.dataset.s } }); quality(main); }));
}
