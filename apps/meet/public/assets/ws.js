// Meet by Kayak workspace: chat, channels, projects, direct messages, threads, tasks, files, meetings and Kayak AI.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const D = window.kayakDesktop || null; // present inside the Windows / Mac app

const P = {
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>', clip: '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>', more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  people: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  ai: '<path d="M12 3l1.9 4.8L19 9.5l-4.1 3.2L16.2 18 12 15.3 7.8 18l1.3-5.3L5 9.5l5.1-1.7z"/>', file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  reply: '<path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>', globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', back: '<path d="M15 18l-6-6 6-6"/>', bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  kayakers: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="4"/><rect x="3" y="13" width="8" height="8" rx="4"/><path d="M17 13v8M13 17h8"/>',
};
const ic = (n, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
const LANGS = { en: "English", hi: "Hindi", mr: "Marathi", gu: "Gujarati", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", bn: "Bengali", pa: "Punjabi", ur: "Urdu", ar: "Arabic", fr: "French", de: "German", es: "Spanish", it: "Italian", pt: "Portuguese", nl: "Dutch", ru: "Russian", uk: "Ukrainian", pl: "Polish", tr: "Turkish", fa: "Persian", he: "Hebrew", ja: "Japanese", zh: "Chinese", ko: "Korean", id: "Indonesian", ms: "Malay", th: "Thai", vi: "Vietnamese", sw: "Swahili", el: "Greek", sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian", cs: "Czech", ro: "Romanian", hu: "Hungarian", ne: "Nepali", si: "Sinhala", fil: "Filipino" };
const REACTS = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "💡"];
const COLORS = ["#17807E", "#2D6A9F", "#4B7A4E", "#5E4B78", "#B4472F", "#9C630E", "#1F4B5F", "#0B5654"];

const S = { me: null, channels: [], open: [], people: [], since: 0, at: "", view: "chat", cur: null, tab: "chat", msgs: [], more: false, lastRead: 0, viewer: false, thread: null, panel: null, prefs: {}, trans: {}, ai: false, mail: false, unreadTotal: 0 };
const app = $("#app");

// ------------------------------------------------------------------ helpers
async function api(path, opts = {}) {
  const r = await fetch("/api/ws" + path, { ...opts, headers: { ...(opts.body && typeof opts.body === "string" ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) } });
  if (r.status === 401) { location.href = "/login"; throw new Error("Signed out"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}
const post = (p, b, method = "POST") => api(p, { method, body: JSON.stringify(b || {}) });
function toast(t, ms = 4000) {
  let box = $(".toasts"); if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); document.body.append(box); }
  const el = document.createElement("div"); el.className = "toast"; el.textContent = t; box.append(el); setTimeout(() => el.remove(), ms);
}
const person = (id) => S.people.find((p) => p.id === id);
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
const color = (id) => COLORS[[...String(id || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const av = (id, name, cls = "") => { const p = person(id); return `<span class="av ${cls}" style="background:${color(id)}" aria-hidden="true">${esc(initials(name || p?.name))}${p?.online && p.id !== S.me.id ? '<i class="on"></i>' : ""}</span>`; };
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDay = (iso) => { const d = new Date(iso), t = new Date(); const y = new Date(Date.now() - 864e5); return d.toDateString() === t.toDateString() ? "Today" : d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }); };
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const chName = (ch) => { if (!ch) return ""; if (ch.kind !== "dm") return ch.name; const o = (ch.member_ids || []).find((i) => i !== S.me.id); return person(o)?.name || "Direct message"; };
const isEmp = () => S.me.kind === "employee";

/** Safe formatting: escape first, then **bold**, _italic_, `code`, links and @mentions. */
function fmt(text) {
  let h = esc(text);
  h = h.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  h = h.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1<i>$2</i>");
  h = h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  for (const p of S.people) if (p.name && h.includes("@" + esc(p.name))) h = h.split("@" + esc(p.name)).join(`<span class="mention">@${esc(p.name)}</span>`);
  return h;
}
/** Small Markdown renderer for AI summaries (escaped first). */
function md(text) {
  const out = []; let list = false;
  for (const raw of String(text || "").split("\n")) {
    const l = esc(raw.trim()).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    if (/^[-*•]\s+/.test(raw.trim())) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${l.replace(/^[-*•]\s+/, "")}</li>`); continue; }
    if (list) { out.push("</ul>"); list = false; }
    if (!l) continue;
    if (/^#{1,4}\s/.test(raw.trim())) out.push(`<h3>${l.replace(/^#+\s*/, "")}</h3>`); else out.push(`<p>${l}</p>`);
  }
  if (list) out.push("</ul>");
  return `<div class="md">${out.join("")}</div>`;
}
function menu(anchor, items) {
  $(".menu")?.remove();
  const m = document.createElement("div"); m.className = "menu"; m.setAttribute("role", "menu");
  m.innerHTML = items.map((it, i) => (it === "-" ? "<hr>" : `<button role="menuitem" data-i="${i}">${it[0]}</button>`)).join("");
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.min(innerWidth - m.offsetWidth - 8, r.left) + "px";
  m.style.top = (r.bottom + m.offsetHeight + 8 > innerHeight ? r.top - m.offsetHeight - 4 : r.bottom + 4) + "px";
  m.onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) { m.remove(); items[+b.dataset.i][1](); } };
  setTimeout(() => document.addEventListener("click", () => m.remove(), { once: true }), 0);
  m.querySelector("button")?.focus();
}
function dialog(html, onMount) {
  const d = document.createElement("dialog"); d.innerHTML = html; document.body.append(d);
  d.addEventListener("close", () => d.remove());
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  $$("[data-close]", d).forEach((b) => (b.onclick = (e) => { e.preventDefault(); d.close(); }));
  d.showModal(); onMount?.(d);
  return d;
}
async function copy(text, label = "Copied") { try { await navigator.clipboard.writeText(text); toast(label); } catch { prompt("Copy this:", text); } }

// ------------------------------------------------------------------ boot
boot();
async function boot() {
  try {
    const b = await api("/boot");
    Object.assign(S, { me: b.me, channels: b.channels, open: b.open, people: b.people, since: b.since, at: b.at, ai: b.ai, mail: b.mail, todoDue: b.todoDue || 0 });
  } catch (e) { app.innerHTML = `<div class="ws-loading"><p>${esc(e.message)}</p><a class="btn" href="/login">Sign in again</a></div>`; return; }
  if (D) { try { S.prefs = (await D.prefs()) || {}; } catch {} D.onCommand((cmd, arg) => { if (cmd === "settings") S.prefs = arg || S.prefs; if (cmd === "toast") toast(arg); }); }
  shell();
  route();
  addEventListener("hashchange", route);
  poll();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(true); });
}
function route() {
  const h = location.hash.slice(1);
  if (h === "new") { history.replaceState(null, "", "#meetings"); go("meetings"); return newMeeting(); }
  if (h === "join") { history.replaceState(null, "", "#meetings"); go("meetings"); return joinCode(); }
  if (["meetings","tasks","todo","planner"].includes(h) || (h === "kayakers" && isEmp())) return go(h);
  if (h.startsWith("calendar")) {
    const msg = { "calendar-connected": "Your calendar is connected. Meet meetings now appear in it, and its events in Planner.", "calendar-failed": "The calendar couldn't be connected. Try again, or ask Kayak IT.", "calendar-cancelled": "Calendar connection cancelled.", "calendar-unavailable": "Calendar sync hasn't been switched on yet by Kayak IT." }[h];
    history.replaceState(null, "", "#planner"); go("planner"); if (msg) toast(msg); if (h === "calendar" || h === "calendar-connected") calendarDialog(); return;
  }
  const m = h.match(/^c\/([a-z0-9]+)(?:\/(tasks|files))?$/);
  if (m) return openChannel(m[1], m[2] || "chat");
  const first = S.channels.find((c) => c.kind !== "dm") || S.channels[0];
  if (first && innerWidth > 760) openChannel(first.id); else go("chat");
}
function go(view) {
  S.view = view; S.panel = null; S.thread = null;
  if (view !== "chat") { S.cur = null; if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view); }
  shell();
}

// ------------------------------------------------------------------ layout
function shell() {
  app.className = "ws" + (S.view === "chat" && !S.cur ? " show-side" : "");
  app.innerHTML = `
    <nav class="rail" aria-label="Main">
      <img class="brand" src="/_shared/logos/MeetByKayak_Mark_Reversed.svg" alt="Meet by Kayak">
      <button data-v="chat" ${S.view === "chat" ? 'aria-current="page"' : ""}>${ic("chat")}Chat${S.unreadTotal ? `<span class="dot">${S.unreadTotal > 99 ? "99+" : S.unreadTotal}</span>` : ""}</button>
      <button data-v="meetings" ${S.view === "meetings" ? 'aria-current="page"' : ""}>${ic("video")}Meetings</button>
      <button data-v="todo" ${S.view === "todo" ? 'aria-current="page"' : ""}>${ic("tasks")}To-Do${S.todoDue ? `<span class="dot">${S.todoDue > 99 ? "99+" : S.todoDue}</span>` : ""}</button>
      <button data-v="planner" ${S.view === "planner" ? 'aria-current="page"' : ""}>${ic("cal")}Planner</button>
      ${isEmp() ? `<button data-v="kayakers" ${S.view === "kayakers" ? 'aria-current="page"' : ""}>${ic("kayakers")}Kayakers</button>` : ""}
      <span class="sp"></span>
      <button id="meBtn" aria-label="Profile and settings">${av(S.me.id, S.me.name, "sm")}<span>You</span></button>
    </nav>
    <aside class="side" id="side"></aside>
    <section class="main" id="main" aria-live="polite"></section>
    <aside class="panel" id="panel" hidden></aside>`;
  $$(".rail [data-v]").forEach((b) => (b.onclick = () => { if (b.dataset.v === "chat") { S.view = "chat"; if (innerWidth <= 760) { S.cur = null; } shell(); if (S.cur) renderMain(); } else go(b.dataset.v); }));
  $("#meBtn").onclick = (e) => profileMenu(e.currentTarget);
  renderSide();
  renderMain();
  renderPanel();
}
function renderSide() {
  const side = $("#side"); if (!side) return;
  const groups = [["project", "Projects"], ["channel", "Channels"], ["dm", "Direct messages"]];
  side.innerHTML = `
    <div class="side-h"><h1>Chat</h1>${isEmp() ? `<button class="ib" id="newCh" aria-label="New channel or project" title="New channel or project">${ic("plus")}</button>` : ""}</div>
    <label class="search">${ic("search")}<input id="q" placeholder="Search messages and tasks" aria-label="Search"></label>
    <div class="side-list">${groups.map(([k, label]) => {
      const list = S.channels.filter((c) => c.kind === k);
      if (!list.length && k === "project" && !isEmp()) return "";
      return `<div class="grp"><span>${label}</span>${k === "dm" ? `<button class="ib" id="newDm" aria-label="New message">${ic("plus")}</button>` : ""}</div>` +
        (list.length ? list.map((c) => {
          const unread = c.unread && !c.muted && c.id !== S.cur?.id;
          const dmP = c.kind === "dm" ? person((c.member_ids || []).find((i) => i !== S.me.id)) : null;
          return `<button class="item${unread ? " unread" : ""}" data-c="${c.id}" ${S.cur?.id === c.id ? 'aria-current="page"' : ""}>${c.kind === "dm" ? av(dmP?.id, dmP?.name, "xs") : `<span class="hash">${c.kind === "project" ? "◆" : c.private ? ic("lock", "ico") .replace('class="ico"', 'class="ico" style="width:14px;height:14px"') : "#"}</span>`}<span class="nm">${esc(chName(c))}</span>${c.external ? '<span class="ext" title="Includes people outside Kayak">Ext</span>' : ""}${unread ? `<span class="n">${c.unread > 99 ? "99+" : c.unread}</span>` : ""}</button>`;
        }).join("") : `<p class="mk-small" style="padding:4px 10px;color:var(--faint);font-size:.85rem">${k === "dm" ? "Start a conversation with the + button." : "None yet."}</p>`);
    }).join("")}
    ${S.open.length ? `<div class="grp"><span>Open Kayak channels</span></div>${S.open.slice(0, 30).map((c) => `<button class="item" data-join="${c.id}"><span class="hash">#</span><span class="nm">${esc(c.name)}</span><small style="color:var(--faint)">Join</small></button>`).join("")}` : ""}
    </div>`;
  $$("[data-c]", side).forEach((b) => (b.onclick = () => openChannel(b.dataset.c)));
  $$("[data-join]", side).forEach((b) => (b.onclick = async () => { await post(`/channels/${b.dataset.join}/join`); await refreshBoot(); openChannel(b.dataset.join); }));
  $("#newCh") && ($("#newCh").onclick = newChannel);
  $("#newDm").onclick = newDm;
  const q = $("#q"); let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => search(q.value.trim()), 300); };
}
async function refreshBoot() {
  const b = await api("/boot");
  Object.assign(S, { channels: b.channels, open: b.open, people: b.people });
  if (S.cur) S.cur = S.channels.find((c) => c.id === S.cur.id) || S.cur;
  updateBadge(); renderSide();
}
function updateBadge() {
  S.unreadTotal = S.channels.filter((c) => !c.muted && c.id !== S.cur?.id).reduce((a, c) => a + (c.unread || 0), 0);
  const dot = $(".rail [data-v=chat] .dot");
  const btn = $(".rail [data-v=chat]");
  if (btn) { dot?.remove(); if (S.unreadTotal) btn.insertAdjacentHTML("beforeend", `<span class="dot">${S.unreadTotal > 99 ? "99+" : S.unreadTotal}</span>`); }
  document.title = (S.unreadTotal ? `(${S.unreadTotal}) ` : "") + "Meet by Kayak";
  D?.setBadge(S.unreadTotal);
}

