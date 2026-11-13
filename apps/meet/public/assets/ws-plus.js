// Meet by Kayak: Activity, Meet Calls, profiles and photos, the Status Manager, Settings (with Updates,
// Accounts and Downloads in the desktop app), keyboard shortcuts, zoom and Cast to a screen.
// Designed and developed by Kayak Strategic Advisors.
// The workspace (ws.js) passes in its helpers; this module adds views and features on top.

export function install(K) {
  const { $, $$, esc, ic, api, post, toast, dialog, menu, S, D } = K;
  Object.assign(K.P, {
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    phoneOff: '<path d="M10.7 13.3a16 16 0 0 0 3.4 2.5l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 4.2 2 2 0 0 1 5.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L9 9.8"/><path d="M23 1L1 23"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    studio: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8M10 13h4"/>',
    cast: '<path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 20h.01"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    access: '<circle cx="12" cy="4" r="2"/><path d="M4 8h16M12 8v6l-3 8M12 14l3 8"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  });

  // ---------------------------------------------------------------- presence and avatars
  const PRES = {
    available: ["Available", "#3FB27F"], busy: ["Busy", "#D9534F"], dnd: ["Do not disturb", "#B3261E"], brb: ["Be right back", "#E0A11B"],
    away: ["Away", "#E0A11B"], offline: ["Appear offline", "#8A9BA0"], ooo: ["Out of office", "#7B5EA7"], auto: ["Automatic", "#3FB27F"],
  };
  K.presenceDot = (p) => { const k = p?.presence; if (!k || k === "offline") return ""; return `<i class="on pres-${k}" title="${esc(PRES[k]?.[0] || "")}"></i>`; };
  K.avatarImg = (p) => (p?.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" decoding="async">` : "");

  // ---------------------------------------------------------------- preferences (synced to the account)
  const DEFAULTS = {
    theme: "system", textSize: 100, density: "comfortable", reduceMotion: false, highContrast: false, clock: "auto", startView: "chat",
    notifyDesktop: true, notifySound: true, notifyPreview: true, notifyKinds: { mention: true, reply: true, dm: true, reaction: true, added: true, task: true, meeting: true, call: true, missed: true },
    quietFrom: "", quietTo: "", ringtone: "kayak", callVideo: false, autoAway: 5,
    readReceipts: true, showPresence: true, enterToSend: true, spellcheck: true, linkPreviews: true, emojiBig: true,
    captionsDefault: false, captionSize: 100, keyboardHints: true,
    plugins: {},
  };
  S.xp = { ...DEFAULTS };
  let saveT;
  const savePrefs = (patch) => { Object.assign(S.xp, patch); applyPrefs(); clearTimeout(saveT); saveT = setTimeout(() => wput("/prefs", { prefs: S.xp }).then(() => toast("Saved", 1200)).catch((e) => toast(e.message)), 400); };
  function applyPrefs() {
    const r = document.documentElement;
    if (S.xp.theme === "system") delete r.dataset.theme; else r.dataset.theme = S.xp.theme;
    r.style.fontSize = (S.xp.textSize || 100) + "%";
    r.classList.toggle("compact", S.xp.density === "compact");
    r.classList.toggle("reduce-motion", !!S.xp.reduceMotion);
    r.classList.toggle("high-contrast", !!S.xp.highContrast);
  }
  // The workspace api() is rooted at /api/ws; Meet's people API is at /api/wsx.
  const xapi = (p, opts = {}) => fetch("/api/wsx" + p, { credentials: "same-origin", ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`); return j; });
  const wpost = (p, b) => xapi(p, { method: "POST", body: JSON.stringify(b || {}) });
  const wput = (p, b) => xapi(p, { method: "PUT", body: JSON.stringify(b || {}) });
  const wpatch = (p, b) => xapi(p, { method: "PATCH", body: JSON.stringify(b || {}) });
  K.loadPrefs = async () => { try { const r = await xapi("/prefs"); S.xp = { ...DEFAULTS, ...(r.prefs || {}), notifyKinds: { ...DEFAULTS.notifyKinds, ...(r.prefs?.notifyKinds || {}) } }; } catch {} applyPrefs(); };

  const quiet = () => {
    if (!S.xp.quietFrom || !S.xp.quietTo) return false;
    const n = new Date(), m = n.getHours() * 60 + n.getMinutes();
    const [a, b] = [S.xp.quietFrom, S.xp.quietTo].map((t) => { const [h, mm] = t.split(":").map(Number); return h * 60 + mm; });
    return a <= b ? m >= a && m < b : m >= a || m < b;
  };
  const myPresence = () => S.people.find((p) => p.id === S.me.id)?.presence;
  K.shouldNotify = (kind) => S.xp.notifyKinds[kind] !== false && !quiet() && myPresence() !== "dnd";

  // ---------------------------------------------------------------- Activity
  S.act = { items: [], unread: 0, top: 0, filter: "all" };
  const ACT = { mention: ["@", "Mentions"], reply: ["↩", "Replies"], reaction: ["☺", "Reactions"], dm: ["✉", "Messages"], added: ["+", "Added to"], task: ["✓", "Tasks"], meeting: ["▣", "Meetings"], call: ["☎", "Calls"], missed: ["☎", "Missed calls"] };
  const ago = (iso) => { const s = (Date.now() - Date.parse(iso)) / 1000; if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; if (s < 604800) return Math.floor(s / 86400) + "d"; return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" }); };
  async function loadActivity(more = false) {
    const f = S.act.filter;
    const q = `?${f === "unread" ? "unread=1" : f !== "all" ? "kind=" + f : ""}${more && S.act.items.length ? "&before=" + S.act.items[S.act.items.length - 1].id : ""}`;
    const r = await xapi("/activity" + q);
    S.act.items = more ? S.act.items.concat(r.items) : r.items; S.act.unread = r.unread; S.act.more = r.items.length === 50;
  }
  async function renderActivity(main) {
    main.innerHTML = `<header class="top"><div class="t"><h2>${ic("activity")} Activity</h2><small>Mentions, replies, reactions, calls, invitations and tasks, in one place.</small></div>
      <button class="btn sm" id="actAll">${ic("check")}<span class="lbl">Mark all read</span></button></header>
      <div class="act-filters" role="tablist">${[["all", "All"], ["unread", "Unread"], ["mention", "Mentions"], ["reply", "Replies"], ["reaction", "Reactions"], ["missed", "Missed calls"], ["meeting", "Meetings"], ["task", "Tasks"], ["saved", "🔖 Saved"]].map(([k, l]) => `<button role="tab" data-f="${k}" aria-selected="${S.act.filter === k}">${l}</button>`).join("")}</div>
      <div class="body act-list" id="actList"><div class="empty"><p>Loading…</p></div></div>`;
    $$("[data-f]", main).forEach((b) => (b.onclick = () => { S.act.filter = b.dataset.f; renderActivity(main); }));
    $("#actAll").onclick = async () => { await wpost("/activity/read", { all: true }); S.act.unread = 0; K.updateRail(); renderActivity(main); };
    if (S.act.filter === "saved") return drawSaved();
    try { await loadActivity(); } catch (e) { $("#actList").innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
    K.updateRail();
    drawActivity();
  }
  async function drawSaved() {
    const list = $("#actList");
    let r; try { r = await api("/saved"); } catch (e) { list.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
    if (!r.saved.length) { list.innerHTML = `<div class="empty"><span class="act-big">🔖</span><h3>Nothing saved yet</h3><p>Choose ⋯ → Save for later on any message to keep it here. Only you see your saved messages.</p></div>`; return; }
    list.innerHTML = r.saved.map((m) => `<div class="act saved" data-s="${m.id}" data-ch="${esc(m.channel_id)}" role="button" tabindex="0"><span class="act-av">${K.av(m.member_id, m.author)}</span>
      <span class="act-t"><b>${esc(m.author || "")} · ${m.channel_kind === "dm" ? "Direct message" : "#" + esc(m.channel_name)}</b><span>${esc(m.meta?.announce ? m.meta.title + " - " + m.body : m.body)}</span></span>
      <span class="row"><time>${ago(m.created_at)}</time><button class="ib" data-un="${m.id}" aria-label="Remove from saved">${ic("x")}</button></span></div>`).join("");
    $$("[data-s]", list).forEach((b) => (b.onclick = (e) => { if (e.target.closest("[data-un]")) return; K.openChannel(b.dataset.ch); }));
    $$("[data-un]", list).forEach((b) => (b.onclick = async () => { await post(`/messages/${b.dataset.un}/save`, { save: false }); drawSaved(); }));
  }
  function drawActivity() {
    const list = $("#actList"); if (!list) return;
    if (!S.act.items.length) { list.innerHTML = `<div class="empty"><span class="act-big">${ic("activity")}</span><h3>You're all caught up</h3><p>When someone mentions you, replies to you, reacts, calls or invites you, it shows up here.</p></div>`; return; }
    let day = "";
    list.innerHTML = S.act.items.map((a) => {
      const d = new Date(a.at).toDateString(); const head = d !== day ? `<div class="act-day">${esc(K.fmtDay(a.at))}</div>` : ""; day = d;
      const p = K.person(a.actor_id);
      return `${head}<button class="act${a.read ? "" : " unread"}" data-a="${a.id}">
        <span class="act-av">${K.av(a.actor_id, a.actor || "Kayak")}<span class="act-k k-${a.kind}" aria-hidden="true">${ACT[a.kind]?.[0] || "•"}</span></span>
        <span class="act-t"><b>${esc(ACT[a.kind]?.[1] || "Update")}</b><span>${esc(a.text)}</span>${p?.custom ? `<small>${esc(p.custom.emoji)} ${esc(p.custom.text)}</small>` : ""}</span>
        <time datetime="${esc(a.at)}">${ago(a.at)}</time></button>`;
    }).join("") + (S.act.more ? `<button class="btn" id="actMore" style="margin:12px auto;display:flex">Show older</button>` : "");
    $$("[data-a]", list).forEach((b) => {
      b.onclick = () => openActivity(S.act.items.find((x) => x.id === +b.dataset.a));
      b.oncontextmenu = (e) => { e.preventDefault(); const a = S.act.items.find((x) => x.id === +b.dataset.a); menu(b, [[a.read ? "Mark as unread" : "Mark as read", async () => { await wpost("/activity/read", { ids: [a.id], unread: a.read ? 1 : 0 }); a.read = a.read ? 0 : 1; drawActivity(); }]]); };
    });
    $("#actMore") && ($("#actMore").onclick = async () => { await loadActivity(true); drawActivity(); });
  }
  async function openActivity(a) {
    if (!a) return;
    if (!a.read) { a.read = 1; S.act.unread = Math.max(0, S.act.unread - 1); K.updateRail(); wpost("/activity/read", { ids: [a.id] }).catch(() => {}); }
    if (a.kind === "meeting" && a.ref) return (location.href = "/" + a.ref);
    if ((a.kind === "missed" || a.kind === "call") && a.actor_id) return startCall([a.actor_id], false);
    if (a.channel_id) { await K.openChannel(a.channel_id, a.kind === "task" ? "tasks" : "chat"); if (a.kind === "reply" && a.ref) K.openThread?.(+a.ref); return; }
    drawActivity();
  }

  // ---------------------------------------------------------------- Meet Calls
  let ringAudio = null, outgoing = null;
  const RINGS = { kayak: [[659, 0.18], [784, 0.18], [988, 0.32]], classic: [[440, 0.4], [480, 0.4]], soft: [[523, 0.3], [659, 0.4]] };
  function ring(start) {
    if (ringAudio) { clearInterval(ringAudio.t); ringAudio.ac.close().catch(() => {}); ringAudio = null; }
    if (!start || !S.xp.notifySound || S.xp.ringtone === "silent") return;
    try {
      const ac = new AudioContext(); const play = () => { let t = ac.currentTime; for (const [f, d] of RINGS[S.xp.ringtone] || RINGS.kayak) { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d + 0.04; } };
      play(); ringAudio = { ac, t: setInterval(play, 2200) };
    } catch {}
  }
  K.previewRing = (name) => { const keep = S.xp.ringtone; S.xp.ringtone = name; ring(true); S.xp.ringtone = keep; setTimeout(() => ring(false), 2300); };
  const shown = new Set();
  K.onRing = (calls) => {
    const live = new Set((calls || []).map((c) => c.id));
    $$(".incoming").forEach((el) => { if (!live.has(el.dataset.call)) el.remove(); });
    if (!$(".incoming")) ring(false);
    for (const c of calls || []) {
      if (shown.has(c.id) && $(`.incoming[data-call="${c.id}"]`)) continue;
      if ($(`.incoming[data-call="${c.id}"]`)) continue;
      if (myPresence() === "dnd") continue; // Do not disturb: the call becomes a missed call in Activity.
      shown.add(c.id);
      const el = document.createElement("div"); el.className = "incoming"; el.dataset.call = c.id; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-label", `Incoming call from ${c.caller}`);
      el.innerHTML = `<div class="inc-av">${K.av(c.caller_id, c.caller, "lg")}<span class="pulse" aria-hidden="true"></span></div>
        <div class="inc-t"><small>${c.video ? "Video call" : "Audio call"}${c.parties > 2 ? ` · group of ${c.parties}` : ""}</small><b>${esc(c.caller)}</b><span>is calling you on Meet by Kayak</span></div>
        <div class="inc-b"><button class="round decline" data-x="decline" aria-label="Decline">${ic("phoneOff")}</button>
        <button class="round accept" data-x="audio" aria-label="Answer with audio">${ic("phone")}</button>
        <button class="round accept" data-x="video" aria-label="Answer with video">${ic("video")}</button></div>`;
      document.body.append(el);
      ring(true);
      if (D) { D.notify({ title: `${c.caller} is calling`, body: c.video ? "Video call on Meet by Kayak" : "Audio call on Meet by Kayak", path: "/app#calls", kind: "call" }); D.attention(); }
      else if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification(`${c.caller} is calling`, { body: "Meet by Kayak", icon: "/_shared/logos/AppIcon_192.png", tag: "call-" + c.id, requireInteraction: true });
      el.onclick = async (e) => {
        const b = e.target.closest("[data-x]"); if (!b) return;
        ring(false); el.remove();
        try {
          if (b.dataset.x === "decline") { await wpost(`/calls/${c.id}/decline`); return; }
          const r = await wpost(`/calls/${c.id}/answer`);
          try { sessionStorage.setItem("km:callcam", b.dataset.x === "video" ? "1" : "0"); } catch {}
          location.href = r.url;
        } catch (x) { toast(x.message); }
      };
    }
  };
  async function startCall(ids, video = S.xp.callVideo) {
    if (outgoing) return toast("You're already calling someone.");
    let r; try { r = await wpost("/calls", { to: ids, video }); } catch (e) { return toast(e.message); }
    const names = ids.map((i) => K.person(i)?.name || "someone");
    const el = document.createElement("div"); el.className = "outgoing"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Calling");
    el.innerHTML = `<div class="out-in">${ids.length === 1 ? K.av(ids[0], names[0], "xl") : `<span class="av xl grp">${ic("people")}</span>`}<h3>${esc(names.join(", "))}</h3><p id="outState">Calling…</p>
      <div class="inc-b"><button class="round decline" id="outEnd" aria-label="Cancel call">${ic("phoneOff")}</button></div></div>`;
    document.body.append(el);
    const t0 = Date.now();
    const finish = async (timeout) => { clearInterval(outgoing?.t); outgoing = null; el.remove(); ring(false); await wpost(`/calls/${r.id}/end`, { timeout }).catch(() => {}); };
    $("#outEnd").onclick = () => finish(false);
    outgoing = { id: r.id, t: setInterval(async () => {
      const s = await xapi(`/calls/${r.id}`).catch(() => null);
      if (!s) return;
      if (s.state === "live") { clearInterval(outgoing.t); outgoing = null; try { sessionStorage.setItem("km:callcam", video ? "1" : "0"); } catch {} location.href = "/" + s.room; return; }
      if (s.state === "declined" || s.parties.every((p) => p.member_id === S.me.id || p.state === "declined")) { $("#outState").textContent = "Declined"; setTimeout(() => finish(false), 1500); clearInterval(outgoing.t); return; }
      if (Date.now() - t0 > 45_000) { $("#outState").textContent = "No answer"; clearInterval(outgoing.t); setTimeout(() => finish(true), 1200); }
    }, 1500) };
  }
  K.startCall = startCall;
  async function renderCalls(main) {
    main.innerHTML = `<header class="top"><div class="t"><h2>${ic("phone")} Calls</h2><small>Free internet calls to anyone you work with on Meet by Kayak. Audio and video go encrypted between devices.</small></div>
      <button class="btn p" id="newCall">${ic("phone")}<span class="lbl">New call</span></button></header>
      <div class="body calls-body"><div class="dial"><label class="search">${ic("search")}<input id="callQ" placeholder="Find someone to call" aria-label="Find someone to call"></label><div class="dial-list" id="dialList"></div></div>
      <div class="hist"><h3 class="sec">Recent calls</h3><div id="hist"><div class="empty"><p>Loading…</p></div></div></div></div>`;
    const draw = (q = "") => {
      const ppl = S.people.filter((p) => p.id !== S.me.id && (!q || p.name.toLowerCase().includes(q.toLowerCase()))).slice(0, 60);
      $("#dialList").innerHTML = ppl.map((p) => `<div class="dial-row">${K.av(p.id, p.name)}<span class="nm"><b>${esc(p.name)}</b><small>${esc(p.title || (p.kind === "employee" ? "Kayak" : p.org || "Client"))} · ${esc(PRES[p.presence]?.[0] || "Offline")}</small></span>
        <button class="ib" data-call="${p.id}" aria-label="Audio call ${esc(p.name)}">${ic("phone")}</button><button class="ib" data-vcall="${p.id}" aria-label="Video call ${esc(p.name)}">${ic("video")}</button></div>`).join("") || `<p class="mute">Nobody matches.</p>`;
      $$("[data-call]").forEach((b) => (b.onclick = () => startCall([b.dataset.call], false)));
      $$("[data-vcall]").forEach((b) => (b.onclick = () => startCall([b.dataset.vcall], true)));
    };
    draw(); $("#callQ").oninput = (e) => draw(e.target.value.trim());
    $("#newCall").onclick = () => groupCall();
    try {
      const r = await xapi("/calls");
      $("#hist").innerHTML = r.calls.length ? r.calls.map((c) => {
        const others = c.party_ids.filter((i) => i !== S.me.id);
        const out = c.caller_id === S.me.id;
        const missed = !out && (c.my_state === "missed" || (c.my_state === "ringing" && c.state !== "live"));
        const dur = c.answered_at && c.ended_at ? Math.round((Date.parse(c.ended_at) - Date.parse(c.answered_at)) / 60000) : null;
        return `<div class="hist-row${missed ? " missed" : ""}">${K.av(others[0], K.person(others[0])?.name)}<span class="nm"><b>${esc(others.map((i) => K.person(i)?.name || "Former participant").join(", "))}</b>
          <small>${missed ? "Missed" : out ? "Outgoing" : "Incoming"} ${c.video ? "video" : "audio"} call · ${new Date(c.started_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}${dur != null ? ` · ${dur || "<1"} min` : c.state === "declined" ? " · declined" : ""}</small></span>
          <button class="ib" data-again="${others.join(",")}" aria-label="Call back">${ic("phone")}</button></div>`;
      }).join("") : `<div class="empty"><p>No calls yet. Pick someone on the left to call them.</p></div>`;
      $$("[data-again]").forEach((b) => (b.onclick = () => startCall(b.dataset.again.split(","), false)));
    } catch (e) { $("#hist").innerHTML = `<p class="mute">${esc(e.message)}</p>`; }
  }
  function groupCall() {
    const chosen = new Set();
    dialog(`<form><h3>New call</h3><p>Choose up to 15 people. Everyone you choose gets a ringing call.</p><div class="fld"><input id="gq" placeholder="Search people" autocomplete="off"></div><div class="pick" id="gl"></div>
      <div class="foot"><button class="btn" data-close>Cancel</button><button class="btn" type="button" id="ga">${ic("phone")} Audio</button><button class="btn p" id="gv">${ic("video")} Video</button></div></form>`, (d) => {
      const draw = (q = "") => { $("#gl", d).innerHTML = S.people.filter((p) => p.id !== S.me.id && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 50).map((p) => `<label class="pick-row"><input type="checkbox" value="${p.id}" ${chosen.has(p.id) ? "checked" : ""}>${K.av(p.id, p.name, "sm")}<span>${esc(p.name)}</span></label>`).join(""); $$("input", $("#gl", d)).forEach((i) => (i.onchange = () => (i.checked ? chosen.add(i.value) : chosen.delete(i.value)))); };
      draw(); $("#gq", d).oninput = (e) => draw(e.target.value);
      const go = (v) => { if (!chosen.size) return toast("Choose someone to call."); d.close(); startCall([...chosen].slice(0, 15), v); };
      $("#ga", d).onclick = () => go(false); $("form", d).onsubmit = (e) => { e.preventDefault(); go(true); };
    });
  }

  // ---------------------------------------------------------------- Status Manager
  const STATUS_PRESETS = [
    ["📅", "In a meeting", 60], ["🚗", "Commuting", 30], ["🤒", "Out sick", "today"], ["🌴", "On leave", null], ["🏠", "Working remotely", "today"],
    ["🎯", "Focusing", 120], ["🍽️", "Lunch break", 60], ["✈️", "Travelling", null], ["📞", "On a client call", 60], ["🎤", "Presenting", 60],
  ];
  const UNTIL = [["", "Don't clear"], ["30", "30 minutes"], ["60", "1 hour"], ["120", "2 hours"], ["240", "4 hours"], ["today", "Today"], ["week", "This week"]];
  const untilIso = (v) => { if (!v) return null; const d = new Date(); if (v === "today") { d.setHours(23, 59, 0, 0); return d.toISOString(); } if (v === "week") { d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); d.setHours(23, 59, 0, 0); return d.toISOString(); } return new Date(Date.now() + Number(v) * 60000).toISOString(); };
  function meMenu(anchor) {
    const mine = S.people.find((p) => p.id === S.me.id) || {};
    const pop = document.createElement("div"); pop.className = "mecard"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Your status and account");
    pop.innerHTML = `<div class="mc-h">${K.av(S.me.id, S.me.name, "lg")}<div><b>${esc(S.me.name)}</b><small>${esc(mine.title || (S.me.kind === "employee" ? "Kayak Strategic Advisors" : S.me.org || ""))}</small><small>${esc(S.me.email)}</small></div></div>
      <button class="mc-cur" id="mcStatus">${mine.custom ? `${esc(mine.custom.emoji)} ${esc(mine.custom.text)}` : `${ic("sparkle")} Set a status message`}</button>
      <div class="mc-pres">${["auto", "available", "busy", "dnd", "brb", "away", "offline"].map((k) => `<button data-p="${k}" ${(S.me.presence || "auto") === k ? 'aria-current="true"' : ""}><i style="background:${PRES[k][1]}"></i>${PRES[k][0]}</button>`).join("")}</div>
      <hr>
      <button data-go="profile">${ic("user")} My profile</button>
      <button data-go="settings">${ic("gear")} Settings</button>
      <button data-go="studio">${ic("studio")} Meet Studio</button>
      <button data-go="cast">${ic("cast")} Cast to a screen</button>
      <button data-go="keys">${ic("keyboard")} Keyboard shortcuts <kbd>${MOD}+/</kbd></button>
      ${D ? `<button data-go="accounts">${ic("people")} Switch account</button>` : ""}
      <hr><button data-go="signout">Sign out</button>`;
    document.body.append(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(innerWidth - pop.offsetWidth - 8, r.right + 8) + "px";
    pop.style.top = Math.max(8, Math.min(innerHeight - pop.offsetHeight - 8, r.bottom - pop.offsetHeight)) + "px";
    const close = () => { pop.remove(); document.removeEventListener("mousedown", out); };
    const out = (e) => { if (!pop.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener("mousedown", out), 0);
    pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); anchor.focus(); } });
    $$("[data-p]", pop).forEach((b) => (b.onclick = async () => { close(); await setStatus({ presence: b.dataset.p, text: mine.custom?.text, emoji: mine.custom?.emoji, until: mine.custom?.until }); toast(`Your status is ${PRES[b.dataset.p][0].toLowerCase()}.`); }));
    $("#mcStatus", pop).onclick = () => { close(); statusDialog(); };
    $$("[data-go]", pop).forEach((b) => (b.onclick = () => { close(); ({ profile: () => openProfile(S.me.id), settings: () => K.go("settings"), studio: () => (location.href = "/studio"), cast: castDialog, keys: shortcutsDialog, accounts: () => openSettings("accounts"), signout: K.signOut })[b.dataset.go](); }));
    $("button", pop)?.focus();
  }
  async function setStatus(s) {
    try {
      await wput("/status", { presence: s.presence ?? S.me.presence ?? "auto", presenceUntil: s.presenceUntil || null, text: s.text || "", emoji: s.emoji || "", until: s.until || null, oooUntil: s.oooUntil || null, oooNote: s.oooNote || "" });
      S.me.presence = s.presence ?? S.me.presence;
      await K.refreshPeople();
    } catch (e) { toast(e.message); }
  }
  function statusDialog() {
    const mine = S.people.find((p) => p.id === S.me.id) || {};
    dialog(`<form class="status-dlg"><h3>Set your status</h3>
      <div class="st-row"><input id="stE" class="st-emoji" maxlength="4" value="${esc(mine.custom?.emoji || "💬")}" aria-label="Emoji"><input id="stT" maxlength="100" placeholder="What's your status?" value="${esc(mine.custom?.text || "")}" aria-label="Status message"></div>
      <div class="st-presets">${STATUS_PRESETS.map(([e, t, u], i) => `<button type="button" data-i="${i}">${e} ${esc(t)}</button>`).join("")}</div>
      <div class="grid2"><div class="fld"><label for="stU">Clear after</label><select id="stU">${UNTIL.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
      <div class="fld"><label for="stP">Availability</label><select id="stP">${["auto", "available", "busy", "dnd", "brb", "away", "offline"].map((k) => `<option value="${k}" ${(S.me.presence || "auto") === k ? "selected" : ""}>${PRES[k][0]}</option>`).join("")}</select></div></div>
      <details ${mine.ooo ? "open" : ""}><summary>Out of office</summary><div class="grid2" style="margin-top:10px"><div class="fld"><label for="stO">Until</label><input id="stO" type="date" value="${mine.ooo ? mine.ooo.until.slice(0, 10) : ""}"></div>
      <div class="fld"><label for="stN">Message people see</label><input id="stN" maxlength="300" value="${esc(mine.ooo?.note || "")}" placeholder="Back on Monday. For urgent matters, contact…"></div></div></details>
      <p class="mute" style="margin:0">Do not disturb silences notifications and incoming calls; missed calls still appear in Activity.</p>
      <div class="foot"><button class="btn" type="button" id="stClear">Clear status</button><span style="flex:1"></span><button class="btn" data-close>Cancel</button><button class="btn p">Save</button></div></form>`, (d) => {
      $$("[data-i]", d).forEach((b) => (b.onclick = () => { const [e, t, u] = STATUS_PRESETS[+b.dataset.i]; $("#stE", d).value = e; $("#stT", d).value = t; $("#stU", d).value = u == null ? "" : String(u); if (t === "Focusing" || t === "Presenting") $("#stP", d).value = "dnd"; if (t === "In a meeting" || t === "On a client call") $("#stP", d).value = "busy"; }));
      $("#stClear", d).onclick = async () => { d.close(); await setStatus({ presence: "auto" }); toast("Status cleared."); };
      $("form", d).onsubmit = async (e) => {
        e.preventDefault(); d.close();
        const o = $("#stO", d).value;
        await setStatus({ presence: $("#stP", d).value, text: $("#stT", d).value.trim(), emoji: $("#stE", d).value.trim(), until: untilIso($("#stU", d).value), oooUntil: o ? new Date(o + "T23:59:00").toISOString() : null, oooNote: $("#stN", d).value.trim() });
        toast("Status updated.");
      };
    });
  }

  // ---------------------------------------------------------------- Profile
  async function openProfile(id) {
    let p; try { p = await xapi("/profile/" + id); } catch (e) { return toast(e.message); }
    const local = p.tz ? new Date().toLocaleTimeString([], { timeZone: p.tz, hour: "2-digit", minute: "2-digit" }) : "";
    dialog(`<div class="dlg profile">
      <div class="pf-cover"></div>
      <div class="pf-h">${K.av(p.id, p.name, "xl")}<div><h3>${esc(p.name)}${p.pronouns ? ` <small>(${esc(p.pronouns)})</small>` : ""}</h3><p>${esc([p.title, p.dept].filter(Boolean).join(" · ") || (p.kind === "employee" ? "Kayak Strategic Advisors" : p.org))}</p>
        <p class="pf-pres"><i style="background:${PRES[p.presence]?.[1] || "#8A9BA0"}"></i>${esc(PRES[p.presence]?.[0] || "Offline")}${p.custom ? ` · ${esc(p.custom.emoji)} ${esc(p.custom.text)}` : ""}</p></div></div>
      ${p.ooo ? `<div class="pf-ooo"><b>Out of office until ${new Date(p.ooo.until).toLocaleDateString([], { dateStyle: "medium" })}</b>${p.ooo.note ? `<p>${esc(p.ooo.note)}</p>` : ""}</div>` : ""}
      ${p.bio ? `<p class="pf-bio">${esc(p.bio)}</p>` : ""}
      <dl class="pf-dl">${p.email ? `<dt>Email</dt><dd>${esc(p.email)}</dd>` : ""}${p.phone ? `<dt>Phone</dt><dd>${esc(p.phone)}</dd>` : ""}${p.org ? `<dt>Organisation</dt><dd>${esc(p.org)}</dd>` : ""}${p.location ? `<dt>Location</dt><dd>${esc(p.location)}</dd>` : ""}${local ? `<dt>Local time</dt><dd>${esc(local)} (${esc(p.tz)})</dd>` : ""}
        ${p.links.map((l) => `<dt>${esc(l.label)}</dt><dd><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.url.replace(/^https:\/\//, ""))}</a></dd>`).join("")}</dl>
      <div class="foot">${p.editable ? `<button class="btn p" id="pfEdit">${ic("user")} Edit profile</button>` : `<button class="btn" id="pfChat">${ic("chat")} Message</button><button class="btn" id="pfCall">${ic("phone")} Call</button><button class="btn p" id="pfV">${ic("video")} Video call</button>`}<button class="btn" data-close>Close</button></div></div>`, (d) => {
      $("#pfEdit", d) && ($("#pfEdit", d).onclick = () => { d.close(); openSettings("profile"); });
      $("#pfChat", d) && ($("#pfChat", d).onclick = () => { d.close(); K.dmWith(p.id); });
      $("#pfCall", d) && ($("#pfCall", d).onclick = () => { d.close(); startCall([p.id], false); });
      $("#pfV", d) && ($("#pfV", d).onclick = () => { d.close(); startCall([p.id], true); });
    });
  }
  K.openProfile = openProfile;
  async function photoPick() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp";
    inp.onchange = () => { const f = inp.files[0]; if (f) cropDialog(f); };
    inp.click();
  }
  function cropDialog(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return toast("Use a PNG, JPEG or WebP picture.");
    if (file.size > 15 * 1024 * 1024) return toast("That picture is very large. Choose one under 15 MB.");
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      let z = 1, ox = 0, oy = 0;
      dialog(`<form><h3>Your profile photo</h3><p>Drag to position, and use the slider to zoom. It's shown as a circle.</p>
        <div class="crop"><canvas id="cv" width="320" height="320" aria-label="Photo preview"></canvas></div>
        <div class="fld"><label for="zz">Zoom</label><input id="zz" type="range" min="1" max="4" step="0.01" value="1"></div>
        <div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Save photo</button></div></form>`, (d) => {
        const cv = $("#cv", d), cx = cv.getContext("2d"), base = Math.max(320 / img.width, 320 / img.height);
        const draw = () => { const s = base * z, w = img.width * s, h = img.height * s; ox = Math.min(0, Math.max(320 - w, ox)); oy = Math.min(0, Math.max(320 - h, oy)); cx.fillStyle = "#fff"; cx.fillRect(0, 0, 320, 320); cx.drawImage(img, ox, oy, w, h); };
        ox = (320 - img.width * base) / 2; oy = (320 - img.height * base) / 2; draw();
        $("#zz", d).oninput = (e) => { const nz = +e.target.value; ox = 160 - ((160 - ox) * nz) / z; oy = 160 - ((160 - oy) * nz) / z; z = nz; draw(); };
        let drag = null;
        cv.onpointerdown = (e) => { drag = [e.clientX - ox, e.clientY - oy]; cv.setPointerCapture(e.pointerId); };
        cv.onpointermove = (e) => { if (drag) { ox = e.clientX - drag[0]; oy = e.clientY - drag[1]; draw(); } };
        cv.onpointerup = () => (drag = null);
        $("form", d).onsubmit = async (e) => {
          e.preventDefault();
          const out = document.createElement("canvas"); out.width = out.height = 512; out.getContext("2d").drawImage(cv, 0, 0, 320, 320, 0, 0, 512, 512);
          const blob = await new Promise((r) => out.toBlob(r, "image/webp", 0.9)) || await new Promise((r) => out.toBlob(r, "image/jpeg", 0.9));
          try { const r = await fetch("/api/wsx/avatar", { method: "PUT", body: blob, headers: { "Content-Type": blob.type } }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Upload failed."); d.close(); toast("Profile photo updated."); await K.refreshPeople(); if (S.view === "settings") renderSettings($("#main")); }
          catch (x) { toast(x.message); }
        };
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => toast("That picture couldn't be opened.");
    img.src = url;
  }

  // ---------------------------------------------------------------- Cast to a screen
  async function castDialog(room) {
    let meetings = [];
    try { meetings = (await api("/meetings")).meetings || []; } catch {}
    const live = meetings.filter((m) => m.status !== "cancelled").slice(0, 30);
    dialog(`<form><h3>${ic("cast")} Cast to a screen</h3>
      <ol class="steps"><li>On the TV, projector PC or meeting-room screen, open <b>meet.kayaksa.com/cast</b> in a browser.</li><li>Enter the 6-digit code it shows.</li><li>Choose the meeting. The screen joins it to show everyone; it never uses that screen's camera or microphone.</li></ol>
      <div class="fld"><label for="cc">Code on the screen</label><input id="cc" inputmode="numeric" maxlength="7" autocomplete="off" placeholder="123 456" style="font:700 1.5rem var(--display);letter-spacing:.2em;text-align:center"></div>
      <div class="fld"><label for="cm">Meeting</label><select id="cm">${room ? `<option value="${esc(room)}">This meeting</option>` : ""}${live.map((m) => `<option value="${esc(m.id)}">${esc(m.title)}${m.starts_at ? " · " + new Date(m.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""}</option>`).join("")}</select>
      ${!room && !live.length ? `<small>Start or schedule a meeting first.</small>` : ""}</div>
      ${D ? `<p class="mute" style="margin:0">Or, in the desktop app, present on a display connected to this computer (HDMI, AirPlay or Miracast): ${ic("cast")} <button type="button" class="linkish" id="cd">Use a connected display</button></p>` : ""}
      <div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Cast</button></div></form>`, (d) => {
      $("#cd", d) && ($("#cd", d).onclick = async () => { d.close(); castLocal(); });
      $("form", d).onsubmit = async (e) => { e.preventDefault(); try { await wpost("/cast", { code: $("#cc", d).value, room: $("#cm", d).value }); d.close(); toast("Sent to the screen. It joins in a few seconds."); } catch (x) { toast(x.message); } };
    });
  }
  K.castDialog = castDialog;
  async function castLocal() {
    const x = D?.app;
    if (!x?.displays) return toast("Update the desktop app to present on a connected display.");
    const list = await x.displays();
    if (!list.length) return toast("No second display is connected. Connect a TV or projector (or extend to it with AirPlay or Miracast), then try again.");
    dialog(`<form><h3>Present on a display</h3><p>The meeting opens full screen on the display you choose. Press Esc on that screen, or choose Stop here, to end.</p>
      <div class="pick">${list.map((s, i) => `<label class="pick-row"><input type="radio" name="dsp" value="${s.id}" ${i ? "" : "checked"}><span>${esc(s.label)} · ${s.width}×${s.height}</span></label>`).join("")}</div>
      <div class="fld"><label for="dm">Meeting link</label><input id="dm" placeholder="Paste a Meet link or room code"></div>
      <div class="foot"><button class="btn" type="button" id="dst">Stop presenting</button><button class="btn" data-close>Cancel</button><button class="btn p">Present</button></div></form>`, (d) => {
      $("#dst", d).onclick = () => { x.present(null); d.close(); };
      $("form", d).onsubmit = (e) => { e.preventDefault(); const v = $("#dm", d).value.trim(); const room = (v.match(/[A-Za-z0-9-]{8,}/g) || []).pop(); if (!room) return toast("Paste the meeting link."); x.present(+$("input[name=dsp]:checked", d).value, room); d.close(); toast("Presenting on the display."); };
    });
  }

  // ---------------------------------------------------------------- Keyboard shortcuts
  const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const SHORTCUTS = [
    ["Getting around", [[`${MOD}+K`, "Search messages and tasks"], [`${MOD}+/`, "Show keyboard shortcuts"], [`${MOD}+,`, "Open Settings"], ["Alt+1", "Activity"], ["Alt+2", "Chat"], ["Alt+3", "Calls"], ["Alt+4", "Meetings"], ["Alt+5", "To-Do"], ["Alt+6", "Planner"], ["Alt+↑ / Alt+↓", "Previous or next conversation"], ["Esc", "Close a panel or dialog"]]],
    ["Messages", [["Enter", "Send (Shift+Enter for a new line)"], ["↑", "Edit your last message"], [`${MOD}+B / I`, "Bold or italic"], ["@", "Mention someone"]]],
    ["Calls and meetings", [[`${MOD}+Shift+C`, "Start an audio call in this direct message"], [`${MOD}+Shift+V`, "Start a video call in this direct message"], [`${MOD}+Shift+M`, "Meet now with this conversation"], [`${MOD}+Shift+A`, "Answer an incoming call"], [`${MOD}+Shift+D`, "Decline an incoming call"], ["In a meeting: M / V", "Mute / camera"], ["In a meeting: H", "Raise hand"]]],
    ["Status and view", [[`${MOD}+Shift+S`, "Set your status"], [`${MOD}+Shift+N`, "Do not disturb on or off"], [`${MOD}+= / ${MOD}+-`, "Zoom in / out"], [`${MOD}+0`, "Reset zoom"]]],
  ];
  function shortcutsDialog() {
    dialog(`<div class="dlg keys"><h3>${ic("keyboard")} Keyboard shortcuts</h3><div class="keys-grid">${SHORTCUTS.map(([g, list]) => `<section><h4>${g}</h4>${list.map(([k, t]) => `<div class="kr"><span>${esc(t)}</span><span>${k.split(" / ").map((x) => `<kbd>${esc(x)}</kbd>`).join(" ")}</span></div>`).join("")}</section>`).join("")}</div><div class="foot"><button class="btn p" data-close>Done</button></div></div>`);
  }
  K.shortcutsDialog = shortcutsDialog;
  let zoomLevel = 100;
  function zoom(dir) {
    if (D?.app?.zoom) { D.app.zoom(dir).then((z) => toast(`Zoom ${Math.round(z * 100)}%`, 1200)); return; }
    zoomLevel = dir === "reset" ? 100 : Math.max(60, Math.min(200, zoomLevel + (dir === "in" ? 10 : -10)));
    document.documentElement.style.zoom = zoomLevel + "%"; toast(`Zoom ${zoomLevel}%`, 1200);
  }
  K.zoom = zoom;
  addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey, t = e.target, typing = t.matches?.("input, textarea, select, [contenteditable=true]");
    const k = e.key.toLowerCase();
    if (mod && k === "/") { e.preventDefault(); return shortcutsDialog(); }
    if (mod && k === ",") { e.preventDefault(); return K.go("settings"); }
    if (mod && !e.shiftKey && (k === "=" || k === "+")) { e.preventDefault(); return zoom("in"); }
    if (mod && !e.shiftKey && k === "-") { e.preventDefault(); return zoom("out"); }
    if (mod && !e.shiftKey && k === "0") { e.preventDefault(); return zoom("reset"); }
    if (e.altKey && !mod && /^[1-6]$/.test(e.key)) { e.preventDefault(); return K.go(["activity", "chat", "calls", "meetings", "todo", "planner"][+e.key - 1]); }
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); const list = S.channels; const i = list.findIndex((c) => c.id === S.cur?.id); const n = list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]; if (n) K.openChannel(n.id); return; }
    if (mod && e.shiftKey) {
      const inc = $(".incoming");
      if (k === "a" && inc) { e.preventDefault(); return $("[data-x=audio]", inc).click(); }
      if (k === "d" && inc) { e.preventDefault(); return $("[data-x=decline]", inc).click(); }
      if (k === "s") { e.preventDefault(); return statusDialog(); }
      if (k === "n") { e.preventDefault(); const on = S.me.presence === "dnd"; setStatus({ presence: on ? "auto" : "dnd" }).then(() => toast(on ? "Do not disturb is off." : "Do not disturb is on.")); return; }
      if ((k === "c" || k === "v") && S.cur?.kind === "dm") { e.preventDefault(); const o = (S.cur.member_ids || []).filter((i) => i !== S.me.id); return startCall(o, k === "v"); }
      if (k === "m" && S.cur && !typing) { e.preventDefault(); return $("#meetNow")?.click(); }
    }
  });

  // ---------------------------------------------------------------- Plugins
  const PLUGINS = [
    { id: "nexapair", name: "NexaPair", by: "Kayak", logo: "N", color: "#17807E", url: "https://www.nexapair.com", desc: "Share NexaPair matches and introductions into a conversation, and open NexaPair from Meet.", state: "link" },
    { id: "docuvow", name: "DocuVow", by: "Kayak", logo: "D", color: "#2D6A9F", url: "https://www.docuvow.com", desc: "Send documents for signature and get status updates in the conversation they came from.", state: "soon" },
    { id: "learn", name: "Kayak Learn", by: "Kayak", logo: "L", color: "#9C630E", url: "https://learn.kayaksa.com", desc: "Share courses, see your progress and get reminders for live sessions.", state: "link" },
    { id: "graphiq", name: "Kayak GraphIQ", by: "Kayak", logo: "G", color: "#0E2F3C", url: "https://graphiq.kayaksa.com", desc: "Call-record analysis and link charts for investigation teams. Kayak team members with access only.", state: "link", emp: true },
    { id: "whatsapp", name: "WhatsApp Business", by: "Meta, via Kayak", logo: "W", color: "#25D366", desc: "Reply to clients' WhatsApp Business messages from a Meet channel. Needs Kayak's WhatsApp Business Platform account (Meta Business verification and a registered number).", state: "setup" },
    { id: "kayakai", name: "Kayak AI", by: "Kayak", logo: "★", color: "#EE9B1E", desc: "Recaps, translation into 45 languages, Notes.AI and meeting minutes. Built in.", state: "built-in" },
  ];
  const INTEGRATIONS = [
    { id: "outlook", name: "Outlook / Microsoft 365 calendar", desc: "Two-way sync of meetings with your Outlook calendar.", action: () => K.calendarDialog(), state: "Connect" },
    { id: "google", name: "Google Calendar", desc: "Two-way sync of meetings with your Google Calendar.", action: () => K.calendarDialog(), state: "Connect" },
    { id: "slack", name: "Slack", desc: "Post a channel's messages to a Slack channel (per channel: More → Connected apps).", state: "Per channel" },
    { id: "webhook", name: "Signed webhooks", desc: "Send a channel's events to your own systems, signed with HMAC-SHA256.", state: "Per channel" },
    { id: "ics", name: "Calendar invites (.ics)", desc: "Every scheduled meeting has an invite file that works with any calendar.", state: "Built in" },
    { id: "teams", name: "Microsoft Teams", desc: "Join Teams meetings from Planner when your Outlook calendar is connected; Teams links open in Teams.", state: "With Outlook" },
    { id: "zoom", name: "Zoom", desc: "Zoom links in calendar events open in Zoom from Planner.", state: "Links" },
    { id: "drive", name: "Google Drive and OneDrive", desc: "Share links from Drive or OneDrive in any conversation; previews are planned.", state: "Links" },
  ];

  // ---------------------------------------------------------------- Settings
  const TABS = [
    ["general", "General", "gear"], ["profile", "Profile", "user"], ["status", "Status", "sparkle"], ["notifications", "Notifications", "bell"],
    ["devices", "Audio and video", "video"], ["studio", "Meet Studio", "studio"], ["calls", "Calls", "phone"], ["appearance", "Appearance", "moon"],
    ["accessibility", "Accessibility", "access"], ["privacy", "Privacy and security", "shield"], ["shortcuts", "Keyboard shortcuts", "keyboard"],
    ["plugins", "Plugins", "plug"], ["integrations", "Integrations", "link"], ...(D ? [["accounts", "Accounts", "people"], ["downloads", "Downloads", "download"]] : []),
    ["updates", "Updates", "refresh"], ["about", "About", "info"],
  ];
  S.setTab = "general";
  function openSettings(tab) { S.setTab = tab || "general"; if (S.view === "settings") renderSettings($("#main")); else K.go("settings"); history.replaceState(null, "", "#settings/" + S.setTab); }
  K.openSettings = openSettings;
  const tog = (key, label, hint = "", val = S.xp[key]) => `<label class="tg"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ""}</span><input type="checkbox" role="switch" data-k="${key}" ${val ? "checked" : ""}></label>`;
  const sel = (key, label, opts, hint = "") => `<label class="sr"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ""}</span><select data-k="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(S.xp[key]) === String(v) ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  const card = (title, body, sub = "") => `<section class="set-card"><h3>${title}</h3>${sub ? `<p class="mute">${sub}</p>` : ""}${body}</section>`;
  function wireKeys(root) {
    $$("[data-k]", root).forEach((el) => (el.onchange = () => { const v = el.type === "checkbox" ? el.checked : el.type === "range" || el.dataset.num ? +el.value : el.value; savePrefs({ [el.dataset.k]: v }); }));
    $$("[data-nk]", root).forEach((el) => (el.onchange = () => savePrefs({ notifyKinds: { ...S.xp.notifyKinds, [el.dataset.nk]: el.checked } })));
  }
  async function renderSettings(main) {
    const t = S.setTab;
    main.innerHTML = `<div class="settings"><nav class="set-nav" aria-label="Settings"><h2>Settings</h2><label class="search">${ic("search")}<input id="setQ" placeholder="Search settings" aria-label="Search settings"></label>
      ${TABS.map(([k, l, i]) => `<button data-t="${k}" ${k === t ? 'aria-current="page"' : ""}>${ic(i)}<span>${l}</span></button>`).join("")}</nav>
      <div class="set-body" id="setBody"></div></div>`;
    $$("[data-t]", main).forEach((b) => (b.onclick = () => openSettings(b.dataset.t)));
    $("#setQ").oninput = (e) => { const q = e.target.value.toLowerCase(); $$("[data-t]", main).forEach((b) => (b.hidden = q && !b.textContent.toLowerCase().includes(q) && !(SEARCH[b.dataset.t] || "").includes(q))); };
    const body = $("#setBody");
    body.innerHTML = `<div class="empty"><p>Loading…</p></div>`;
    await (PAGES[t] || PAGES.general)(body);
    wireKeys(body);
  }
  const SEARCH = { notifications: "sound quiet hours mentions preview badge", devices: "microphone camera speaker noise echo test", appearance: "dark light theme text size density contrast", privacy: "read receipts presence data export erase two-factor sessions", accessibility: "captions zoom motion contrast screen reader", updates: "version release beta channel", accounts: "switch multi account sign in", downloads: "files saved", calls: "ringtone video answer voip", studio: "background blur lights hd beauty camera", plugins: "nexapair docuvow learn whatsapp graphiq", integrations: "outlook google slack teams zoom webhook calendar drive" };

  const PAGES = {
    async general(b) {
      const desk = D?.app ? await D.app.info().catch(() => null) : null;
      b.innerHTML = `<h2 class="set-h">General</h2>
        ${card("Start-up", sel("startView", "Open Meet on", [["activity", "Activity"], ["chat", "Chat"], ["calls", "Calls"], ["meetings", "Meetings"], ["todo", "To-Do"], ["planner", "Planner"]]) +
          (desk ? `${tog("_launch", "Open Meet by Kayak when I sign in to this computer", "", desk.launchAtLogin)}${tog("_tray", "Keep running in the background when I close the window", "Calls and messages still reach you.", desk.closeToTray)}` : ""))}
        ${card("Language and region", `<label class="sr"><span><b>Translation language</b><small>Kayak AI translates messages and captions into this language and writes recaps in it.</small></span><button class="btn sm" id="lang">${esc(K.LANGS[S.me.lang] || "English")}</button></label>` +
          sel("clock", "Time format", [["auto", "Use my device's setting"], ["12", "12-hour (2:30 pm)"], ["24", "24-hour (14:30)"]]))}
        ${card("Messages", tog("enterToSend", "Press Enter to send", "Turn off to send with " + MOD + "+Enter instead.") + tog("spellcheck", "Check spelling as I type") + tog("linkPreviews", "Show previews of links") + tog("emojiBig", "Show messages that are only emoji larger"))}`;
      $("#lang").onclick = K.pickLang;
      $$("[data-k=_launch],[data-k=_tray]", b).forEach((el) => (el.onchange = (e) => { e.stopImmediatePropagation(); D.app.set({ [el.dataset.k === "_launch" ? "launchAtLogin" : "closeToTray"]: el.checked }).then(() => toast("Saved", 1200)); }));
    },
    async profile(b) {
      let p; try { p = await xapi("/profile/" + S.me.id); } catch (e) { b.innerHTML = `<p>${esc(e.message)}</p>`; return; }
      b.innerHTML = `<h2 class="set-h">Profile</h2>
        <section class="set-card pf-edit"><div class="pf-photo">${K.av(S.me.id, S.me.name, "xxl")}<div><b>Profile photo</b><small>Any picture you like: PNG, JPEG or WebP. You can crop it before it's saved. People you work with see it.</small>
          <div class="row"><button class="btn sm p" id="ph">${ic("user")} ${p.avatar ? "Change photo" : "Upload a photo"}</button>${p.avatar ? `<button class="btn sm" id="phx">Remove</button>` : ""}</div></div></div></section>
        <form class="set-card" id="pf"><h3>About you</h3>
          <div class="grid2"><div class="fld"><label for="pn">Name</label><input id="pn" maxlength="80" value="${esc(p.name)}" ${p.nameFromInternal ? "disabled" : ""}>${p.nameFromInternal ? "<small>Your name comes from Kayak Internal. Ask Kayak HR to change it.</small>" : ""}</div>
          <div class="fld"><label for="pp">Pronouns</label><input id="pp" maxlength="30" value="${esc(p.pronouns)}" placeholder="e.g. she/her"></div>
          <div class="fld"><label for="pt">Job title</label><input id="pt" maxlength="80" value="${esc(p.title)}" placeholder="e.g. Senior Manager, Risk"></div>
          <div class="fld"><label for="pd">Department or team</label><input id="pd" maxlength="80" value="${esc(p.dept)}"></div>
          <div class="fld"><label for="pph">Phone</label><input id="pph" maxlength="30" value="${esc(p.phone)}" inputmode="tel" placeholder="+91 …"><small>Shown to Kayak colleagues and people you share a conversation with.</small></div>
          <div class="fld"><label for="pl">Location</label><input id="pl" maxlength="80" value="${esc(p.location)}" placeholder="e.g. Mumbai"></div>
          <div class="fld"><label for="pz">Time zone</label><select id="pz"><option value="">Not shown</option>${(Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "Asia/Singapore"]).map((z) => `<option ${p.tz === z ? "selected" : ""}>${z}</option>`).join("")}</select></div>
          <div class="fld"><label>Email</label><input value="${esc(p.email || "")}" disabled><small>Your sign-in email can't be changed here.</small></div></div>
          <div class="fld"><label for="pb">About me</label><textarea id="pb" maxlength="500" placeholder="A line or two about what you work on.">${esc(p.bio)}</textarea></div>
          <div class="fld"><label>Links</label><div id="pk">${[0, 1, 2].map((i) => `<div class="row"><input data-ll="${i}" maxlength="40" placeholder="Label (e.g. LinkedIn)" value="${esc(p.links[i]?.label || "")}"><input data-lu="${i}" maxlength="300" placeholder="https://…" value="${esc(p.links[i]?.url || "")}"></div>`).join("")}</div></div>
          <div class="foot"><button class="btn" type="button" id="pv">Preview my profile</button><button class="btn p">Save profile</button></div></form>`;
      $("#ph").onclick = photoPick;
      $("#phx") && ($("#phx").onclick = async () => { await xapi("/avatar", { method: "DELETE" }); await K.refreshPeople(); toast("Photo removed."); PAGES.profile(b); });
      $("#pv").onclick = () => openProfile(S.me.id);
      $("#pf").onsubmit = async (e) => {
        e.preventDefault();
        const links = [0, 1, 2].map((i) => ({ label: $(`[data-ll="${i}"]`).value.trim(), url: $(`[data-lu="${i}"]`).value.trim() })).filter((l) => l.label && l.url);
        if (links.some((l) => !/^https:\/\//i.test(l.url))) return toast("Links must start with https://");
        try { await wpatch("/profile", { name: $("#pn").value.trim(), pronouns: $("#pp").value.trim(), title: $("#pt").value.trim(), dept: $("#pd").value.trim(), phone: $("#pph").value.trim(), location: $("#pl").value.trim(), tz: $("#pz").value, bio: $("#pb").value.trim(), links }); toast("Profile saved."); await K.refreshPeople(); }
        catch (x) { toast(x.message); }
      };
    },
    async status(b) {
      const mine = S.people.find((p) => p.id === S.me.id) || {};
      b.innerHTML = `<h2 class="set-h">Status</h2>
        ${card("Right now", `<div class="st-now"><span class="pf-pres"><i style="background:${PRES[mine.presence]?.[1] || "#8A9BA0"}"></i>${esc(PRES[mine.presence]?.[0] || "Offline")}</span>${mine.custom ? `<span>${esc(mine.custom.emoji)} ${esc(mine.custom.text)}${mine.custom.until ? ` · until ${new Date(mine.custom.until).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>` : `<span class="mute">No status message</span>`}<button class="btn sm p" id="stS">Change status</button></div>`)}
        ${card("Automatic availability", sel("autoAway", "Show me as Away after", [[5, "5 minutes without activity"], [10, "10 minutes"], [15, "15 minutes"], [30, "30 minutes"]]) + tog("showPresence", "Let people see when I'm available", "If off, you appear offline to everyone, but you can still message and call."), "Automatic shows Available while you're using Meet, Away when you're not, and Busy while you're in a meeting or call.")}
        ${card("Quiet hours", `<div class="grid2"><div class="fld"><label for="qf">From</label><input id="qf" type="time" data-k="quietFrom" value="${esc(S.xp.quietFrom)}"></div><div class="fld"><label for="qt">To</label><input id="qt" type="time" data-k="quietTo" value="${esc(S.xp.quietTo)}"></div></div>`, "No notification sounds or pop-ups during these hours. Everything still appears in Activity.")}`;
      $("#stS").onclick = statusDialog;
    },
    async notifications(b) {
      const perm = "Notification" in window ? Notification.permission : "unsupported";
      b.innerHTML = `<h2 class="set-h">Notifications</h2>
        ${!D && perm !== "granted" ? `<div class="banner">${ic("bell")}<span>${perm === "denied" ? "Notifications are blocked for meet.kayaksa.com in your browser. Allow them in the browser's site settings." : "Allow notifications so you hear about calls and mentions when Meet isn't in front."}</span>${perm === "default" ? `<button class="btn sm p" id="np">Allow</button>` : ""}</div>` : ""}
        ${card("How you're notified", tog("notifyDesktop", "Show pop-up notifications") + tog("notifySound", "Play sounds", "For incoming calls and messages.") + tog("notifyPreview", "Show message text in notifications", "Turn off when you share your screen often."))}
        ${card("What you're notified about", Object.entries({ mention: "@mentions of me or everyone", reply: "Replies in threads I'm part of", dm: "Direct messages", reaction: "Reactions to my messages", added: "Being added to a channel or project", task: "Tasks assigned to me", meeting: "Meeting invitations", call: "Calls", missed: "Missed calls" }).map(([k, l]) => `<label class="tg"><span><b>${l}</b></span><input type="checkbox" role="switch" data-nk="${k}" ${S.xp.notifyKinds[k] !== false ? "checked" : ""}></label>`).join(""), "Everything is always kept in Activity; these choices decide what interrupts you.")}
        ${card("Test", `<button class="btn" id="nt">${ic("bell")} Send a test notification</button>`)}`;
      $("#np") && ($("#np").onclick = async () => { await Notification.requestPermission(); PAGES.notifications(b); wireKeys(b); });
      $("#nt").onclick = () => { if (D) D.notify({ title: "Meet by Kayak", body: "Notifications are working.", path: "/app#activity" }); else if ("Notification" in window && Notification.permission === "granted") new Notification("Meet by Kayak", { body: "Notifications are working.", icon: "/_shared/logos/AppIcon_192.png" }); else toast("Allow notifications first."); if (S.xp.notifySound) K.previewRing(S.xp.ringtone); };
    },
    async devices(b) {
      let devs = [];
      try { devs = await navigator.mediaDevices.enumerateDevices(); } catch {}
      const opt = (kind, cur) => devs.filter((d) => d.kind === kind).map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? "selected" : ""}>${esc(d.label || `Device ${i + 1}`)}</option>`).join("") || `<option value="">Default</option>`;
      const ls = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
      b.innerHTML = `<h2 class="set-h">Audio and video</h2>
        <section class="set-card"><h3>Devices</h3><p class="mute">Used for meetings and calls on this device.${devs.some((d) => d.label) ? "" : " Device names appear after you allow camera and microphone access."}</p>
          <div class="dv"><video id="dvV" autoplay playsinline muted></video><div class="dv-meter" aria-hidden="true"><i id="dvM"></i></div></div>
          <div class="grid2"><div class="fld"><label for="dvC">Camera</label><select id="dvC">${opt("videoinput", ls("km:cam"))}</select></div>
          <div class="fld"><label for="dvA">Microphone</label><select id="dvA">${opt("audioinput", ls("km:mic"))}</select></div>
          <div class="fld"><label for="dvS">Speaker</label><select id="dvS" ${"setSinkId" in HTMLMediaElement.prototype ? "" : "disabled"}>${opt("audiooutput", ls("km:spk"))}</select></div></div>
          <div class="row"><button class="btn" id="dvT">${ic("video")} Test camera and microphone</button><button class="btn" id="dvP">Play a test sound</button></div></section>
        ${card("Sound", tog("_ns", "Noise suppression", "Reduces keyboard, fan and street noise.", ls("km:ns") !== "0") + tog("_ec", "Echo cancellation", "", ls("km:ec") !== "0") + tog("_ag", "Automatic microphone volume", "", ls("km:ag") !== "0"))}
        ${card("Video", tog("_mirror", "Mirror my video", "Only you see it mirrored.", ls("km:mirror") !== "0") + tog("_hd", "Send HD video (720p) when the connection allows", "", ls("km:hd") !== "0") + `<p class="mute">More camera controls (lighting, background, touch-up and framing) are in <a href="/studio">Meet Studio</a>.</p>`)}`;
      let stream = null, raf = 0;
      const stop = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); stream = null; };
      const save = () => { try { localStorage.setItem("km:cam", $("#dvC").value); localStorage.setItem("km:mic", $("#dvA").value); localStorage.setItem("km:spk", $("#dvS").value); } catch {} };
      $$("#dvC,#dvA,#dvS", b).forEach((s) => (s.onchange = () => { save(); toast("Saved", 1000); if (stream) $("#dvT").click(); }));
      $("#dvT").onclick = async () => {
        stop();
        try { stream = await navigator.mediaDevices.getUserMedia({ video: $("#dvC").value ? { deviceId: { exact: $("#dvC").value } } : true, audio: $("#dvA").value ? { deviceId: { exact: $("#dvA").value } } : true }); } catch { return toast("Allow camera and microphone access in your browser to test them."); }
        $("#dvV").srcObject = stream; $("#dvV").style.transform = ls("km:mirror") !== "0" ? "scaleX(-1)" : "";
        const ac = new AudioContext(), an = ac.createAnalyser(); ac.createMediaStreamSource(stream).connect(an); const buf = new Uint8Array(an.fftSize);
        const tick = () => { if (!stream) { ac.close(); return; } an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); $("#dvM").style.width = Math.min(100, m * 1.6) + "%"; raf = requestAnimationFrame(tick); };
        tick(); setTimeout(() => { if (S.view !== "settings") stop(); }, 60_000);
      };
      $("#dvP").onclick = () => K.previewRing("soft");
      $$("[data-k^=_]", b).forEach((el) => (el.onchange = (e) => { e.stopImmediatePropagation(); try { localStorage.setItem("km:" + el.dataset.k.slice(1), el.checked ? "1" : "0"); } catch {} toast("Saved", 1000); }));
      K.onLeaveSettings = stop;
    },
    async studio(b) {
      b.innerHTML = `<h2 class="set-h">Meet Studio</h2>
        <section class="set-card studio-promo"><div><h3>Look your best in every meeting</h3><p>Meet Studio is a private room where you try lighting, colour, backgrounds, blur, touch-up, framing and sound on your own camera, then save the look. Your saved look is used automatically when you join meetings and calls.</p>
          <a class="btn p" href="/studio">${ic("studio")} Open Meet Studio</a></div><span class="studio-art" aria-hidden="true">${ic("studio")}</span></section>`;
    },
    async calls(b) {
      b.innerHTML = `<h2 class="set-h">Calls</h2>
        ${card("Ringing", sel("ringtone", "Ringtone", [["kayak", "Kayak"], ["classic", "Classic"], ["soft", "Soft"], ["silent", "Silent (show only)"]]) + `<div class="row"><button class="btn sm" id="rt">Play ringtone</button></div>`)}
        ${card("Starting calls", tog("callVideo", "Start calls with video", "Otherwise calls start as audio and you can turn on video during the call."))}
        ${card("About Meet Calls", `<p>Meet Calls are internet (VoIP) calls between people on Meet by Kayak, in the browser or the desktop app. They're free, encrypted between devices, and work on Wi-Fi or mobile data. Calls to ordinary phone numbers aren't available.</p>`)}`;
      $("#rt").onclick = () => K.previewRing(S.xp.ringtone);
    },
    async appearance(b) {
      b.innerHTML = `<h2 class="set-h">Appearance</h2>
        <section class="set-card"><h3>Theme</h3><div class="themes">${[["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => `<label class="theme t-${v}"><input type="radio" name="th" value="${v}" ${S.xp.theme === v ? "checked" : ""}><span class="sw" aria-hidden="true"><i></i><i></i><i></i></span><b>${l}</b></label>`).join("")}</div></section>
        ${card("Text and layout", `<label class="sr"><span><b>Text size</b><small id="tsv">${S.xp.textSize}%</small></span><input type="range" min="85" max="140" step="5" data-k="textSize" value="${S.xp.textSize}" aria-label="Text size"></label>` + sel("density", "Spacing", [["comfortable", "Comfortable"], ["compact", "Compact - more on screen"]]))}`;
      $$("[name=th]", b).forEach((r) => (r.onchange = () => savePrefs({ theme: r.value })));
      $("[data-k=textSize]", b).oninput = (e) => { $("#tsv").textContent = e.target.value + "%"; };
    },
    async accessibility(b) {
      b.innerHTML = `<h2 class="set-h">Accessibility</h2>
        ${card("Seeing", tog("highContrast", "High contrast", "Stronger borders and text.") + tog("reduceMotion", "Reduce motion", "Turns off animations.") + `<label class="sr"><span><b>Zoom</b><small>${MOD}+= and ${MOD}+- work everywhere.</small></span><span class="row"><button class="btn sm" data-z="out" aria-label="Zoom out">−</button><button class="btn sm" data-z="reset">Reset</button><button class="btn sm" data-z="in" aria-label="Zoom in">+</button></span></label>`)}
        ${card("Hearing", tog("captionsDefault", "Turn on live captions when I join a meeting", "Captions are transcribed on Kayak's servers in 14 Indian languages and English.") + `<label class="sr"><span><b>Caption size</b></span><input type="range" min="80" max="180" step="10" data-k="captionSize" value="${S.xp.captionSize}" aria-label="Caption size"></label>`)}
        ${card("Keyboard", tog("keyboardHints", "Show keyboard shortcuts in tooltips") + `<button class="btn sm" id="ks">${ic("keyboard")} See all shortcuts</button>`)}`;
      $$("[data-z]", b).forEach((x) => (x.onclick = () => zoom(x.dataset.z)));
      $("#ks").onclick = shortcutsDialog;
    },
    async privacy(b) {
      b.innerHTML = `<h2 class="set-h">Privacy and security</h2>
        ${card("Visibility", tog("readReceipts", "Send read receipts", "Others can see when you've read their direct messages.") + tog("showPresence", "Show when I'm available"))}
        ${card("Sign-in", `<p>${S.me.kind === "employee" ? "You sign in through Kayak Internal with your password and two-factor code." : "You sign in with your email and a code from your authenticator app."}</p><div class="row"><button class="btn sm" id="so">Sign out on this device</button></div>`)}
        ${card("Your data", `<p>Download a copy of what Meet by Kayak holds about you (DPDP Act 2023, s.11; GDPR art. 15 and 20).</p><div class="row"><a class="btn sm" href="/api/ws/me/export">${ic("download")} Download my data</a>${S.me.kind === "client" ? `<button class="btn sm danger" id="er">Close my account</button>` : ""}<a class="btn sm" href="https://www.kayaksa.com/legal#privacy" target="_blank" rel="noopener">Privacy notice</a></div>`)}`;
      $("#so").onclick = K.signOut;
      $("#er") && ($("#er").onclick = K.eraseMe);
    },
    async shortcuts(b) {
      b.innerHTML = `<h2 class="set-h">Keyboard shortcuts</h2>${SHORTCUTS.map(([g, list]) => card(g, list.map(([k, t]) => `<div class="kr"><span>${esc(t)}</span><span>${k.split(" / ").map((x) => `<kbd>${esc(x)}</kbd>`).join(" ")}</span></div>`).join(""))).join("")}${D ? card("Anywhere on your computer", `<p>The desktop app also has global shortcuts (mute, camera, raise hand) that work even when Meet isn't in front. Change them in the app's own settings.</p><button class="btn sm" id="ds">Open desktop shortcuts</button>`) : ""}`;
      $("#ds") && ($("#ds").onclick = () => D.app?.openDesktopSettings?.());
    },
    async plugins(b) {
      const on = S.xp.plugins || {};
      const list = PLUGINS.filter((p) => !p.emp || K.isEmp());
      b.innerHTML = `<h2 class="set-h">Plugins</h2><p class="mute">Plugins built by Kayak for Meet. Turn one on to add it to the ${ic("plug")} Plugins menu in conversations.</p>
        <div class="plug-grid">${list.map((p) => `<article class="plug"><span class="plug-logo" style="background:${p.color}">${esc(p.logo)}</span><div><h3>${esc(p.name)}</h3><small>By ${esc(p.by)}</small><p>${esc(p.desc)}</p>
          <div class="row">${p.state === "built-in" ? `<span class="pill ok">${ic("check")} Built in</span>` : p.state === "soon" ? `<span class="pill">Coming soon</span>` : p.state === "setup" ? `<span class="pill warn">Needs set-up by Kayak IT</span>` : `<label class="tg mini"><input type="checkbox" role="switch" data-plug="${p.id}" ${on[p.id] ? "checked" : ""}><span>${on[p.id] ? "On" : "Off"}</span></label>${p.url ? `<a class="btn sm" href="${p.url}" target="_blank" rel="noopener">Open ${esc(p.name)}</a>` : ""}`}</div></div></article>`).join("")}</div>`;
      $$("[data-plug]", b).forEach((x) => (x.onchange = () => { savePrefs({ plugins: { ...on, [x.dataset.plug]: x.checked } }); x.nextElementSibling.textContent = x.checked ? "On" : "Off"; }));
    },
    async integrations(b) {
      b.innerHTML = `<h2 class="set-h">Integrations</h2><p class="mute">Connect Meet by Kayak to the tools you already use.</p>
        <div class="int-list">${INTEGRATIONS.map((x) => `<div class="int"><div><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></div>${x.action ? `<button class="btn sm p" data-int="${x.id}">${esc(x.state)}</button>` : `<span class="pill">${esc(x.state)}</span>`}</div>`).join("")}</div>`;
      $$("[data-int]", b).forEach((x) => (x.onclick = () => INTEGRATIONS.find((i) => i.id === x.dataset.int).action()));
    },
    async accounts(b) {
      const a = await D.app.accounts.list().catch(() => null);
      if (!a) { b.innerHTML = `<h2 class="set-h">Accounts</h2><p>Update the desktop app to use more than one account.</p>`; return; }
      b.innerHTML = `<h2 class="set-h">Accounts</h2><p class="mute">Use up to five Meet by Kayak accounts in the desktop app, for example your Kayak account and a client's guest account. Each account is kept completely separate on this computer.</p>
        <div class="acct-list">${a.accounts.map((x) => `<div class="acct${x.id === a.active ? " cur" : ""}"><span class="av" style="background:#17807E">${esc((x.label || "A")[0].toUpperCase())}</span><div><b>${esc(x.label)}</b><small>${x.id === a.active ? "Using now" : "Signed in separately"}</small></div>
          ${x.id === a.active ? `<span class="pill ok">${ic("check")} Current</span>` : `<button class="btn sm p" data-sw="${x.id}">Switch</button>`}<button class="ib" data-rn="${x.id}" aria-label="Rename">${ic("more")}</button></div>`).join("")}</div>
        ${a.accounts.length < 5 ? `<button class="btn" id="aa">${ic("plus")} Add another account</button>` : ""}`;
      $$("[data-sw]", b).forEach((x) => (x.onclick = () => D.app.accounts.switch(x.dataset.sw)));
      $$("[data-rn]", b).forEach((x) => (x.onclick = () => menu(x, [["Rename", () => { dialog(`<form><h3>Rename account</h3><div class="fld"><input id="rn" maxlength="40" value="${esc(a.accounts.find((y) => y.id === x.dataset.rn).label)}"></div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Save</button></div></form>`, (d) => { $("form", d).onsubmit = async (e) => { e.preventDefault(); await D.app.accounts.rename(x.dataset.rn, $("#rn", d).value.trim()); d.close(); PAGES.accounts(b); }; }); }],
        ...(x.dataset.rn !== a.active ? [["Remove from this computer", async () => { await D.app.accounts.remove(x.dataset.rn); PAGES.accounts(b); }]] : [])])));
      $("#aa") && ($("#aa").onclick = () => dialog(`<form><h3>Add an account</h3><p>Meet opens a fresh sign-in for the new account. Your current account stays signed in.</p><div class="fld"><label for="al">Name for this account</label><input id="al" maxlength="40" placeholder="e.g. Client - Acme" required></div><div class="foot"><button class="btn" data-close>Cancel</button><button class="btn p">Add and sign in</button></div></form>`, (d) => { $("form", d).onsubmit = (e) => { e.preventDefault(); D.app.accounts.add($("#al", d).value.trim()); }; }));
    },
    async downloads(b) {
      const draw = async () => {
        const list = await D.app.downloads.list().catch(() => []);
        b.innerHTML = `<h2 class="set-h">Downloads</h2><p class="mute">Files you've downloaded in Meet by Kayak on this computer.</p>
          ${list.length ? `<div class="dl-list">${list.map((x) => `<div class="dl ${x.state}"><span class="dl-ic">${ic("file")}</span><div><b>${esc(x.name)}</b><small>${x.state === "progressing" ? `${Math.round((x.received / (x.total || 1)) * 100)}% · ${K.fmtSize(x.received)} of ${K.fmtSize(x.total)}` : x.state === "completed" ? `${K.fmtSize(x.total)} · ${new Date(x.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : x.state === "cancelled" ? "Cancelled" : "Failed"}</small>${x.state === "progressing" ? `<progress max="${x.total || 1}" value="${x.received}"></progress>` : ""}</div>
            ${x.state === "completed" ? `<button class="btn sm" data-op="${x.id}">Open</button><button class="btn sm" data-sh="${x.id}">Show in folder</button>` : x.state === "progressing" ? `<button class="btn sm" data-cx="${x.id}">Cancel</button>` : ""}</div>`).join("")}</div><button class="btn sm" id="dlc">Clear list</button>` : `<div class="empty"><p>No downloads yet.</p></div>`}
          <section class="set-card"><h3>Where files are saved</h3><p>${esc((await D.app.info().catch(() => ({}))).downloadDir || "Your Downloads folder")}</p><label class="tg"><span><b>Ask where to save each file</b></span><input type="checkbox" role="switch" id="dla" ${(await D.app.info().catch(() => ({}))).askDownload ? "checked" : ""}></label></section>`;
        $$("[data-op]", b).forEach((x) => (x.onclick = () => D.app.downloads.open(x.dataset.op)));
        $$("[data-sh]", b).forEach((x) => (x.onclick = () => D.app.downloads.show(x.dataset.sh)));
        $$("[data-cx]", b).forEach((x) => (x.onclick = () => D.app.downloads.cancel(x.dataset.cx)));
        $("#dlc") && ($("#dlc").onclick = async () => { await D.app.downloads.clear(); draw(); });
        $("#dla").onchange = (e) => D.app.set({ askDownload: e.target.checked });
      };
      await draw();
      const off = D.app.downloads.onChange?.(() => { if (S.view === "settings" && S.setTab === "downloads") draw(); });
      K.onLeaveSettings = () => off?.();
    },
    async updates(b) {
      if (D?.app) {
        const info = await D.app.info().catch(() => ({}));
        b.innerHTML = `<h2 class="set-h">Updates</h2>
          <section class="set-card upd"><span class="upd-ic">${ic("refresh")}</span><div><h3>Meet by Kayak ${esc(info.version || "")}</h3><p id="us">${info.updateStatus ? esc(info.updateStatus) : "Checks for updates every four hours."}</p><progress id="up" hidden max="100" value="0"></progress></div>
            <div class="row"><button class="btn p" id="uc">Check for updates</button><button class="btn" id="ui" ${info.updateReady ? "" : "hidden"}>Restart and update</button></div></section>
          ${card("Update settings", `<label class="tg"><span><b>Update automatically</b><small>Updates download in the background and install when you restart. Meet never restarts during a meeting.</small></span><input type="checkbox" role="switch" id="ua" ${info.autoUpdate ? "checked" : ""} ${info.locked?.includes("autoUpdate") ? "disabled" : ""}></label>
            <label class="sr"><span><b>Release channel</b><small>Beta gets new features a week or two early.</small></span><select id="uch" ${info.locked?.includes("updateChannel") ? "disabled" : ""}><option value="latest">Stable</option><option value="beta" ${info.updateChannel === "beta" ? "selected" : ""}>Beta</option></select></label>`)}
          ${card("What's new", `<ul class="news"><li><b>1.1</b> Activity, Meet Calls, profile photos, the Status Manager, Meet Studio, new Settings, Accounts, Downloads, Cast to a screen and keyboard shortcuts.</li><li><b>1.0.1</b> Meet only, a branded start-up screen, and a better offline screen.</li></ul>`)}`;
        $("#uc").onclick = async () => { $("#us").textContent = "Checking…"; const r = await D.app.update.check().catch((e) => ({ status: e.message })); $("#us").textContent = r?.status || "Checked."; };
        $("#ui").onclick = () => D.app.update.install();
        $("#ua").onchange = (e) => D.app.set({ autoUpdate: e.target.checked });
        $("#uch").onchange = (e) => D.app.set({ updateChannel: e.target.value });
        const off = D.app.update.onStatus?.((s) => { if (!$("#us")) return; $("#us").textContent = s.text; if (s.percent != null) { $("#up").hidden = false; $("#up").value = s.percent; } if (s.ready) $("#ui").hidden = false; });
        K.onLeaveSettings = () => off?.();
      } else {
        b.innerHTML = `<h2 class="set-h">Updates</h2>
          ${card("Meet by Kayak on the web", `<p>You're using the web version, which is always up to date: new releases appear the next time you open or reload Meet.</p><div class="row"><button class="btn" id="wr">${ic("refresh")} Reload now</button></div>`)}
          ${card("Desktop app", `<p>The desktop app for Windows and Mac updates itself automatically. It adds a system-wide mute shortcut, a mini window during meetings, Accounts, a download tracker and presenting on a connected display.</p><a class="btn p" href="/download" target="_blank" rel="noopener">${ic("download")} Get the desktop app</a>`)}`;
        $("#wr").onclick = () => location.reload();
      }
    },
    async about(b) {
      const v = D?.app ? (await D.app.info().catch(() => ({}))).version : null;
      b.innerHTML = `<h2 class="set-h">About</h2><section class="set-card about"><img src="/_shared/logos/MeetByKayak_Logo_FullColour.svg" alt="Meet by Kayak" width="220"><p><b>Meet by Kayak</b>${v ? ` · desktop app ${esc(v)}` : " · web"}</p><p>Designed and developed by Kayak Strategic Advisors Private Limited.</p>
        <div class="row"><a class="btn sm" href="https://www.kayaksa.com/legal#privacy" target="_blank" rel="noopener">Privacy notice</a><a class="btn sm" href="https://www.kayaksa.com/legal#terms" target="_blank" rel="noopener">Terms</a><a class="btn sm" href="mailto:enquiries@kayaksa.com?subject=Meet%20by%20Kayak%20feedback">Send feedback</a></div>
        <p class="mute">Support: enquiries@kayaksa.com</p></section>`;
    },
  };

  return {
    views: { activity: renderActivity, calls: renderCalls, settings: (m) => { K.onLeaveSettings?.(); K.onLeaveSettings = null; return renderSettings(m); } },
    meMenu, statusDialog, openSettings, startCall,
    pluginMenu(anchor, ch) {
      const on = S.xp.plugins || {};
      const items = PLUGINS.filter((p) => on[p.id] && p.url && (!p.emp || K.isEmp())).map((p) => [`<span class="plug-logo sm" style="background:${p.color}">${esc(p.logo)}</span> ${esc(p.name)}`, () => {
        dialog(`<form><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p><div class="foot"><a class="btn" href="${p.url}" target="_blank" rel="noopener">Open ${esc(p.name)}</a><button class="btn p" type="button" id="plShare">Share a link here</button></div></form>`, (d) => {
          $("#plShare", d).onclick = async () => { try { await post(`/channels/${ch.id}/messages`, { body: `${p.name}: ${p.url}` }); d.close(); toast("Shared."); } catch (x) { toast(x.message); } };
        });
      }]);
      menu(anchor, [...items, "-", [`${ic("gear")} Manage plugins`, () => openSettings("plugins")]]);
    },
    onPoll(r) {
      if (r.activity) {
        const grew = r.activity.top > S.act.top && S.act.top;
        S.act.unread = r.activity.unread; S.act.top = r.activity.top; K.updateRail();
        if (grew && S.view === "activity") renderActivity($("#main"));
      }
      K.onRing(r.ring);
    },
  };
}
