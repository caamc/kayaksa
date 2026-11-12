// Kayak Meet client. Browser-to-browser audio and video over WebRTC (end-to-end encrypted with
// DTLS-SRTP), Kayak's own signalling over a WebSocket, live captions, recording and feedback.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const app = $("#app");

// ---------------------------------------------------------------- icons
const P = {
  sparkle: '<path d="M12 3l1.9 4.8L19 9.5l-4.1 3.2L16.2 18 12 15.3 7.8 18l1.3-5.3L5 9.5l5.1-1.7z"/>',
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/>',
  micOff: '<path d="M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.9-.8M19 11a7 7 0 0 1-1.1 3.8M5 11a7 7 0 0 0 10.6 6M12 18v3"/>',
  cam: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  camOff: '<path d="M3 3l18 18M16 16v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1M10 6h4a2 2 0 0 1 2 2v2l5-3v10"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4M9 10l3-3 3 3M12 7v6"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 16l-1.5-3.5a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/>',
  rec: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  leave: '<path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-1.5v-3a12 12 0 0 0-7 0v3l-3 1.5z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  send: '<path d="M4 12l16-8-6 16-2-6z"/>',
  layout: '<rect x="3" y="4" width="18" height="16"/><path d="M3 10h18M10 10v10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  copy: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
  qa: '<path d="M4 5h16v11h-7l-5 4v-4H4z"/><path d="M10 9a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4M12 14h.01"/>',
  rooms: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  voice: '<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h0"/>',
  avatar: '<circle cx="12" cy="9" r="4.5"/><path d="M4 21a8 8 0 0 1 16 0M10 8.5h.01M14 8.5h.01M10.5 11a2 2 0 0 0 3 0"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
  up: '<path d="M12 5l7 8h-4v6H9v-6H5z"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
};
const ic = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

// ---------------------------------------------------------------- state
const room = location.pathname.slice(1);
let token = new URLSearchParams(location.search).get("t");
try { if (token) sessionStorage.setItem("km:" + room, token); else token = sessionStorage.getItem("km:" + room); } catch {}
if (location.search) history.replaceState(null, "", location.pathname); // keep the invitation out of screenshots and shared screens

const S = {
  info: null, me: null, name: "", ws: null, ice: [], relay: false,
  local: null, micOn: true, camOn: true, screen: null, hand: false,
  peers: new Map(), // id -> { info, pc, polite, makingOffer, ignoreOffer, streams:{cam,screens:{}}, screenIds:[], quality }
  screens: [], // screens I am presenting (up to 4 across the whole room)
  room: {}, panel: null, unread: 0, lobby: [], chat: [], captions: [], transcript: [],
  layout: "auto", rec: null, cap: null, ended: false, leaving: false, stats: { rtt: [], loss: [] }, joinedAt: 0, retries: 0,
  capLang: (() => { try { const v = localStorage.getItem("km:caplang"); return v !== null ? v : localStorage.getItem("km:en") === "0" ? "" : "en"; } catch { return "en"; } })(),
  devices: { mic: localStorage.getItem("km:mic") || "", cam: localStorage.getItem("km:cam") || "" },
  qa: [], br: null, myLang: "", liveQ: null,
};

const api = async (path, opts = {}) => {
  const r = await fetch(path, { ...opts, headers: { "X-Meet-Token": token || "", ...(opts.body && !(opts.body instanceof Blob) && !(opts.body instanceof ArrayBuffer) ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
};

function toast(text, kind = "", ms = 5000, actions = "") {
  let box = $(".kt-toasts");
  if (!box) { box = document.createElement("div"); box.className = "kt-toasts"; box.setAttribute("role", "status"); document.body.append(box); }
  const t = document.createElement("div");
  t.className = "kt " + kind;
  t.innerHTML = `<span>${esc(text)}</span>${actions}`;
  box.append(t);
  if (ms) setTimeout(() => t.remove(), ms);
  return t;
}
const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

// ---------------------------------------------------------------- start
init();
async function init() {
  // No invitation link: join with the Meet by Kayak account you are signed in with, if it is entitled.
  try { S.info = await api(`/api/room/${room}`); }
  catch (e) {
    if (!token) return signInToJoin();
    return fatal("We couldn't open this meeting.", e.message);
  }
  desktopBridge();
  document.title = `${S.info.title} · Meet by Kayak`;
  S.name = S.info.name || localStorage.getItem("km:name") || "";
  prejoin();
}

function signInToJoin() {
  app.innerHTML = `<div class="km-center"><img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak" class="km-logo-big"><h1 style="font:800 1.5rem var(--display);margin:0">Sign in to join this meeting</h1><p class="km-muted">This meeting is for people signed in to Meet by Kayak who were invited to it. If you were sent a guest link, open that link instead.</p><a class="kb primary" href="/login?next=${encodeURIComponent("/" + room)}">Sign in</a></div>`;
}

// ---------------------------------------------------------------- Windows / Mac app
// Tells the desktop app what is happening (taskbar buttons, tray, mini window, no sleep during calls)
// and takes its commands from global shortcuts. Does nothing in a normal browser.
const DESK = window.kayakDesktop || null;
function deskState() {
  DESK?.meeting({ inMeeting: !!S.me && !S.ended && !S.leaving, muted: !S.micOn, camera: S.camOn, sharing: S.screens.length > 0, hand: S.hand, title: S.info?.title || "" });
}
function desktopBridge() {
  if (!DESK) return;
  DESK.onCommand((cmd, arg) => {
    if (!S.me || S.ended) return;
    if (cmd === "toggleMute") setMic(!S.micOn);
    else if (cmd === "toggleCamera") setCam(!S.camOn);
    else if (cmd === "raiseHand") toggleHand();
    else if (cmd === "shareScreen") toggleScreen();
    else if (cmd === "leave") leave();
    else if (cmd === "mini") document.body.classList.toggle("mini", !!arg);
  });
  DESK.prefs().then((p) => { if (p?.joinMuted) S.micOn = false; if (p?.joinCameraOff) S.camOn = false; }).catch(() => {});
}

function fatal(title, detail) {
  app.innerHTML = `<div class="km-center"><img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak" class="km-logo-big"><h1 style="font:800 1.5rem var(--display);margin:0">${esc(title)}</h1><p class="km-muted">${esc(detail)}</p></div>`;
}

// ---------------------------------------------------------------- pre-join
async function getMedia() {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(S.devices.mic ? { deviceId: { exact: S.devices.mic } } : {}) };
  const video = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 }, ...(S.devices.cam ? { deviceId: { exact: S.devices.cam } } : {}) };
  try { return await navigator.mediaDevices.getUserMedia({ audio, video }); }
  catch (e) {
    try { const a = await navigator.mediaDevices.getUserMedia({ audio }); S.camOn = false; toast("No camera found, or access was refused. You can join with audio only."); return a; }
    catch { S.micOn = false; S.camOn = false; toast("Camera and microphone are blocked. Allow them in the browser's address bar to be seen and heard.", "warn", 9000); return new MediaStream(); }
  }
}

let meterStop = null;
function meter(stream, el) {
  meterStop?.();
  const t = stream.getAudioTracks()[0];
  if (!t || !el) return;
  const ac = new AudioContext(); const an = ac.createAnalyser(); an.fftSize = 256;
  ac.createMediaStreamSource(new MediaStream([t])).connect(an);
  const d = new Uint8Array(an.frequencyBinCount); let run = true;
  const tick = () => { if (!run) return; an.getByteTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v - 128)); el.style.height = Math.min(100, m * 1.6) + "%"; requestAnimationFrame(tick); };
  tick();
  meterStop = () => { run = false; ac.close(); };
}

async function prejoin() {
  S.local = await getMedia();
  await applyStudio();
  const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  const label = { audioinput: "Microphone", videoinput: "Camera", audiooutput: "Speaker" };
  const opt = (kind, cur) => devs.filter((d) => d.kind === kind).map((d, i) => `<option value="${esc(d.deviceId)}"${d.deviceId === cur ? " selected" : ""}>${esc(d.label || `${label[kind]} ${i + 1}`)}</option>`).join("");
  const outs = devs.filter((d) => d.kind === "audiooutput");
  const canPickSpeaker = outs.length > 0 && "setSinkId" in HTMLMediaElement.prototype;
  const isClient = S.info.kind === "client";
  app.innerHTML = `
  <div class="top"><img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak"><span class="title"></span><span class="pill e2e">${ic("lock")} End-to-end encrypted</span></div>
  <div class="pre">
    <div class="pre-video"><video id="pv" autoplay playsinline muted></video><div class="off" id="poff" hidden>Camera is off</div><div class="meter" aria-hidden="true"><i id="pm"></i></div>
      <div class="pre-bar"><button class="kc" id="pmic" aria-pressed="true" aria-label="Microphone">${ic("mic")}</button><button class="kc" id="pcam" aria-pressed="true" aria-label="Camera">${ic("cam")}</button><button class="kc" id="pstudio" aria-label="Camera studio and backgrounds" data-tip="Camera studio">${ic("sparkle")}</button></div></div>
    <div class="pre-side">
      <span class="pill" style="justify-self:start">${isClient ? "Client meeting" : S.info.kind === "webinar" ? "Webinar" : "Kayak meeting"}${S.info.startsAt ? " · " + new Date(S.info.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""}</span>
      <h1>${esc(S.info.title)}</h1>
      <p class="km-muted">Hosted by ${esc(S.info.host)}</p>
      ${S.info.name ? `<p>Joining as <b>${esc(S.info.name)}</b></p>` : `<div class="field"><label for="nm">Your name</label><input class="input" id="nm" maxlength="60" autocomplete="name" value="${esc(S.name)}" placeholder="As you'd like others to see it"></div>`}
      <div class="devs"><div class="field"><label for="dmic">Microphone</label><select class="input" id="dmic">${opt("audioinput", S.devices.mic)}</select></div><div class="field"><label for="dcam">Camera</label><select class="input" id="dcam">${opt("videoinput", S.devices.cam)}</select></div>${canPickSpeaker ? `<div class="field"><label for="dspk">Speaker</label><div style="display:flex;gap:8px"><select class="input" id="dspk" style="flex:1">${opt("audiooutput", S.sinkId)}</select><button class="kb" type="button" id="dtest" title="Play a test sound">Test</button></div></div>` : ""}</div>
      <button class="kb primary" id="join">${S.info.role === "guest" && S.info.lobby ? "Ask to join" : "Join now"}</button>
      <p class="note">Audio and video go directly between participants' browsers and are encrypted end to end. If the host turns on captions, speech is transcribed on Kayak's own servers. Everyone sees a notice when a meeting is recorded. <a href="https://www.kayaksa.com/legal" target="_blank" rel="noopener">Privacy</a></p>
    </div>
  </div>`;
  $(".top .title").textContent = "";
  const v = $("#pv"); v.srcObject = S.local;
  meter(S.local, $("#pm"));
  const sync = () => {
    S.local.getAudioTracks().forEach((t) => (t.enabled = S.micOn));
    S.local.getVideoTracks().forEach((t) => (t.enabled = S.camOn));
    $("#pmic").className = "kc" + (S.micOn ? "" : " off"); $("#pmic").innerHTML = ic(S.micOn ? "mic" : "micOff"); $("#pmic").setAttribute("aria-pressed", S.micOn);
    $("#pcam").className = "kc" + (S.camOn ? "" : " off"); $("#pcam").innerHTML = ic(S.camOn ? "cam" : "camOff"); $("#pcam").setAttribute("aria-pressed", S.camOn);
    $("#poff").hidden = S.camOn && S.local.getVideoTracks().length > 0;
  };
  sync();
  $("#pmic").onclick = () => { S.micOn = !S.micOn; sync(); };
  $("#pcam").onclick = () => { S.camOn = !S.camOn; sync(); };
  const swap = async () => {
    S.devices = { mic: $("#dmic").value, cam: $("#dcam").value };
    try { localStorage.setItem("km:mic", S.devices.mic); localStorage.setItem("km:cam", S.devices.cam); } catch {}
    stopCamTracks(); S.local.getTracks().forEach((t) => t.stop());
    S.local = await getMedia(); await applyStudio(); v.srcObject = S.local; meter(S.local, $("#pm")); sync();
  };
  $("#dmic").onchange = swap; $("#dcam").onchange = swap;
  $("#pstudio").onclick = () => openStudio();
  if (canPickSpeaker) {
    $("#dspk").onchange = () => setSpeaker($("#dspk").value);
    $("#dtest").onclick = async () => {
      // A short tone through the chosen speaker, so people can check they'll hear the meeting.
      try { const ac = new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 440; g.gain.value = 0.0001; o.connect(g); const dst = ac.createMediaStreamDestination(); g.connect(dst); g.connect(ac.destination);
        const el = new Audio(); el.srcObject = dst.stream; if (el.setSinkId && $("#dspk").value) await el.setSinkId($("#dspk").value).catch(() => {}); el.play().catch(() => {});
        o.start(); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5); o.stop(ac.currentTime + 0.5);
        toast("Playing a test sound through your speaker.");
        setTimeout(() => { ac.close(); el.srcObject = null; }, 800);
      } catch { toast("Couldn't play a test sound."); }
    };
  }
  $("#join").onclick = async () => {
    const n = S.info.name || $("#nm")?.value.trim();
    if (!n) { $("#nm").focus(); return toast("Add your name so others know who you are."); }
    S.name = n; try { localStorage.setItem("km:name", n); } catch {}
    $("#join").disabled = true;
    meterStop?.();
    try { const ice = await api(`/api/ice/${room}`); S.ice = ice.iceServers; S.relay = ice.relay; } catch { S.ice = [{ urls: ["stun:stun.cloudflare.com:3478"] }]; }
    connect();
  };
}

