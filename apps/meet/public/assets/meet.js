// Kayak Meet client. Browser-to-browser audio and video over WebRTC (end-to-end encrypted with
// DTLS-SRTP), Kayak's own signalling over a WebSocket, live captions, recording and feedback.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const app = $("#app");

// ---------------------------------------------------------------- icons
const P = {
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
  peers: new Map(), // id -> { info, pc, polite, makingOffer, ignoreOffer, streams:{cam,screen}, screenId, tile, screenTile, quality }
  room: {}, panel: null, unread: 0, lobby: [], chat: [], captions: [], transcript: [],
  layout: "auto", rec: null, cap: null, ended: false, leaving: false, stats: { rtt: [], loss: [] }, joinedAt: 0, retries: 0,
  english: (() => { try { return localStorage.getItem("km:en") !== "0"; } catch { return true; } })(),
  devices: { mic: localStorage.getItem("km:mic") || "", cam: localStorage.getItem("km:cam") || "" },
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
  DESK?.meeting({ inMeeting: !!S.me && !S.ended && !S.leaving, muted: !S.micOn, camera: S.camOn, sharing: !!S.screen, hand: S.hand, title: S.info?.title || "" });
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
  const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  const opt = (kind, cur) => devs.filter((d) => d.kind === kind).map((d, i) => `<option value="${esc(d.deviceId)}"${d.deviceId === cur ? " selected" : ""}>${esc(d.label || `${kind === "audioinput" ? "Microphone" : "Camera"} ${i + 1}`)}</option>`).join("");
  const isClient = S.info.kind === "client";
  app.innerHTML = `
  <div class="top"><img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak"><span class="title"></span><span class="pill e2e">${ic("lock")} End-to-end encrypted</span></div>
  <div class="pre">
    <div class="pre-video"><video id="pv" autoplay playsinline muted></video><div class="off" id="poff" hidden>Camera is off</div><div class="meter" aria-hidden="true"><i id="pm"></i></div>
      <div class="pre-bar"><button class="kc" id="pmic" aria-pressed="true" aria-label="Microphone">${ic("mic")}</button><button class="kc" id="pcam" aria-pressed="true" aria-label="Camera">${ic("cam")}</button></div></div>
    <div class="pre-side">
      <span class="pill" style="justify-self:start">${isClient ? "Client meeting" : S.info.kind === "webinar" ? "Webinar" : "Kayak meeting"}${S.info.startsAt ? " · " + new Date(S.info.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : ""}</span>
      <h1>${esc(S.info.title)}</h1>
      <p class="km-muted">Hosted by ${esc(S.info.host)}</p>
      ${S.info.name ? `<p>Joining as <b>${esc(S.info.name)}</b></p>` : `<div class="field"><label for="nm">Your name</label><input class="input" id="nm" maxlength="60" autocomplete="name" value="${esc(S.name)}" placeholder="As you'd like others to see it"></div>`}
      <div class="devs"><div class="field"><label for="dmic">Microphone</label><select class="input" id="dmic">${opt("audioinput", S.devices.mic)}</select></div><div class="field"><label for="dcam">Camera</label><select class="input" id="dcam">${opt("videoinput", S.devices.cam)}</select></div></div>
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
    S.local.getTracks().forEach((t) => t.stop());
    S.local = await getMedia(); v.srcObject = S.local; meter(S.local, $("#pm")); sync();
  };
  $("#dmic").onchange = swap; $("#dcam").onchange = swap;
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
    if (S.ended || S.leaving || [4000, 4001, 4003, 4004].includes(e.code)) return;
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
      S.me = m.you; S.room = m.room || {}; S.joinedAt ||= Date.now();
      if (!$(".stage")) roomUi();
      send({ t: "state", mic: S.micOn, cam: S.camOn, hand: false, screen: false });
      for (const p of m.peers) addPeer(p);
      refreshRoom(); render(); return;
    case "join": addPeer(m.peer); render(); chime(); return;
    case "leave": dropPeer(m.id); render(); return;
    case "peer": { const x = S.peers.get(m.peer.id); if (x) { const wasHand = x.info.hand; x.info = m.peer; if (m.peer.hand && !wasHand) toast(`${m.peer.name} raised a hand ✋`); } render(); renderPanel(); return; }
    case "signal": return onSignal(m.from, m.data);
    case "chat": S.chat.push(m); if (S.english && m.from !== S.me?.id && !looksEnglish(m.text)) api(`/api/translate/${room}`, { method: "POST", body: JSON.stringify({ text: m.text }) }).then((r) => { m.en = r.en; renderPanel(); }).catch(() => {}); if (S.panel !== "chat" && m.from !== S.me?.id) { S.unread++; toast(`${m.name}: ${m.text.slice(0, 80)}`, "", 4000); } renderPanel(); badge(); return;
    case "react": return floatReact(m.e);
    case "caption": S.captions.push(m); S.transcript.push(m); S.captions = S.captions.slice(-3); drawCaptions(); if (S.panel === "transcript") renderPanel(); setTimeout(() => { S.captions = S.captions.filter((x) => x !== m); drawCaptions(); }, 7000); return;
    case "lobby": { const n = m.list.length > S.lobby.length; S.lobby = m.list; if (n) { chime(); toast(`${m.list[m.list.length - 1].name} is waiting to join.`, "warn", 8000); } renderPanel(); badge(); return; }
    case "room": { const before = S.room; S.room = m.room; refreshRoom(before, m.by); return; }
    case "muteRequest": if (S.micOn) { setMic(false); toast(`${m.by} muted you. Unmute when you're ready to speak.`); } return;
    case "removed": S.ended = true; cleanup(); return fatal("The host removed you from this meeting.", "");
    case "denied": S.ended = true; cleanup(); return fatal("The host didn't admit you to this meeting.", "If you think this is a mistake, contact the host.");
    case "full": S.ended = true; cleanup(); return fatal("This meeting is full.", `Meet by Kayak rooms hold up to ${m.limit} people with video. Ask the host to run it as a webinar for larger audiences.`);
    case "ended": S.ended = true; cleanup(); return endScreen(`The meeting was ended by ${m.by}.`);
  }
}