// ------------------------------------------------------------------ conversation
async function openChannel(id, tab = "chat") {
  let ch = S.channels.find((c) => c.id === id);
  if (!ch) { await refreshBoot().catch(() => {}); ch = S.channels.find((c) => c.id === id); }
  if (!ch) { try { const r = await api(`/channels/${id}`); ch = { ...r.channel, member_ids: r.members.map((m) => m.id), role: r.role }; } catch (e) { toast(e.message); return go("chat"); } }
  const changed = S.cur?.id !== id;
  S.view = "chat"; S.cur = ch; S.tab = tab;
  if (changed) { S.thread = null; S.panel = null; S.msgs = []; }
  const want = "#c/" + id + (tab !== "chat" ? "/" + tab : "");
  if (location.hash !== want) history.replaceState(null, "", want);
  shell();
  if (tab === "chat") await loadMessages();
}
function renderMain() {
  const main = $("#main"); if (!main) return;
  if (S.view === "meetings") return renderMeetings(main);
  if (S.view === "todo") return renderTodo(main);
  if (S.view === "planner") return renderPlanner(main);
  if (S.view === "kayakers") return renderKayakers(main);
  const ch = S.cur;
  if (!ch) { main.innerHTML = `<div class="empty"><img src="/_shared/logos/MeetByKayak_Mark_FullColour.svg" width="96" alt=""><h3>Welcome, ${esc(S.me.name.split(" ")[0])}</h3><p>${isEmp() ? "Pick a conversation, or start a channel for a client engagement." : "Pick a conversation to continue working with Kayak."}</p></div>`; return; }
  const members = (ch.member_ids || []).length;
  main.innerHTML = `
    <header class="top">
      <button class="ib back" id="back" aria-label="Back to conversations">${ic("back")}</button>
      <div class="t"><h2>${ch.kind === "dm" ? "" : ch.kind === "project" ? "◆ " : "# "}${esc(chName(ch))}${ch.external ? '<span class="ext" title="People outside Kayak are in this conversation">External</span>' : ""}</h2>
        <small>${ch.topic ? esc(ch.topic) : ch.kind === "dm" ? "Direct message" : `${members} ${members === 1 ? "person" : "people"}`}${ch.due ? ` · due ${new Date(ch.due).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}` : ""}</small></div>
      <button class="btn s" id="meetNow" title="Start a meeting with everyone here">${ic("video")}<span class="lbl">Meet now</span></button>
      ${S.ai ? `<button class="btn" id="sum" title="Kayak AI: summarise this conversation">${ic("ai")}<span class="lbl">Recap</span></button>` : ""}
      ${ch.kind !== "dm" ? `<button class="btn ghost" id="ppl" aria-label="People">${ic("people")}<span class="lbl">${members}</span></button>` : ""}
      <button class="ib" id="chMore" aria-label="More">${ic("more")}</button>
    </header>
    ${ch.kind !== "dm" ? `<div class="tabs" role="tablist">${[["chat", "Conversation"], ["tasks", ch.kind === "project" ? "Board" : "Tasks"], ["files", "Files"]].map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}</button>`).join("")}</div>` : ""}
    <div class="body" id="body"></div>
    ${S.tab === "chat" ? composerHtml("main") : ""}`;
  $("#back").onclick = () => { S.cur = null; S.view = "chat"; history.replaceState(null, "", "#"); shell(); };
  $("#meetNow").onclick = () => startMeeting(ch);
  $("#sum") && ($("#sum").onclick = () => summarise());
  $("#ppl") && ($("#ppl").onclick = () => { S.panel = S.panel === "people" ? null : "people"; renderPanel(); });
  $("#chMore").onclick = (e) => channelMenu(e.currentTarget);
  $$("[data-tab]", main).forEach((b) => (b.onclick = () => openChannel(ch.id, b.dataset.tab)));
  if (S.tab === "chat") { renderMessages(); wireComposer("main"); }
  else if (S.tab === "tasks") renderBoard($("#body"));
  else renderFiles($("#body"));
}
async function loadMessages(before) {
  const ch = S.cur; if (!ch) return;
  const r = await api(`/channels/${ch.id}/messages${before ? `?before=${before}` : ""}`).catch((e) => { toast(e.message); return null; });
  if (!r || S.cur?.id !== ch.id) return;
  S.msgs = before ? [...r.messages, ...S.msgs] : r.messages;
  S.more = r.more; S.viewer = r.viewer;
  if (!before) S.lastRead = r.lastRead;
  renderMessages(!before);
  markRead();
}
function markRead() {
  const ch = S.cur; if (!ch || !S.msgs.length || document.hidden) return;
  const last = S.msgs[S.msgs.length - 1].id;
  const c = S.channels.find((x) => x.id === ch.id);
  if (c && (c.unread || (c.last_read || 0) < last)) { c.unread = 0; c.last_read = last; post(`/channels/${ch.id}/read`, { id: last }).catch(() => {}); updateBadge(); renderSide(); }
}
function msgHtml(m, prev, inThread = false) {
  if (m.kind === "system" || m.kind === "task") return `<div class="sys">${m.kind === "task" ? ic("tasks", "ico") + " " : ""}${esc(m.body)} <time>${fmtTime(m.created_at)}</time></div>`;
  if (m.kind === "recap") return `<div class="recap"><h4>${ic("ai", "ico")} Kayak AI recap${m.meta?.by ? ` · shared by ${esc(m.meta.by)}` : ""}</h4>${md(m.body)}</div>`;
  if (m.kind === "meeting") {
    const mt = m.meta || {};
    return `<div class="msg"><span class="av" style="background:#0E2F3C">${ic("video", "ico")}</span><div><div class="tx">${esc(m.body)}</div>
      <div class="card"><span class="ci">${ic("video")}</span><div><b>${esc(mt.title || "Meeting")}</b><small>${mt.startsAt ? new Date(mt.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Now"} · Meet by Kayak</small></div><a class="btn p sm" href="/${esc(mt.meeting)}" data-meet="${esc(mt.meeting)}">Join</a></div></div></div>`;
  }
  const cont = prev && prev.member_id === m.member_id && prev.kind === "text" && !inThread === !prev.parent_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
  const mine = m.member_id === S.me.id;
  const tr = S.trans[m.id];
  const file = m.kind === "file" && m.meta ? `<div class="card"><span class="ci f">${ic("file")}</span><div><b>${esc(m.meta.name)}</b><small>${fmtSize(m.meta.size)}</small></div><a class="btn sm" href="/files/${esc(m.meta.file)}" download>${ic("download")} Download</a></div>${/^image\/(png|jpeg|gif|webp)$/.test(m.meta.type) ? `<img class="imgprev" loading="lazy" src="/files/${esc(m.meta.file)}?inline=1" alt="${esc(m.meta.name)}">` : ""}` : "";
  const reacts = Object.entries(m.reactions || {}).map(([e, ids]) => `<button data-react="${m.id}" data-e="${e}" class="${ids.includes(S.me.id) ? "mine" : ""}" title="${esc(ids.map((i) => person(i)?.name || "Someone").join(", "))}">${e} ${ids.length}</button>`).join("");
  return `<div class="msg${cont ? " cont" : ""}" data-id="${m.id}">${av(m.member_id, m.author)}<div>
    ${cont ? "" : `<div class="who"><b>${esc(m.author || "Kayak")}</b>${person(m.member_id)?.kind === "client" ? `<span class="ext">${esc(person(m.member_id)?.org || "Client")}</span>` : ""}<time datetime="${m.created_at}">${fmtTime(m.created_at)}</time></div>`}
    ${m.deleted ? `<div class="tx" style="color:var(--faint);font-style:italic">This message was deleted.</div>` : `${m.kind === "file" && m.body === m.meta?.name ? "" : `<div class="tx">${fmt(m.body)}${m.edited_at && m.kind === "text" && !Object.keys(m.reactions || {}).length ? ' <span class="edited">(edited)</span>' : ""}</div>`}${file}`}
    ${tr ? `<div class="tr">${esc(tr.text)}<small>Translated to ${esc(LANGS[tr.to] || tr.to)} by Kayak AI</small></div>` : ""}
    ${reacts ? `<div class="reacts">${reacts}</div>` : ""}
    ${!inThread && m.replies ? `<button class="thr" data-thread="${m.id}">${m.replies} ${m.replies === 1 ? "reply" : "replies"}</button>` : ""}
    </div>
    ${m.deleted ? "" : `<div class="acts" role="toolbar" aria-label="Message actions"><button data-rx="${m.id}" title="React" aria-label="React">🙂</button>${!inThread ? `<button data-thread="${m.id}" title="Reply in thread" aria-label="Reply in thread">${ic("reply")}</button>` : ""}${S.ai && m.kind === "text" ? `<button data-tr="${m.id}" title="Translate" aria-label="Translate">${ic("globe")}</button>` : ""}${mine ? `<button data-mm="${m.id}" aria-label="More">${ic("more")}</button>` : ""}</div>`}
  </div>`;
}
function renderMessages(scroll = true) {
  const body = $("#body"); if (!body || S.tab !== "chat") return;
  const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  let html = S.more ? `<div style="text-align:center;padding:10px"><button class="btn sm" id="older">Load earlier messages</button></div>` : "";
  let prev = null, day = "";
  const firstUnread = S.msgs.find((m) => m.id > S.lastRead && m.member_id !== S.me.id && m.kind === "text");
  for (const m of S.msgs) {
    const d = fmtDay(m.created_at);
    if (d !== day) { html += `<div class="day">${d}</div>`; day = d; prev = null; }
    if (firstUnread && m.id === firstUnread.id) html += `<div class="newline"><span>New</span></div>`;
    html += msgHtml(m, prev); prev = m;
  }
  if (!S.msgs.length) html += `<div class="empty">${ic("chat")}<h3>${S.cur.kind === "dm" ? "Say hello" : "This is the start of " + esc(chName(S.cur))}</h3><p>${S.cur.external ? "People outside Kayak are in this conversation. Share only what they should see." : "Messages here stay between the people in this conversation."}</p></div>`;
  body.innerHTML = `<div class="msgs">${html}</div>`;
  wireMessages(body);
  if (scroll || atBottom) body.scrollTop = body.scrollHeight;
  $("#older") && ($("#older").onclick = () => loadMessages(S.msgs[0]?.id));
}
function wireMessages(root) {
  $$("[data-thread]", root).forEach((b) => (b.onclick = () => openThread(+b.dataset.thread)));
  $$("[data-react]", root).forEach((b) => (b.onclick = () => react(+b.dataset.react, b.dataset.e)));
  $$("[data-rx]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); menu(b, REACTS.map((x) => [`<span style="font-size:1.2rem">${x}</span>`, () => react(+b.dataset.rx, x)])); }));
  $$("[data-tr]", root).forEach((b) => (b.onclick = () => translate(+b.dataset.tr)));
  $$("[data-mm]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); msgMenu(b, +b.dataset.mm); }));
  $$("[data-meet]", root).forEach((a) => (a.onclick = (e) => { e.preventDefault(); joinRoom(a.dataset.meet); }));
}
const findMsg = (id) => S.msgs.find((m) => m.id === id) || S.thread?.msgs.find((m) => m.id === id);
async function react(id, e) {
  try { const r = await post(`/messages/${id}/react`, { emoji: e }); const m = findMsg(id); if (m) m.reactions = r.reactions; rerender(); } catch (x) { toast(x.message); }
}
async function translate(id) {
  const m = findMsg(id); if (!m) return;
  if (S.trans[id]) { delete S.trans[id]; return rerender(); }
  const to = S.me.lang && S.me.lang !== "en" ? S.me.lang : "en";
  try { S.trans[id] = await post("/translate", { text: m.body, to }); rerender(); } catch (e) { toast(e.message); }
}
function msgMenu(anchor, id) {
  const m = findMsg(id);
  menu(anchor, [
    ["Edit", () => editMsg(m)],
    ["Copy text", () => copy(m.body)],
    "-",
    ['<span style="color:var(--danger)">Delete</span>', async () => { await api(`/messages/${id}`, { method: "DELETE" }); m.deleted = true; m.body = ""; rerender(); }],
  ]);
}
function editMsg(m) {
  dialog(`<form><h3>Edit message</h3><div class="fld"><textarea id="ed" rows="5" maxlength="8000">${esc(m.body)}</textarea></div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Save</button></div></form>`, (d) => {
    $("form", d).onsubmit = async (e) => { e.preventDefault(); const v = $("#ed", d).value.trim(); if (!v) return; try { await post(`/messages/${m.id}`, { body: v }, "PATCH"); m.body = v; m.edited_at = new Date().toISOString(); d.close(); rerender(); } catch (x) { toast(x.message); } };
  });
}
function rerender() { renderMessages(false); if (S.thread) renderPanel(); }

// composer (main conversation and thread panel)
function composerHtml(where) {
  const ph = where === "thread" ? "Reply in thread" : S.cur ? `Message ${S.cur.kind === "dm" ? chName(S.cur) : (S.cur.kind === "project" ? "◆ " : "#") + chName(S.cur)}` : "Message";
  return `<div class="comp" style="position:relative" data-where="${where}"><div class="comp-box"><textarea rows="1" maxlength="8000" placeholder="${esc(ph)}" aria-label="${esc(ph)}"></textarea>
    <div class="comp-bar"><label class="ib" title="Attach a file (up to 25 MB)" aria-label="Attach a file">${ic("clip")}<input type="file" hidden multiple></label><span class="sp"></span><button class="btn p sm" data-send aria-label="Send">${ic("send")}</button></div></div>
    <div class="comp-hint">Enter to send · Shift+Enter for a new line · **bold** · _italic_ · \`code\` · @ to mention</div></div>`;
}
function wireComposer(where) {
  const box = $(`.comp[data-where="${where}"]`); if (!box) return;
  const ta = $("textarea", box);
  const draftKey = `km:draft:${S.cur?.id}:${where === "thread" ? S.thread?.id : ""}`;
  try { ta.value = sessionStorage.getItem(draftKey) || ""; } catch {}
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(200, ta.scrollHeight) + "px"; };
  grow();
  let pop = null, sel = 0, matches = [];
  const closePop = () => { pop?.remove(); pop = null; };
  ta.oninput = () => {
    grow();
    try { sessionStorage.setItem(draftKey, ta.value); } catch {}
    const before = ta.value.slice(0, ta.selectionStart);
    const at = before.match(/@([\w .'-]{0,30})$/);
    if (!at) return closePop();
    const ids = new Set(S.cur?.member_ids || []);
    matches = S.people.filter((p) => ids.has(p.id) && p.id !== S.me.id && p.name.toLowerCase().includes(at[1].toLowerCase())).slice(0, 8);
    if (!matches.length) return closePop();
    if (!pop) { pop = document.createElement("div"); pop.className = "mention-pop"; box.append(pop); }
    sel = 0;
    const draw = () => { pop.innerHTML = matches.map((p, i) => `<button data-i="${i}" aria-selected="${i === sel}">${av(p.id, p.name, "xs")}${esc(p.name)}</button>`).join(""); $$("[data-i]", pop).forEach((b) => (b.onmousedown = (e) => { e.preventDefault(); pick(+b.dataset.i); })); };
    pop.draw = draw; draw();
  };
  const pick = (i) => {
    const p = matches[i]; if (!p) return;
    const pos = ta.selectionStart, before = ta.value.slice(0, pos).replace(/@([\w .'-]{0,30})$/, "@" + p.name + " ");
    ta.value = before + ta.value.slice(pos); ta.selectionStart = ta.selectionEnd = before.length; closePop(); ta.focus();
  };
  ta.onkeydown = (e) => {
    if (pop) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length; pop.draw(); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); return pick(sel); }
      if (e.key === "Escape") return closePop();
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    if (e.key === "ArrowUp" && !ta.value) { const mine = [...(where === "thread" ? S.thread.msgs : S.msgs)].reverse().find((m) => m.member_id === S.me.id && m.kind === "text" && !m.deleted); if (mine) { e.preventDefault(); editMsg(mine); } }
  };
  const send = async () => {
    const body = ta.value.trim(); if (!body || !S.cur) return;
    ta.value = ""; grow(); try { sessionStorage.removeItem(draftKey); } catch {}
    try {
      const r = await post(`/channels/${S.cur.id}/messages`, { body, parent_id: where === "thread" ? S.thread.id : undefined });
      const m = { id: r.id, channel_id: S.cur.id, member_id: S.me.id, author: S.me.name, parent_id: where === "thread" ? S.thread.id : null, body, kind: "text", reactions: {}, created_at: new Date().toISOString(), replies: 0 };
      if (where === "thread") { S.thread.msgs.push(m); const root = S.msgs.find((x) => x.id === S.thread.id); if (root) root.replies = (root.replies || 0) + 1; renderPanel(); renderMessages(false); }
      else { S.msgs.push(m); renderMessages(true); }
    } catch (e) { ta.value = body; toast(e.message); }
  };
  $("[data-send]", box).onclick = send;
  $("input[type=file]", box).onchange = (e) => { [...e.target.files].forEach(upload); e.target.value = ""; };
  box.ondragover = (e) => { e.preventDefault(); };
  box.ondrop = (e) => { e.preventDefault(); [...e.dataTransfer.files].forEach(upload); };
  ta.onpaste = (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); f.forEach(upload); } };
  if (where === "main" && innerWidth > 760) ta.focus();
}
async function upload(file) {
  if (file.size > 25 * 1024 * 1024) return toast(`${file.name} is larger than 25 MB.`);
  const t = toast.bind(null);
  t(`Uploading ${file.name}…`, 2500);
  const r = await fetch(`/api/ws/channels/${S.cur.id}/files`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) }, body: file });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return toast(j.error || "Upload failed.");
  await pollOnce();
}