// ---------------------------------------------------------------- signalling
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/${room}?t=${encodeURIComponent(token || "")}&name=${encodeURIComponent(S.name)}`);
  S.ws = ws;
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
  ws.onclose = (e) => {
    clearInterval(S.ping);
    if (S.ended || S.leaving || [4000, 4001, 4003, 4004, 4005].includes(e.code)) return;
    // Lost connection: tidy up and rejoin.
    for (const id of [...S.peers.keys()]) dropPeer(id);
    if (S.retries++ < 8) { toast("Reconnecting…", "warn", 3000); setTimeout(connect, Math.min(1000 * 2 ** S.retries, 15000)); }
    else fatal("You've been disconnected.", "Check your internet connection, then open the invitation link again.");
  };
  ws.onopen = () => { S.retries = 0; S.ping = setInterval(() => send({ t: "ping" }), 25000); };
}
const send = (m) => { if (S.ws?.readyState === 1) S.ws.send(JSON.stringify(m)); };

function onMsg(m) {
  switch (m.t) {
    case "waiting": return waitingRoom(m);
    case "welcome":
      S.me = m.you; S.room = m.room || {}; S.joinedAt ||= Date.now(); S.qa = m.qa || []; S.br = m.br || null;
      if (!$(".stage")) roomUi();
      send({ t: "state", mic: S.micOn, cam: S.camOn, hand: false, screen: false, vc: voiceOn(), av: !!S.avatar.on });
      if (S.room.sfu) sfuStart();
      if (S.voice !== "natural") applyVoice().then(() => send({ t: "state", vc: voiceOn() }));
      for (const p of m.peers) addPeer(p);
      refreshRoom(); render(); return;
    case "join": addPeer(m.peer); render(); if (together(m.peer)) chime(); return;
    case "leave": dropPeer(m.id); render(); renderPanel(); return;
    case "peer": {
      if (m.peer.id === S.me?.id) { const before = S.me.br || null; S.me = { ...S.me, ...m.peer }; if ((S.me.br || null) !== before) movedRoom(before); render(); renderPanel(); return; }
      const x = S.peers.get(m.peer.id);
      if (x) { const wasHand = x.info.hand, wasBr = x.info.br || null; x.info = m.peer; if (m.peer.hand && !wasHand && together(m.peer)) toast(`${m.peer.name} raised a hand ✋`); if ((m.peer.br || null) !== wasBr) regroup(); if (S.room.sfu) sfuSubscribe(x); }
      render(); renderPanel(); return;
    }
    case "qa": { const before = S.qa; S.qa = m.list; qaNotify(before); if (S.panel === "qa") renderPanel(); bar(); drawLiveQ(); return; }
    case "breakouts": { const was = S.br; S.br = m.br; brNotify(was); regroup(); render(); renderPanel(); bar(); return; }
    case "brMsg": if (m.text) toast(`${m.by} to all rooms: ${m.text}`, "warn", 15000); return;
    case "brHelp": { chime(); toast(`${m.name} asks for help in ${m.room}.`, "warn", 15000, m.key ? `<button class="kb sm" data-brgo="${esc(m.key)}">Join ${esc(m.room)}</button>` : ""); $$("[data-brgo]").forEach((b) => (b.onclick = () => { send({ t: "brMove", key: b.dataset.brgo }); b.closest(".kt")?.remove(); })); return; }
    case "toast": return void toast(m.text || "");
    case "signal": return onSignal(m.from, m.data);
    case "chat": S.chat.push(m); if (S.capLang && m.from !== S.me?.id && !(S.capLang === "en" && looksEnglish(m.text))) api(`/api/translate/${room}`, { method: "POST", body: JSON.stringify({ text: m.text, to: S.capLang }) }).then((r) => { if (r.text && r.text !== m.text) { m.en = r.text; renderPanel(); } }).catch(() => {}); if (S.panel !== "chat" && m.from !== S.me?.id) { S.unread++; toast(`${m.name}: ${m.text.slice(0, 80)}`, "", 4000); } renderPanel(); badge(); return;
    case "react": return floatReact(m.e);
    case "caption": translateCaption(m); S.captions.push(m); S.transcript.push(m); S.captions = S.captions.slice(-3); drawCaptions(); if (S.panel === "transcript") renderPanel(); setTimeout(() => { S.captions = S.captions.filter((x) => x !== m); drawCaptions(); }, 7000); return;
    case "lobby": { const n = m.list.length > S.lobby.length; S.lobby = m.list; if (n) { chime(); toast(`${m.list[m.list.length - 1].name} is waiting to join.`, "warn", 8000); } renderPanel(); badge(); return; }
    case "room": { const before = S.room; S.room = m.room; refreshRoom(before, m.by); return; }
    case "screenFull": { const last = S.screens[S.screens.length - 1]; if (last) stopScreen(last.id); toast(`Up to ${MAX_SCREENS} screens can be shared at once.`, "warn"); return; }
    case "muteRequest": if (S.micOn) { setMic(false); toast(`${m.by} muted you. Unmute when you're ready to speak.`); } return;
    case "removed": S.ended = true; cleanup(); return fatal("The host removed you from this meeting.", "");
    case "denied": S.ended = true; cleanup(); return fatal("The host didn't admit you to this meeting.", "If you think this is a mistake, contact the host.");
    case "full": S.ended = true; cleanup(); return fatal("This meeting is full.", m.townhall ? `This town hall holds up to ${m.limit} people.` : `Meet by Kayak rooms hold up to ${m.limit} people with video. Ask the host to run it as a town hall for larger audiences.`);
    case "ended": S.ended = true; cleanup(); return endScreen(`The meeting was ended by ${m.by}.`);
    // Kayak's monthly Cloudflare Realtime limits (see usage.ts on the server)
    case "capped": S.ended = true; cleanup(); return fatal("This town hall is paused for the rest of the month.", "Kayak's monthly allowance for large meetings has been used. Ask the host to hold it as a regular meeting (up to 12 people with video).");
    case "sfuStop": { try { S.sfu?.pc.close(); } catch {} S.sfu = null; for (const x of S.peers.values()) { x.streams = { screens: {} }; x.pulled = new Map(); } render(); return void toast("Kayak's monthly allowance for town halls has been used, so this town hall's audio and video have stopped. Chat and Q&A still work.", "warn", 0); }
    case "turnStop": return turnStop();
  }
}

function waitingRoom(m) {
  S.me = m.you;
  app.innerHTML = `<div class="km-center"><img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak" class="km-logo-big"><h1 style="font:800 1.5rem var(--display);margin:0">${esc(m.title)}</h1>
    <p class="km-muted">${m.hostHere ? "The host knows you're here and will let you in shortly." : "The meeting hasn't started yet. You'll join as soon as the host lets you in."}</p><span class="pill"><i class="spinner"></i> Waiting to join</span><button class="kb" id="wl">Leave</button></div>`;
  $("#wl").onclick = () => { S.leaving = true; S.ws?.close(); cleanup(); fatal("You left the waiting room.", ""); };
}

// ---------------------------------------------------------------- peers (perfect negotiation)
// Everyone is in S.peers (the roster). A direct connection exists only with the people you can see
// and hear: everyone, or just your own breakout room while rooms are open. In a town hall there are
// no direct connections at all; media goes through Cloudflare Realtime instead (see "town halls").
const together = (info) => !S.br?.open || (info.br || null) === (S.me?.br || null);
const pcs = () => [...[...S.peers.values()].map((x) => x.pc), S.sfu?.pc].filter(Boolean);
function addPeer(info) {
  if (S.peers.has(info.id) || info.id === S.me.id) return;
  const x = { info, pc: null, polite: S.me.id > info.id, makingOffer: false, ignoreOffer: false, streams: { screens: {} }, screenIds: [], quality: "good", pulled: new Map() };
  S.peers.set(info.id, x);
  if (S.room.sfu) return sfuSubscribe(x);
  if (together(info)) link(x);
}
function unlink(x) {
  x.pc?.close(); x.pc = null; x.streams = { screens: {} }; x.makingOffer = false; x.ignoreOffer = false;
  const a = S.audio?.get(x.info.id); if (a) { a.srcObject = null; a.remove(); S.audio.delete(x.info.id); }
}
function regroup() {
  if (S.room.sfu) return;
  for (const x of S.peers.values()) { const t = together(x.info); if (t && !x.pc) link(x); else if (!t && x.pc) unlink(x); }
  tuneBitrate();
}
function link(x) {
  const info = x.info;
  const pc = new RTCPeerConnection({ iceServers: S.ice, bundlePolicy: "max-bundle" });
  x.pc = pc;
  for (const t of S.local.getTracks()) pc.addTrack(t, S.local);
  for (const st of S.screens) for (const t of st.getTracks()) pc.addTrack(t, st);
  pc.onnegotiationneeded = async () => {
    try { x.makingOffer = true; await pc.setLocalDescription(); send({ t: "signal", to: info.id, data: { sdp: pc.localDescription, screenIds: myScreenIds() } }); }
    catch (e) { console.warn(e); } finally { x.makingOffer = false; }
  };
  pc.onicecandidate = ({ candidate }) => candidate && send({ t: "signal", to: info.id, data: { candidate } });
  pc.ontrack = ({ track, streams }) => {
    const st = streams[0] || new MediaStream([track]);
    if (x.screenIds.includes(st.id)) x.streams.screens[st.id] = st; else if (!x.streams.cam || x.streams.cam.id === st.id) x.streams.cam = st; else x.streams.screens[st.id] = st;
    // Audio plays through a dedicated, always-present element, never the video tile, so it keeps
    // playing through every layout change (screen share, speaker view, camera off, phones).
    if (track.kind === "audio") playAudio(info.id, st);
    track.onended = track.onmute = () => render();
    track.onunmute = () => render();
    render();
    if (S.rec) S.rec.addStream(st);
  };
  pc.onconnectionstatechange = () => {
    if (x.pc !== pc) return;
    if (pc.connectionState === "failed") pc.restartIce();
    render();
  };
  tuneBitrate();
}

async function onSignal(from, data) {
  const x = S.peers.get(from);
  if (!x || S.room.sfu) return;
  if (!x.pc) { if (!together(x.info)) return; link(x); }
  const pc = x.pc;
  try {
    if (Array.isArray(data.screenIds)) x.screenIds = data.screenIds.slice(0, 4).map(String);
    else if (data.screenId !== undefined) x.screenIds = data.screenId ? [String(data.screenId)] : []; // older clients
    if (data.sdp) {
      const collision = data.sdp.type === "offer" && (x.makingOffer || pc.signalingState !== "stable");
      x.ignoreOffer = !x.polite && collision;
      if (x.ignoreOffer) return;
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === "offer") { await pc.setLocalDescription(); send({ t: "signal", to: from, data: { sdp: pc.localDescription, screenIds: myScreenIds() } }); }
      // A stream may have arrived before we knew it was a screen share.
      reconcileScreens(x);
      render();
    } else if (data.screenIds || data.screenId !== undefined) { reconcileScreens(x); render();
    } else if (data.candidate) {
      try { await pc.addIceCandidate(data.candidate); } catch (e) { if (!x.ignoreOffer) console.warn(e); }
    }
  } catch (e) { console.warn("signal", e); }
}

function dropPeer(id) {
  const x = S.peers.get(id);
  if (!x) return;
  x.pc?.close();
  if (S.sfu && x.pulled?.size) sfuClose([...x.pulled.values()]);
  S.peers.delete(id);
  const a = S.audio?.get(id); if (a) { a.srcObject = null; a.remove(); S.audio.delete(id); }
  tuneBitrate();
}

// ---------------------------------------------------------------- camera studio and backgrounds
// A processing step between the camera and the call: light, contrast, colour, warmth, soft focus,
// framing, and a background (blur or a Kayak office). Nothing is processed until someone changes a
// setting; untouched, the camera goes out exactly as it comes in. Backgrounds use Google's open-source
// MediaPipe selfie segmentation, served from Kayak's own site; if it can't load, the rest still works.
const STUDIO0 = { bright: 0, contrast: 0, sat: 0, warm: 0, soft: 0, light: false, zoom: 1, bg: "none" };
S.studio = (() => { try { return { ...STUDIO0, ...JSON.parse(localStorage.getItem("km:studio") || "{}") }; } catch { return { ...STUDIO0 }; } })();
const BACKGROUNDS = [["boardroom", "Boardroom"], ["meeting-room", "Meeting room"], ["open-office", "Open office"], ["lounge", "Lounge"], ["teal-studio", "Teal studio"], ["window-desk", "Window desk"], ["deep-current", "Deep Current"], ["open-water", "Open Water"], ["sea-mist", "Sea Mist"]];
const canStudio = (() => { try { return "filter" in document.createElement("canvas").getContext("2d"); } catch { return false; } })();
const studioOn = () => { const t = S.studio; return !!(S.avatar?.on || t.bright || t.contrast || t.sat || t.warm || t.soft || t.light || t.zoom > 1.001 || t.bg !== "none"); };
let PROC = null; // { raw, video, canvas, ctx, out, timer, busy }
let bgImg = null, bgKey = "";
function saveStudio() { try { localStorage.setItem("km:studio", JSON.stringify(S.studio)); } catch {} }
function filterOf(t) {
  const b = 1 + t.bright / 100 + (t.light ? 0.12 : 0), c = 1 + t.contrast / 100 - (t.light ? 0.04 : 0), sat = 1 + t.sat / 100;
  return `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)}) saturate(${sat.toFixed(3)})${t.warm > 0 ? ` sepia(${(t.warm / 260).toFixed(3)})` : t.warm < 0 ? ` hue-rotate(${(t.warm / 6).toFixed(1)}deg) saturate(${(1 + t.warm / 400).toFixed(3)})` : ""}`;
}
function loadBg(key) {
  if (!key.startsWith("kayak-") || bgKey === key) return;
  bgKey = key; const im = new Image(); im.onload = () => { if (bgKey === key) bgImg = im; }; im.src = `/assets/bg/${key}.jpg`;
}
function loadScript(src) { return new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = () => rej(new Error("load")); document.head.append(el); }); }
async function loadSegmenter() {
  if (S.seg) return S.seg;
  if (S.segLoading) return S.segLoading;
  S.segLoading = (async () => {
    await loadScript("/seg/selfie_segmentation.js");
    const seg = new window.SelfieSegmentation({ locateFile: (f) => `/seg/${f}` });
    seg.setOptions({ modelSelection: 1 });
    seg.onResults((r) => { S.segMask = r.segmentationMask; });
    await seg.initialize();
    S.seg = seg;
    return seg;
  })();
  try { return await S.segLoading; } catch (e) { S.segLoading = null; throw e; }
}
function startProc(raw) {
  const st = raw.getSettings ? raw.getSettings() : {};
  const W = st.width || 1280, H = st.height || 720;
  const video = document.createElement("video"); video.muted = true; video.playsInline = true; video.srcObject = new MediaStream([raw]); video.play().catch(() => {});
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  const out = canvas.captureStream(24).getVideoTracks()[0];
  PROC = { raw, video, canvas, ctx, out, busy: false };
  PROC.timer = setInterval(drawProc, 1000 / 24);
}
function stopProc() {
  if (!PROC) return;
  clearInterval(PROC.timer); PROC.video.srcObject = null;
  const p = PROC; PROC = null; return p;
}
function drawProc() {
  const p = PROC; if (!p) return;
  const { video, ctx, canvas } = p, W = canvas.width, H = canvas.height, t = S.studio;
  if (S.avatar?.on) { trackAvatar(video); drawAvatar(ctx, W, H); return; }
  if (video.readyState < 2 || !video.videoWidth) return;
  const z = Math.max(1, Math.min(1.8, t.zoom)), vw = video.videoWidth, vh = video.videoHeight;
  const sw = vw / z, sh = vh / z, sx = (vw - sw) / 2, sy = Math.max(0, (vh - sh) / 2 - (vh - sh) * 0.15); // keep a little headroom
  const f = filterOf(t);
  const useBg = t.bg !== "none" && S.segMask;
  if (useBg) {
    ctx.save();
    ctx.globalCompositeOperation = "copy"; ctx.filter = "blur(3px)";
    ctx.drawImage(S.segMask, sx, sy, sw, sh, 0, 0, W, H);          // the person, as a soft-edged mask
    ctx.globalCompositeOperation = "source-in"; ctx.filter = f;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);              // the person, with the studio look
    ctx.globalCompositeOperation = "destination-over";
    if (t.bg === "blur") { ctx.filter = "blur(16px)"; ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H); }
    else if (bgImg) { ctx.filter = "none"; const r = Math.max(W / bgImg.width, H / bgImg.height), bw = bgImg.width * r, bh = bgImg.height * r; ctx.drawImage(bgImg, (W - bw) / 2, (H - bh) / 2, bw, bh); }
    else { ctx.filter = "none"; ctx.fillStyle = "#0E2F3C"; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  } else { ctx.filter = f; ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H); ctx.filter = "none"; }
  if (t.soft > 0) { ctx.save(); ctx.globalAlpha = (t.soft / 100) * 0.42; ctx.filter = `blur(${2 + t.soft / 30}px)`; ctx.globalCompositeOperation = "lighten"; ctx.drawImage(p.canvas, 0, 0); ctx.restore(); }
  if (t.bg !== "none" && S.seg && !p.busy) { p.busy = true; S.seg.send({ image: video }).catch(() => {}).finally(() => { if (PROC === p) p.busy = false; }); }
}
function swapVideo(oldT, newT) {
  if (oldT) S.local.removeTrack(oldT);
  if (newT) S.local.addTrack(newT);
  for (const pc of pcs()) for (const sd of pc.getSenders()) if (oldT && sd.track === oldT) sd.replaceTrack(newT);
  if (S.sfu && newT && newT.kind === "video" && !oldT) sfuPublish();
  const pv = $("#pv"); if (pv) { pv.srcObject = null; pv.srcObject = S.local; }
  if ($("#grid")) render();
}
// Turn the processing on or off to match the settings (called after any camera change).
async function applyStudio() {
  const want = canStudio && studioOn() && S.camOn;
  const cur = S.local?.getVideoTracks()[0];
  if (want && !PROC && cur && cur.readyState === "live") { startProc(cur); swapVideo(cur, PROC.out); }
  else if (!want && PROC) { const p = stopProc(); swapVideo(p.out, p.raw.readyState === "live" ? p.raw : null); p.out.stop(); }
  if (want && S.studio.bg.startsWith("kayak-")) loadBg(S.studio.bg);
  if (want && S.studio.bg !== "none" && !S.seg) {
    try { await loadSegmenter(); }
    catch { toast("Backgrounds aren't available on this device right now. Your other camera settings still apply.", "warn", 7000); S.studio.bg = "none"; saveStudio(); }
  }
}
// The raw camera track behind the studio (or the camera itself when the studio is off).
const rawCam = () => PROC?.raw || S.local?.getVideoTracks()[0];
function stopCamTracks() { const p = stopProc(); if (p) { p.out.stop(); p.raw.stop(); S.local.removeTrack(p.out); } }