function waitingRoom(m) {
  S.me = m.you;
  app.innerHTML = `<div class="km-center"><img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak" class="km-logo-big"><h1 style="font:800 1.5rem var(--display);margin:0">${esc(m.title)}</h1>
    <p class="km-muted">${m.hostHere ? "The host knows you're here and will let you in shortly." : "The meeting hasn't started yet. You'll join as soon as the host lets you in."}</p><span class="pill"><i class="spinner"></i> Waiting to join</span><button class="kb" id="wl">Leave</button></div>`;
  $("#wl").onclick = () => { S.leaving = true; S.ws?.close(); cleanup(); fatal("You left the waiting room.", ""); };
}

// ---------------------------------------------------------------- peers (perfect negotiation)
function addPeer(info) {
  if (S.peers.has(info.id) || info.id === S.me.id) return;
  const pc = new RTCPeerConnection({ iceServers: S.ice, bundlePolicy: "max-bundle" });
  const x = { info, pc, polite: S.me.id > info.id, makingOffer: false, ignoreOffer: false, streams: {}, screenId: null, quality: "good" };
  S.peers.set(info.id, x);
  for (const t of S.local.getTracks()) pc.addTrack(t, S.local);
  if (S.screen) for (const t of S.screen.getTracks()) pc.addTrack(t, S.screen);
  pc.onnegotiationneeded = async () => {
    try { x.makingOffer = true; await pc.setLocalDescription(); send({ t: "signal", to: info.id, data: { sdp: pc.localDescription, screenId: S.screen?.id || null } }); }
    catch (e) { console.warn(e); } finally { x.makingOffer = false; }
  };
  pc.onicecandidate = ({ candidate }) => candidate && send({ t: "signal", to: info.id, data: { candidate } });
  pc.ontrack = ({ track, streams }) => {
    const st = streams[0] || new MediaStream([track]);
    if (x.screenId && st.id === x.screenId) x.streams.screen = st; else if (!x.streams.cam || x.streams.cam.id === st.id) x.streams.cam = st; else x.streams.screen = st;
    track.onended = track.onmute = () => render();
    track.onunmute = () => render();
    render();
    if (S.rec) S.rec.addStream(st);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") pc.restartIce();
    render();
  };
  tuneBitrate();
}