// thread and side panels
async function openThread(id) {
  const r = await api(`/channels/${S.cur.id}/messages?parent=${id}`).catch((e) => toast(e.message));
  if (!r) return;
  S.thread = { id, msgs: r.messages }; S.panel = "thread"; renderPanel();
}
function renderPanel() {
  const p = $("#panel"); if (!p) return;
  p.hidden = !S.panel;
  if (!S.panel) { p.innerHTML = ""; return; }
  const head = (t, extra = "") => `<header><h3>${t}</h3>${extra}<button class="ib" id="pclose" aria-label="Close">${ic("x")}</button></header>`;
  if (S.panel === "thread" && S.thread) {
    const [root, ...replies] = S.thread.msgs;
    p.innerHTML = head("Thread", S.ai ? `<button class="btn sm" id="tsum">${ic("ai")} Summarise</button>` : "") + `<div class="pb msgs">${root ? msgHtml(root, null, true) : ""}<div class="day">${replies.length} ${replies.length === 1 ? "reply" : "replies"}</div>${replies.map((m, i) => msgHtml(m, replies[i - 1], true)).join("")}</div>${composerHtml("thread")}`;
    wireMessages(p); wireComposer("thread");
    $(".pb", p).scrollTop = 1e9;
    $("#tsum") && ($("#tsum").onclick = () => summarise(S.thread.id));
  } else if (S.panel === "people") return renderPeoplePanel(p, head);
  else if (S.panel === "summary") {
    p.innerHTML = head("Kayak AI recap") + `<div class="pb"><div class="pad" id="sumBody"><p class="mk-small">Reading the conversation…</p></div></div>`;
  }
  $("#pclose").onclick = () => { S.panel = null; S.thread = null; renderPanel(); };
}
async function renderPeoplePanel(p, head) {
  const r = await api(`/channels/${S.cur.id}`).catch((e) => toast(e.message)); if (!r) return;
  S.cur.member_ids = r.members.map((m) => m.id);
  p.innerHTML = head(`People (${r.members.length})`) + `<div class="pb">
    ${r.manage || (isEmp() && r.role !== "viewer") ? `<div class="pad" style="margin-bottom:10px"><button class="btn p" id="addP">${ic("plus")} Add people</button></div>` : ""}
    ${r.members.map((m) => `<div class="person">${av(m.id, m.name)}<div><b>${esc(m.name)}${m.id === S.me.id ? " (you)" : ""}</b><small>${m.kind === "client" ? `${esc(m.org || "Client")}${m.status === "invited" ? " · invitation pending" : ""}` : "Kayak"}${m.role === "owner" ? " · owner" : ""}</small></div>
      ${m.id !== S.me.id ? `<button class="ib" data-pm="${m.id}" aria-label="Options for ${esc(m.name)}">${ic("more")}</button>` : ""}</div>`).join("")}
    ${r.manage ? `<div class="pad" style="margin-top:16px"><h3 class="sec" style="font-size:.95rem">Connected apps</h3>${r.integrations.length ? r.integrations.map((i) => `<div class="chip">${esc(i.label)} <small>${esc(i.last_status || "not used yet")}</small><button data-rmint="${i.id}" aria-label="Disconnect">✕</button></div>`).join("") : '<small style="color:var(--muted)">Send this channel\'s recaps and task updates to Slack or any app that accepts webhooks (HubSpot workflows, Zapier, Power Automate).</small>'}<button class="btn sm" id="addInt">${ic("link")} Connect an app</button></div>` : ""}
  </div>`;
  $("#pclose").onclick = () => { S.panel = null; renderPanel(); };
  $("#addP") && ($("#addP").onclick = addPeople);
  $("#addInt") && ($("#addInt").onclick = addIntegration);
  $$("[data-rmint]", p).forEach((b) => (b.onclick = async () => { await api(`/channels/${S.cur.id}/integrations/${b.dataset.rmint}`, { method: "DELETE" }); renderPanel(); }));
  $$("[data-pm]", p).forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const m = r.members.find((x) => x.id === b.dataset.pm);
    const items = [["Message", () => dmWith(m.id)]];
    if (isEmp() && m.kind === "client") items.push(["Reset sign-in (new invitation link)", () => resetClient(m)], ["Turn off access", () => disableClient(m)]);
    if (r.manage) items.push("-", ['<span style="color:var(--danger)">Remove from channel</span>', async () => { await api(`/channels/${S.cur.id}/members/${m.id}`, { method: "DELETE" }); await refreshBoot(); renderPanel(); }]);
    menu(b, items);
  }));
}
async function resetClient(m) {
  if (!confirm(`Reset ${m.name}'s sign-in? They'll need the new invitation link to set up their authenticator again.`)) return;
  const r = await post(`/people/${m.id}/reset`).catch((e) => toast(e.message)); if (!r) return;
  inviteLinks([{ email: m.name, link: r.link }]);
}
async function disableClient(m) {
  if (!confirm(`Turn off ${m.name}'s access to Meet by Kayak? They are signed out everywhere at once.`)) return;
  await post(`/people/${m.id}/disable`).catch((e) => toast(e.message)); toast("Access turned off."); await refreshBoot(); renderPanel();
}
function inviteLinks(list) {
  dialog(`<div class="dlg"><h3>Send the invitation link${list.length > 1 ? "s" : ""}</h3><p>${S.mail ? "Some invitations could not be emailed." : "Email isn't set up yet, so send each person their link yourself."} Each link works once and expires in 7 days. Send it only to that person.</p>
    ${list.map((i, n) => `<div class="fld"><label>${esc(i.email)}</label><div class="copy"><input readonly value="${esc(i.link)}" id="lk${n}"><button class="btn sm" data-cp="${n}">Copy</button></div></div>`).join("")}
    <div class="foot"><button class="btn p" data-close>Done</button></div></div>`, (d) => $$("[data-cp]", d).forEach((b) => (b.onclick = () => copy($("#lk" + b.dataset.cp, d).value, "Link copied"))));
}