function openStudio() {
  const d = document.createElement("dialog"); d.className = "studio";
  const t = S.studio;
  const slider = (k, label, min, max, step = 1) => `<label class="sl"><span>${label}<output id="o-${k}">${t[k]}</output></span><input type="range" id="s-${k}" min="${min}" max="${max}" step="${step}" value="${t[k]}"></label>`;
  d.innerHTML = `<div class="st-wrap"><div class="st-prev"><video id="stv" autoplay playsinline muted></video><span class="st-tag">${ic("lock")} Preview · only you see this</span></div>
    <div class="st-side"><header><h2>Camera studio</h2><button class="kb sm" id="stx" aria-label="Close">${ic("x")}</button></header>
    ${canStudio ? `<p class="km-muted st-note">Look your best on every call. Leave everything untouched and your camera works exactly as normal.</p>
    <div class="st-group"><h3>Light</h3>${slider("bright", "Brightness", -40, 40)}${slider("contrast", "Contrast", -40, 40)}<label class="tg"><input type="checkbox" id="s-light" ${t.light ? "checked" : ""}> Low-light boost</label></div>
    <div class="st-group"><h3>Colour</h3>${slider("sat", "Colour", -50, 50)}${slider("warm", "Warmth", -50, 50)}</div>
    <div class="st-group"><h3>Touch-up &amp; framing</h3>${slider("soft", "Soft focus", 0, 100)}${slider("zoom", "Framing (zoom)", 1, 1.8, 0.05)}</div>
    <div class="st-group"><h3>Background</h3><div class="bgs"><button data-bg="none" class="${t.bg === "none" ? "on" : ""}"><span>None</span></button><button data-bg="blur" class="${t.bg === "blur" ? "on" : ""}"><span>Blur</span></button>${BACKGROUNDS.map(([k, n]) => `<button data-bg="kayak-${k}" class="${t.bg === "kayak-" + k ? "on" : ""}" style="background-image:url(/assets/bg/kayak-${k}-thumb.jpg)" title="${n}"><span>${n}</span></button>`).join("")}</div></div>
    <div class="st-foot"><button class="kb" id="streset">Reset to standard</button><button class="kb primary" id="stdone">Done</button></div>`
    : `<p class="km-muted st-note">Camera studio and backgrounds need Chrome, Edge or Firefox, or the Meet by Kayak desktop app. Your camera works as normal here.</p><div class="st-foot"><button class="kb primary" id="stdone">OK</button></div>`}</div></div>`;
  document.body.append(d); d.showModal();
  const v = $("#stv", d); v.srcObject = S.local;
  const close = () => { d.close(); d.remove(); };
  $("#stx", d) && ($("#stx", d).onclick = close); $("#stdone", d).onclick = close;
  d.addEventListener("cancel", close);
  const changed = async () => { saveStudio(); await applyStudio(); v.srcObject = S.local; };
  for (const k of ["bright", "contrast", "sat", "warm", "soft", "zoom"]) { const el = $("#s-" + k, d); if (el) el.oninput = () => { t[k] = Number(el.value); $("#o-" + k, d).textContent = k === "zoom" ? `${Math.round(t[k] * 100)}%` : t[k] > 0 ? `+${t[k]}` : t[k]; changed(); }; }
  $("#s-light", d) && ($("#s-light", d).onchange = (e) => { t.light = e.target.checked; changed(); });
  $$("[data-bg]", d).forEach((b) => (b.onclick = () => { t.bg = b.dataset.bg; $$("[data-bg]", d).forEach((x) => x.classList.toggle("on", x === b)); changed(); }));
  $("#streset", d) && ($("#streset", d).onclick = () => { Object.assign(t, STUDIO0); saveStudio(); applyStudio().then(() => { close(); openStudio(); }); });
}

// ---------------------------------------------------------------- audio sink
// One hidden <audio> per remote participant, kept in the DOM for the whole call so their sound is
// never interrupted by what the video grid happens to be showing. If the browser blocks autoplay,
// a single tap on the "Enable sound" bar starts every one of them.
S.audio = new Map();
try { S.sinkId = localStorage.getItem("km:spk") || ""; } catch {}
let audioBlocked = false;
function audioSink() { let s = $("#sink"); if (!s) { s = document.createElement("div"); s.id = "sink"; s.style.display = "none"; document.body.append(s); } return s; }
function playAudio(id, stream) {
  let a = S.audio.get(id);
  if (!a) { a = document.createElement("audio"); a.autoplay = true; a.playsInline = true; audioSink().append(a); S.audio.set(id, a); }
  if (a.srcObject !== stream) a.srcObject = stream;
  if (S.sinkId && a.setSinkId) a.setSinkId(S.sinkId).catch(() => {});
  a.play?.().catch(() => { if (!audioBlocked) { audioBlocked = true; soundBar(); } });
}
function soundBar() {
  if ($("#soundbar")) return;
  const b = document.createElement("button");
  b.id = "soundbar"; b.className = "soundbar";
  b.innerHTML = `${ic("mic")} Tap to enable sound`;
  b.onclick = () => { audioBlocked = false; for (const a of S.audio.values()) a.play?.().catch(() => {}); b.remove(); };
  document.body.append(b);
}
// Let people choose which speaker/headphones the meeting plays through, where the browser allows it.
async function setSpeaker(id) {
  S.sinkId = id; try { localStorage.setItem("km:spk", id); } catch {}
  for (const a of S.audio.values()) if (a.setSinkId) await a.setSinkId(id).catch(() => {});
}

// Fewer people, more quality: share the uplink across everyone we send to.
function tuneBitrate() {
  const n = Math.max(1, S.peers.size);
  const kbps = n <= 1 ? 1800 : n <= 3 ? 900 : n <= 6 ? 500 : 300;
  const scale = n <= 1 ? 1 : n <= 3 ? 1.5 : n <= 6 ? 2 : 3;
  for (const pc of pcs()) for (const s of pc.getSenders()) {
    if (s.track?.kind !== "video") continue;
    const isScreen = !!s.track && isMyScreenTrack(s.track);
    const p = s.getParameters(); if (!p.encodings?.length) p.encodings = [{}];
    p.encodings[0].maxBitrate = (isScreen ? Math.max(kbps * 1.5, 1200) : kbps) * 1000;
    if (!isScreen) p.encodings[0].scaleResolutionDownBy = scale;
    s.setParameters(p).catch(() => {});
  }
}

// ---------------------------------------------------------------- media controls
function setMic(on) {
  S.micOn = on;
  S.local.getAudioTracks().forEach((t) => (t.enabled = on));
  send({ t: "state", mic: on });
  bar(); render();
  if (S.cap) S.cap.paused = !on;
}
async function setCam(on) {
  S.camOn = on;
  if (!on && PROC) { const old = PROC.out; stopCamTracks(); for (const pc of pcs()) for (const s of pc.getSenders()) if (s.track === old) s.replaceTrack(null); }
  let t = S.local.getVideoTracks()[0];
  if (!on && t) { t.stop(); S.local.removeTrack(t); for (const pc of pcs()) for (const s of pc.getSenders()) if (s.track === t) s.replaceTrack(null); }
  if (on) {
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 }, ...(S.devices.cam ? { deviceId: { exact: S.devices.cam } } : {}) } });
      t = v.getVideoTracks()[0]; S.local.addTrack(t);
      for (const pc of pcs()) {
        const s = pc === S.sfu?.pc ? S.sfu.camSender : pc.getSenders().find((x) => (x.track === null || x.track?.kind === "video") && !isMyScreenTrack(x.track) && x.__cam !== false);
        if (s) await s.replaceTrack(t); else if (pc !== S.sfu?.pc) pc.addTrack(t, S.local);
      }
      if (S.sfu && !S.sfu.camSender) sfuPublish();
      tuneBitrate();
      await applyStudio();
    } catch { S.camOn = false; toast("The camera couldn't start. Check that no other app is using it."); }
  }
  send({ t: "state", cam: S.camOn });
  bar(); render();
}
// ---------------------------------------------------------------- multi-screen share
// Up to 4 screens at once across the whole room, from one person or several (a deck, a spreadsheet,
// a contract and a dashboard side by side). The server enforces the limit too.
const MAX_SCREENS = 4;
const myScreenIds = () => S.screens.map((st) => st.id);
const isMyScreenTrack = (t) => S.screens.some((st) => st.getTracks().includes(t));
const othersScreens = () => [...S.peers.values()].filter((x) => together(x.info)).reduce((a, x) => a + (Number(x.info.screen) || 0), 0);
function reconcileScreens(x) {
  if (x.streams.cam && x.screenIds.includes(x.streams.cam.id)) { x.streams.screens[x.streams.cam.id] = x.streams.cam; x.streams.cam = null; }
  for (const id of Object.keys(x.streams.screens)) if (!x.screenIds.includes(id)) delete x.streams.screens[id];
}
function announceScreens() {
  for (const [id, x] of S.peers) if (x.pc) send({ t: "signal", to: id, data: { screenIds: myScreenIds() } });
  send({ t: "state", screen: S.screens.length });
}
// The Share button: start sharing, or (when already sharing) choose to add another screen or stop one.
function toggleScreen(e) {
  if (!S.screens.length) return addScreen();
  const items = [];
  if (S.screens.length + othersScreens() < MAX_SCREENS) items.push([`${ic("screen")} Share another screen (${S.screens.length + othersScreens()} of ${MAX_SCREENS})`, addScreen]);
  S.screens.forEach((st, i) => items.push([`${ic("x")} Stop sharing ${esc(screenLabel(st, i))}`, () => stopScreen(st.id)]));
  if (S.screens.length > 1) items.push([`${ic("x")} Stop all sharing`, stopAllScreens]);
  const anchor = e?.currentTarget || $("#bscr") || $("#bmore");
  if (anchor) menu(anchor, items); else stopAllScreens();
}
const screenLabel = (st, i) => (st.getVideoTracks()[0]?.label || `screen ${i + 1}`).replace(/^(screen|window|web-contents-media-stream):\S*/i, `screen ${i + 1}`).slice(0, 40);
async function addScreen() {
  if (S.screens.length + othersScreens() >= MAX_SCREENS) return toast(`Up to ${MAX_SCREENS} screens can be shared at once. Ask someone to stop sharing first.`, "warn");
  let st;
  try { st = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: S.screens.length === 0 }); }
  catch { return; }
  const vt = st.getVideoTracks()[0];
  if (vt && "contentHint" in vt) vt.contentHint = "detail";
  if (vt) vt.onended = () => stopScreen(st.id);
  S.screens.push(st);
  for (const { pc } of S.peers.values()) if (pc) for (const t of st.getTracks()) pc.addTrack(t, st);
  if (S.sfu) sfuPublish();
  announceScreens();
  tuneBitrate(); bar(); render();
  if (S.screens.length > 1) toast(`You're presenting ${S.screens.length} screens. Everyone sees them side by side.`);
}
function stopScreen(id) {
  const st = S.screens.find((x) => x.id === id);
  if (!st) return;
  const tracks = st.getTracks();
  tracks.forEach((t) => t.stop());
  for (const { pc } of S.peers.values()) if (pc) for (const sd of pc.getSenders()) if (tracks.includes(sd.track)) pc.removeTrack(sd);
  if (S.sfu) sfuUnpublish(tracks);
  S.screens = S.screens.filter((x) => x !== st);
  announceScreens();
  bar(); render();
}
function stopAllScreens() { for (const st of [...S.screens]) stopScreen(st.id); }
function toggleHand() { S.hand = !S.hand; send({ t: "state", hand: S.hand }); bar(); render(); }

// ---------------------------------------------------------------- room UI
function roomUi() {
  app.innerHTML = `
  <div class="top"><img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak"><span class="title" id="ttl"></span>
    <span class="pill rec" id="recpill" hidden><i></i> Recording</span><span class="pill" id="cappill" hidden>${ic("cc")} Captions on</span>
    <span class="pill e2e hide-sm" title="Audio and video travel directly between browsers and are encrypted end to end.">${ic("lock")} Encrypted</span><span class="pill" id="clock">0:00</span></div>
  <div class="main"><div class="stage"><div class="grid" id="grid"></div><div class="caps" id="caps" aria-live="polite"></div></div><aside class="side" id="side" hidden></aside></div>
  <div class="bar" id="bar"></div>`;
  $("#ttl").textContent = S.info.title;
  setInterval(() => { const s = Math.floor((Date.now() - S.joinedAt) / 1000); $("#clock") && ($("#clock").textContent = `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor(s / 60) % 60).padStart(Math.floor(s / 3600) ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`); }, 1000);
  setInterval(pollStats, 4000);
  speakingLoop();
  window.addEventListener("resize", layoutGrid);
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest("input,textarea")) return;
    if (e.key.toLowerCase() === "d") { e.preventDefault(); setMic(!S.micOn); }
    if (e.key.toLowerCase() === "e") { e.preventDefault(); setCam(!S.camOn); }
  });
  window.addEventListener("beforeunload", () => { S.leaving = true; S.ws?.close(); });
  bar();
}