async function onSignal(from, data) {
  const x = S.peers.get(from);
  if (!x) return;
  const pc = x.pc;
  try {
    if (data.screenId !== undefined) x.screenId = data.screenId;
    if (data.sdp) {
      const collision = data.sdp.type === "offer" && (x.makingOffer || pc.signalingState !== "stable");
      x.ignoreOffer = !x.polite && collision;
      if (x.ignoreOffer) return;
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === "offer") { await pc.setLocalDescription(); send({ t: "signal", to: from, data: { sdp: pc.localDescription, screenId: S.screen?.id || null } }); }
      // A stream may have arrived before we knew it was a screen share.
      if (x.screenId && x.streams.cam?.id === x.screenId) { x.streams.screen = x.streams.cam; x.streams.cam = null; }
      if (!x.screenId && x.streams.screen) { x.streams.screen = null; }
      render();
    } else if (data.candidate) {
      try { await pc.addIceCandidate(data.candidate); } catch (e) { if (!x.ignoreOffer) console.warn(e); }
    }
  } catch (e) { console.warn("signal", e); }
}

function dropPeer(id) {
  const x = S.peers.get(id);
  if (!x) return;
  x.pc.close();
  S.peers.delete(id);
  tuneBitrate();
}

// Fewer people, more quality: share the uplink across everyone we send to.
function tuneBitrate() {
  const n = Math.max(1, S.peers.size);
  const kbps = n <= 1 ? 1800 : n <= 3 ? 900 : n <= 6 ? 500 : 300;
  const scale = n <= 1 ? 1 : n <= 3 ? 1.5 : n <= 6 ? 2 : 3;
  for (const { pc } of S.peers.values()) for (const s of pc.getSenders()) {
    if (s.track?.kind !== "video") continue;
    const isScreen = S.screen && s.track && S.screen.getTracks().includes(s.track);
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
  let t = S.local.getVideoTracks()[0];
  if (!on && t) { t.stop(); S.local.removeTrack(t); for (const { pc } of S.peers.values()) for (const s of pc.getSenders()) if (s.track === t) s.replaceTrack(null); }
  if (on) {
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 }, ...(S.devices.cam ? { deviceId: { exact: S.devices.cam } } : {}) } });
      t = v.getVideoTracks()[0]; S.local.addTrack(t);
      for (const { pc } of S.peers.values()) {
        const s = pc.getSenders().find((x) => (x.track === null || x.track?.kind === "video") && !(S.screen && S.screen.getTracks().includes(x.track)) && x.__cam !== false);
        if (s) await s.replaceTrack(t); else pc.addTrack(t, S.local);
      }
      tuneBitrate();
    } catch { S.camOn = false; toast("The camera couldn't start. Check that no other app is using it."); }
  }
  send({ t: "state", cam: S.camOn });
  bar(); render();
}
async function toggleScreen() {
  if (S.screen) return stopScreen();
  try { S.screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: true }); }
  catch { return; }
  const vt = S.screen.getVideoTracks()[0];
  if ("contentHint" in vt) vt.contentHint = "detail";
  vt.onended = stopScreen;
  for (const [id, { pc }] of S.peers) { send({ t: "signal", to: id, data: { screenId: S.screen.id } }); for (const t of S.screen.getTracks()) pc.addTrack(t, S.screen); }
  send({ t: "state", screen: true });
  tuneBitrate(); bar(); render();
}
function stopScreen() {
  if (!S.screen) return;
  const tracks = S.screen.getTracks();
  tracks.forEach((t) => t.stop());
  for (const [id, { pc }] of S.peers) { for (const s of pc.getSenders()) if (tracks.includes(s.track)) pc.removeTrack(s); send({ t: "signal", to: id, data: { screenId: null } }); }
  S.screen = null;
  send({ t: "state", screen: false });
  bar(); render();
}
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
    <button class="kc ${S.screen ? "on" : ""} hide-sm" id="bscr" data-tip="${S.screen ? "Stop sharing" : "Share screen"}" aria-label="Share screen">${ic("screen")}</button>
    <button class="kc ${S.hand ? "on" : ""}" id="bhand" data-tip="${S.hand ? "Lower hand" : "Raise hand"}" aria-label="Raise hand">${ic("hand")}</button>
    <button class="kc" id="breact" data-tip="React" aria-label="React">${ic("smile")}</button>
    <span class="sep"></span>
    <button class="kc ${S.room.captions ? "on" : ""}" id="bcc" data-tip="${isHost() ? (S.room.captions ? "Turn captions off" : "Turn captions on") : "Transcript"}" aria-label="Captions">${ic("cc")}</button>
    ${isHost() ? `<button class="kc ${S.rec ? "off" : ""} hide-sm" id="brec" data-tip="${S.rec ? "Stop recording" : "Record"}" aria-label="Record">${ic("rec")}</button>` : ""}
    <button class="kc" id="bchat" data-tip="Chat" aria-label="Chat">${ic("chat")}${S.unread ? `<span class="badge">${S.unread}</span>` : ""}</button>
    <button class="kc" id="bppl" data-tip="People" aria-label="People">${ic("people")}${isHost() && S.lobby.length ? `<span class="badge">${S.lobby.length}</span>` : `<span class="badge" style="background:#ffffff30;color:#fff">${S.peers.size + 1}</span>`}</button>
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
  $("#bppl").onclick = () => panel("people");
  $("#bmore").onclick = (e) => menu(e.currentTarget, [
    [`${ic("layout")} ${S.layout === "speaker" ? "Grid view" : "Speaker view"}`, () => { S.layout = S.layout === "speaker" ? "auto" : "speaker"; render(); }],
    [`${ic("cc")} Transcript`, () => panel("transcript")],
    [`${ic("globe")} ${S.english ? "Turn off live translation" : "Translate to English live"}`, () => setEnglish(!S.english)],
    [`${ic("screen")} ${S.screen ? "Stop sharing" : "Share screen"}`, toggleScreen],
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
  if (S.room.captions && !before.captions) { toast(`Captions are on. Speech is transcribed on Kayak's own servers and kept as the meeting transcript.${S.english ? " Anything not in English is translated to English live." : ""}`, "", 8000); startCaptions(); }
  if (!S.room.captions && before.captions) { toast("Captions are off."); stopCaptions(); }
  if (S.room.locked !== before.locked && by) toast(S.room.locked ? `${by} locked the meeting. New guests wait to be admitted.` : `${by} unlocked the meeting.`);
  bar();
}

// ---------------------------------------------------------------- tiles and layout
function tileFor(key, { name, stream, me, screen, mic, cam, hand, quality }) {
  let t = document.querySelector(`.tile[data-k="${key}"]`);
  if (!t) {
    t = document.createElement("div");
    t.className = "tile" + (me ? " me" : "") + (screen ? " screen" : "");
    t.dataset.k = key;
    t.innerHTML = `<video autoplay playsinline ${me ? "muted" : ""}></video><div class="av"><span></span></div><div class="name"><b></b></div><div class="flags"></div>`;
  }
  const v = t.querySelector("video");
  if (stream && v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); }
  const hasVideo = screen || (cam && stream?.getVideoTracks().some((x) => x.readyState === "live" && !x.muted));
  v.style.visibility = hasVideo ? "visible" : "hidden";
  t.querySelector(".av").hidden = !!hasVideo;
  t.querySelector(".av span").textContent = initials(name);
  t.querySelector(".name b").textContent = screen ? `${name} is presenting` : name + (me ? " (you)" : "");
  t.querySelector(".name").innerHTML = `${!screen && !mic ? ic("micOff") : ""}<b>${esc(screen ? `${name} is presenting` : name + (me ? " (you)" : ""))}</b>${quality && quality !== "good" ? `<span class="q ${quality}" title="Connection is ${quality}"><i></i><i></i><i></i></span>` : ""}`;
  t.querySelector(".flags").innerHTML = !screen && hand ? `<span class="hand" aria-label="Hand raised">✋</span>` : "";
  return t;
}