// ------------------------------------------------------------------ dialogs: channels and people
function peoplePicker(d, chosen) {
  const draw = () => {
    $("#chips", d).innerHTML = chosen.map((c, i) => `<span class="chip">${esc(c.name || c.email)}${c.email ? " · invite" : ""}<button data-rm="${i}" aria-label="Remove">✕</button></span>`).join("");
    $$("[data-rm]", d).forEach((b) => (b.onclick = () => { chosen.splice(+b.dataset.rm, 1); draw(); }));
  };
  const inp = $("#pp", d), list = $("#ppl", d);
  inp.oninput = () => {
    const q = inp.value.trim().toLowerCase();
    const hits = q ? S.people.filter((p) => p.id !== S.me.id && !chosen.some((c) => c.id === p.id) && (p.name.toLowerCase().includes(q) || (p.email || "").includes(q))).slice(0, 6) : [];
    const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(q) && !S.people.some((p) => p.email === q);
    list.innerHTML = hits.map((p) => `<button type="button" class="item" data-add="${p.id}">${av(p.id, p.name, "xs")}<span class="nm">${esc(p.name)}</span><small>${p.kind === "client" ? esc(p.org || "Client") : "Kayak"}</small></button>`).join("") + (isMail ? `<button type="button" class="item" data-mail="${esc(q)}">${ic("plus")}<span class="nm">Invite ${esc(q)} as a client</span></button>` : "");
    $$("[data-add]", list).forEach((b) => (b.onclick = () => { const p = person(b.dataset.add); chosen.push({ id: p.id, name: p.name }); inp.value = ""; list.innerHTML = ""; draw(); inp.focus(); }));
    $$("[data-mail]", list).forEach((b) => (b.onclick = () => { chosen.push({ email: b.dataset.mail, name: $("#cn", d)?.value || "", org: $("#co", d)?.value || "" }); inp.value = ""; list.innerHTML = ""; draw(); inp.focus(); }));
  };
  draw();
}
const pickerHtml = `<div class="fld"><label for="pp">People</label><input id="pp" placeholder="Type a name, or a client's email address to invite them" autocomplete="off"><div id="ppl"></div><div class="chips" id="chips"></div>
  <small>Clients you invite get a one-time link to accept the privacy notice and set up two-factor sign-in. They see only the conversations you add them to.</small></div>
  <div class="row2"><div class="fld"><label for="cn">New client's name (optional)</label><input id="cn" maxlength="80"></div><div class="fld"><label for="co">Their organisation (optional)</label><input id="co" maxlength="120"></div></div>`;
function newChannel() {
  const chosen = [];
  dialog(`<form><h3>New channel or project</h3>
    <div class="fld"><label>Type</label><div class="row2"><label class="chip"><input type="radio" name="k" value="channel" checked> Channel: ongoing conversation</label><label class="chip"><input type="radio" name="k" value="project"> Project: tasks on a board, with a due date</label></div></div>
    <div class="fld"><label for="nm">Name</label><input id="nm" required maxlength="80" placeholder="For example: Acme · FY27 tax health check"></div>
    <div class="fld"><label for="tp">Purpose (optional)</label><input id="tp" maxlength="300"></div>
    <div class="fld" id="dueF" hidden><label for="du">Due date</label><input id="du" type="date"></div>
    <label class="chip" style="justify-self:start"><input type="checkbox" id="pv" checked> Private: only people added can find it</label>
    ${pickerHtml}
    <div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Create</button></div></form>`, (d) => {
    peoplePicker(d, chosen);
    $$("input[name=k]", d).forEach((r) => (r.onchange = () => ($("#dueF", d).hidden = $("input[name=k]:checked", d).value !== "project")));
    $("form", d).onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await post("/channels", { name: $("#nm", d).value, topic: $("#tp", d).value, kind: $("input[name=k]:checked", d).value, due: $("#du", d).value, private: $("#pv", d).checked, members: chosen });
        d.close(); await refreshBoot(); openChannel(r.id);
        if (r.invites?.length) inviteLinks(r.invites);
        if (r.emailed?.length) toast(`Invitation emailed to ${r.emailed.join(", ")}.`);
      } catch (x) { toast(x.message); }
    };
  });
}
function addPeople() {
  const chosen = [];
  dialog(`<form><h3>Add people to ${esc(chName(S.cur))}</h3>${S.cur.external ? "" : '<p class="warn">Adding a client makes this an external conversation. They will see its earlier messages and files.</p>'}${pickerHtml}<div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Add</button></div></form>`, (d) => {
    peoplePicker(d, chosen);
    $("form", d).onsubmit = async (e) => {
      e.preventDefault(); if (!chosen.length) return;
      try { const r = await post(`/channels/${S.cur.id}/members`, { members: chosen }); d.close(); await refreshBoot(); S.panel = "people"; renderPanel(); if (r.invites?.length) inviteLinks(r.invites); if (r.emailed?.length) toast(`Invitation emailed to ${r.emailed.join(", ")}.`); } catch (x) { toast(x.message); }
    };
  });
}
function newDm() {
  dialog(`<form><h3>New message</h3><div class="fld"><label for="dq">To</label><input id="dq" placeholder="Type a name" autocomplete="off"></div><div id="dl" style="max-height:300px;overflow:auto"></div><div class="foot"><button class="btn" data-close>Cancel</button></div></form>`, (d) => {
    const draw = () => {
      const q = $("#dq", d).value.trim().toLowerCase();
      $("#dl", d).innerHTML = S.people.filter((p) => p.id !== S.me.id && p.status === "active" && (!q || p.name.toLowerCase().includes(q))).slice(0, 30).map((p) => `<button type="button" class="item" data-p="${p.id}">${av(p.id, p.name, "sm")}<span class="nm">${esc(p.name)}</span><small>${p.kind === "client" ? esc(p.org || "Client") : "Kayak"}</small></button>`).join("") || '<p class="mk-small">No one found. Clients can message people they share a channel with.</p>';
      $$("[data-p]", d).forEach((b) => (b.onclick = () => { d.close(); dmWith(b.dataset.p); }));
    };
    $("#dq", d).oninput = draw; draw(); $("#dq", d).focus();
    $("form", d).onsubmit = (e) => e.preventDefault();
  });
}
async function dmWith(id) { try { const r = await post("/dm", { id }); await refreshBoot(); openChannel(r.id); } catch (e) { toast(e.message); } }
function channelMenu(anchor) {
  const ch = S.cur;
  const items = [];
  if (ch.kind !== "dm") items.push([`${ic("people")} People and apps`, () => { S.panel = "people"; renderPanel(); }]);
  items.push([`${ic("cal")} Schedule a meeting`, () => newMeeting(ch)]);
  if (S.ai) items.push([`${ic("ai")} Recap since I last read`, () => summarise(0, ch.last_read)]);
  items.push([`${ic("bell")} ${ch.muted ? "Unmute" : "Mute"} notifications`, async () => { await post(`/channels/${ch.id}/mute`, { muted: !ch.muted }); ch.muted = !ch.muted; toast(ch.muted ? "Muted. You won't be notified about this conversation." : "Unmuted."); renderSide(); }]);
  if (ch.role === "owner" || ch.created_by === S.me.id) {
    items.push("-", [`${ic("gear")} Edit details`, editChannel], [`Archive`, async () => { if (!confirm(`Archive ${ch.name}? It disappears from everyone's list. Messages and files are kept.`)) return; await post(`/channels/${ch.id}`, { archived: true }, "PATCH"); await refreshBoot(); go("chat"); }]);
  }
  if (ch.kind !== "dm") items.push("-", [`Leave`, async () => { if (!confirm(`Leave ${ch.name}?`)) return; await post(`/channels/${ch.id}/leave`); await refreshBoot(); S.cur = null; go("chat"); }]);
  menu(anchor, items);
}
function editChannel() {
  const ch = S.cur;
  dialog(`<form><h3>Edit ${esc(ch.name)}</h3><div class="fld"><label for="nm">Name</label><input id="nm" maxlength="80" value="${esc(ch.name)}" required></div><div class="fld"><label for="tp">Purpose</label><input id="tp" maxlength="300" value="${esc(ch.topic || "")}"></div>${ch.kind === "project" ? `<div class="fld"><label for="du">Due date</label><input id="du" type="date" value="${esc(ch.due || "")}"></div>` : ""}<label class="chip" style="justify-self:start"><input type="checkbox" id="pv" ${ch.private ? "checked" : ""}> Private</label><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Save</button></div></form>`, (d) => {
    $("form", d).onsubmit = async (e) => { e.preventDefault(); await post(`/channels/${ch.id}`, { name: $("#nm", d).value, topic: $("#tp", d).value, due: $("#du", d)?.value, private: $("#pv", d).checked }, "PATCH").catch((x) => toast(x.message)); d.close(); await refreshBoot(); renderMain(); };
  });
}
function addIntegration() {
  dialog(`<form><h3>Connect an app</h3>
    <div class="fld"><label for="ik">App</label><select id="ik"><option value="slack">Slack (incoming webhook)</option><option value="webhook">Any app (signed webhook: HubSpot, Zapier, Power Automate, Make)</option></select></div>
    <div class="fld"><label for="iu">Webhook address</label><input id="iu" type="url" required placeholder="https://hooks.slack.com/services/…"><small>Create it in the other app, then paste it here. It is stored encrypted.</small></div>
    <div class="fld"><label>Send</label><div class="chips"><label class="chip"><input type="checkbox" name="ev" value="recap" checked> AI recaps</label><label class="chip"><input type="checkbox" name="ev" value="task" checked> New and completed tasks</label><label class="chip"><input type="checkbox" name="ev" value="meeting"> Meetings</label></div></div>
    <label class="warn" style="display:flex;gap:8px"><input type="checkbox" id="ic" required> I confirm this content may leave Meet by Kayak and be stored by the other app.${S.cur.external ? " This channel includes clients: check your engagement terms allow it." : ""}</label>
    <div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Connect</button></div></form>`, (d) => {
    $("form", d).onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await post(`/channels/${S.cur.id}/integrations`, { kind: $("#ik", d).value, url: $("#iu", d).value, events: $$("input[name=ev]:checked", d).map((x) => x.value), confirm: $("#ic", d).checked });
        d.close(); renderPanel();
        if (r.signingSecret) dialog(`<div class="dlg"><h3>Signing secret</h3><p>Use this to check that requests really come from Meet by Kayak (header <code>X-Kayak-Signature: sha256=…</code>, HMAC-SHA256 of the body). It is shown only once.</p><div class="copy"><input readonly value="${esc(r.signingSecret)}" id="ss"><button class="btn sm" id="cs">Copy</button></div><div class="foot"><button class="btn p" data-close>Done</button></div></div>`, (x) => ($("#cs", x).onclick = () => copy($("#ss", x).value)));
      } catch (x) { toast(x.message); }
    };
  });
}