const isHost = () => S.me?.role === "host";
function bar() {
  deskState();
  const b = $("#bar"); if (!b) return;
  b.innerHTML = `
    <button class="kc ${S.micOn ? "" : "off"}" id="bmic" data-tip="${S.micOn ? "Mute" : "Unmute"} (Ctrl+D)" aria-label="${S.micOn ? "Mute" : "Unmute"}" aria-pressed="${!S.micOn}">${ic(S.micOn ? "mic" : "micOff")}</button>
    <button class="kc ${S.camOn ? "" : "off"}" id="bcam" data-tip="${S.camOn ? "Turn camera off" : "Turn camera on"} (Ctrl+E)" aria-label="Camera">${ic(S.camOn ? "cam" : "camOff")}</button>
    <button class="kc ${S.screens.length ? "on" : ""} hide-sm" id="bscr" data-tip="${S.screens.length ? `Presenting ${S.screens.length} · share more or stop` : "Share screen"}" aria-label="Share screen">${ic("screen")}${S.screens.length > 1 ? `<span class="badge">${S.screens.length}</span>` : ""}</button>
    <button class="kc ${S.hand ? "on" : ""}" id="bhand" data-tip="${S.hand ? "Lower hand" : "Raise hand"}" aria-label="Raise hand">${ic("hand")}</button>
    <button class="kc" id="breact" data-tip="React" aria-label="React">${ic("smile")}</button>
    <span class="sep"></span>
    <button class="kc ${S.room.captions ? "on" : ""}" id="bcc" data-tip="${isHost() ? (S.room.captions ? "Turn captions off" : "Turn captions on") : "Transcript"}" aria-label="Captions">${ic("cc")}</button>
    ${isHost() ? `<button class="kc ${S.rec ? "off" : ""} hide-sm" id="brec" data-tip="${S.rec ? "Stop recording" : "Record"}" aria-label="Record">${ic("rec")}</button>` : ""}
    <button class="kc" id="bchat" data-tip="Chat" aria-label="Chat">${ic("chat")}${S.unread ? `<span class="badge">${S.unread}</span>` : ""}</button>
    ${qaInBar() ? `<button class="kc ${S.panel === "qa" ? "on" : ""}" id="bqa" data-tip="Q&amp;A" aria-label="Questions and answers">${ic("qa")}${qaOpen() ? `<span class="badge">${qaOpen()}</span>` : ""}</button>` : ""}
    <button class="kc" id="bppl" data-tip="People" aria-label="People">${ic("people")}${isHost() && S.lobby.length ? `<span class="badge">${S.lobby.length}</span>` : `<span class="badge" style="background:#ffffff30;color:#fff">${[...S.peers.values()].filter((x) => together(x.info)).length + 1}</span>`}</button>
    <button class="kc" id="bmore" data-tip="More" aria-label="More options">${ic("more")}</button>
    <button class="kc leave" id="bleave" aria-label="Leave the meeting">${ic("leave")} <span class="hide-sm">Leave</span></button>`;
  $("#bmic").onclick = () => setMic(!S.micOn);
  $("#bcam").onclick = () => setCam(!S.camOn);
  $("#bscr").onclick = toggleScreen;
  $("#bhand").onclick = toggleHand;
  $("#breact").onclick = (e) => menu(e.currentTarget, ["👍", "👏", "🎉", "❤️", "😂", "🙏"].map((x) => [x, () => send({ t: "react", e: x })]), true);
  $("#bcc").onclick = () => (isHost() ? send({ t: "room", captions: !S.room.captions }) : panel("transcript"));
  $("#brec") && ($("#brec").onclick = () => (S.rec ? stopRecording() : startRecording()));
  $("#bchat").onclick = () => panel("chat");
  $("#bqa") && ($("#bqa").onclick = () => panel("qa"));
  $("#bppl").onclick = () => panel("people");
  $("#bmore").onclick = (e) => menu(e.currentTarget, [
    [`${ic("layout")} ${S.layout === "speaker" ? "Grid view" : "Speaker view"}`, () => { S.layout = S.layout === "speaker" ? "auto" : "speaker"; render(); }],
    [`${ic("notes")} Notes.AI transcript`, () => panel("transcript")],
    ...(qaInBar() ? [] : [[`${ic("qa")} Q&amp;A`, () => panel("qa")]]),
    ...(isHost() && !S.room.sfu ? [[`${ic("rooms")} Breakout rooms${S.br?.open ? " · open" : ""}`, () => panel("rooms")]] : []),
    ...(!isHost() && S.br?.open && S.br.self ? [[`${ic("rooms")} Choose a breakout room`, () => panel("rooms")]] : []),
    [`${ic("voice")} Voice changer${voiceOn() ? ` · ${esc(VOICES[S.voice]?.[0] || "")}` : ""}`, (e) => voiceMenu()],
    [`${ic("avatar")} Kayak Avatar${S.avatar.on ? " · on" : ""}`, openAvatar],
    [`${ic("globe")} Caption language: ${S.capLang ? langName(S.capLang) : "Off"}`, () => { if (S.panel !== "transcript") panel("transcript"); setTimeout(() => $("#ten")?.focus(), 50); }],
    [`${ic("screen")} ${S.screens.length ? "Share another screen or stop" : "Share screen"}`, toggleScreen],
    [`${ic("sparkle")} Camera studio &amp; backgrounds`, openStudio],
    ...(isHost() ? [
      [`${ic("micOff")} Mute everyone`, () => send({ t: "muteAll" })],
      [`${ic("lock")} ${S.room.locked ? "Unlock meeting" : "Lock meeting"}`, () => send({ t: "room", locked: !S.room.locked })],
      [`${ic("people")} ${S.room.lobby ? "Let guests in directly" : "Hold guests in the waiting room"}`, () => send({ t: "room", lobby: !S.room.lobby })],
    ] : []),
    [`${ic("gear")} Connection details`, showStats],
  ]);
  $("#bleave").onclick = (e) => (isHost() ? menu(e.currentTarget, [["Leave the meeting", () => leave()], ["End the meeting for everyone", () => { send({ t: "end" }); }]]) : leave());
}
function badge() { bar(); }

function menu(anchor, items, row = false) {
  $(".menu")?.remove();
  const m = document.createElement("div");
  m.className = "menu"; m.setAttribute("role", "menu");
  if (row) m.style.cssText = "display:flex;padding:6px";
  m.innerHTML = items.map(([l], i) => `<button role="menuitem" data-i="${i}"${row ? ' style="font-size:1.6rem;padding:8px"' : ""}>${l}</button>`).join("");
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.left + r.width / 2 - m.offsetWidth / 2)) + "px";
  m.style.bottom = innerHeight - r.top + 10 + "px";
  m.style.position = "fixed";
  m.onclick = (e) => { const b = e.target.closest("[data-i]"); if (!b) return; m.remove(); items[+b.dataset.i][1](); };
  setTimeout(() => document.addEventListener("click", function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("click", off); } }), 0);
  m.querySelector("button")?.focus();
}

function refreshRoom(before = {}, by) {
  $("#recpill") && ($("#recpill").hidden = !S.room.recording);
  $("#cappill") && ($("#cappill").hidden = !S.room.captions);
  if (S.room.recording && !before.recording) toast(`${S.room.recording} started recording this meeting. Everyone can see this notice.`, "warn", 8000);
  if (!S.room.recording && before.recording) toast("Recording stopped.");
  if (S.room.captions && !before.captions) { toast(`Captions are on. Speech is transcribed on Kayak's own servers and kept as the meeting transcript.${S.capLang ? ` Captions are shown in ${langName(S.capLang)}; change it under Transcript.` : ""}`, "", 8000); startCaptions(); }
  if (!S.room.captions && before.captions) { toast("Captions are off."); stopCaptions(); }
  if (S.room.locked !== before.locked && by) toast(S.room.locked ? `${by} locked the meeting. New guests wait to be admitted.` : `${by} unlocked the meeting.`);
  bar();
}

// ---------------------------------------------------------------- tiles and layout
function tileFor(key, { name, stream, me, screen, mic, cam, hand, quality, vc, av }) {
  let t = document.querySelector(`.tile[data-k="${key}"]`);
  if (!t) {
    t = document.createElement("div");
    t.className = "tile" + (me ? " me" : "") + (screen ? " screen" : "");
    t.dataset.k = key;
    // Always muted: sound comes from the dedicated audio sink, never the tile, so audio survives
    // every layout change. (The local tile would echo anyway.)
    t.innerHTML = `<video autoplay playsinline muted></video><div class="av"><span></span></div><div class="name"><b></b></div><div class="flags"></div>`;
  }
  const v = t.querySelector("video");
  if (stream && v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); }
  const hasVideo = screen || (cam && stream?.getVideoTracks().some((x) => x.readyState === "live" && !x.muted));
  v.style.visibility = hasVideo ? "visible" : "hidden";
  t.querySelector(".av").hidden = !!hasVideo;
  t.querySelector(".av span").textContent = initials(name);
  t.querySelector(".name b").textContent = screen ? (name.includes(" · screen ") ? name : `${name} is presenting`) : name + (me ? " (you)" : "");
  t.querySelector(".name").innerHTML = `${!screen && !mic ? ic("micOff") : ""}<b>${esc(screen ? (name.includes(" · screen ") ? name : `${name} is presenting`) : name + (me ? " (you)" : ""))}</b>${quality && quality !== "good" ? `<span class="q ${quality}" title="Connection is ${quality}"><i></i><i></i><i></i></span>` : ""}`;
  t.querySelector(".flags").innerHTML = (!screen && hand ? `<span class="hand" aria-label="Hand raised">✋</span>` : "") + (!screen && av ? `<span class="fl" title="Appearing as a Kayak Avatar">${ic("avatar")} Avatar</span>` : "") + (!screen && vc ? `<span class="fl" title="Using the voice changer">${ic("voice")} Voice changed</span>` : "");
  return t;
}

function render() {
  const g = $("#grid"); if (!g) return;
  const tiles = [];
  const screens = [];
  S.screens.forEach((st, i) => screens.push(tileFor("me:screen:" + st.id, { name: S.name + (S.screens.length > 1 ? ` · screen ${i + 1}` : ""), stream: st, me: true, screen: true })));
  const seen = [...S.peers].filter(([, x]) => together(x.info));
  for (const [id, x] of seen) {
    if (!x.info.screen) continue;
    const list = Object.values(x.streams.screens).filter((st) => st.getVideoTracks().some((t) => t.readyState === "live"));
    list.forEach((st, i) => screens.push(tileFor(id + ":screen:" + st.id, { name: x.info.name + (list.length > 1 ? ` · screen ${i + 1}` : ""), stream: st, screen: true })));
  }
  tiles.push(tileFor("me", { name: S.name, stream: S.local, me: true, mic: S.micOn, cam: S.camOn, hand: S.hand, vc: voiceOn(), av: S.avatar.on }));
  // A town hall shows up to 24 video tiles (people speaking or presenting first); everyone is still heard.
  const shown = S.room.sfu ? seen.sort(([a], [b]) => (b === S.loudest) - (a === S.loudest)).slice(0, 24) : seen;
  for (const [id, x] of shown) tiles.push(tileFor(id, { name: x.info.name, stream: x.streams.cam, mic: x.info.mic, cam: x.info.cam, hand: x.info.hand, quality: x.quality, vc: x.info.vc, av: x.info.av }));
  drawBrBanner();
  const keep = new Set([...tiles, ...screens]);
  $$(".tile").forEach((t) => !keep.has(t) && t.remove());
  let spot = null;
  if (screens.length > 1) {
    let sg = $("#sgrid");
    if (!sg) { sg = document.createElement("div"); sg.className = "screens-grid"; sg.id = "sgrid"; }
    sg.dataset.n = Math.min(4, screens.length);
    sg.replaceChildren(...screens.slice(0, 4));
    spot = sg;
  } else spot = screens[0] || (S.layout === "speaker" && S.peers.size ? tiles.find((t) => t.dataset.k === S.loudest) || tiles[1] : null);
  g.classList.toggle("spot", !!spot);
  if (spot) {
    let strip = $("#strip");
    if (!strip) { strip = document.createElement("div"); strip.className = "strip"; strip.id = "strip"; }
    g.replaceChildren(spot, strip);
    strip.replaceChildren(...[...(screens.length > 1 ? [] : screens), ...tiles].filter((t) => t !== spot));
    spot.style.width = ""; spot.style.aspectRatio = "auto";
  } else {
    g.replaceChildren(...tiles);
    tiles.forEach((t) => (t.style.aspectRatio = ""));
    layoutGrid();
  }
  if (S.rec) S.rec.tiles = () => [...(spot ? [spot] : []), ...tiles.filter((t) => t !== spot)];
}

// The best grid for N tiles in the space available, keeping 16:9.
function layoutGrid() {
  const g = $("#grid"); if (!g || g.classList.contains("spot")) return;
  const n = g.children.length, W = g.clientWidth, H = g.clientHeight || innerHeight - 160, gap = 10;
  let best = { cols: 1, w: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * (16 / 9));
    if (w > best.w) best = { cols, w };
  }
  g.style.gridTemplateColumns = `repeat(${best.cols}, ${Math.floor(best.w)}px)`;
}

// Who is speaking: a highlight for everyone, and the speaker view follows the loudest voice.
function speakingLoop() {
  const ac = new AudioContext();
  const an = new Map();
  const attach = (key, stream) => {
    const t = stream?.getAudioTracks()[0];
    if (!t) return;
    const prev = an.get(key);
    if (prev?.track === t) return;
    try { const a = ac.createAnalyser(); a.fftSize = 512; ac.createMediaStreamSource(new MediaStream([t])).connect(a); an.set(key, { a, track: t, d: new Uint8Array(a.fftSize), lvl: 0 }); } catch {}
  };
  setInterval(() => {
    if (ac.state === "suspended") ac.resume().catch(() => {});
    attach("me", S.local);
    for (const [id, x] of S.peers) if (x.pc || S.room.sfu) attach(id, x.streams.cam);
    let loud = null, max = 0.02;
    for (const [k, o] of an) {
      if (k !== "me" && !S.peers.has(k)) { an.delete(k); continue; }
      o.a.getByteTimeDomainData(o.d);
      let s = 0; for (const v of o.d) s += ((v - 128) / 128) ** 2;
      o.lvl = o.lvl * 0.6 + Math.sqrt(s / o.d.length) * 0.4;
      const on = o.lvl > 0.03 && (k !== "me" || S.micOn);
      document.querySelector(`.tile[data-k="${k}"]`)?.classList.toggle("speaking", on);
      if (on && o.lvl > max && k !== "me") { max = o.lvl; loud = k; }
    }
    if (loud && loud !== S.loudest) { S.loudest = loud; if (S.layout === "speaker") render(); }
  }, 200);
}

function floatReact(e) {
  const el = document.createElement("div");
  el.className = "react"; el.textContent = e; el.style.left = 10 + Math.random() * 70 + "%";
  $(".stage")?.append(el); setTimeout(() => el.remove(), 3000);
}
function capText(m) {
  if (!S.capLang || m.lang === S.capLang) return null;
  return S.capLang === "en" ? m.en || null : m.tr || null;
}
function drawCaptions() {
  const c = $("#caps"); if (!c) return;
  c.innerHTML = S.captions.map((m) => { const t = capText(m); return t ? `<p><b>${esc(m.name)}</b>${esc(t)}<br><small style="opacity:.7">${esc(m.text)} · ${esc(langName(m.lang))}</small></p>` : `<p><b>${esc(m.name)}</b>${esc(m.text)}</p>`; }).join("");
}
// Each viewer gets captions in their own language. English comes with the caption from the server;
// any other language is translated for this viewer only (nothing is stored per viewer).
function translateCaption(m) {
  if (!S.capLang || S.capLang === "en" || m.lang === S.capLang || !m.text) return;
  api(`/api/translate/${room}`, { method: "POST", body: JSON.stringify({ text: m.text, to: S.capLang, from: m.lang || undefined }) })
    .then((r) => { if (r.text) { m.tr = r.text; drawCaptions(); if (S.panel === "transcript") renderPanel(); } }).catch(() => {});
}

let lastChime = 0;
function chime() {
  if (Date.now() - lastChime < 1500) return; lastChime = Date.now();
  try { const ac = new AudioContext(); const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(0.06, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.4); } catch {}
}

