// Meet Studio: a private room to try lighting, colour, backgrounds, blur, touch-up, framing, overlays,
// video quality and sound on your own camera, then save the look for every meeting and call.
// Designed and developed by Kayak Strategic Advisors. Everything stays on this device.
import { STUDIO_DEFAULT, LOOKS, loadStudio, saveStudio, isActive, needsMask, drawFrame, constraints } from "./studio-engine.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const P = {
  back: '<path d="M15 18l-6-6 6-6"/>', cam: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  snap: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', rec: '<circle cx="12" cy="12" r="7"/>',
  split: '<path d="M12 3v18M4 5h16v14H4z"/>', reset: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>', save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8M8 21v-7h8v7"/>',
  grid: '<path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>', check: '<path d="M20 6L9 17l-5-5"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const ic = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
const BACKGROUNDS = [["boardroom", "Boardroom"], ["meeting-room", "Meeting room"], ["open-office", "Open office"], ["lounge", "Lounge"], ["teal-studio", "Teal studio"], ["window-desk", "Window desk"], ["deep-current", "Deep Current"], ["open-water", "Open Water"], ["sea-mist", "Sea Mist"]];
const ls = (k, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
function toast(t, ms = 3000) { let b = $(".toasts"); if (!b) { b = document.createElement("div"); b.className = "toasts"; b.setAttribute("role", "status"); document.body.append(b); } const e = document.createElement("div"); e.className = "toast"; e.textContent = t; b.append(e); setTimeout(() => e.remove(), ms); }

const T = loadStudio();
const ST = { stream: null, raw: null, video: null, canvas: null, ctx: null, seg: null, mask: null, busy: false, bgImg: null, bgKey: "", split: false, grid: false, mirror: ls("km:mirror", "1") !== "0", me: null, tab: "look", dirty: false, rec: null };
const app = $("#studio");

async function boot() {
  try { const r = await fetch("/api/ws/boot", { credentials: "same-origin" }); if (r.status === 401) { location.href = "/login?next=/studio"; return; } const j = await r.json(); ST.me = j.me; } catch {}
  if (!T.tagName && ST.me) T.tagName = ST.me.name;
  shell();
  await startCam();
  loop();
}

function shell() {
  app.innerHTML = `
  <header class="sx-top"><a class="sx-back" href="/app" aria-label="Back to Meet">${ic("back")}</a><img src="/_shared/logos/MeetByKayak_Logo_Reversed.svg" alt="Meet by Kayak" height="26"><span class="sx-title">Studio</span>
    <span class="sx-sp"></span><span class="sx-badge">${ic("check")} Private · only you see this preview</span><button class="sx-btn primary" id="saveLook">${ic("save")} Save look</button></header>
  <main class="sx-main">
    <section class="sx-stage" aria-label="Camera preview">
      <div class="sx-frame" id="frame"><canvas id="out" aria-label="Your camera with the studio look"></canvas><canvas id="before" class="sx-before" hidden aria-hidden="true"></canvas>
        <div class="sx-grid" id="gridOv" hidden aria-hidden="true"></div><div class="sx-split-l" id="splitL" hidden>Before</div><div class="sx-split-r" id="splitR" hidden>After</div>
        <div class="sx-cam-off" id="camOff" hidden><p>Your camera is off or blocked.</p><button class="sx-btn" id="retryCam">Turn on camera</button></div>
        <div class="sx-tip" id="tip" hidden></div></div>
      <div class="sx-bar" role="toolbar" aria-label="Studio tools">
        <button class="sx-tool" id="tSplit" aria-pressed="false">${ic("split")}<span>Before / after</span></button>
        <button class="sx-tool" id="tGrid" aria-pressed="false">${ic("grid")}<span>Framing guide</span></button>
        <button class="sx-tool" id="tMirror" aria-pressed="${ST.mirror}">${ic("user")}<span>Mirror preview</span></button>
        <button class="sx-tool" id="tSnap">${ic("snap")}<span>Snapshot</span></button>
        <button class="sx-tool" id="tRec">${ic("rec")}<span>Test recording</span></button>
        <button class="sx-tool" id="tCheck">${ic("sun")}<span>Lighting check</span></button>
        <button class="sx-tool" id="tReset">${ic("reset")}<span>Reset</span></button>
      </div>
      <div class="sx-presets" id="presets"></div>
    </section>
    <aside class="sx-panel"><nav class="sx-tabs" role="tablist">${[["look", "Look"], ["light", "Light"], ["colour", "Colour"], ["bg", "Background"], ["frame", "Framing"], ["privacy", "Privacy"], ["overlay", "Overlays"], ["quality", "Quality"], ["sound", "Sound"]].map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${ST.tab === k}">${l}</button>`).join("")}</nav>
      <div class="sx-ctl" id="ctl"></div></aside>
  </main>`;
  $$("[data-tab]").forEach((b) => (b.onclick = () => { ST.tab = b.dataset.tab; $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b)); panel(); }));
  $("#saveLook").onclick = saveLook;
  $("#tSplit").onclick = (e) => { ST.split = !ST.split; e.currentTarget.setAttribute("aria-pressed", ST.split); $("#before").hidden = !ST.split; $("#splitL").hidden = $("#splitR").hidden = !ST.split; };
  $("#tGrid").onclick = (e) => { ST.grid = !ST.grid; e.currentTarget.setAttribute("aria-pressed", ST.grid); $("#gridOv").hidden = !ST.grid; };
  $("#tMirror").onclick = (e) => { ST.mirror = !ST.mirror; lset("km:mirror", ST.mirror ? "1" : "0"); e.currentTarget.setAttribute("aria-pressed", ST.mirror); applyMirror(); };
  $("#tSnap").onclick = snapshot; $("#tRec").onclick = testRecording; $("#tCheck").onclick = lightingCheck;
  $("#tReset").onclick = () => { Object.assign(T, STUDIO_DEFAULT, { tagName: ST.me?.name || "" }); changed(true); panel(); toast("Back to your camera as it is."); };
  $("#retryCam").onclick = startCam;
  panel(); presets(); applyMirror();
  addEventListener("beforeunload", (e) => { if (ST.dirty) { e.preventDefault(); e.returnValue = ""; } });
}
// Mirror the preview like a mirror, except when overlays are on, so their text reads the right way round.
function applyMirror() { const m = ST.mirror && !T.flip && !T.tag && !T.brand; $("#out").style.transform = $("#before").style.transform = m ? "scaleX(-1)" : ""; const b = $("#tMirror"); if (b) b.title = T.tag || T.brand ? "Preview isn't mirrored while overlays are on, so you can read them" : ""; }

// ---------------------------------------------------------------- controls
const slider = (k, label, min, max, step = 1, hint = "") => `<label class="sx-sl"><span><b>${label}</b><output id="o-${k}">${fmt(k, T[k])}</output></span><input type="range" data-s="${k}" min="${min}" max="${max}" step="${step}" value="${T[k]}" aria-label="${label}">${hint ? `<small>${hint}</small>` : ""}</label>`;
const tog = (k, label, hint = "", val = T[k], attr = "data-t") => `<label class="sx-tg"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ""}</span><input type="checkbox" role="switch" ${attr}="${k}" ${val ? "checked" : ""}></label>`;
const fmt = (k, v) => (k === "zoom" ? `${Number(v).toFixed(2)}×` : k === "blurAmt" ? `${v}px` : v > 0 && k !== "key" && k !== "vig" && k !== "soft" ? `+${v}` : String(v));
function panel() {
  const c = $("#ctl");
  const P2 = {
    look: () => `<h2>Looks</h2><p class="sx-help">Start from a look, then fine-tune it in Light and Colour.</p><div class="sx-looks">${LOOKS.map(([k, l]) => `<button data-look="${k}" class="${T.look === k ? "on" : ""}"><span class="sx-swatch lk-${k}"></span>${l}</button>`).join("")}</div>
      <h3>Touch-up</h3>${slider("soft", "Soft focus", 0, 100, 1, "Smooths skin and softens the picture. A little goes a long way.")}`,
    light: () => `<h2>Light</h2>${slider("bright", "Brightness", -40, 40)}${slider("exposure", "Exposure", -30, 30)}${slider("contrast", "Contrast", -40, 40)}${slider("key", "Key light", 0, 100, 1, "A soft light on your face, like a ring light.")}${slider("vig", "Vignette", 0, 100, 1, "Darkens the corners to draw attention to you.")}
      ${tog("light", "Low-light boost", "For dim rooms and evenings.")}`,
    colour: () => `<h2>Colour</h2>${slider("sat", "Colour", -50, 50)}${slider("warm", "Warmth", -50, 50, 1, "Warmer for fluorescent office light, cooler for orange lamps.")}${slider("tint", "Tint", -30, 30, 1, "Green to magenta.")}`,
    bg: () => `<h2>Background</h2><div class="sx-bgs">
      <button data-bg="none" class="${T.bg === "none" ? "on" : ""}"><span class="sx-bgn">None</span></button>
      <button data-bg="blur" class="${T.bg === "blur" ? "on" : ""}"><span class="sx-bgn blur">Blur</span></button>
      <button data-bg="color" class="${T.bg === "color" ? "on" : ""}"><span class="sx-bgn" style="background:${esc(T.bgColor)}">Colour</span></button>
      <button data-bg="custom" class="${T.bg === "custom" ? "on" : ""}" ${ls("km:studio-bg") ? "" : "disabled"}>${ls("km:studio-bg") ? `<img src="${ls("km:studio-bg")}" alt="">` : `<span class="sx-bgn">Yours</span>`}<i>My picture</i></button>
      ${BACKGROUNDS.map(([k, l]) => `<button data-bg="kayak-${k}" class="${T.bg === "kayak-" + k ? "on" : ""}"><img src="/assets/bg/kayak-${k}-thumb.jpg" alt="" loading="lazy"><i>${l}</i></button>`).join("")}</div>
      ${T.bg === "blur" ? slider("blurAmt", "Blur strength", 4, 40) : ""}
      ${T.bg === "color" ? `<label class="sx-sl"><span><b>Background colour</b></span><input type="color" id="bgColor" value="${esc(T.bgColor)}" aria-label="Background colour"></label>` : ""}
      <div class="sx-row"><button class="sx-btn" id="bgUp">${ic("upload")} Use my own picture</button>${ls("km:studio-bg") ? `<button class="sx-btn ghost" id="bgDel">${ic("trash")} Remove my picture</button>` : ""}</div>
      <p class="sx-help">Your own picture stays on this device. Backgrounds use on-device person detection; nothing is uploaded.</p>`,
    frame: () => `<h2>Framing</h2>${slider("zoom", "Zoom", 1, 2.2, 0.05)}${slider("panx", "Left / right", -100, 100)}${slider("pany", "Up / down", -100, 100)}
      ${tog("flip", "Flip my video for others", "Turns your picture around for everyone, for example if your camera is upside-down-mounted or text behind you reads backwards.")}
      <p class="sx-help">Use the framing guide to put your eyes about a third of the way down the picture.</p>`,
    privacy: () => `<h2>Privacy</h2>${tog("faceBlur", "Blur my face", "Blurs you beyond recognition while keeping your movement visible, for sensitive calls and witness interviews. Until person detection is ready, the whole picture is blurred.")}
      ${tog("_bgPriv", "Hide my room", "Shortcut: blurs the background strongly.", T.bg === "blur" && T.blurAmt >= 24, "data-x")}
      <p class="sx-help">Meet never records or analyses your face. Studio effects are applied on this device before your video leaves it.</p>`,
    overlay: () => `<h2>Overlays</h2>${tog("tag", "Name tag", "A lower-third with your name and title, like on TV.")}
      ${T.tag ? `<label class="sx-in"><span>Name</span><input data-v="tagName" maxlength="60" value="${esc(T.tagName)}"></label><label class="sx-in"><span>Title</span><input data-v="tagTitle" maxlength="80" value="${esc(T.tagTitle)}" placeholder="e.g. Partner, Kayak Strategic Advisors"></label>` : ""}
      ${tog("brand", "Meet by Kayak logo", "A small logo in the corner of your video.")}`,
    quality: () => `<h2>Video quality</h2>
      <label class="sx-sel"><span><b>Resolution</b><small>Higher looks sharper but uses more data. Meet lowers it automatically when the connection is weak.</small></span><select data-q="km:res">${[["360", "360p - saves data"], ["540", "540p"], ["720", "720p HD"], ["1080", "1080p Full HD"]].map(([v, l]) => `<option value="${v}" ${ls("km:res", "720") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="sx-sel"><span><b>Frame rate</b><small>30 fps is smoother for movement and demos.</small></span><select data-q="km:fps">${[["15", "15 fps"], ["24", "24 fps - film-like"], ["30", "30 fps - smooth"]].map(([v, l]) => `<option value="${v}" ${ls("km:fps", "24") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${tog("km:hd", "Send HD video when the connection allows", "", ls("km:hd", "1") !== "0", "data-ls")}
      <label class="sx-sel"><span><b>Camera</b></span><select id="camSel"></select></label>
      <p class="sx-help" id="camInfo"></p>`,
    sound: () => `<h2>Sound</h2>
      <label class="sx-sel"><span><b>Microphone</b></span><select id="micSel"></select></label>
      <div class="sx-meter" aria-label="Microphone level"><i id="lvl"></i></div>
      ${tog("km:ns", "Noise suppression", "Reduces keyboard, fan and street noise.", ls("km:ns", "1") !== "0", "data-ls")}${tog("km:ec", "Echo cancellation", "", ls("km:ec", "1") !== "0", "data-ls")}${tog("km:ag", "Automatic volume", "", ls("km:ag", "1") !== "0", "data-ls")}
      <div class="sx-row"><button class="sx-btn" id="micTest">${ic("mic")} Record 5 seconds and play back</button></div><p class="sx-help">The voice changer is in the meeting's More menu.</p>`,
  };
  c.innerHTML = P2[ST.tab]();
  $$("[data-s]", c).forEach((el) => (el.oninput = () => { const k = el.dataset.s; T[k] = Number(el.value); $("#o-" + k).textContent = fmt(k, T[k]); changed(); }));
  $$("[data-t]", c).forEach((el) => (el.onchange = () => { T[el.dataset.t] = el.checked; if (["flip", "tag", "brand"].includes(el.dataset.t)) applyMirror(); changed(true); if (["tag", "faceBlur"].includes(el.dataset.t)) panel(); }));
  $$("[data-v]", c).forEach((el) => (el.oninput = () => { T[el.dataset.v] = el.value; changed(); }));
  $$("[data-look]", c).forEach((b) => (b.onclick = () => { T.look = b.dataset.look; $$("[data-look]", c).forEach((x) => x.classList.toggle("on", x === b)); changed(); }));
  $$("[data-bg]", c).forEach((b) => (b.onclick = () => { T.bg = b.dataset.bg; changed(true); panel(); }));
  $("#bgColor") && ($("#bgColor").oninput = (e) => { T.bgColor = e.target.value; changed(); });
  $("#bgUp") && ($("#bgUp").onclick = uploadBg);
  $("#bgDel") && ($("#bgDel").onclick = () => { try { localStorage.removeItem("km:studio-bg"); } catch {} if (T.bg === "custom") T.bg = "none"; changed(true); panel(); });
  $$("[data-x=_bgPriv]", c).forEach((el) => (el.onchange = () => { if (el.checked) { T.bg = "blur"; T.blurAmt = 30; } else T.bg = "none"; changed(true); }));
  $$("[data-ls]", c).forEach((el) => (el.onchange = () => { lset(el.dataset.ls, el.checked ? "1" : "0"); if (ST.tab === "quality" || ST.tab === "sound") restartCam(); }));
  $$("[data-q]", c).forEach((el) => (el.onchange = () => { lset(el.dataset.q, el.value); restartCam(); }));
  if (ST.tab === "quality" || ST.tab === "sound") devicePickers();
  $("#micTest") && ($("#micTest").onclick = micTest);
}
let saveT;
function changed(now = false) {
  ST.dirty = true;
  if (needsMask(T)) loadSeg();
  if (T.bg.startsWith("kayak-") && ST.bgKey !== T.bg) { ST.bgKey = T.bg; const im = new Image(); im.onload = () => { if (ST.bgKey === T.bg) ST.bgImg = im; }; im.src = `/assets/bg/${T.bg}.jpg`; }
  clearTimeout(saveT); saveT = setTimeout(() => saveStudio(T), now ? 0 : 250); // applies to meetings immediately, too
}
async function devicePickers() {
  const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  const fill = (sel, kind, key) => { if (!sel) return; sel.innerHTML = devs.filter((d) => d.kind === kind).map((d, i) => `<option value="${esc(d.deviceId)}" ${ls(key) === d.deviceId ? "selected" : ""}>${esc(d.label || `${kind === "videoinput" ? "Camera" : "Microphone"} ${i + 1}`)}</option>`).join("") || `<option>Default</option>`; sel.onchange = () => { lset(key, sel.value); restartCam(); }; };
  fill($("#camSel"), "videoinput", "km:cam"); fill($("#micSel"), "audioinput", "km:mic");
  const s = ST.raw?.getSettings?.(); if (s && $("#camInfo")) $("#camInfo").textContent = `Your camera is sending ${s.width}×${s.height} at ${Math.round(s.frameRate || 0)} fps.`;
}

// ---------------------------------------------------------------- camera and drawing
async function startCam() {
  ST.stream?.getTracks().forEach((t) => t.stop());
  const c = constraints({ cam: ls("km:cam"), mic: ls("km:mic") });
  try { ST.stream = await navigator.mediaDevices.getUserMedia(c); }
  catch { try { ST.stream = await navigator.mediaDevices.getUserMedia({ video: c.video }); } catch { $("#camOff").hidden = false; return; } }
  $("#camOff").hidden = true;
  ST.raw = ST.stream.getVideoTracks()[0];
  if (!ST.video) { ST.video = document.createElement("video"); ST.video.muted = true; ST.video.playsInline = true; }
  ST.video.srcObject = new MediaStream([ST.raw]); await ST.video.play().catch(() => {});
  const s = ST.raw.getSettings(); const W = s.width || 1280, H = s.height || 720;
  ST.canvas = $("#out"); ST.canvas.width = W; ST.canvas.height = H; ST.ctx = ST.canvas.getContext("2d", { alpha: false });
  const b = $("#before"); b.width = W; b.height = H;
  meter();
  if (needsMask(T)) loadSeg();
  changed(true); ST.dirty = false;
}
let rT; function restartCam() { clearTimeout(rT); rT = setTimeout(() => startCam().then(() => ST.tab === "quality" && devicePickers()), 300); }
function loop() {
  const v = ST.video;
  if (v && ST.ctx && v.readyState >= 2) {
    drawFrame(ST.ctx, ST.canvas, v, T, { mask: needsMask(T) ? ST.mask : null, bgImg: ST.bgImg });
    if (ST.split) { const b = $("#before"), bc = b.getContext("2d"); bc.drawImage(v, 0, 0, b.width, b.height); b.style.clipPath = ST.mirror && !T.flip && !T.tag && !T.brand ? "inset(0 0 0 50%)" : "inset(0 50% 0 0)"; }
    if (needsMask(T) && ST.seg && !ST.busy) { ST.busy = true; ST.seg.send({ image: v }).catch(() => {}).finally(() => (ST.busy = false)); }
  }
  requestAnimationFrame(loop);
}
let segLoading = null;
function loadScript(src) { return new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = () => rej(new Error("load")); document.head.append(el); }); }
function loadSeg() {
  if (ST.seg || segLoading) return segLoading;
  segLoading = (async () => {
    try {
      await loadScript("/seg/selfie_segmentation.js");
      const seg = new window.SelfieSegmentation({ locateFile: (f) => `/seg/${f}` });
      seg.setOptions({ modelSelection: 1 }); seg.onResults((r) => { ST.mask = r.segmentationMask; });
      await seg.initialize(); ST.seg = seg;
    } catch { segLoading = null; toast("Backgrounds and face blur aren't available on this device right now. Face blur blurs the whole picture instead."); }
  })();
  return segLoading;
}
let ac = null;
function meter() {
  const a = ST.stream?.getAudioTracks()[0]; if (!a) return;
  ac?.close().catch(() => {}); ac = new AudioContext(); const an = ac.createAnalyser(); ac.createMediaStreamSource(new MediaStream([a])).connect(an); const buf = new Uint8Array(an.fftSize);
  const tick = () => { if (!ac || ac.state === "closed") return; an.getByteTimeDomainData(buf); let m = 0; for (const x of buf) m = Math.max(m, Math.abs(x - 128)); const el = $("#lvl"); if (el) el.style.width = Math.min(100, m * 1.6) + "%"; requestAnimationFrame(tick); };
  tick();
}