// ------------------------------------------------------------------ Kayak AI recap
async function summarise(parent = 0, since = 0) {
  S.panel = "summary"; renderPanel();
  const lang = S.me.lang || "en";
  try {
    const r = await post(`/channels/${S.cur.id}/summary`, { parent_id: parent || undefined, since: since || undefined, lang });
    const body = $("#sumBody"); if (!body) return;
    body.innerHTML = `${md(r.summary)}<small style="color:var(--faint)">${r.count || 0} messages · written by Kayak AI on Kayak's own platform. Check before relying on it.</small>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="cpS">Copy</button>${isEmp() ? `<button class="btn sm p" id="postS">Share in conversation</button>` : ""}</div>`;
    $("#cpS").onclick = () => copy(r.summary);
    $("#postS") && ($("#postS").onclick = async () => { await post(`/channels/${S.cur.id}/summary`, { parent_id: parent || undefined, since: since || undefined, lang, post: true }); toast("Recap shared."); pollOnce(); });
  } catch (e) { const b = $("#sumBody"); if (b) b.innerHTML = `<p>${esc(e.message)}</p>`; }
}

// ------------------------------------------------------------------ search
async function search(q) {
  if (q.length < 2) { if (S.view === "search") { S.view = "chat"; renderMain(); } return; }
  const r = await api(`/search?q=${encodeURIComponent(q)}`).catch(() => null); if (!r) return;
  S.view = "search";
  const main = $("#main");
  main.innerHTML = `<header class="top"><div class="t"><h2>Results for “${esc(q)}”</h2><small>${r.results.length} messages · ${r.tasks.length} tasks</small></div></header><div class="body"><div class="msgs">
    ${r.tasks.map((t) => `<div class="msg" style="cursor:pointer" data-go="${t.channel_id}" data-tab="tasks"><span class="av" style="background:#4B7A4E">${ic("tasks")}</span><div><div class="who"><b>${esc(t.title)}</b><time>${esc(t.channel)} · ${esc(t.status)}</time></div></div></div>`).join("")}
    ${r.results.map((m) => `<div class="msg" style="cursor:pointer" data-go="${m.channel_id}">${av(m.author, m.author)}<div><div class="who"><b>${esc(m.author || "")}</b><time>${m.kind === "dm" ? "Direct message" : "#" + esc(m.channel)} · ${fmtDay(m.created_at)} ${fmtTime(m.created_at)}</time></div><div class="tx">${fmt(m.body)}</div></div></div>`).join("") || (r.tasks.length ? "" : '<div class="empty"><h3>Nothing found</h3><p>Search looks through every conversation you are part of.</p></div>')}
  </div></div>`;
  $$("[data-go]", main).forEach((el) => (el.onclick = () => { $("#q").value = ""; openChannel(el.dataset.go, el.dataset.tab || "chat"); }));
}