// ---------------------------------------------------------------- side panel
function panel(name) {
  S.panel = S.panel === name ? null : name;
  if (S.panel === "chat") S.unread = 0;
  $("#side").hidden = !S.panel;
  renderPanel(); bar(); setTimeout(layoutGrid, 0);
}
function renderPanel() {
  const s = $("#side"); if (!s || !S.panel) return;
  const head = (t) => `<header><h2>${t}</h2><button class="kb sm" id="pclose" aria-label="Close">${ic("x")}</button></header>`;
  if (S.panel === "chat") {
    s.innerHTML = head("Chat") + `<div class="body" id="cb">${S.chat.length ? S.chat.map((m) => `<div class="msg"><b>${esc(m.from === S.me.id ? "You" : m.name)}<time>${new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></b><p>${linkify(esc(m.text))}</p>${m.en ? `<p class="km-muted" style="font-size:.9rem">${ic("globe")} ${esc(m.en)}</p>` : m.from !== S.me.id && !looksEnglish(m.text) ? `<button class="kb sm" data-tr="${S.chat.indexOf(m)}" style="justify-self:start">Translate to English</button>` : ""}</div>`).join("") : `<p class="km-muted">Messages are seen by everyone in the meeting and are not saved after it ends.</p>`}</div>
      <form id="cf"><input class="input" id="ci" maxlength="2000" placeholder="Message everyone" autocomplete="off" aria-label="Message"><button class="kb primary sm" aria-label="Send">${ic("send")}</button></form>`;
    const b = $("#cb"); b.scrollTop = b.scrollHeight;
    $$("[data-tr]", s).forEach((x) => (x.onclick = async () => { x.disabled = true; x.textContent = "Translating…"; const m = S.chat[+x.dataset.tr]; try { m.en = (await api(`/api/translate/${room}`, { method: "POST", body: JSON.stringify({ text: m.text }) })).en || "(no translation)"; } catch (e) { m.en = e.message; } renderPanel(); }));
    $("#cf").onsubmit = (e) => { e.preventDefault(); const v = $("#ci").value.trim(); if (v) { send({ t: "chat", text: v }); $("#ci").value = ""; } };
    $("#ci").focus();
  } else if (S.panel === "people") {
    const ppl = [{ id: S.me.id, name: S.name + " (you)", role: S.me.role, mic: S.micOn, hand: S.hand, me: true, av: S.avatar.on, vc: voiceOn() }, ...[...S.peers.values()].map((x) => x.info)];
    s.innerHTML = head(`People (${ppl.length})`) + `<div class="body">
      ${isHost() && S.lobby.length ? `<div class="lobbybox"><b>Waiting to join (${S.lobby.length})</b>${S.lobby.map((l) => `<div class="person"><div class="who"><b>${esc(l.name)}</b>${l.email ? `<small>${esc(l.email)}</small>` : ""}</div><div class="acts"><button class="kb sm primary" data-admit="${l.id}">Admit</button><button class="kb sm" data-deny="${l.id}">Deny</button></div></div>`).join("")}${S.lobby.length > 1 ? `<button class="kb sm" id="admitall">Admit everyone</button>` : ""}</div>` : ""}
      ${ppl.map((p) => `<div class="person"><span class="av" style="width:34px;height:34px;border-radius:50%;background:#17807E;display:grid;place-items:center;font-weight:700;flex:none">${esc(initials(p.name))}</span><div class="who"><b>${esc(p.name)}</b><small>${p.role === "host" ? "Host" : p.role === "guest" ? "Guest" : "Kayak"}${p.hand ? " · ✋" : ""}${S.br?.open ? ` · ${esc(roomName(p.me ? S.me.br : p.br))}` : ""}${p.av ? " · Avatar" : ""}${p.vc ? " · Voice changed" : ""}</small></div>
        <span aria-label="${p.mic ? "Microphone on" : "Muted"}">${ic(p.mic ? "mic" : "micOff")}</span>
        ${isHost() && !p.me ? `<div class="acts"><button class="kb sm" data-pm="${p.id}" aria-label="More for ${esc(p.name)}">${ic("more")}</button></div>` : ""}</div>`).join("")}
      <button class="kb sm" id="invite">${ic("copy")} Copy meeting address</button></div>`;
    $$("[data-admit]", s).forEach((b) => (b.onclick = () => send({ t: "admit", id: b.dataset.admit })));
    $$("[data-deny]", s).forEach((b) => (b.onclick = () => send({ t: "deny", id: b.dataset.deny })));
    $("#admitall") && ($("#admitall").onclick = () => send({ t: "admitAll" }));
    $$("[data-pm]", s).forEach((b) => (b.onclick = () => { const p = S.peers.get(b.dataset.pm)?.info; menu(b, [["Ask to unmute / mute", () => send({ t: "mute", id: p.id })], ...(p.role === "member" ? [["Make co-host", () => send({ t: "host", id: p.id })]] : []), ["Remove from meeting", () => send({ t: "remove", id: p.id })]]); }));
    $("#invite").onclick = () => { navigator.clipboard.writeText(location.origin + location.pathname).then(() => toast("Meeting address copied. Invited people still need their own invitation link from the Kayak portal.")).catch(() => toast(location.origin + location.pathname)); };
  } else if (S.panel === "transcript") {
    const langs = {}; for (const m of S.transcript) if (m.lang) langs[m.lang] = (langs[m.lang] || 0) + 1;
    s.innerHTML = head(`${ic("notes")} Notes.AI`) + `<div class="body" id="tb">
      <p class="km-muted" style="font-size:.85rem;margin:0">Every phrase is transcribed in the language it was spoken - Notes.AI detects it automatically, line by line, even when people switch languages.</p>
      ${Object.keys(langs).length ? `<div class="langs">${Object.entries(langs).sort((a, b) => b[1] - a[1]).map(([l, n]) => `<span class="lchip">${esc(langName(l))} · ${n}</span>`).join("")}</div>` : ""}
      <label class="row" style="display:grid;gap:4px;font-size:.9rem" for="ten">Show captions in<select class="input" id="ten" style="min-height:38px">${capOptions()}</select></label>
      ${S.transcript.length ? S.transcript.map((m) => `<p class="tline"><b>${esc(m.name)}</b> <span class="lchip sm" title="Detected language${m.conf != null ? ` · ${Math.round(m.conf * 100)}% sure` : ""}">${esc(langName(m.lang))}</span><br>${esc(capText(m) || m.text)}${capText(m) ? `<br><small class="km-muted">${esc(m.text)}</small>` : ""}</p>`).join("") : `<p class="km-muted">${S.room.captions ? "Waiting for someone to speak…" : isHost() ? "Turn on captions to start Notes.AI. Everyone will see a notice." : "Captions are off. The host can turn them on."}</p>`}
      ${isHost() ? `<button class="kb sm" id="notesdl">${ic("dl")} Download the evidence record</button><p class="km-muted" style="font-size:.8rem;margin:0">Time-stamped (UTC), with speaker, detected language and confidence, and a SHA-256 fingerprint logged by Kayak.</p>` : ""}</div>`;
    const b = $("#tb"); b.scrollTop = b.scrollHeight;
    $("#ten").onchange = (e) => setCapLang(e.target.value);
    $("#notesdl") && ($("#notesdl").onclick = downloadNotes);
  } else if (S.panel === "qa") renderQa(s, head);
  else if (S.panel === "rooms") renderRooms(s, head);
  $("#pclose").onclick = () => panel(S.panel);
}
const LANGS = { en: "English", hi: "Hindi", bn: "Bengali", mr: "Marathi", te: "Telugu", ta: "Tamil", gu: "Gujarati", ur: "Urdu", kn: "Kannada", ml: "Malayalam", pa: "Punjabi", or: "Odia", as: "Assamese", ne: "Nepali", sd: "Sindhi", si: "Sinhala", ar: "Arabic", fr: "French", de: "German", es: "Spanish", it: "Italian", pt: "Portuguese", nl: "Dutch", ru: "Russian", uk: "Ukrainian", pl: "Polish", tr: "Turkish", fa: "Persian", he: "Hebrew", el: "Greek", sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian", cs: "Czech", ro: "Romanian", hu: "Hungarian", ja: "Japanese", zh: "Chinese", ko: "Korean", id: "Indonesian", ms: "Malay", th: "Thai", vi: "Vietnamese", tl: "Filipino", sw: "Swahili", am: "Amharic", ha: "Hausa", yo: "Yoruba", zu: "Zulu" };
const capOptions = () => `<option value="" ${!S.capLang ? "selected" : ""}>As spoken (no translation)</option>` + Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${S.capLang === k ? "selected" : ""}>${v}</option>`).join("");
const langName = (l) => LANGS[l] || (l ? l.toUpperCase() : "translated");
const looksEnglish = (t) => /^[\x00-\x7F\u2018-\u201D\u2026\u20B9]*$/.test(t) && !/\b(hai|nahi|kya|aap|merci|bonjour|gracias|danke)\b/i.test(t);
function setCapLang(lang) {
  S.capLang = LANGS[lang] ? lang : "";
  try { localStorage.setItem("km:caplang", S.capLang); } catch {}
  for (const m of S.transcript) m.tr = null;
  for (const m of S.transcript.slice(-30)) translateCaption(m); // recent lines only, to stay within the translation rate limit
  drawCaptions(); renderPanel(); bar();
  toast(S.capLang ? `Captions and chat now show in ${LANGS[S.capLang]}, with what was said underneath.` : "Captions show exactly what was said.");
}
const linkify = (h) => h.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

// ---------------------------------------------------------------- captions: my own voice, transcribed on Kayak's servers
async function startCaptions() {
  const mic = rawMic();
  if (S.cap || !mic) return;
  try {
    const ac = new AudioContext();
    await ac.audioWorklet.addModule("/assets/capture-worklet.js");
    const node = new AudioWorkletNode(ac, "kayak-capture");
    ac.createMediaStreamSource(new MediaStream([mic])).connect(node); // your real voice, even with the voice changer on
    const cap = { ac, node, buf: [], voiced: 0, silent: 0, paused: !S.micOn, busy: 0 };
    node.port.onmessage = ({ data }) => {
      if (cap.paused) { cap.buf = []; cap.voiced = 0; return; }
      let s = 0; for (const v of data) s += v * v;
      const rms = Math.sqrt(s / data.length);
      const speaking = rms > 0.012;
      if (speaking) { cap.voiced++; cap.silent = 0; } else cap.silent++;
      if (cap.voiced || speaking) cap.buf.push(data);
      const secs = cap.buf.length * 0.1;
      if ((cap.voiced >= 4 && cap.silent >= 6) || secs >= 10) flushCaption(cap);
      else if (!cap.voiced && cap.buf.length > 5) cap.buf = [];
    };
    S.cap = cap;
  } catch (e) { console.warn("captions", e); toast("Captions couldn't start on this browser."); }
}
async function flushCaption(cap) {
  const chunks = cap.buf; cap.buf = []; cap.voiced = 0; cap.silent = 0;
  if (chunks.length < 6 || cap.busy > 2) return;
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const pcm = new Int16Array(n); let o = 0;
  for (const c of chunks) for (const v of c) pcm[o++] = Math.max(-1, Math.min(1, v)) * 0x7fff;
  const wav = new ArrayBuffer(44 + pcm.byteLength), d = new DataView(wav);
  const str = (p, s) => [...s].forEach((ch, i) => d.setUint8(p + i, ch.charCodeAt(0)));
  str(0, "RIFF"); d.setUint32(4, 36 + pcm.byteLength, true); str(8, "WAVE"); str(12, "fmt "); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 16000, true); d.setUint32(28, 32000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); str(36, "data"); d.setUint32(40, pcm.byteLength, true);
  new Int16Array(wav, 44).set(pcm);
  cap.busy++;
  try {
    const r = await api(`/api/transcribe/${room}${S.myLang ? `?hint=${S.myLang}` : ""}`, { method: "POST", body: new Blob([wav], { type: "audio/wav" }) });
    if (r.lang && (r.conf == null || r.conf >= 0.7)) S.myLang = r.lang;
    if (r.text) send({ t: "caption", text: r.text, en: r.en || null, lang: r.lang || null, conf: r.conf ?? null });
  }
  catch {} finally { cap.busy--; }
}
function stopCaptions() { if (!S.cap) return; try { S.cap.node.disconnect(); S.cap.ac.close(); } catch {} S.cap = null; }

// ---------------------------------------------------------------- recording (host): composed in the browser, stored in Kayak's R2
async function startRecording() {
  try {
    const r = await api(`/api/rec/${room}/start`, { method: "POST" });
    const W = 1280, H = 720;
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const g = canvas.getContext("2d");
    const ac = new AudioContext(); const dest = ac.createMediaStreamDestination();
    const added = new Set();
    const rec = { id: r.id, part: 1, size: 0, queue: [], buf: [], bufSize: 0, tiles: () => [], ac, dest,
      addStream(st) { const t = st?.getAudioTracks()[0]; if (!t || added.has(t.id)) return; added.add(t.id); try { ac.createMediaStreamSource(new MediaStream([t])).connect(dest); } catch {} } };
    rec.addStream(S.local); for (const st of S.screens) rec.addStream(st);
    for (const x of S.peers.values()) { rec.addStream(x.streams.cam); for (const st of Object.values(x.streams.screens)) rec.addStream(st); }
    const logo = new Image(); logo.src = "/_shared/logos/MeetByKayak_Logo_Reversed.svg";
    const draw = () => {
      g.fillStyle = "#06171E"; g.fillRect(0, 0, W, H);
      const ts = rec.tiles(); const spot = $("#grid")?.classList.contains("spot");
      const place = (t, x, y, w, h) => {
        const v = t.querySelector("video");
        if (v && v.style.visibility !== "hidden" && v.videoWidth) { const r2 = Math.min(w / v.videoWidth, h / v.videoHeight); const vw = v.videoWidth * r2, vh = v.videoHeight * r2; g.drawImage(v, x + (w - vw) / 2, y + (h - vh) / 2, vw, vh); }
        else { g.fillStyle = "#0F2E3B"; g.fillRect(x, y, w, h); g.fillStyle = "#17807E"; g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) / 6, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = `bold ${Math.round(Math.min(w, h) / 8)}px Archivo, Arial`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t.querySelector(".av span")?.textContent || "", x + w / 2, y + h / 2); }
        g.fillStyle = "#06171Ecc"; g.fillRect(x + 6, y + h - 28, Math.min(w - 12, 260), 22); g.fillStyle = "#fff"; g.font = "13px Archivo, Arial"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText((t.querySelector(".name b")?.textContent || "").slice(0, 36), x + 12, y + h - 17);
      };
      if (spot && ts.length) { place(ts[0], 0, 0, W, H - 150); ts.slice(1, 6).forEach((t, i) => place(t, 8 + i * 254, H - 142, 246, 138)); }
      else { const n = Math.max(1, ts.length), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), w = W / cols, h = H / rows; ts.forEach((t, i) => place(t, (i % cols) * w + 3, Math.floor(i / cols) * h + 3, w - 6, h - 6)); }
      if (S.captions.length) { const c = S.captions[S.captions.length - 1]; g.font = "22px Archivo, Arial"; const line = `${c.name}: ${capText(c) || c.text}`.slice(0, 110); const tw = g.measureText(line).width; g.fillStyle = "#000000cc"; g.fillRect((W - tw) / 2 - 12, H - 60, tw + 24, 36); g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(line, W / 2, H - 42); }
      if (logo.complete) g.drawImage(logo, W - 170, 12, 156, 42);
    };
    rec.timer = setInterval(draw, 1000 / 20);
    const stream = new MediaStream([...canvas.captureStream(20).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    rec.mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 96_000 });
    rec.mr.ondataavailable = (e) => { if (!e.data.size) return; rec.buf.push(e.data); rec.bufSize += e.data.size; if (rec.bufSize >= 6 * 1024 * 1024) flushRec(rec); };
    rec.mr.start(4000);
    S.rec = rec;
    render();
    send({ t: "room", recording: true });
  } catch (e) { toast(e.message || "Recording couldn't start.", "warn"); }
}
function flushRec(rec, last = false) {
  if (!rec.buf.length) return rec.chain || Promise.resolve();
  const blob = new Blob(rec.buf, { type: "video/webm" }); rec.buf = []; rec.bufSize = 0;
  const n = rec.part++;
  rec.chain = (rec.chain || Promise.resolve()).then(() => fetch(`/api/rec/${room}/${rec.id}/${n}`, { method: "PUT", headers: { "X-Meet-Token": token || "" }, body: blob }).then((r) => { if (!r.ok) throw new Error("upload"); }).catch(() => toast("Part of the recording failed to upload. Keep this tab open.", "warn")));
  return rec.chain;
}
async function stopRecording() {
  const rec = S.rec; if (!rec) return;
  S.rec = null; bar();
  send({ t: "room", recording: false });
  await new Promise((ok) => { rec.mr.onstop = ok; rec.mr.stop(); });
  clearInterval(rec.timer);
  await flushRec(rec, true);
  try { await api(`/api/rec/${room}/${rec.id}/finish`, { method: "POST" }); toast("Recording saved. Find it in Kayak Meet on the internal portal."); }
  catch (e) { toast(e.message, "warn"); }
  rec.ac.close();
}

// ---------------------------------------------------------------- connection quality
// Data received through Cloudflare's TURN relay and Realtime SFU, reported to the room every 20 seconds
// for Kayak's monthly usage limits. Running totals, so connections that close still count.
S.usage = { turn: 0, sfu: 0, last: new Map(), sent: 0 };
function countUsage(pc, st, kind) {
  const cand = new Map(); st.forEach((r) => { if (r.type === "local-candidate" || r.type === "remote-candidate") cand.set(r.id, r.candidateType); });
  st.forEach((r) => {
    if (r.type !== "candidate-pair" || !r.bytesReceived) return;
    const relayed = cand.get(r.localCandidateId) === "relay" || cand.get(r.remoteCandidateId) === "relay";
    if (kind === "turn" && !relayed) return;
    const key = kind + ":" + r.id, last = S.usage.last.get(key) || 0;
    if (r.bytesReceived > last) { S.usage[kind] += r.bytesReceived - last; S.usage.last.set(key, r.bytesReceived); }
  });
}
function turnStop() {
  // Stop using the relay: reconnect directly (STUN only). People behind strict firewalls may lose video.
  S.ice = [{ urls: ["stun:stun.cloudflare.com:3478"] }]; S.relay = false;
  for (const x of S.peers.values()) if (x.pc) { try { x.pc.setConfiguration({ iceServers: S.ice, bundlePolicy: "max-bundle" }); x.pc.restartIce(); } catch {} }
  toast("Kayak's monthly relay allowance has been used, so this call now connects directly. If someone drops out, their network is blocking direct calls.", "warn", 12000);
}
async function pollStats() {
  try { if (S.sfu?.pc) countUsage(S.sfu.pc, await S.sfu.pc.getStats(), "sfu"); } catch {}
  if (Date.now() - S.usage.sent > 20000) { S.usage.sent = Date.now(); send({ t: "usage", turn: Math.round(S.usage.turn), sfu: Math.round(S.usage.sfu) }); }
  for (const x of S.peers.values()) {
    if (!x.pc) continue;
    try {
      const st = await x.pc.getStats();
      if (S.relay) countUsage(x.pc, st, "turn");
      let rtt = null, lost = 0, recv = 0;
      st.forEach((r) => {
        if (r.type === "candidate-pair" && r.nominated && r.currentRoundTripTime != null) rtt = r.currentRoundTripTime * 1000;
        if (r.type === "inbound-rtp" && r.kind === "video") { lost += r.packetsLost || 0; recv += r.packetsReceived || 0; }
      });
      const loss = recv ? lost / (lost + recv) : 0;
      const q = (rtt != null && rtt > 400) || loss > 0.08 ? "poor" : (rtt != null && rtt > 200) || loss > 0.03 ? "fair" : "good";
      if (q !== x.quality) { x.quality = q; render(); }
      if (rtt != null) S.stats.rtt.push(rtt);
      S.stats.loss.push(loss);
    } catch {}
  }
  S.stats.rtt = S.stats.rtt.slice(-200); S.stats.loss = S.stats.loss.slice(-200);
}
function showStats() {
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  toast(`Connected to ${S.peers.size} ${S.peers.size === 1 ? "person" : "people"} directly${S.relay ? " (relay available for strict networks)" : ""}. Average delay ${Math.round(avg(S.stats.rtt))} ms, video loss ${(avg(S.stats.loss) * 100).toFixed(1)}%. All media is encrypted end to end.`, "", 9000);
}

// ---------------------------------------------------------------- leaving and feedback
async function leave() {
  S.leaving = true;
  await pollStats().catch(() => {}); send({ t: "usage", turn: Math.round(S.usage.turn), sfu: Math.round(S.usage.sfu) });
  if (S.rec) await stopRecording();
  S.ws?.close(1000);
  cleanup();
  endScreen("You left the meeting.");
}
function cleanup() {
  try { stopCamTracks(); } catch {}
  try { stopVoice(); } catch {}
  try { S.sfu?.pc.close(); } catch {}
  S.ended = S.ended || S.leaving; deskState();
  stopCaptions();
  for (const id of [...S.peers.keys()]) dropPeer(id);
  S.local?.getTracks().forEach((t) => t.stop());
  S.screens.forEach((st) => st.getTracks().forEach((t) => t.stop()));
  $(".menu")?.remove();
}

function endScreen(msg) {
  const fb = { overall: 0, audio: 0, video: 0, ease: 0, issues: [] };
  const stars = (k, label) => `<div class="field"><label>${label}</label><div class="stars" data-k="${k}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} of 5">★</button>`).join("")}</div></div>`;
  const ISSUES = ["Audio cut out", "Echo or noise", "Video froze", "Couldn't share screen", "Hard to join", "Captions were wrong", "Other"];
  app.innerHTML = `<div class="end"><div class="km-center" style="max-width:620px">
    <img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak" style="width:220px">
    <h1 style="font:800 1.6rem var(--display);margin:0">${esc(msg)}</h1>
    <form id="fb" class="pre-side" style="text-align:left;width:100%">
      <p class="km-muted">How was this meeting? Your answers help Meet by Kayak improve. Every change is reviewed by Kayak before it goes live.</p>
      ${stars("overall", "Overall")}${stars("audio", "Sound")}${stars("video", "Video")}${stars("ease", "Ease of use")}
      <div class="field"><label>Anything go wrong?</label><div class="chips">${ISSUES.map((i) => `<button type="button" class="chip" data-i="${esc(i)}">${esc(i)}</button>`).join("")}</div></div>
      <div class="field"><label for="fc">Tell us more (optional)</label><textarea class="input" id="fc" rows="3" maxlength="2000" style="padding:10px"></textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="kb primary">Send feedback</button><button class="kb" type="button" id="rejoin">Rejoin</button>${token ? "" : `<a class="kb" href="/app">Back to workspace</a>`}${isHost() ? `<button class="kb" type="button" id="mins">Write the minutes</button><button class="kb" type="button" id="notesdl2">Notes.AI record</button>` : ""}</div>
    </form><div id="minbox"></div></div></div>`;
  $$(".stars").forEach((s) => s.addEventListener("click", (e) => { const b = e.target.closest("[data-n]"); if (!b) return; fb[s.dataset.k] = +b.dataset.n; $$("button", s).forEach((x) => x.classList.toggle("on", +x.dataset.n <= fb[s.dataset.k])); }));
  $$(".chip").forEach((c) => (c.onclick = () => { c.classList.toggle("on"); fb.issues = $$(".chip.on").map((x) => x.dataset.i); }));
  $("#rejoin").onclick = () => location.reload();
  $("#notesdl2") && ($("#notesdl2").onclick = downloadNotes);
  $("#mins") && ($("#mins").onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = "Writing…";
    try { const r = await api(`/api/minutes/${room}`, { method: "POST" }); $("#minbox").innerHTML = r.summary ? `<h2 style="font:700 1.1rem var(--sans)">Minutes</h2><div class="minutes">${esc(r.summary)}</div><p class="km-small">Saved with the meeting in your workspace. Check before sharing.</p>` : `<p class="note">${esc(r.error)}</p>`; }
    catch (x) { $("#minbox").innerHTML = `<p class="note">${esc(x.message)}</p>`; }
    e.target.textContent = "Write the minutes"; e.target.disabled = false;
  });
  $("#fb").onsubmit = async (e) => {
    e.preventDefault();
    if (!fb.overall) return toast("Choose an overall rating first.");
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    try {
      await api(`/api/feedback/${room}`, { method: "POST", body: JSON.stringify({ ...fb, comment: $("#fc").value.trim(), name: S.name, stats: { rttMs: avg(S.stats.rtt), lossPct: S.stats.loss.length ? +(avg(S.stats.loss.map((x) => x * 1000)) / 10).toFixed(1) : null, minutes: S.joinedAt ? Math.round((Date.now() - S.joinedAt) / 60000) : 0, browser: navigator.userAgent.slice(0, 120) } }) });
      $("#fb").innerHTML = `<p class="km-muted" style="text-align:center">Thank you. Your feedback has been recorded.</p>`;
    } catch (x) { toast(x.message); }
  };
}