// ---------------------------------------------------------------- tools
function modal(html, onMount) {
  const d = document.createElement("dialog"); d.className = "sx-dlg"; d.innerHTML = html; document.body.append(d);
  d.addEventListener("close", () => d.remove()); $$("[data-close]", d).forEach((b) => (b.onclick = (e) => { e.preventDefault(); d.close(); }));
  d.showModal(); onMount?.(d); return d;
}
function snapshot() {
  if (!ST.canvas) return;
  const url = ST.canvas.toDataURL("image/jpeg", 0.92);
  modal(`<div class="sx-dlg-in"><h3>Snapshot</h3><img src="${url}" alt="Your snapshot" class="sx-snap"><div class="sx-row end"><a class="sx-btn" href="${url}" download="meet-studio.jpg">Save picture</a><button class="sx-btn" id="asProfile">${ic("user")} Use as profile photo</button><button class="sx-btn primary" data-close>Done</button></div></div>`, (d) => {
    $("#asProfile", d).onclick = async () => {
      const W = ST.canvas.width, H = ST.canvas.height, s = Math.min(W, H), out = document.createElement("canvas"); out.width = out.height = 512;
      out.getContext("2d").drawImage(ST.canvas, (W - s) / 2, Math.max(0, (H - s) / 2 - H * 0.05), s, s, 0, 0, 512, 512);
      const blob = await new Promise((r) => out.toBlob(r, "image/webp", 0.9)) || await new Promise((r) => out.toBlob(r, "image/jpeg", 0.9));
      const r = await fetch("/api/wsx/avatar", { method: "PUT", body: blob, headers: { "Content-Type": blob.type } }).catch(() => null);
      if (r?.ok) { toast("Profile photo updated."); d.close(); } else toast((await r?.json().catch(() => ({})))?.error || "Couldn't update your photo.");
    };
  });
}
function testRecording() {
  if (!ST.canvas || !window.MediaRecorder) return toast("Recording isn't supported in this browser.");
  if (ST.rec) return;
  const vs = ST.canvas.captureStream(24), mixed = new MediaStream([...vs.getVideoTracks(), ...(ST.stream?.getAudioTracks() || [])]);
  const type = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const rec = new MediaRecorder(mixed, type ? { mimeType: type } : {}); const parts = []; ST.rec = rec;
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  rec.onstop = () => { ST.rec = null; $("#tRec").classList.remove("live"); $("#tRec span").textContent = "Test recording"; const url = URL.createObjectURL(new Blob(parts, { type: rec.mimeType }));
    modal(`<div class="sx-dlg-in"><h3>How you look and sound</h3><video src="${url}" controls autoplay playsinline class="sx-snap"></video><p class="sx-help">This clip stays on this device and is deleted when you close it.</p><div class="sx-row end"><button class="sx-btn primary" data-close>Close</button></div></div>`, (d) => d.addEventListener("close", () => URL.revokeObjectURL(url))); };
  rec.start(); $("#tRec").classList.add("live");
  let n = 10; $("#tRec span").textContent = `Recording… ${n}s`;
  const t = setInterval(() => { n -= 1; if (n <= 0) { clearInterval(t); rec.stop(); } else $("#tRec span").textContent = `Recording… ${n}s`; }, 1000);
}
function micTest() {
  const a = ST.stream?.getAudioTracks()[0]; if (!a || !window.MediaRecorder) return toast("No microphone found.");
  const rec = new MediaRecorder(new MediaStream([a])); const parts = []; rec.ondataavailable = (e) => parts.push(e.data);
  rec.onstop = () => { const au = new Audio(URL.createObjectURL(new Blob(parts, { type: rec.mimeType }))); au.play().catch(() => {}); toast("Playing back…"); };
  rec.start(); toast("Recording 5 seconds. Say something."); setTimeout(() => rec.stop(), 5000);
}
function lightingCheck() {
  const v = ST.video; if (!v || v.readyState < 2) return;
  const c = document.createElement("canvas"); c.width = 160; c.height = 90; const x = c.getContext("2d"); x.drawImage(v, 0, 0, 160, 90);
  const d = x.getImageData(0, 0, 160, 90).data; let sum = 0, cen = 0, n = 0, cn = 0, hi = 0, r = 0, b = 0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sum += L; n++; r += d[i]; b += d[i + 2]; if (L > 245) hi++; const px = p % 160, py = (p / 160) | 0; if (px > 50 && px < 110 && py > 15 && py < 70) { cen += L; cn++; } }
  const avg = sum / n, face = cen / cn, tips = [];
  if (face < 70) tips.push("Your face is in shadow. Face a window or a lamp, or turn up Key light."); else if (face > 200) tips.push("Your face is very bright. Move away from direct light, or lower Brightness.");
  if (face + 25 < avg) tips.push("There's strong light behind you. Close the blinds behind you, or use a background.");
  if (hi / n > 0.08) tips.push("Part of the picture is over-exposed. Lower Exposure.");
  if (r > b * 1.35) tips.push("The light is quite orange. Try Warmth a little to the left."); else if (b > r * 1.15) tips.push("The light is quite blue. Try Warmth a little to the right.");
  const tip = $("#tip"); tip.hidden = false; tip.innerHTML = `<b>${tips.length ? "Lighting tips" : "Your lighting looks good."}</b>${tips.map((t) => `<p>${esc(t)}</p>`).join("")}<button class="sx-x" aria-label="Close">${ic("x")}</button>`;
  $(".sx-x", tip).onclick = () => (tip.hidden = true);
}
function uploadBg() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp";
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return; if (f.size > 20 * 1024 * 1024) return toast("Choose a picture under 20 MB.");
    const im = new Image(); im.onload = () => { const s = Math.min(1, 1600 / im.width), c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      const d = c.toDataURL("image/jpeg", 0.82); try { localStorage.setItem("km:studio-bg", d); } catch { return toast("That picture is too large to keep. Try a smaller one."); }
      T.bg = "custom"; changed(true); panel(); URL.revokeObjectURL(im.src); toast("Your background is ready."); };
    im.onerror = () => toast("That picture couldn't be opened."); im.src = URL.createObjectURL(f);
  };
  inp.click();
}