// ------------------------------------------------------------------ tasks
const COLS = [["todo", "To do"], ["doing", "In progress"], ["review", "In review"], ["done", "Done"]];
async function renderBoard(body) {
  body.innerHTML = `<p class="mk-small" style="padding:16px">Loading tasks…</p>`;
  const r = await api(`/tasks?channel=${S.cur.id}`).catch((e) => toast(e.message)); if (!r) return;
  const tasks = r.tasks;
  const done = tasks.filter((t) => t.status === "done").length;
  body.innerHTML = `${S.cur.kind === "project" ? `<div style="padding:14px 16px 0;max-width:420px"><small style="color:var(--muted)">${done} of ${tasks.length} tasks done</small><div class="progress"><i style="width:${tasks.length ? (done / tasks.length) * 100 : 0}%"></i></div></div>` : ""}
    <div class="board">${COLS.map(([k, l]) => `<section class="col" data-col="${k}"><h4>${l}<span>${tasks.filter((t) => t.status === k).length}</span></h4><div class="tasks">${tasks.filter((t) => t.status === k).map(taskCard).join("")}</div><button class="addtask" data-new="${k}">+ Add a task</button></section>`).join("")}</div>`;
  wireTasks(body, tasks, () => renderBoard(body));
}
function taskCard(t) {
  const late = t.due && t.status !== "done" && t.due < new Date().toISOString().slice(0, 10);
  return `<article class="task ${t.priority}" draggable="true" data-t="${t.id}" tabindex="0"><b>${esc(t.title)}</b><div class="meta">${t.assignee ? `${av(t.assignee, t.assignee_name, "xs")}${esc(t.assignee_name || "")}` : "Unassigned"}${t.due ? `<span class="due${late ? " late" : ""}">${ic("cal", "ico")} ${new Date(t.due).toLocaleDateString([], { day: "numeric", month: "short" })}</span>` : ""}${t.channel_name ? `<span>#${esc(t.channel_name)}</span>` : ""}${t.priority === "high" || t.priority === "urgent" ? `<span style="color:${t.priority === "urgent" ? "var(--danger)" : "#9C630E"};font-weight:700">${t.priority}</span>` : ""}</div></article>`;
}
function wireTasks(root, tasks, reload) {
  $$("[data-t]", root).forEach((el) => {
    el.ondragstart = (e) => e.dataTransfer.setData("text/plain", el.dataset.t);
    el.onclick = () => taskDialog(tasks.find((t) => t.id === el.dataset.t), null, reload);
    el.onkeydown = (e) => { if (e.key === "Enter") el.click(); };
  });
  $$("[data-col]", root).forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add("drop"); };
    col.ondragleave = () => col.classList.remove("drop");
    col.ondrop = async (e) => { e.preventDefault(); col.classList.remove("drop"); const id = e.dataTransfer.getData("text/plain"); await post(`/tasks/${id}`, { status: col.dataset.col }, "PATCH").catch((x) => toast(x.message)); reload(); };
  });
  $$("[data-new]", root).forEach((b) => (b.onclick = () => taskDialog(null, b.dataset.new, reload)));
}
function taskDialog(t, status, reload) {
  const ids = new Set(S.cur?.member_ids || []);
  const people = S.people.filter((p) => ids.has(p.id));
  dialog(`<form><h3>${t ? "Task" : "New task"}</h3>
    <div class="fld"><label for="tt">Title</label><input id="tt" required maxlength="200" value="${esc(t?.title || "")}"></div>
    <div class="fld"><label for="td">Details</label><textarea id="td" maxlength="4000">${esc(t?.detail || "")}</textarea></div>
    <div class="row2"><div class="fld"><label for="ta">Assigned to</label><select id="ta"><option value="">Nobody yet</option>${people.map((p) => `<option value="${p.id}" ${t?.assignee === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
    <div class="fld"><label for="tdu">Due</label><input id="tdu" type="date" value="${esc(t?.due || "")}"></div></div>
    <div class="row2"><div class="fld"><label for="ts">Status</label><select id="ts">${COLS.map(([k, l]) => `<option value="${k}" ${(t?.status || status) === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="fld"><label for="tp">Priority</label><select id="tp">${["low", "normal", "high", "urgent"].map((p) => `<option ${(t?.priority || "normal") === p ? "selected" : ""}>${p}</option>`).join("")}</select></div></div>
    <div class="foot">${t ? `<button type="button" class="btn danger" id="tdel" style="margin-right:auto">Delete</button>` : ""}<button class="btn" data-close>Cancel</button><button class="btn p">${t ? "Save" : "Add task"}</button></div></form>`, (d) => {
    $("#tt", d).focus();
    $("form", d).onsubmit = async (e) => {
      e.preventDefault();
      const b = { title: $("#tt", d).value, detail: $("#td", d).value, assignee: $("#ta", d).value || null, due: $("#tdu", d).value, status: $("#ts", d).value, priority: $("#tp", d).value };
      try { if (t) await post(`/tasks/${t.id}`, b, "PATCH"); else await post(`/channels/${S.cur.id}/tasks`, b); d.close(); reload(); } catch (x) { toast(x.message); }
    };
    $("#tdel", d) && ($("#tdel", d).onclick = async () => { if (!confirm("Delete this task?")) return; await api(`/tasks/${t.id}`, { method: "DELETE" }).catch((x) => toast(x.message)); d.close(); reload(); });
  });
}
// ------------------------------------------------------------------ To-Do (personal)
const dueClass = (due, done) => { if (!due || done) return ""; const t = new Date().toISOString().slice(0, 10); return due < t ? "late" : due === t ? "soon" : ""; };
const dueLabel = (due) => { const t = new Date().toISOString().slice(0, 10); const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10); const tm = new Date(Date.now() + 864e5).toISOString().slice(0, 10); return due < t ? `Overdue · ${new Date(due).toLocaleDateString([], { day: "numeric", month: "short" })}` : due === t ? "Today" : due === tm ? "Tomorrow" : due === y ? "Yesterday" : new Date(due).toLocaleDateString([], { day: "numeric", month: "short", year: due.slice(0, 4) !== t.slice(0, 4) ? "numeric" : undefined }); };
async function renderTodo(main) {
  main.innerHTML = `<header class="top"><div class="t"><h2>To-Do</h2><small>Plan, track, update and strike through your to-dos and deliverables</small></div><button class="btn p" id="addTodo">${ic("plus")}<span class="lbl">Add to-do</span></button></header>
    <div class="body" id="body"><p class="mk-small" style="padding:16px">Loading…</p></div>`;
  $("#addTodo").onclick = () => todoDialog(null, () => renderTodo(main));
  const [tr, tk] = await Promise.all([api("/todos").catch(() => ({ todos: [] })), api("/tasks").catch(() => ({ tasks: [] }))]);
  const todos = tr.todos, tasks = tk.tasks.filter((t) => t.status !== "done");
  S.todoDue = todos.filter((t) => !t.done && t.due && t.due <= new Date().toISOString().slice(0, 10)).length;
  updateRailDots();
  const open = todos.filter((t) => !t.done), done = todos.filter((t) => t.done);
  const row = (t) => `<div class="td ${t.done ? "done" : ""}" data-td="${t.id}">
    <button class="tick ${t.done ? "on" : ""}" data-tick="${t.id}" aria-label="${t.done ? "Mark as not done" : "Mark as done"}" aria-pressed="${t.done}">${t.done ? "✓" : ""}</button>
    <div class="td-main"><span class="td-text">${fmt(t.text)}</span>${t.kind === "deliverable" ? '<span class="pill-d">Deliverable</span>' : ""}${t.channel_name ? `<span class="td-ch">#${esc(t.channel_name)}</span>` : ""}
      ${t.due ? `<span class="td-due ${dueClass(t.due, t.done)}">${ic("cal", "ico")} ${dueLabel(t.due)}</span>` : ""}${t.priority === "high" || t.priority === "urgent" ? `<span class="td-pri ${t.priority}">${t.priority}</span>` : ""}</div>
    <button class="ib" data-tm="${t.id}" aria-label="Edit">${ic("more")}</button></div>`;
  const body = $("#body");
  body.innerHTML = `<div class="todo-wrap">
    <div class="quick"><input id="qadd" placeholder="Add a quick to-do and press Enter" maxlength="400" autocomplete="off"></div>
    ${open.length ? `<section>${open.map(row).join("")}</section>` : `<div class="empty">${ic("tasks")}<h3>All clear</h3><p>Add a to-do above, or turn a client deliverable into a tracked item with a due date.</p></div>`}
    ${tasks.length ? `<h3 class="sec" style="margin:22px 0 8px">Assigned to me in conversations</h3><section>${tasks.map((t) => `<div class="td" data-task="${t.id}"><button class="tick" data-done="${t.id}" aria-label="Mark done">${""}</button><div class="td-main"><span class="td-text">${esc(t.title)}</span><span class="td-ch">#${esc(t.channel_name || "")}</span>${t.due ? `<span class="td-due ${dueClass(t.due)}">${ic("cal", "ico")} ${dueLabel(t.due)}</span>` : ""}</div><a class="ib" href="#c/${t.channel_id}/tasks" aria-label="Open">${ic("back")}</a></div>`).join("")}</section>` : ""}
    ${done.length ? `<details class="done-wrap"><summary>${done.length} done recently</summary>${done.map(row).join("")}</details>` : ""}
  </div>`;
  const qa = $("#qadd");
  qa.onkeydown = async (e) => { if (e.key === "Enter" && qa.value.trim()) { const v = qa.value.trim(); qa.value = ""; await post("/todos", { text: v }).catch((x) => toast(x.message)); renderTodo(main); } };
  qa.focus();
  $$("[data-tick]", body).forEach((b) => (b.onclick = async () => { const t = todos.find((x) => x.id === b.dataset.tick); await post(`/todos/${b.dataset.tick}`, { done: !t.done }, "PATCH"); renderTodo(main); }));
  $$("[data-done]", body).forEach((b) => (b.onclick = async () => { await post(`/tasks/${b.dataset.done}`, { status: "done" }, "PATCH").catch((x) => toast(x.message)); renderTodo(main); }));
  $$("[data-tm]", body).forEach((b) => (b.onclick = () => todoMenu(b, todos.find((x) => x.id === b.dataset.tm), () => renderTodo(main))));
  $$("[data-td] .td-text", body).forEach((el) => (el.ondblclick = () => todoDialog(todos.find((x) => x.id === el.closest("[data-td]").dataset.td), () => renderTodo(main))));
}
function todoMenu(anchor, t, reload) {
  menu(anchor, [["Edit", () => todoDialog(t, reload)], [t.kind === "deliverable" ? "Make a plain to-do" : "Mark as a deliverable", async () => { await post(`/todos/${t.id}`, { kind: t.kind === "deliverable" ? "todo" : "deliverable" }, "PATCH"); reload(); }], "-", ['<span style="color:var(--danger)">Delete</span>', async () => { await api(`/todos/${t.id}`, { method: "DELETE" }); reload(); }]]);
}
function todoDialog(t, reload) {
  const convs = S.channels.filter((c) => c.kind !== "dm");
  dialog(`<form><h3>${t ? "Edit to-do" : "New to-do"}</h3>
    <div class="fld"><label for="tt">To-do</label><input id="tt" required maxlength="400" value="${esc(t?.text || "")}"></div>
    <div class="fld"><label for="tn">Notes (optional)</label><textarea id="tn" maxlength="2000">${esc(t?.note || "")}</textarea></div>
    <div class="row2"><div class="fld"><label for="tdu">Due date</label><input id="tdu" type="date" value="${esc(t?.due || "")}"></div><div class="fld"><label for="tp">Priority</label><select id="tp">${["low", "normal", "high", "urgent"].map((p) => `<option ${(t?.priority || "normal") === p ? "selected" : ""}>${p}</option>`).join("")}</select></div></div>
    <div class="row2"><div class="fld"><label for="tk">Type</label><select id="tk"><option value="todo" ${t?.kind !== "deliverable" ? "selected" : ""}>To-do</option><option value="deliverable" ${t?.kind === "deliverable" ? "selected" : ""}>Client deliverable</option></select></div>
    <div class="fld"><label for="tc">Linked conversation (optional)</label><select id="tc"><option value="">None</option>${convs.map((c) => `<option value="${c.id}" ${t?.channel_id === c.id ? "selected" : ""}>#${esc(chName(c))}</option>`).join("")}</select></div></div>
    <div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">${t ? "Save" : "Add"}</button></div></form>`, (d) => {
    $("#tt", d).focus();
    $("form", d).onsubmit = async (e) => { e.preventDefault(); const b = { text: $("#tt", d).value, note: $("#tn", d).value, due: $("#tdu", d).value, priority: $("#tp", d).value, kind: $("#tk", d).value, channel_id: $("#tc", d).value || null }; try { if (t) await post(`/todos/${t.id}`, b, "PATCH"); else await post("/todos", b); d.close(); reload(); } catch (x) { toast(x.message); } };
  });
}
function updateRailDots() {
  const btn = $(".rail [data-v=todo]"); if (!btn) return;
  btn.querySelector(".dot")?.remove();
  if (S.todoDue) btn.insertAdjacentHTML("beforeend", `<span class="dot">${S.todoDue > 99 ? "99+" : S.todoDue}</span>`);
}

// ------------------------------------------------------------------ Planner
const BUCKETS = [["overdue", "Overdue"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"], ["later", "Later"]];
function bucketOf(due, today) {
  if (due < today) return "overdue";
  if (due === today) return "today";
  const tm = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  if (due === tm) return "tomorrow";
  const wk = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  return due <= wk ? "week" : "later";
}
async function renderPlanner(main) {
  main.innerHTML = `<header class="top"><div class="t"><h2>Planner</h2><small>Meet your due dates, deliverables and meetings - everything with a date, in one place</small></div><button class="btn" id="calBtn">${ic("cal")}<span class="lbl">Calendars</span></button><button class="btn p" id="addDel">${ic("plus")}<span class="lbl">Add deliverable</span></button></header><div class="body" id="body"><p class="mk-small" style="padding:16px">Loading…</p></div>`;
  $("#addDel").onclick = () => todoDialog({ kind: "deliverable" }, () => renderPlanner(main));
  $("#calBtn") && ($("#calBtn").onclick = calendarDialog);
  const r = await api("/planner").catch((e) => toast(e.message)); if (!r) return;
  const body = $("#body");
  if (!r.items.length) { body.innerHTML = `<div class="empty">${ic("cal")}<h3>Nothing scheduled</h3><p>Add a deliverable with a due date, give a to-do a date, or schedule a meeting. It all shows here on a timeline.</p></div>`; return; }
  const by = {}; for (const it of r.items) (by[bucketOf(it.due, r.today)] ||= []).push(it);
  const TYPE = { todo: ["To-do", "#17807E", P.tasks], deliverable: ["Deliverable", "#9C630E", P.tasks], task: ["Task", "#2D6A9F", P.tasks], meeting: ["Meeting", "#0E2F3C", P.video], calendar: ["Calendar", "#5E4B78", P.cal] };
  const line = (it) => { const [label, col, icon] = TYPE[it.type] || TYPE.todo; return `<div class="pl-row" data-type="${it.type}" data-id="${esc(it.id)}" ${it.channel_id ? `data-ch="${esc(it.channel_id)}"` : ""}>
    <span class="pl-ic" style="background:${col}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span>
    <div class="pl-main"><b>${esc(it.title)}</b><small>${it.type === "calendar" ? (it.provider === "google" ? "Google Calendar" : "Outlook") : label}${it.channel ? ` · #${esc(it.channel)}` : ""}${it.type === "meeting" && it.startsAt ? ` · ${new Date(it.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}${it.priority === "high" || it.priority === "urgent" ? ` · ${it.priority}` : ""}</small></div>
    <span class="pl-due ${dueClass(it.due, it.done)}">${new Date(it.due).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</span></div>`; };
  body.innerHTML = `<div class="mt-wrap">${BUCKETS.filter(([k]) => by[k]?.length).map(([k, label]) => `<section><h3 class="sec ${k === "overdue" ? "overdue" : ""}">${label} <span class="count">${by[k].length}</span></h3><div class="pl-list">${by[k].map(line).join("")}</div></section>`).join("")}</div>`;
  $$(".pl-row", body).forEach((el) => (el.onclick = () => {
    const type = el.dataset.type, id = el.dataset.id;
    if (type === "calendar") { const it = r.items.find((x) => x.type === "calendar" && x.id === id); if (it?.link) window.open(it.link, "_blank", "noopener"); }
    else if (type === "meeting") joinRoom(id);
    else if (type === "task" && el.dataset.ch) openChannel(el.dataset.ch, "tasks");
    else go("todo");
  }));
}
// ------------------------------------------------------------------ Kayakers (Kayak team only)
const KX = {
  board: ["Whiteboard", "#17807E", "Draw, sketch, add sticky notes and shapes together, live."],
  chess: ["Chess", "#2D6A9F", "Full rules - castling, en passant, promotion. Play a colleague or Kayak AI."],
  carrom: ["Carrom", "#9C630E", "Real physics on a classic board. Flick the striker and pocket your coins."],
  four: ["Kayak Four", "#B4472F", "Line up four discs before the other side does. Quick and addictive."],
};
const KXI = {
  board: '<path d="M3 5h18v11H3z"/><path d="M8 21l4-5 4 5M7 12l3-3 2 2 4-4"/>',
  chess: '<path d="M8 21h8M9 18h6l-1-6h2l-2-3c1-1 1-3-1-4-1-1-3 0-3 1-2 0-3 2-2 3l-2 3h2z"/>',
  carrom: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="3"/><circle cx="6" cy="6" r="1.3"/><circle cx="18" cy="6" r="1.3"/><circle cx="6" cy="18" r="1.3"/><circle cx="18" cy="18" r="1.3"/>',
  four: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.6"/><circle cx="12" cy="9" r="1.6"/><circle cx="16" cy="9" r="1.6"/><circle cx="8" cy="15" r="1.6"/><circle cx="12" cy="15" r="1.6"/><circle cx="16" cy="15" r="1.6"/>',
};
async function renderKayakers(main) {
  main.innerHTML = `<header class="top"><div class="t"><h2>Kayakers</h2><small>Joint visuals and games for the Kayak team - work together, then take a break together</small></div><button class="btn p" id="kxNewB">${ic("plus")}<span class="lbl">New whiteboard</span></button></header>
    <div class="body" id="body"><div class="mt-wrap kx-hub">
      <section><h3 class="sec">Joint visuals</h3><div class="kx-grid" id="kxBoards"><p class="mk-small">Loading…</p></div></section>
      <section><h3 class="sec">Games</h3><div class="kx-games">${["chess", "carrom", "four"].map((k) => `<div class="kx-game" style="--c:${KX[k][1]}"><span class="kx-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${KXI[k]}</svg></span><b>${KX[k][0]}</b><small>${KX[k][2]}</small><div class="kx-btns"><button class="btn sm p" data-new="${k}" data-mode="team">${ic("people")} With colleagues</button><button class="btn sm" data-new="${k}" data-mode="ai">${ic("ai")} vs Kayak AI</button></div></div>`).join("")}</div>
        <h3 class="sec" style="margin-top:22px">Recent games</h3><div class="kx-grid" id="kxGames"></div></section>
    </div></div>`;
  const create = async (kind, mode, title) => {
    const r = await post("/kayakers", { kind, mode, title }).catch((e) => toast(e.message));
    if (r?.id) location.href = `/kayakers/${r.id}`;
  };
  $("#kxNewB").onclick = () => dialog(`<form><h3>New whiteboard</h3><div class="fld"><label for="kxt">Name</label><input id="kxt" maxlength="80" placeholder="e.g. Diligence plan - Project Falcon" required></div><p class="mk-small">Everyone in the Kayak team can open and draw on it. Don't put client-confidential material on a shared board unless the whole team may see it.</p><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Create</button></div></form>`, (d) => {
    $("form", d).onsubmit = (e) => { e.preventDefault(); const t = $("#kxt", d).value.trim(); if (t) create("board", "team", t); };
    $("#kxt", d).focus();
  });
  $$("[data-new]", main).forEach((b) => (b.onclick = () => create(b.dataset.new, b.dataset.mode, `${KX[b.dataset.new][0]}${b.dataset.mode === "ai" ? " vs Kayak AI" : ""} · ${S.me.name.split(" ")[0]}`)));
  const r = await api("/kayakers").catch((e) => toast(e.message)); if (!r) return;
  const card = (sp) => `<a class="kx-card" href="/kayakers/${esc(sp.id)}" style="--c:${KX[sp.kind]?.[1] || "#17807E"}"><span class="kx-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${KXI[sp.kind] || ""}</svg></span><span class="kx-t"><b>${esc(sp.title)}</b><small>${KX[sp.kind]?.[0] || ""}${sp.kind !== "board" ? (sp.mode === "ai" ? " · vs AI" : " · team") : ""} · ${esc(sp.created_by_name || "")} · ${fmtDay(sp.updated_at)}</small></span>${sp.created_by === S.me.id ? `<button class="ib" data-del="${esc(sp.id)}" aria-label="Remove" title="Remove">${ic("x")}</button>` : ""}</a>`;
  const boards = r.spaces.filter((x) => x.kind === "board"), games = r.spaces.filter((x) => x.kind !== "board");
  $("#kxBoards").innerHTML = boards.length ? boards.map(card).join("") : `<div class="kx-none"><b>No whiteboards yet</b><small>Start one for a workshop, a case map or a quick sketch - colleagues who open it draw with you live.</small></div>`;
  $("#kxGames").innerHTML = games.length ? games.slice(0, 12).map(card).join("") : `<div class="kx-none"><small>No games yet. Pick one above.</small></div>`;
  $$("[data-del]", main).forEach((b) => (b.onclick = async (e) => { e.preventDefault(); e.stopPropagation(); await post(`/kayakers/${b.dataset.del}`, {}, "DELETE").catch((x) => toast(x.message)); renderKayakers(main); }));
}
async function renderFiles(body) {
  const r = await api(`/channels/${S.cur.id}/files`).catch((e) => toast(e.message)); if (!r) return;
  body.innerHTML = r.files.length ? `<div class="mt-wrap"><div class="mt-list">${r.files.map((f) => `<div class="mt-row" style="grid-template-columns:44px minmax(0,1fr) auto"><span class="card" style="margin:0;padding:0;border:0"><span class="ci f">${ic("file")}</span></span><div><b>${esc(f.name)}</b><br><small style="color:var(--muted)">${fmtSize(f.size)} · ${esc(f.author || "")} · ${fmtDay(f.created_at)}</small></div><div class="acts"><a class="btn sm" href="/files/${f.id}" download>${ic("download")} Download</a></div></div>`).join("")}</div></div>`
    : `<div class="empty">${ic("file")}<h3>No files yet</h3><p>Drop files into the conversation to share them with everyone here. Up to 25 MB each.</p></div>`;
}

// ------------------------------------------------------------------ meetings
async function renderMeetings(main) {
  main.innerHTML = `<header class="top"><div class="t"><h2>Meetings</h2><small>Private, encrypted meetings with Kayak AI captions and recaps</small></div></header><div class="body" id="body"><div class="mt-wrap">
    <div class="mt-hero">
      <button class="mt-act s" id="mNow"><span class="ci">${ic("video")}</span><b>Meet now</b><small>Start a meeting and invite people with a link</small></button>
      <button class="mt-act" id="mSch"><span class="ci">${ic("cal")}</span><b>Schedule</b><small>Pick a time; add it to Outlook or Google Calendar</small></button>
      <button class="mt-act" id="mJoin"><span class="ci">${ic("link")}</span><b>Join with a code</b><small>Enter a meeting code like abc-defg-hij</small></button>
    </div>
    <div><h3 class="sec">Upcoming</h3><div id="up" style="margin-top:10px"><p class="mk-small">Loading…</p></div></div>
    <div><h3 class="sec">Recent</h3><div id="rec" style="margin-top:10px"></div></div>
  </div></div>`;
  $("#mNow").onclick = () => startMeeting(null);
  $("#mSch").onclick = () => newMeeting();
  $("#mJoin").onclick = joinCode;
  const r = await api("/meetings").catch((e) => toast(e.message)); if (!r) return;
  const kindLabel = { client: "Client meeting", webinar: "Webinar", townhall: "Town hall", meeting: "" };
  $("#up").innerHTML = r.upcoming.length ? `<div class="mt-list">${r.upcoming.map((m) => {
    const d = m.starts_at ? new Date(m.starts_at) : null;
    return `<div class="mt-row"><div class="mt-when">${m.status === "live" ? '<span class="live">Live</span>' : d ? `<b>${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b><small>${fmtDay(m.starts_at)}</small>` : "<b>Now</b>"}</div>
      <div><b>${esc(m.title)}</b><br><small style="color:var(--muted)">${[kindLabel[m.kind], m.channel_name ? "#" + m.channel_name : "", "Host: " + m.host_name, m.duration_min + " min"].filter(Boolean).map(esc).join(" · ")}</small></div>
      <div class="acts"><button class="btn p sm" data-join="${m.id}">Join</button><button class="ib" data-mm="${m.id}" aria-label="More">${ic("more")}</button></div></div>`;
  }).join("")}</div>` : `<p class="mk-small" style="color:var(--muted)">No upcoming meetings.</p>`;
  $("#rec").innerHTML = r.recent.length ? `<div class="mt-list">${r.recent.map((m) => `<div class="mt-row"><div class="mt-when"><small>${m.ended_at ? fmtDay(m.ended_at) : ""}</small></div><div><b>${esc(m.title)}</b></div><div class="acts">${m.has_minutes ? `<button class="btn sm" data-min="${m.id}">${ic("ai")} Minutes</button>` : ""}</div></div>`).join("")}</div>` : `<p class="mk-small" style="color:var(--muted)">Meetings you attend appear here with their AI minutes.</p>`;
  $$("[data-join]", main).forEach((b) => (b.onclick = () => joinRoom(b.dataset.join)));
  $$("[data-min]", main).forEach((b) => (b.onclick = () => showMinutes(b.dataset.min)));
  $$("[data-mm]", main).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); meetingMenu(b, r.upcoming.find((m) => m.id === b.dataset.mm)); }));
}
async function meetingMenu(anchor, m) {
  const r = await api(`/meetings/${m.id}`).catch((e) => toast(e.message)); if (!r) return;
  const items = [[`${ic("link")} Copy meeting link`, () => copy(r.url, "Meeting link copied. People sign in to join.")]];
  if (r.guestLink) items.push([`${ic("link")} Copy guest link (no account needed)`, () => copy(r.guestLink, "Guest link copied. Anyone with it can ask to join; you admit them from the lobby.")]);
  if (m.starts_at) {
    const s = new Date(m.starts_at), e = new Date(+s + m.duration_min * 60_000), z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z/, "Z");
    const det = `Join on Meet by Kayak: ${r.url}`;
    items.push("-", [`${ic("cal")} Add to Outlook`, () => window.open(`https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(m.title)}&startdt=${s.toISOString()}&enddt=${e.toISOString()}&body=${encodeURIComponent(det)}&location=${encodeURIComponent(r.url)}`, "_blank", "noopener")],
      [`${ic("cal")} Add to Google Calendar`, () => window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(m.title)}&dates=${z(s)}/${z(e)}&details=${encodeURIComponent(det)}&location=${encodeURIComponent(r.url)}`, "_blank", "noopener")],
      [`${ic("download")} Download calendar file (.ics)`, () => (location.href = `/api/ws/meetings/${m.id}/ics`)]);
  }
  if (r.host) items.push("-", ['<span style="color:var(--danger)">Cancel meeting</span>', async () => { if (!confirm(`Cancel “${m.title}”?`)) return; await post(`/meetings/${m.id}/cancel`); renderMeetings($("#main")); }]);
  menu(anchor, items);
}
async function showMinutes(id) {
  const r = await api(`/meetings/${id}/minutes`).catch((e) => toast(e.message)); if (!r) return;
  dialog(`<div class="dlg"><h3>${esc(r.title)}: minutes</h3>${r.minutes ? md(r.minutes.summary) + `<small style="color:var(--faint)">Written by Kayak AI from the live captions. Check before relying on it.</small>` : "<p>No minutes for this meeting.</p>"}<div class="foot">${r.minutes ? '<button class="btn" id="cpm">Copy</button>' : ""}<button class="btn p" data-close>Close</button></div></div>`, (d) => $("#cpm", d) && ($("#cpm", d).onclick = () => copy(r.minutes.summary)));
}
async function startMeeting(ch) {
  try { const r = await post("/meetings", { channel_id: ch?.id }); joinRoom(r.id); } catch (e) { toast(e.message); }
}
function joinRoom(id) { location.href = `/${id}`; }
function joinCode() {
  dialog(`<form><h3>Join with a code</h3><div class="fld"><label for="jc">Meeting code or link</label><input id="jc" required placeholder="abc-defg-hij" autocomplete="off"></div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Join</button></div></form>`, (d) => {
    $("#jc", d).focus();
    $("form", d).onsubmit = (e) => { e.preventDefault(); const m = $("#jc", d).value.trim().toLowerCase().match(/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})/); if (!m) return toast("That doesn't look like a meeting code."); location.href = "/" + m[1]; };
  });
}
function newMeeting(ch = null) {
  const now = new Date(Date.now() + 3600_000); now.setMinutes(now.getMinutes() < 30 ? 30 : 60, 0, 0);
  const local = new Date(now - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const convs = S.channels;
  dialog(`<form><h3>Schedule a meeting</h3>
    <div class="fld"><label for="mt">Title</label><input id="mt" maxlength="140" required value="${esc(ch ? chName(ch) : "")}"></div>
    <div class="row2"><div class="fld"><label for="ms">Starts</label><input id="ms" type="datetime-local" required value="${local}"></div><div class="fld"><label for="md">Length</label><select id="md">${[15, 30, 45, 60, 90, 120, 180].map((n) => `<option value="${n}" ${n === 30 ? "selected" : ""}>${n < 60 ? n + " minutes" : n / 60 + (n === 60 ? " hour" : " hours")}</option>`).join("")}</select></div></div>
    <div class="row2"><div class="fld"><label for="mc">Conversation</label><select id="mc"><option value="">None: invite by email</option>${convs.map((c) => `<option value="${c.id}" ${ch?.id === c.id ? "selected" : ""}>${esc(c.kind === "dm" ? chName(c) : "#" + chName(c))}</option>`).join("")}</select><small>Everyone in the conversation can join.</small></div>
    ${isEmp() ? `<div class="fld"><label for="mk">Type</label><select id="mk"><option value="meeting">Meeting</option><option value="client">Client meeting (lobby on)</option><option value="webinar">Webinar (every attendee waits in the lobby)</option></select></div>` : ""}</div>
    ${isEmp() ? `<div class="fld"><label for="mi">Also invite by email (optional)</label><input id="mi" placeholder="name@client.com, …"><small>People without an account join through the guest link and wait in the lobby.</small></div>` : ""}
    <div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Schedule</button></div></form>`, (d) => {
    $("form", d).onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await post("/meetings", { title: $("#mt", d).value, startsAt: new Date($("#ms", d).value).toISOString(), duration: +$("#md", d).value, channel_id: $("#mc", d).value || undefined, kind: $("#mk", d)?.value, invitees: $("#mi", d)?.value || "" });
        d.close(); toast("Meeting scheduled. Add it to your calendar from the ⋯ menu."); go("meetings");
      } catch (x) { toast(x.message); }
    };
  });
}

// ------------------------------------------------------------------ profile
function profileMenu(anchor) {
  menu(anchor, [
    [`<b>${esc(S.me.name)}</b>`, () => {}],
    [`<small style="color:var(--muted)">${esc(S.me.email)} · ${S.me.kind === "employee" ? "Kayak" : esc(S.me.org || "Client")}</small>`, () => {}],
    "-",
    [`${ic("globe")} Translation language: ${esc(LANGS[S.me.lang] || "English")}`, pickLang],
    [`${ic("cal")} Calendar sync (Outlook, Google)`, calendarDialog],
    ...(isEmp() ? [[`${ic("globe")} Cloudflare usage this month`, usageDialog]] : []),
    ...(!D && "Notification" in window && Notification.permission === "default" ? [[`${ic("bell")} Turn on notifications`, () => Notification.requestPermission()]] : []),
    ...(!D ? [[`${ic("download")} Get the desktop app`, () => window.open("/download", "_blank", "noopener")]] : []),
    [`${ic("download")} Download my data`, () => (location.href = "/api/ws/me/export")],
    ...(S.me.kind === "client" ? [[`Close my account`, eraseMe]] : []),
    "-",
    [`Privacy notice`, () => window.open("https://www.kayaksa.com/legal#privacy", "_blank", "noopener")],
    [`Sign out`, async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/login"; }],
  ]);
}
function pickLang() {
  dialog(`<form><h3>Translation language</h3><p>Kayak AI translates messages and meeting captions into this language, and writes recaps in it.</p><div class="fld"><select id="lg">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${S.me.lang === k ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Save</button></div></form>`, (d) => {
    $("form", d).onsubmit = async (e) => { e.preventDefault(); const lang = $("#lg", d).value; await post("/me", { lang }, "PATCH"); S.me.lang = lang; S.trans = {}; d.close(); toast(`Translations will be in ${LANGS[lang]}.`); };
  });
}
function eraseMe() {
  dialog(`<form><h3>Close my account</h3><p>This signs you out everywhere, removes you from every conversation and erases your name, email and sign-in details. What you wrote in shared conversations stays, shown as “Former participant”, as part of Kayak's engagement records; to have that erased too, write to enquiries@kayaksa.com with "Privacy" in the subject.</p><p>Download your data first if you want a copy.</p><div class="fld"><label for="cf">Type ERASE to confirm</label><input id="cf" autocomplete="off"></div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn danger">Close my account</button></div></form>`, (d) => {
    $("form", d).onsubmit = async (e) => { e.preventDefault(); try { await post("/me/erase", { confirm: $("#cf", d).value.trim() }); location.href = "/login"; } catch (x) { toast(x.message); } };
  });
}