// ---------------------------------------------------------------- breakout rooms
// The host splits the meeting into rooms. People only connect to, see, hear and chat with their own
// room; the server enforces it too. Rooms can close on a timer, always with a 30-second warning.
const roomName = (key) => (key ? S.br?.rooms.find((r) => r.key === key)?.name || "a breakout room" : "the main room");
function movedRoom(before) {
  regroup();
  const now = S.me.br || null;
  if (now) toast(`You're now in ${roomName(now)}.`, "", 6000);
  else if (before) toast("You're back in the main room.", "", 6000);
}
function brNotify(was) {
  const b = S.br;
  if (b?.open && !was?.open && !isHost() && !S.me.br) toast(b.self ? "Breakout rooms are open. Choose a room from More → Choose a breakout room." : "Breakout rooms are open. The host will move you shortly.", "", 9000);
  if (b?.closingAt && !was?.closingAt) toast(`Breakout rooms close in ${Math.round((b.closingAt - Date.now()) / 1000)} seconds. Everyone returns to the main room.`, "warn", 12000);
  if (was?.open && !b?.open && isHost()) toast("Breakout rooms are closed. Everyone is back in the main room.");
}
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function drawBrBanner() {
  const stage = $(".stage"); if (!stage) return;
  let el = $("#brb");
  const b = S.br, mine = S.me?.br || null;
  if (!b?.open || (!mine && !b.closingAt && !isHost())) { el?.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "brb"; el.className = "br-banner"; stage.prepend(el); clearInterval(S.brTick); S.brTick = setInterval(drawBrBanner, 1000); }
  const until = b.closingAt || b.endsAt;
  el.innerHTML = `${ic("rooms")}<b>${esc(mine ? roomName(mine) : "Main room")}</b>${until ? `<span>${b.closingAt ? "Closing in" : "Ends in"} ${mmss(until - Date.now())}</span>` : ""}
    ${mine && !isHost() ? `<button class="kb sm" id="brhelp">Ask for help</button>` : ""}${mine && (isHost() || b.self) ? `<button class="kb sm" id="brback">Back to main room</button>` : ""}`;
  $("#brhelp") && ($("#brhelp").onclick = () => send({ t: "brHelp" }));
  $("#brback") && ($("#brback").onclick = () => send({ t: "brMove", key: null }));
}
function renderRooms(s, head) {
  const b = S.br, people = [...S.peers.values()].map((x) => x.info).filter((p) => p.role !== "host");
  if (!isHost()) {
    s.innerHTML = head("Breakout rooms") + `<div class="body">${b?.open && b.self ? b.rooms.map((r) => `<div class="room-c"><b>${esc(r.name)}</b><small>${[...S.peers.values()].filter((x) => x.info.br === r.key).length} people</small><button class="kb sm ${S.me.br === r.key ? "" : "primary"}" data-pick="${r.key}" ${S.me.br === r.key ? "disabled" : ""}>${S.me.br === r.key ? "You're here" : "Join"}</button></div>`).join("") + `<button class="kb sm" data-pick="">Main room</button>` : `<p class="km-muted">The host assigns breakout rooms.</p>`}</div>`;
    $$("[data-pick]", s).forEach((x) => (x.onclick = () => send({ t: "brMove", key: x.dataset.pick || null })));
    $("#pclose").onclick = () => panel(S.panel); return;
  }
  if (!b) {
    s.innerHTML = head("Breakout rooms") + `<div class="body"><p class="km-muted">Split the meeting into smaller rooms for workshops and discussions. People in a room only see, hear and chat with each other. You can visit any room and message all rooms at once.</p>
      <form id="brf" class="brf"><label>Rooms<input class="input" id="brn" type="number" min="1" max="20" value="${Math.max(2, Math.min(20, Math.ceil(people.length / 4) || 2))}"></label>
      <label>Assign<select class="input" id="bra"><option value="auto">Automatically (${people.length} people)</option><option value="manual">Manually</option><option value="self">Let people choose</option></select></label>
      <label>Close after<select class="input" id="brt"><option value="0">No time limit</option>${[5, 10, 15, 20, 30, 45, 60].map((m) => `<option value="${m}" ${m === 15 ? "selected" : ""}>${m} minutes</option>`).join("")}</select></label>
      <button class="kb primary">Create rooms</button></form></div>`;
    $("#brf").onsubmit = (e) => {
      e.preventDefault();
      const n = Math.max(1, Math.min(20, Number($("#brn").value) || 2)), mode = $("#bra").value;
      const rooms = Array.from({ length: n }, (_, i) => `Room ${i + 1}`), assign = {};
      if (mode === "auto") [...people].sort(() => Math.random() - 0.5).forEach((p, i) => (assign[p.id] = "b" + ((i % n) + 1)));
      S.brMinutes = Number($("#brt").value) || 0;
      send({ t: "brSet", rooms, assign, self: mode === "self" });
    };
  } else {
    const roomsHtml = b.rooms.map((r, i) => {
      const inRoom = people.filter((p) => (b.open ? p.br : b.assign[p.id]) === r.key);
      return `<div class="room-c"><input class="input sm" data-rn="${i}" value="${esc(r.name)}" aria-label="Room name" ${b.open ? "disabled" : ""}><small>${inRoom.length ? inRoom.map((p) => esc(p.name)).join(", ") : "Nobody yet"}</small>${b.open ? `<button class="kb sm" data-visit="${r.key}">${S.me.br === r.key ? "You're here" : "Join"}</button>` : ""}</div>`;
    }).join("");
    const unassigned = people.filter((p) => !(b.open ? p.br : b.assign[p.id]));
    s.innerHTML = head("Breakout rooms") + `<div class="body">
      ${b.open ? `<p class="km-muted" style="margin:0">${b.closingAt ? `Closing in ${mmss(b.closingAt - Date.now())}` : b.endsAt ? `Rooms close in ${mmss(b.endsAt - Date.now())}` : "Rooms are open."}</p>` : ""}
      ${roomsHtml}
      <div class="room-c"><b>Main room</b><small>${unassigned.length ? unassigned.map((p) => esc(p.name)).join(", ") : "Nobody else"}</small>${b.open && S.me.br ? `<button class="kb sm" data-visit="">Return</button>` : ""}</div>
      <h3 class="ph">Move people</h3>${people.map((p) => `<label class="mv"><span>${esc(p.name)}</span><select class="input sm" data-mv="${p.id}"><option value="">Main room</option>${b.rooms.map((r) => `<option value="${r.key}" ${(b.open ? p.br : b.assign[p.id]) === r.key ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`).join("") || `<p class="km-muted">No one else is here yet.</p>`}
      ${b.open ? `<form id="brmf" class="brf"><label>Message every room<input class="input" id="brm" maxlength="500" placeholder="e.g. 5 minutes left - please wrap up"></label><button class="kb sm">Send to all rooms</button></form>
        <div class="row2"><button class="kb sm primary" id="brclose" ${b.closingAt ? "disabled" : ""}>Close rooms (30-second warning)</button><button class="kb sm" id="brnow">Close now</button></div>`
      : `<label class="mv"><span>Close after</span><select class="input sm" id="brt2"><option value="0">No time limit</option>${[5, 10, 15, 20, 30, 45, 60].map((m) => `<option value="${m}" ${m === (S.brMinutes ?? 15) ? "selected" : ""}>${m} minutes</option>`).join("")}</select></label>
        <div class="row2"><button class="kb sm primary" id="bropen">Open rooms</button><button class="kb sm" id="brdel">Delete rooms</button></div>`}</div>`;
    const assign = () => { const a = { ...b.assign }; $$("[data-mv]", s).forEach((x) => { if (x.value) a[x.dataset.mv] = x.value; else delete a[x.dataset.mv]; }); return a; };
    const names = () => b.rooms.map((r, i) => $(`[data-rn="${i}"]`, s)?.value.trim() || r.name);
    $$("[data-rn]", s).forEach((x) => (x.onchange = () => send({ t: "brSet", rooms: names(), assign: assign(), self: b.self })));
    $$("[data-mv]", s).forEach((x) => (x.onchange = () => (b.open ? send({ t: "brMove", id: x.dataset.mv, key: x.value || null }) : send({ t: "brSet", rooms: names(), assign: assign(), self: b.self }))));
    $$("[data-visit]", s).forEach((x) => (x.onclick = () => send({ t: "brMove", key: x.dataset.visit || null })));
    $("#bropen") && ($("#bropen").onclick = () => { S.brMinutes = Number($("#brt2").value) || 0; send({ t: "brOpen", minutes: S.brMinutes }); });
    $("#brdel") && ($("#brdel").onclick = () => send({ t: "brSet", rooms: [] }));
    $("#brclose") && ($("#brclose").onclick = () => send({ t: "brClose" }));
    $("#brnow") && ($("#brnow").onclick = () => send({ t: "brClose", now: true }));
    $("#brmf") && ($("#brmf").onsubmit = (e) => { e.preventDefault(); const v = $("#brm").value.trim(); if (v) { send({ t: "brMsg", text: v }); $("#brm").value = ""; toast("Sent to every room."); } });
  }
  $("#pclose").onclick = () => panel(S.panel);
}

// ---------------------------------------------------------------- Q&A
// Anyone can ask (with their name, or anonymously), everyone can upvote, and the host answers live
// or in writing. In webinars and town halls it sits on the bar; in other meetings, under More.
const qaInBar = () => ["webinar", "townhall"].includes(S.room.kind || S.info?.kind) || S.qa.length > 0;
const qaOpen = () => S.qa.filter((q) => q.status === "open" || q.status === "live").length;
function qaNotify(before) {
  const old = new Set(before.map((q) => q.id));
  for (const q of S.qa) if (!old.has(q.id) && q.mine !== S.me.id && isHost()) toast(`New question${q.name ? ` from ${q.name}` : ""}: ${q.text.slice(0, 90)}`, "", 6000);
  const live = S.qa.find((q) => q.status === "live");
  const wasLive = before.find((q) => q.status === "live");
  if (live && live.id !== wasLive?.id && !isHost()) toast(`Now answering: ${live.text.slice(0, 100)}`, "", 8000);
  for (const q of S.qa) { const b = before.find((x) => x.id === q.id); if (q.mine === S.me.id && b && b.status !== q.status && q.status === "answered") toast("Your question was answered."); }
}
function drawLiveQ() {
  const stage = $(".stage"); if (!stage) return;
  const live = S.qa.find((q) => q.status === "live");
  let el = $("#liveq");
  if (!live) { el?.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "liveq"; el.className = "liveq"; stage.append(el); }
  el.innerHTML = `<small>${ic("qa")} Now answering${live.name ? ` · asked by ${esc(live.name)}` : ""}</small><b>${esc(live.text)}</b>`;
}
function renderQa(s, head) {
  const order = { live: 0, open: 1, answered: 2, dismissed: 3 };
  const list = [...S.qa].filter((q) => isHost() || q.status !== "dismissed").sort((a, b) => order[a.status] - order[b.status] || b.votes - a.votes || a.at - b.at);
  s.innerHTML = head(`Q&amp;A (${qaOpen()} open)`) + `<div class="body" id="qab">
    ${list.length ? list.map((q) => `<div class="q ${q.status}"><div class="qh"><b>${esc(q.name || "Anonymous")}</b><time>${new Date(q.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>${q.status !== "open" ? `<span class="qs">${q.status === "live" ? "Answering now" : q.status === "answered" ? "Answered" : "Dismissed"}</span>` : ""}</div>
      <p>${linkify(esc(q.text))}</p>${q.answer ? `<p class="qa-ans"><b>Answer</b> ${linkify(esc(q.answer))}</p>` : ""}
      <div class="qa-acts"><button class="kb sm ${q.voters.includes(S.me.id) ? "on" : ""}" data-up="${q.id}" ${q.mine === S.me.id ? "disabled" : ""} aria-label="Upvote">${ic("up")} ${q.votes}</button>
      ${isHost() ? `${q.status !== "live" ? `<button class="kb sm" data-qs="live" data-q="${q.id}">Answer live</button>` : ""}<button class="kb sm" data-qw="${q.id}">Type answer</button>${q.status !== "answered" ? `<button class="kb sm" data-qs="answered" data-q="${q.id}">Done</button>` : ""}${q.status !== "dismissed" ? `<button class="kb sm" data-qs="dismissed" data-q="${q.id}">Dismiss</button>` : `<button class="kb sm" data-qs="open" data-q="${q.id}">Reopen</button>`}` : q.mine === S.me.id && q.status === "open" ? `<button class="kb sm" data-qs="deleted" data-q="${q.id}">Delete</button>` : ""}</div></div>`).join("")
      : `<p class="km-muted">No questions yet. ${isHost() ? "Questions from attendees appear here; the most upvoted rise to the top." : "Ask the first one."}</p>`}</div>
    <form id="qaf" class="qaf"><textarea class="input" id="qai" maxlength="500" rows="2" placeholder="Ask a question" aria-label="Your question"></textarea><div><label class="tg"><input type="checkbox" id="qaanon"> Ask anonymously</label><button class="kb primary sm">Ask</button></div></form>`;
  $$("[data-up]", s).forEach((b) => (b.onclick = () => send({ t: "qaVote", id: b.dataset.up })));
  $$("[data-qs]", s).forEach((b) => (b.onclick = () => send({ t: "qaMark", id: b.dataset.q, status: b.dataset.qs })));
  $$("[data-qw]", s).forEach((b) => (b.onclick = () => {
    const q = S.qa.find((x) => x.id === b.dataset.qw); const box = b.closest(".q");
    if ($(".qa-wr", box)) return;
    const f = document.createElement("form"); f.className = "qa-wr"; f.innerHTML = `<textarea class="input" maxlength="1000" rows="2" placeholder="Write the answer everyone will see">${esc(q?.answer || "")}</textarea><button class="kb sm primary">Publish answer</button>`;
    box.append(f); $("textarea", f).focus();
    f.onsubmit = (e) => { e.preventDefault(); send({ t: "qaMark", id: q.id, status: "answered", answer: $("textarea", f).value }); };
  }));
  $("#qaf").onsubmit = (e) => { e.preventDefault(); const v = $("#qai").value.trim(); if (!v) return; send({ t: "qaAsk", text: v, anon: $("#qaanon").checked }); $("#qai").value = ""; toast($("#qaanon").checked ? "Question sent anonymously." : "Question sent."); };
  $("#pclose").onclick = () => panel(S.panel);
}

// ---------------------------------------------------------------- Notes.AI evidence record
async function downloadNotes() {
  try {
    const r = await fetch(`/api/notes/${room}`, { headers: { "X-Meet-Token": token || "" } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "The record couldn't be exported.");
    const blob = await r.blob(), url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `Notes.AI-${room}.txt` }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`Notes.AI record downloaded. SHA-256 ${String(r.headers.get("X-Content-SHA256") || "").slice(0, 16)}… is logged by Kayak.`, "", 9000);
  } catch (e) { toast(e.message, "warn"); }
}

// ---------------------------------------------------------------- voice changer
// Runs on your device, between your microphone and the call. Everyone sees a "Voice changed" badge
// next to your name, so no one is misled. Captions and Notes.AI always use your real voice.
const VOICES = { natural: ["Natural", 1, 0], deeper: ["Deeper", 0.8, 0], higher: ["Higher", 1.25, 0], robot: ["Robot", 1, 55], radio: ["Radio", 1, 0], anonymous: ["Anonymous", 0.86, 28] };
S.voice = (() => { try { const v = localStorage.getItem("km:voice"); return VOICES[v] ? v : "natural"; } catch { return "natural"; } })();
let VOICE = null;
const voiceOn = () => S.voice !== "natural" && !!VOICE;
const rawMic = () => VOICE?.raw || S.local?.getAudioTracks()[0];
function voiceMenu() {
  menu($("#bmore") || $("#bar"), Object.entries(VOICES).map(([k, [label]]) => [`${S.voice === k ? "✓ " : ""}${label}`, () => setVoice(k)]));
}
async function setVoice(k) {
  S.voice = k; try { localStorage.setItem("km:voice", k); } catch {}
  await applyVoice();
  send({ t: "state", vc: voiceOn() }); bar(); render();
  if (k !== "natural" && !voiceOn()) return;
  toast(k === "natural" ? "Voice changer off." : `Voice changer: ${VOICES[k][0]}. Others see a "Voice changed" badge next to your name.`);
}
function swapAudio(oldT, newT) {
  if (oldT) S.local.removeTrack(oldT);
  if (newT) { newT.enabled = S.micOn; S.local.addTrack(newT); }
  for (const pc of pcs()) for (const sd of pc.getSenders()) if (oldT && sd.track === oldT) sd.replaceTrack(newT);
}
async function applyVoice() {
  if (S.voice === "natural") return stopVoice();
  const raw = rawMic(); if (!raw) return toast("There's no microphone to change.");
  if (!VOICE) {
    try {
      const ac = new AudioContext();
      await ac.audioWorklet.addModule("/assets/voice-worklet.js");
      const node = new AudioWorkletNode(ac, "kayak-voice");
      const src = ac.createMediaStreamSource(new MediaStream([raw]));
      const band = ac.createBiquadFilter(); band.type = "allpass";
      const dst = ac.createMediaStreamDestination();
      src.connect(node).connect(band).connect(dst);
      raw.enabled = true;
      VOICE = { ac, node, band, raw, out: dst.stream.getAudioTracks()[0] };
      swapAudio(raw, VOICE.out);
    } catch (e) { console.warn(e); S.voice = "natural"; return toast("The voice changer isn't available in this browser.", "warn"); }
  }
  const [, ratio, ring] = VOICES[S.voice];
  VOICE.node.parameters.get("ratio").value = ratio;
  VOICE.node.parameters.get("ring").value = ring;
  if (S.voice === "radio") { VOICE.band.type = "bandpass"; VOICE.band.frequency.value = 1700; VOICE.band.Q.value = 0.9; } else VOICE.band.type = "allpass";
}
function stopVoice() {
  if (!VOICE) return;
  const v = VOICE; VOICE = null;
  swapAudio(v.out, v.raw);
  try { v.out.stop(); v.ac.close(); } catch {}
}

// ---------------------------------------------------------------- Kayak Avatar
// Appear as an illustrated Kayak Avatar instead of your camera picture. Your camera stays on your
// device: it is only used, locally, to follow your head, eyes and mouth (Google's open-source
// MediaPipe Face Mesh, served by Kayak). If face tracking can't load, the avatar follows your voice.
// Everyone sees an "Avatar" badge next to your name.
const AV0 = { on: false, skin: 2, hair: 0, hairColor: 0, outfit: 0, glasses: false };
S.avatar = (() => { try { return { ...AV0, ...JSON.parse(localStorage.getItem("km:avatar") || "{}"), on: false }; } catch { return { ...AV0 }; } })();
const AV_SKIN = ["#F6D7C3", "#EBC0A0", "#D9A27C", "#BC7F57", "#8D5A3B", "#5E3B27"];
const AV_HAIR = ["Short", "Long", "Bun", "Curly", "Close crop"];
const AV_HAIRC = ["#1E1A18", "#4B2E1E", "#8A5A33", "#C9A26B", "#9A9A9A"];
const AV_OUT = [["Navy", "#0E2F3C"], ["Teal", "#17807E"], ["Charcoal", "#33393D"], ["Saffron", "#C77D10"]];
const AVS = { mouth: 0, blink: 0, yaw: 0, pitch: 0, roll: 0, lvl: 0, t: 0, face: null };
function saveAvatar() { try { const { on, ...rest } = S.avatar; localStorage.setItem("km:avatar", JSON.stringify(rest)); } catch {} }
async function loadFace() {
  if (S.face) return S.face;
  if (S.faceLoading) return S.faceLoading;
  S.faceLoading = (async () => {
    await loadScript("/face/face_mesh.js");
    const fm = new window.FaceMesh({ locateFile: (f) => `/face/${f}` });
    fm.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    fm.onResults((r) => { AVS.face = r.multiFaceLandmarks?.[0] || null; });
    await fm.initialize();
    S.face = fm; return fm;
  })();
  try { return await S.faceLoading; } catch (e) { S.faceLoading = null; throw e; }
}
function trackAvatar(video) {
  // voice level, for the mouth when there is no face tracking (and to liven it up when there is)
  if (!AVS.an && rawMic()) { try { const ac = new AudioContext(); const a = ac.createAnalyser(); a.fftSize = 512; ac.createMediaStreamSource(new MediaStream([rawMic()])).connect(a); AVS.an = { ac, a, d: new Uint8Array(512) }; } catch {} }
  if (AVS.an) { AVS.an.a.getByteTimeDomainData(AVS.an.d); let s = 0; for (const v of AVS.an.d) s += ((v - 128) / 128) ** 2; AVS.lvl = AVS.lvl * 0.5 + Math.sqrt(s / AVS.an.d.length) * 0.5; }
  const f = AVS.face, k = 0.45, mix = (a, b) => a + (b - a) * k;
  AVS.t += 1 / 24;
  if (f) {
    const d = (a, b) => Math.hypot(f[a].x - f[b].x, f[a].y - f[b].y);
    const faceH = d(10, 152) || 1;
    AVS.mouth = mix(AVS.mouth, Math.max(0, Math.min(1, (d(13, 14) / faceH - 0.01) * 7)));
    const eye = (d(159, 145) + d(386, 374)) / 2 / faceH;
    AVS.blink = mix(AVS.blink, eye < 0.022 ? 1 : 0);
    AVS.yaw = mix(AVS.yaw, ((f[1].x - (f[234].x + f[454].x) / 2) / (Math.abs(f[454].x - f[234].x) || 1)) * -2);
    AVS.pitch = mix(AVS.pitch, ((f[1].y - (f[33].y + f[263].y) / 2) / faceH - 0.18) * 3);
    AVS.roll = mix(AVS.roll, Math.atan2(f[263].y - f[33].y, f[263].x - f[33].x));
  } else {
    AVS.mouth = mix(AVS.mouth, S.micOn ? Math.min(1, AVS.lvl * 9) : 0);
    AVS.blink = (AVS.t % 4.2) < 0.13 ? 1 : 0;
    AVS.yaw = Math.sin(AVS.t * 0.6) * 0.12; AVS.pitch = Math.sin(AVS.t * 0.45) * 0.05; AVS.roll = Math.sin(AVS.t * 0.5) * 0.04;
  }
  if (video && S.face && !AVS.busy && video.readyState >= 2) { AVS.busy = true; S.face.send({ image: video }).catch(() => {}).finally(() => (AVS.busy = false)); }
}
function drawAvatar(ctx, W, H, a = S.avatar, st = AVS) {
  const bgKey = S.studio.bg;
  if (bgKey.startsWith("kayak-") && bgImg) { const r = Math.max(W / bgImg.width, H / bgImg.height); ctx.filter = "blur(2px)"; ctx.drawImage(bgImg, (W - bgImg.width * r) / 2, (H - bgImg.height * r) / 2, bgImg.width * r, bgImg.height * r); ctx.filter = "none"; }
  else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#14707A"); g.addColorStop(1, "#0B2833"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 0.08; ctx.fillStyle = "#fff"; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(W * (0.1 + i * 0.17), H * 0.2 + (i % 2) * H * 0.5, H * 0.18, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
  const s = H / 720, cx = W / 2 + st.yaw * 60 * s, cy = H * 0.47 + st.pitch * 50 * s;
  const skin = AV_SKIN[a.skin] || AV_SKIN[2], hairC = AV_HAIRC[a.hairColor] || AV_HAIRC[0], out = (AV_OUT[a.outfit] || AV_OUT[0])[1];
  // body
  ctx.fillStyle = out; ctx.beginPath(); ctx.moveTo(W / 2 - 300 * s, H); ctx.bezierCurveTo(W / 2 - 290 * s, H * 0.78, W / 2 - 170 * s, H * 0.73, W / 2, H * 0.73); ctx.bezierCurveTo(W / 2 + 170 * s, H * 0.73, W / 2 + 290 * s, H * 0.78, W / 2 + 300 * s, H); ctx.fill();
  ctx.fillStyle = "#F4F7F8"; ctx.beginPath(); ctx.moveTo(W / 2 - 60 * s, H * 0.73); ctx.lineTo(W / 2, H * 0.86); ctx.lineTo(W / 2 + 60 * s, H * 0.73); ctx.fill();
  ctx.fillStyle = "#EE9B1E"; ctx.beginPath(); ctx.arc(W / 2 - 150 * s, H * 0.84, 9 * s, 0, 7); ctx.fill(); // Kayak pin
  ctx.fillStyle = skin; ctx.fillRect(W / 2 - 38 * s, H * 0.6, 76 * s, H * 0.14);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(st.roll);
  const hw = 112 * s, hh = 142 * s;
  // hair behind
  ctx.fillStyle = hairC;
  if (a.hair === 1) { ctx.beginPath(); ctx.ellipse(0, 10 * s, hw * 1.18, hh * 1.25, 0, Math.PI, 0); ctx.lineTo(hw * 1.18, 150 * s); ctx.quadraticCurveTo(0, 175 * s, -hw * 1.18, 150 * s); ctx.fill(); }
  if (a.hair === 2) { ctx.beginPath(); ctx.arc(0, -hh - 18 * s, 48 * s, 0, 7); ctx.fill(); }
  // ears + head
  ctx.fillStyle = skin; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * hw * 0.98, 6 * s, 20 * s, 30 * s, 0, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(0, 0, hw, hh, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#00000014"; ctx.beginPath(); ctx.ellipse(0, hh * 0.55, hw * 0.75, hh * 0.35, 0, 0, Math.PI); ctx.fill();
  // hair on top
  ctx.fillStyle = hairC;
  if (a.hair === 0 || a.hair === 1 || a.hair === 2) { ctx.beginPath(); ctx.ellipse(0, -hh * 0.55, hw * 1.04, hh * 0.58, 0, Math.PI, 0); ctx.quadraticCurveTo(hw * 0.4, -hh * 0.5, -hw * 0.2, -hh * 0.62); ctx.quadraticCurveTo(-hw * 0.7, -hh * 0.45, -hw * 1.04, -hh * 0.4); ctx.fill(); }
  if (a.hair === 3) for (let i = 0; i < 14; i++) { const ang = Math.PI + (i / 13) * Math.PI; ctx.beginPath(); ctx.arc(Math.cos(ang) * hw * 0.92, -hh * 0.35 + Math.sin(ang) * hh * 0.72, 30 * s, 0, 7); ctx.fill(); }
  if (a.hair === 4) { ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(0, -hh * 0.5, hw * 1.0, hh * 0.56, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1; }
  // eyes
  const ey = -14 * s, ex = 42 * s, open = 1 - Math.min(1, st.blink);
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(sx * ex + st.yaw * 6 * s, ey, 19 * s, Math.max(1.5, 13 * s * open), 0, 0, 7); ctx.fill();
    if (open > 0.25) { ctx.fillStyle = "#123B47"; ctx.beginPath(); ctx.arc(sx * ex + st.yaw * 10 * s, ey + 1 * s, 8.5 * s, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx * ex + st.yaw * 10 * s + 3 * s, ey - 2 * s, 2.4 * s, 0, 7); ctx.fill(); }
    ctx.strokeStyle = hairC; ctx.lineWidth = 7 * s; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(sx * ex - 20 * s, ey - 30 * s - st.mouth * 6 * s); ctx.quadraticCurveTo(sx * ex, ey - 38 * s - st.mouth * 8 * s, sx * ex + 20 * s, ey - 30 * s - st.mouth * 6 * s); ctx.stroke();
  }
  if (a.glasses) { ctx.strokeStyle = "#1B1B1B"; ctx.lineWidth = 5 * s; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.roundRect(sx * ex - 30 * s, ey - 22 * s, 60 * s, 44 * s, 12 * s); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-12 * s, ey - 4 * s); ctx.lineTo(12 * s, ey - 4 * s); ctx.stroke(); }
  // nose
  ctx.strokeStyle = "#00000030"; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(st.yaw * 8 * s, 8 * s); ctx.quadraticCurveTo(12 * s + st.yaw * 8 * s, 40 * s, st.yaw * 8 * s - 4 * s, 44 * s); ctx.stroke();
  // mouth
  const m = Math.min(1, st.mouth), my = 78 * s;
  ctx.fillStyle = "#6E2C2C"; ctx.beginPath(); ctx.ellipse(st.yaw * 6 * s, my, 30 * s + m * 4 * s, 4 * s + m * 24 * s, 0, 0, Math.PI * 2); ctx.fill();
  if (m < 0.15) { ctx.strokeStyle = "#7A3434"; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(-30 * s + st.yaw * 6 * s, my - 2 * s); ctx.quadraticCurveTo(st.yaw * 6 * s, my + 16 * s, 30 * s + st.yaw * 6 * s, my - 2 * s); ctx.stroke(); }
  else { ctx.fillStyle = "#fff"; ctx.fillRect(-18 * s + st.yaw * 6 * s, my - 4 * s - m * 18 * s, 36 * s, 8 * s); }
  ctx.fillStyle = "#E88A7A33"; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 70 * s, 42 * s, 20 * s, 12 * s, 0, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = "#ffffffb3"; ctx.font = `600 ${Math.round(18 * s)}px Archivo, Arial`; ctx.textAlign = "right"; ctx.fillText("Kayak Avatar", W - 20 * s, H - 20 * s);
}
function openAvatar() {
  const d = document.createElement("dialog"); d.className = "studio";
  const a = S.avatar;
  const sw = (key, list, label) => `<div class="st-group"><h3>${label}</h3><div class="sws">${list.map((c, i) => `<button type="button" data-${key}="${i}" class="${a[key] === i ? "on" : ""}" style="background:${Array.isArray(c) ? c[1] : c}" title="${Array.isArray(c) ? c[0] : ""}" aria-label="${label} ${i + 1}"></button>`).join("")}</div></div>`;
  d.innerHTML = `<div class="st-wrap"><div class="st-prev"><canvas id="avc" width="1280" height="720"></canvas><span class="st-tag">${ic("lock")} Your camera stays on this device</span></div>
    <div class="st-side"><header><h2>Kayak Avatar</h2><button class="kb sm" id="avx" aria-label="Close">${ic("x")}</button></header>
    <p class="km-muted st-note">Appear as your Kayak Avatar instead of your camera picture. It follows your head, eyes and mouth; your camera video never leaves this device. Everyone sees an "Avatar" badge by your name.</p>
    <label class="tg big"><input type="checkbox" id="avon" ${a.on ? "checked" : ""}> Use my Kayak Avatar in this meeting</label>
    ${sw("skin", AV_SKIN, "Skin tone")}
    <div class="st-group"><h3>Hair</h3><div class="chips">${AV_HAIR.map((h, i) => `<button type="button" class="chip ${a.hair === i ? "on" : ""}" data-hair="${i}">${h}</button>`).join("")}</div></div>
    ${sw("hairColor", AV_HAIRC, "Hair colour")}${sw("outfit", AV_OUT, "Outfit")}
    <label class="tg"><input type="checkbox" id="avgl" ${a.glasses ? "checked" : ""}> Glasses</label>
    <div class="st-foot"><button class="kb primary" id="avdone">Done</button></div></div></div>`;
  document.body.append(d); d.showModal();
  const cv = $("#avc", d), cx = cv.getContext("2d");
  let run = true; const tick = () => { if (!run) return; if (!PROC) trackAvatar(null); drawAvatar(cx, cv.width, cv.height); requestAnimationFrame(tick); }; tick();
  const close = () => { run = false; d.close(); d.remove(); };
  $("#avx", d).onclick = close; $("#avdone", d).onclick = close; d.addEventListener("cancel", close);
  const pick = (key) => $$(`[data-${key.toLowerCase()}]`, d).forEach((b) => (b.onclick = () => { a[key] = Number(b.getAttribute(`data-${key.toLowerCase()}`)); $$(`[data-${key.toLowerCase()}]`, d).forEach((x) => x.classList.toggle("on", x === b)); saveAvatar(); }));
  ["skin", "hair", "hairColor", "outfit"].forEach(pick);
  $("#avgl", d).onchange = (e) => { a.glasses = e.target.checked; saveAvatar(); };
  $("#avon", d).onchange = (e) => setAvatar(e.target.checked);
}
async function setAvatar(on) {
  if (on && !canStudio) return toast("Kayak Avatar needs Chrome, Edge or Firefox, or the desktop app.", "warn");
  if (on && !S.camOn) await setCam(true);
  if (on && !S.local.getVideoTracks().length) { $("#avon") && ($("#avon").checked = false); return toast("Kayak Avatar needs a camera to follow your expressions.", "warn"); }
  S.avatar.on = on;
  await applyStudio();
  if (on) loadFace().catch(() => toast("Face tracking isn't available on this device, so your avatar follows your voice instead.", "", 7000));
  send({ t: "state", av: on }); bar(); render();
  toast(on ? "You now appear as your Kayak Avatar. Others see an \"Avatar\" badge." : "Your camera picture is back.");
}

// ---------------------------------------------------------------- town halls: Cloudflare Realtime
// Instead of a direct connection to every person, each browser sends its audio and video once to
// Cloudflare's network and receives everyone else's from there, so a town hall can hold hundreds.
// To keep it smooth, you receive the voice of people with their mic on, and video from up to 24 people.
const SFU_VIDEO = 24;
const sfuApi = (path, body = {}) => api(`/api/sfu/${room}/${path}`, { method: "POST", body: JSON.stringify({ session: S.sfu.session, ticket: S.sfu.ticket, ...body }) });
function sfuQ(fn) { S.sfu.q = S.sfu.q.then(fn).catch((e) => console.warn("town hall", e)); return S.sfu.q; }
async function sfuStart() {
  if (S.sfu) return;
  S.sfu = { q: Promise.resolve(), mids: new Map(), pending: new Map(), pub: new Map(), camSender: null, aSender: null, n: 0 };
  const pc = new RTCPeerConnection({ iceServers: S.ice, bundlePolicy: "max-bundle" });
  S.sfu.pc = pc;
  pc.ontrack = (e) => { const mid = e.transceiver?.mid; const m = S.sfu.mids.get(mid); if (m) sfuAttach(m, e.track); else S.sfu.pending.set(mid, e.track); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") toast("The town hall connection dropped. Rejoin to reconnect.", "warn", 0); };
  await sfuQ(async () => { const r = await api(`/api/sfu/${room}/session`, { method: "POST", body: "{}" }); S.sfu.session = r.session; S.sfu.ticket = r.ticket; });
  if (!S.sfu.session) return toast("Couldn't connect to the town hall. Rejoin to try again.", "warn", 0);
  sfuPublish();
  for (const x of S.peers.values()) sfuSubscribe(x);
}
function sfuAnnounce() {
  const name = (t) => S.sfu.pub.get(t?.id)?.name;
  const a = [...S.sfu.pub.values()].find((p) => p.kind === "a")?.name, v = [...S.sfu.pub.values()].find((p) => p.kind === "v")?.name;
  send({ t: "state", sfu: { s: S.sfu.session, a, v, sc: S.screens.map((st) => name(st.getVideoTracks()[0])).filter(Boolean) } });
}
function sfuPublish() {
  if (!S.sfu) return;
  return sfuQ(async () => {
    if (!S.sfu.session) return;
    const pc = S.sfu.pc, want = [];
    const a = S.local.getAudioTracks()[0]; if (a && !S.sfu.aSender) want.push([a, "a"]);
    const v = S.local.getVideoTracks()[0]; if (v && !S.sfu.camSender) want.push([v, "v"]);
    for (const st of S.screens) { const t = st.getVideoTracks()[0]; if (t && !S.sfu.pub.has(t.id)) want.push([t, "s"]); }
    if (!want.length) return;
    const trs = want.map(([t]) => pc.addTransceiver(t, { direction: "sendonly" }));
    await pc.setLocalDescription(await pc.createOffer());
    const names = want.map(([, k]) => `${S.me.id}-${k}${++S.sfu.n}`);
    const r = await sfuApi("tracks", { sessionDescription: pc.localDescription, tracks: trs.map((tr, i) => ({ location: "local", mid: tr.mid, trackName: names[i] })) });
    await pc.setRemoteDescription(r.sessionDescription);
    trs.forEach((tr, i) => { const [t, k] = want[i]; S.sfu.pub.set(t.id, { mid: tr.mid, name: names[i], tr, kind: k }); if (k === "a") S.sfu.aSender = tr.sender; if (k === "v") S.sfu.camSender = tr.sender; });
    tuneBitrate();
    sfuAnnounce();
  });
}
function sfuUnpublish(tracks) {
  if (!S.sfu) return;
  const mids = []; for (const t of tracks) { const p = S.sfu.pub.get(t.id); if (p) { mids.push(p.mid); try { p.tr.stop(); } catch {} S.sfu.pub.delete(t.id); } }
  if (mids.length) sfuCloseMids(mids, true);
}
function sfuCloseMids(mids, announce = false) {
  return sfuQ(async () => {
    const pc = S.sfu.pc;
    for (const tr of pc.getTransceivers()) if (mids.includes(tr.mid) && tr.currentDirection !== "stopped") try { tr.stop(); } catch {}
    await pc.setLocalDescription(await pc.createOffer());
    const r = await sfuApi("close", { mids, sessionDescription: pc.localDescription });
    if (r.sessionDescription) await pc.setRemoteDescription(r.sessionDescription);
    for (const m of mids) S.sfu.mids.delete(m);
    if (announce) sfuAnnounce();
  });
}
function sfuClose(mids) { if (S.sfu && mids.length) sfuCloseMids(mids); }
function sfuSubscribe(x) {
  if (!S.sfu) return;
  sfuQ(async () => {
    if (!S.sfu.session || !S.peers.has(x.info.id)) return;
    const f = x.info.sfu || {};
    const videos = [...S.peers.values()].reduce((n, y) => n + (y !== x && y.info.sfu?.v && y.pulled.has(y.info.sfu.v) ? 1 : 0), 0);
    const want = [(x.info.mic || x.pulled.has(f.a)) && f.a, x.info.cam && f.v && (videos < SFU_VIDEO || x.info.role === "host" || x.pulled.has(f.v)) ? f.v : null, ...(f.sc || [])].filter(Boolean);
    const gone = [...x.pulled.keys()].filter((n) => !want.includes(n) || x.sess !== f.s);
    if (gone.length) {
      const mids = gone.map((n) => x.pulled.get(n));
      const ids = new Set(mids.map((m) => S.sfu.mids.get(m)?.trackId).filter(Boolean));
      if (x.streams.cam) for (const t of x.streams.cam.getTracks()) if (ids.has(t.id)) x.streams.cam.removeTrack(t);
      for (const n of gone) { x.pulled.delete(n); delete x.streams.screens[n]; }
      await sfuCloseMidsNow(mids);
    }
    x.sess = f.s;
    const add = want.filter((n) => !x.pulled.has(n));
    if (!add.length || !f.s) return;
    const r = await sfuApi("tracks", { tracks: add.map((n) => ({ location: "remote", sessionId: f.s, trackName: n })) });
    (r.tracks || []).forEach((t, i) => { const n = t.trackName || add[i]; if (t.mid && !t.errorCode) { x.pulled.set(n, t.mid); S.sfu.mids.set(t.mid, { id: x.info.id, name: n, kind: n === f.a ? "a" : n === f.v ? "v" : "s" }); } });
    if (r.requiresImmediateRenegotiation && r.sessionDescription) {
      const pc = S.sfu.pc;
      await pc.setRemoteDescription(r.sessionDescription);
      await pc.setLocalDescription(await pc.createAnswer());
      await sfuApi("renegotiate", { sessionDescription: pc.localDescription });
    }
    for (const [mid, track] of S.sfu.pending) { const m = S.sfu.mids.get(mid); if (m) { sfuAttach(m, track); S.sfu.pending.delete(mid); } }
  });
}
async function sfuCloseMidsNow(mids) {
  const pc = S.sfu.pc;
  for (const tr of pc.getTransceivers()) if (mids.includes(tr.mid)) try { tr.stop(); } catch {}
  await pc.setLocalDescription(await pc.createOffer());
  const r = await sfuApi("close", { mids, sessionDescription: pc.localDescription });
  if (r.sessionDescription) await pc.setRemoteDescription(r.sessionDescription);
  for (const m of mids) S.sfu.mids.delete(m);
}
function sfuAttach(m, track) {
  const x = S.peers.get(m.id); if (!x) return;
  m.trackId = track.id;
  if (m.kind === "s") { x.streams.screens[m.name] = new MediaStream([track]); }
  else {
    if (!x.streams.cam) x.streams.cam = new MediaStream();
    for (const t of x.streams.cam.getTracks()) if (t.kind === track.kind && t !== track) x.streams.cam.removeTrack(t);
    if (!x.streams.cam.getTracks().includes(track)) x.streams.cam.addTrack(track);
    if (track.kind === "audio") playAudio(x.info.id, x.streams.cam);
  }
  track.onunmute = track.onmute = () => render();
  render();
}