// ---------------------------------------------------------------- saved looks
const getLooks = () => { try { return JSON.parse(ls("km:studio-looks", "[]")) || []; } catch { return []; } };
function presets() {
  const list = getLooks();
  $("#presets").innerHTML = `<span class="sx-pl">My looks</span>${list.map((l, i) => `<button class="sx-chip" data-pl="${i}">${esc(l.name)}<span data-pd="${i}" aria-label="Delete ${esc(l.name)}" role="button" tabindex="0">${ic("x")}</span></button>`).join("") || `<span class="sx-help">Save a look to switch to it in one click.</span>`}`;
  $$("[data-pl]").forEach((b) => (b.onclick = (e) => { if (e.target.closest("[data-pd]")) return; Object.assign(T, STUDIO_DEFAULT, list[+b.dataset.pl].t); changed(true); panel(); applyMirror(); toast(`Using “${list[+b.dataset.pl].name}”.`); }));
  $$("[data-pd]").forEach((b) => (b.onclick = () => { list.splice(+b.dataset.pd, 1); lset("km:studio-looks", JSON.stringify(list)); presets(); }));
}
function saveLook() {
  saveStudio(T); ST.dirty = false;
  modal(`<form class="sx-dlg-in"><h3>Save this look</h3><p class="sx-help">It's already in use for your meetings and calls${isActive(T) ? "" : " (your camera as it is)"}. Give it a name to keep it in My looks.</p>
    <label class="sx-in"><span>Name</span><input id="ln" maxlength="30" placeholder="e.g. Client calls" required></label>
    <div class="sx-row end"><button class="sx-btn" data-close>Not now</button><button class="sx-btn primary">Save look</button></div></form>`, (d) => {
    $("form", d).onsubmit = (e) => { e.preventDefault(); const list = getLooks(); list.unshift({ name: $("#ln", d).value.trim(), t: { ...T } }); lset("km:studio-looks", JSON.stringify(list.slice(0, 8))); presets(); d.close(); toast("Look saved."); };
  });
}

boot();