// ------------------------------------------------------------------ live updates
let pollTimer = null;
async function pollOnce() {
  const r = await api(`/poll?since=${S.since}&at=${encodeURIComponent(S.at)}`).catch(() => null);
  if (!r) return;
  S.at = r.at;
  let changedList = false;
  for (const m of r.messages) {
    if (m.id <= S.since && S.msgs.some((x) => x.id === m.id)) continue;
    const ch = S.channels.find((c) => c.id === m.channel_id);
    const mine = m.member_id === S.me.id;
    if (S.cur?.id === m.channel_id && S.tab === "chat") {
      if (!m.parent_id && !S.msgs.some((x) => x.id === m.id)) S.msgs.push(m);
      if (m.parent_id) { const root = S.msgs.find((x) => x.id === m.parent_id); if (root && !mine) root.replies = (root.replies || 0) + 1; if (S.thread?.id === m.parent_id && !S.thread.msgs.some((x) => x.id === m.id)) S.thread.msgs.push(m); }
    } else if (ch && !mine && !m.parent_id && m.member_id) { ch.unread = (ch.unread || 0) + 1; changedList = true; }
    if (!ch) changedList = true;
    if (!mine && m.member_id && (document.hidden || S.cur?.id !== m.channel_id) && ch && !ch.muted) alertFor(m, ch);
  }
  for (const m of r.edits) { const x = findMsg(m.id); if (x) Object.assign(x, m, { replies: x.replies }); }
  if (r.messages.length || r.edits.length) { if (S.tab === "chat" && S.cur) renderMessages(false); if (S.thread) renderPanel(); markRead(); }
  S.since = Math.max(S.since, r.since);
  if (r.channelsChanged || (changedList && r.messages.some((m) => !S.channels.some((c) => c.id === m.channel_id)))) await refreshBoot();
  else if (changedList) { updateBadge(); renderSide(); }
  if (r.tasksChanged && S.tab === "tasks" && S.cur) renderBoard($("#body"));
}
function alertFor(m, ch) {
  const mention = m.body.includes("@" + S.me.name);
  if (ch.kind !== "dm" && !mention) return;
  const title = ch.kind === "dm" ? m.author : `${m.author} in #${ch.name}`;
  const body = m.kind === "file" ? "Shared a file" : m.body.slice(0, 160);
  if (D) { D.notify({ title, body, path: `/app#c/${ch.id}` }); D.attention(); return; }
  if ("Notification" in window && Notification.permission === "granted" && document.hidden) { const n = new Notification(title, { body, icon: "/_shared/logos/AppIcon_192.png", tag: "km-" + ch.id }); n.onclick = () => { focus(); openChannel(ch.id); n.close(); }; }
}
function poll(now = false) {
  clearTimeout(pollTimer);
  const run = async () => { await pollOnce(); pollTimer = setTimeout(run, document.hidden ? 20_000 : 4_000); };
  pollTimer = setTimeout(run, now ? 0 : 4_000);
}
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#q")?.focus(); }
  if (e.key === "Escape" && S.panel && !document.querySelector("dialog[open]")) { S.panel = null; S.thread = null; renderPanel(); }
});