function render() {
  const g = $("#grid"); if (!g) return;
  const tiles = [];
  const screens = [];
  if (S.screen) screens.push(tileFor("me:screen", { name: S.name, stream: S.screen, me: true, screen: true }));
  for (const [id, x] of S.peers) if (x.streams.screen && x.info.screen) screens.push(tileFor(id + ":screen", { name: x.info.name, stream: x.streams.screen, screen: true }));
  tiles.push(tileFor("me", { name: S.name, stream: S.local, me: true, mic: S.micOn, cam: S.camOn, hand: S.hand }));
  for (const [id, x] of S.peers) tiles.push(tileFor(id, { name: x.info.name, stream: x.streams.cam, mic: x.info.mic, cam: x.info.cam, hand: x.info.hand, quality: x.quality }));
  const keep = new Set([...tiles, ...screens]);
  $$(".tile").forEach((t) => !keep.has(t) && t.remove());
  const spot = screens[0] || (S.layout === "speaker" && S.peers.size ? tiles.find((t) => t.dataset.k === S.loudest) || tiles[1] : null);
  g.classList.toggle("spot", !!spot);
  if (spot) {
    let strip = $("#strip");
    if (!strip) { strip = document.createElement("div"); strip.className = "strip"; strip.id = "strip"; }
    g.replaceChildren(spot, strip);
    strip.replaceChildren(...[...screens, ...tiles].filter((t) => t !== spot));
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
    for (const [id, x] of S.peers) attach(id, x.streams.cam);
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
function drawCaptions() {
  const c = $("#caps"); if (!c) return;
  c.innerHTML = S.captions.map((m) => S.english && m.en ? `<p><b>${esc(m.name)}</b>${esc(m.en)}<br><small style="opacity:.7">${esc(m.text)} · ${esc(langName(m.lang))}</small></p>` : `<p><b>${esc(m.name)}</b>${esc(m.text)}</p>`).join("");
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
    const ppl = [{ id: S.me.id, name: S.name + " (you)", role: S.me.role, mic: S.micOn, hand: S.hand, me: true }, ...[...S.peers.values()].map((x) => x.info)];
    s.innerHTML = head(`People (${ppl.length})`) + `<div class="body">
      ${isHost() && S.lobby.length ? `<div class="lobbybox"><b>Waiting to join (${S.lobby.length})</b>${S.lobby.map((l) => `<div class="person"><div class="who"><b>${esc(l.name)}</b>${l.email ? `<small>${esc(l.email)}</small>` : ""}</div><div class="acts"><button class="kb sm primary" data-admit="${l.id}">Admit</button><button class="kb sm" data-deny="${l.id}">Deny</button></div></div>`).join("")}${S.lobby.length > 1 ? `<button class="kb sm" id="admitall">Admit everyone</button>` : ""}</div>` : ""}
      ${ppl.map((p) => `<div class="person"><span class="av" style="width:34px;height:34px;border-radius:50%;background:#17807E;display:grid;place-items:center;font-weight:700;flex:none">${esc(initials(p.name))}</span><div class="who"><b>${esc(p.name)}</b><small>${p.role === "host" ? "Host" : p.role === "guest" ? "Guest" : "Kayak"}${p.hand ? " · ✋" : ""}</small></div>
        <span aria-label="${p.mic ? "Microphone on" : "Muted"}">${ic(p.mic ? "mic" : "micOff")}</span>
        ${isHost() && !p.me ? `<div class="acts"><button class="kb sm" data-pm="${p.id}" aria-label="More for ${esc(p.name)}">${ic("more")}</button></div>` : ""}</div>`).join("")}
      <button class="kb sm" id="invite">${ic("copy")} Copy meeting address</button></div>`;
    $$("[data-admit]", s).forEach((b) => (b.onclick = () => send({ t: "admit", id: b.dataset.admit })));
    $$("[data-deny]", s).forEach((b) => (b.onclick = () => send({ t: "deny", id: b.dataset.deny })));
    $("#admitall") && ($("#admitall").onclick = () => send({ t: "admitAll" }));
    $$("[data-pm]", s).forEach((b) => (b.onclick = () => { const p = S.peers.get(b.dataset.pm)?.info; menu(b, [["Ask to unmute / mute", () => send({ t: "mute", id: p.id })], ...(p.role === "member" ? [["Make co-host", () => send({ t: "host", id: p.id })]] : []), ["Remove from meeting", () => send({ t: "remove", id: p.id })]]); }));
    $("#invite").onclick = () => { navigator.clipboard.writeText(location.origin + location.pathname).then(() => toast("Meeting address copied. Invited people still need their own invitation link from the Kayak portal.")).catch(() => toast(location.origin + location.pathname)); };
  } else if (S.panel === "transcript") {
    s.innerHTML = head("Transcript") + `<div class="body" id="tb"><label class="row" style="display:flex;gap:8px;align-items:center;font-size:.9rem"><input type="checkbox" id="ten" ${S.english ? "checked" : ""}> Translate to English live</label>${S.transcript.length ? S.transcript.map((m) => `<p class="tline"><b>${esc(m.name)}</b> ${esc(S.english && m.en ? m.en : m.text)}${S.english && m.en ? `<br><small class="km-muted">${esc(m.text)} · ${esc(langName(m.lang))}</small>` : ""}</p>`).join("") : `<p class="km-muted">${S.room.captions ? "Waiting for someone to speak…" : isHost() ? "Turn on captions to transcribe the meeting. Everyone will see a notice." : "Captions are off. The host can turn them on."}</p>`}</div>`;
    const b = $("#tb"); b.scrollTop = b.scrollHeight;
    $("#ten").onchange = (e) => setEnglish(e.target.checked);
  }
  $("#pclose").onclick = () => panel(S.panel);
}
const LANGS = { hi: "Hindi", mr: "Marathi", gu: "Gujarati", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam", bn: "Bengali", pa: "Punjabi", ur: "Urdu", ar: "Arabic", fr: "French", de: "German", es: "Spanish", it: "Italian", pt: "Portuguese", ja: "Japanese", zh: "Chinese", ko: "Korean", ru: "Russian", tr: "Turkish", fa: "Persian", id: "Indonesian", ms: "Malay", th: "Thai", vi: "Vietnamese", nl: "Dutch", sw: "Swahili" };
const langName = (l) => LANGS[l] || (l ? l.toUpperCase() : "translated");
const looksEnglish = (t) => /^[\x00-\x7F\u2018-\u201D\u2026\u20B9]*$/.test(t) && !/\b(hai|nahi|kya|aap|merci|bonjour|gracias|danke)\b/i.test(t);
function setEnglish(on) { S.english = on; try { localStorage.setItem("km:en", on ? "1" : "0"); } catch {} drawCaptions(); renderPanel(); toast(on ? "Live translation to English is on. Captions and transcript show English, with the original underneath." : "Live translation is off. Captions show what was said."); }
const linkify = (h) => h.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

// ---------------------------------------------------------------- captions: my own voice, transcribed on Kayak's servers
async function startCaptions() {
  if (S.cap || !S.local.getAudioTracks()[0]) return;
  try {
    const ac = new AudioContext();
    await ac.audioWorklet.addModule("/assets/capture-worklet.js");
    const node = new AudioWorkletNode(ac, "kayak-capture");
    ac.createMediaStreamSource(new MediaStream([S.local.getAudioTracks()[0]])).connect(node);
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
  try { const r = await api(`/api/transcribe/${room}`, { method: "POST", body: new Blob([wav], { type: "audio/wav" }) }); if (r.text) send({ t: "caption", text: r.text, en: r.en || null, lang: r.lang || null }); }
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
    rec.addStream(S.local); if (S.screen) rec.addStream(S.screen);
    for (const x of S.peers.values()) { rec.addStream(x.streams.cam); rec.addStream(x.streams.screen); }
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
      if (S.captions.length) { const c = S.captions[S.captions.length - 1]; g.font = "22px Archivo, Arial"; const line = `${c.name}: ${(S.english && c.en) || c.text}`.slice(0, 110); const tw = g.measureText(line).width; g.fillStyle = "#000000cc"; g.fillRect((W - tw) / 2 - 12, H - 60, tw + 24, 36); g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(line, W / 2, H - 42); }
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
async function pollStats() {
  for (const x of S.peers.values()) {
    try {
      const st = await x.pc.getStats();
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
  if (S.rec) await stopRecording();
  S.ws?.close(1000);
  cleanup();
  endScreen("You left the meeting.");
}
function cleanup() {
  S.ended = S.ended || S.leaving; deskState();
  stopCaptions();
  for (const id of [...S.peers.keys()]) dropPeer(id);
  S.local?.getTracks().forEach((t) => t.stop());
  S.screen?.getTracks().forEach((t) => t.stop());
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
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="kb primary">Send feedback</button><button class="kb" type="button" id="rejoin">Rejoin</button>${token ? "" : `<a class="kb" href="/app">Back to workspace</a>`}${isHost() ? `<button class="kb" type="button" id="mins">Write the minutes</button>` : ""}</div>
    </form><div id="minbox"></div></div></div>`;
  $$(".stars").forEach((s) => s.addEventListener("click", (e) => { const b = e.target.closest("[data-n]"); if (!b) return; fb[s.dataset.k] = +b.dataset.n; $$("button", s).forEach((x) => x.classList.toggle("on", +x.dataset.n <= fb[s.dataset.k])); }));
  $$(".chip").forEach((c) => (c.onclick = () => { c.classList.toggle("on"); fb.issues = $$(".chip.on").map((x) => x.dataset.i); }));
  $("#rejoin").onclick = () => location.reload();
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