// ------------------------------------------------------------------ calendar sync (Outlook, Google)
async function calendarDialog() {
  const r = await api("/calendar").catch((e) => toast(e.message)); if (!r) return;
  const row = (p) => `<div class="cal-row"><span class="cal-ic ${p.id}">${p.id === "google" ? "G" : "O"}</span><div><b>${esc(p.name)}</b><small>${p.connected ? `Connected${p.account ? ` as ${esc(p.account)}` : ""}${p.syncedAt ? ` · synced ${new Date(p.syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}${p.error ? ` · <span style="color:#B4472F">${esc(p.error)}</span>` : ""}` : p.available ? "Not connected" : "Not switched on yet by Kayak IT"}</small></div>
    ${p.connected ? `<button class="btn sm" data-off="${p.id}">Disconnect</button>${p.error ? `<a class="btn sm p" href="/calendar/connect/${p.id}">Sign in again</a>` : ""}` : p.available ? `<a class="btn sm p" href="/calendar/connect/${p.id}">Connect</a>` : ""}</div>`;
  dialog(`<div class="dlg"><h3>Calendar sync</h3><p>Connect your work calendar and Meet by Kayak keeps both in step:</p>
    <ul class="cal-ul"><li>Meetings you schedule here, or are invited to, appear in your calendar with the join link.</li><li>Your calendar's events show in Planner beside your to-dos and deliverables.</li><li>Move a meeting you host in Outlook or Google, and it moves here too.</li></ul>
    ${r.providers.map(row).join("")}
    <p class="mk-small" style="color:var(--muted)">Meet by Kayak asks only for access to your calendar events. Your sign-in tokens are encrypted and you can disconnect at any time, which deletes them.</p>
    <div class="foot">${r.providers.some((p) => p.connected) ? `<button class="btn" id="calSync">Sync now</button>` : ""}<button class="btn p" data-close>Done</button></div></div>`, (d) => {
    $$("[data-off]", d).forEach((b) => (b.onclick = async () => { await post(`/calendar/${b.dataset.off}`, {}, "DELETE").catch((e) => toast(e.message)); d.close(); toast("Calendar disconnected."); }));
    $("#calSync", d) && ($("#calSync", d).onclick = async (e) => { e.target.disabled = true; e.target.textContent = "Syncing…"; await post("/calendar/sync").catch((x) => toast(x.message)); d.close(); toast("Calendar synced."); if (S.view === "planner") renderMain(); });
  });
}

// ------------------------------------------------------------------ Cloudflare Realtime usage (Kayak team)
async function usageDialog() {
  const r = await api("/usage").catch((e) => toast(e.message)); if (!r) return;
  const fmt = (v, u) => (u === "GB" ? v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : Math.round(v).toLocaleString("en-IN")) + " " + u;
  dialog(`<div class="dlg"><h3>Cloudflare Realtime usage</h3><p>Billing period from ${new Date(r.period + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. Meet by Kayak stops using each service just before its limit, so usage stays within what's included.</p>
    ${r.meters.map((m) => `<div class="um"><div class="um-h"><b>${esc(m.label)}</b><span>${fmt(m.used, m.unit)} of ${fmt(m.limit, m.unit)}</span></div><div class="um-bar"><i style="width:${m.pct}%;background:${m.pct >= 90 ? "#B4472F" : m.pct >= 80 ? "#EE9B1E" : "#17807E"}"></i></div><small>${m.notUsed ? "Not used by Meet by Kayak (its recordings are stored in Kayak's own R2). Blocked at the limit anyway." : `Stops at ${fmt(m.stopsAt, m.unit)}.`}</small></div>`).join("")}
    <div class="foot"><button class="btn p" data-close>Done</button></div></div>`);
}
