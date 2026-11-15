// Meet self-test: what works on this device and on Kayak's servers, in plain words.
// Designed and developed by Kayak Strategic Advisors. Nothing is recorded or kept.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const report = [];
const WORD = { ok: "Works", bad: "Not working", warn: "Limited", wait: "Checking" };
function row(list, id, label) {
  const li = document.createElement("li"); li.id = "r-" + id; li.className = "st-wait";
  li.innerHTML = `<i class="st-tag">${WORD.wait}</i><div><b>${esc(label)}</b><span></span></div>`; list.append(li); return li;
}
function set(li, state, detail) { li.className = "st-" + state; li.querySelector(".st-tag").textContent = WORD[state]; li.querySelector("span").textContent = detail; report.push(`${WORD[state].toUpperCase()}  ${li.querySelector("b").textContent}: ${detail}`); }
const mediaWhy = (e) => ({ NotAllowedError: "Permission was refused. Allow it for meet.kayaksa.com in the browser's site settings (or in the system's privacy settings for the Meet app).", NotFoundError: "None was found on this device.", NotReadableError: "It is in use by another app, or the system blocked it. Close other apps that use it and try again.", OverconstrainedError: "The one Meet remembered is no longer connected.", SecurityError: "The browser blocked it for this page." })[e?.name] || `${e?.name || "Error"}: ${e?.message || "unknown"}`;

async function device() {
  const list = $("#device"); list.innerHTML = "";
  const chk = async (id, label, fn) => { const li = row(list, id, label); try { const r = await fn(); set(li, r.state || "ok", r.detail); } catch (e) { set(li, "bad", String(e?.message || e)); } };
  await chk("browser", "Browser", async () => ({ detail: `${navigator.userAgent.slice(0, 160)}${window.kayakDesktop ? " · Meet desktop app" : ""}` }));
  let stream = null;
  await chk("cam", "Camera", async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); stream = s; const t = s.getVideoTracks()[0], g = t.getSettings(); return { detail: `${t.label || "Camera"} at ${g.width}×${g.height}.` }; }
    catch (e) { return { state: "bad", detail: mediaWhy(e) }; }
  });
  await chk("mic", "Microphone", async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true }); const t = s.getAudioTracks()[0];
      const ac = new AudioContext(); if (ac.state === "suspended") await ac.resume().catch(() => {});
      const an = ac.createAnalyser(); ac.createMediaStreamSource(s).connect(an); const buf = new Uint8Array(an.fftSize); let max = 0;
      const end = Date.now() + 1500; while (Date.now() < end) { an.getByteTimeDomainData(buf); for (const x of buf) max = Math.max(max, Math.abs(x - 128)); await new Promise((r) => setTimeout(r, 60)); }
      s.getTracks().forEach((x) => x.stop()); const state = ac.state; await ac.close().catch(() => {});
      if (state !== "running") return { state: "warn", detail: `${t.label || "Microphone"} opened, but this browser holds audio until you tap the page. Captions start only after a tap.` };
      return max < 3 ? { state: "warn", detail: `${t.label || "Microphone"} opened, but no sound was heard. Check it isn't muted, then speak while the test runs.` } : { detail: `${t.label || "Microphone"} is picking up sound.` };
    } catch (e) { return { state: "bad", detail: mediaWhy(e) }; }
  });
  await chk("filter", "Studio looks, light, colour and blur", async () => {
    const c = document.createElement("canvas").getContext("2d");
    return "filter" in c ? { detail: "Supported." } : { state: "bad", detail: "This browser cannot apply picture effects to the camera (Safari, and every browser on iPhone and iPad). Looks, Light, Colour, background blur and face blur have no effect here. Use Chrome or Edge on a computer, or the Meet desktop app." };
  });
  await chk("gl", "Graphics for backgrounds and the avatar", async () => { const c = document.createElement("canvas"); return c.getContext("webgl2") || c.getContext("webgl") ? { detail: "Supported." } : { state: "bad", detail: "Graphics acceleration is off, so backgrounds and the avatar cannot run. Turn on hardware acceleration in the browser's settings." }; });
  await chk("seg", "Background model", async () => { const r = await fetch("/seg/selfie_segmentation.js", { method: "HEAD" }).catch(() => null); return r?.ok ? { detail: "Available." } : { state: "bad", detail: `Missing from this release (${r ? r.status : "no answer"}), so backgrounds and face blur cannot work. Tell your Kayak administrator.` }; });
  await chk("cap", "Caption capture", async () => {
    if (!window.AudioWorkletNode) return { state: "bad", detail: "This browser cannot capture speech for captions." };
    const ac = new AudioContext(); try { await ac.audioWorklet.addModule("/assets/capture-worklet.js"); return { detail: "Ready." }; } catch (e) { return { state: "bad", detail: `The caption capture file could not be loaded (${e?.message || e}).` }; } finally { ac.close().catch(() => {}); }
  });
  await chk("rec", "Recording", async () => {
    if (!window.MediaRecorder) return { state: "bad", detail: "This browser cannot record meetings." };
    const t = ["video/mp4;codecs=avc1,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].filter((m) => MediaRecorder.isTypeSupported(m));
    return t.length ? { detail: `Supported (${t[0].split(";")[0].replace("video/", "").toUpperCase()}).` } : { state: "bad", detail: "No recording format this browser can produce is supported." };
  });
  await chk("rtc", "Connection to other people", async () => {
    if (!window.RTCPeerConnection) return { state: "bad", detail: "This browser cannot make calls." };
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] }); pc.createDataChannel("t");
    const kinds = new Set(); pc.onicecandidate = (e) => { if (e.candidate) kinds.add(e.candidate.type); };
    await pc.setLocalDescription(await pc.createOffer()); await new Promise((r) => { pc.onicegatheringstatechange = () => pc.iceGatheringState === "complete" && r(); setTimeout(r, 4000); }); pc.close();
    return kinds.has("srflx") ? { detail: "This network allows direct calls." } : { state: "warn", detail: "This network hides its public address, so calls may need Kayak's relay. If calls fail to connect here, tell your Kayak administrator." };
  });
  stream?.getTracks().forEach((t) => t.stop());
}
async function server() {
  const list = $("#server"); list.innerHTML = "";
  const wait = row(list, "wait", "Asking Kayak's servers");
  const r = await fetch("/api/diag", { credentials: "same-origin" }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  wait.remove();
  if (!r) { set(row(list, "net", "Kayak's servers"), "bad", "No answer. Check your internet connection."); return; }
  if (r.status === 403) { $("#serverBox").hidden = true; $("#note").textContent = "The server checks are for the Kayak team. Send this report to your Kayak contact if something on this device is not working."; return; }
  if (!r.ok) { set(row(list, "err", "Kayak's servers"), "bad", j.error || `The test could not run (${r.status}).`); return; }
  for (const c of j.checks || []) set(row(list, c.id, c.label), c.ok ? "ok" : (["relay", "townhall", "face"].includes(c.id) ? "warn" : "bad"), `${c.detail} (${c.ms} ms)`);
}
$("#run").onclick = async () => {
  const b = $("#run"); b.disabled = true; b.textContent = "Testing…"; report.length = 0; $("#copy").hidden = true;
  report.push(`Meet by Kayak self-test · ${new Date().toISOString()}`);
  try { await device(); await server(); } finally { b.disabled = false; b.textContent = "Run the test again"; $("#copy").hidden = false; }
};
$("#copy").onclick = async () => {
  const text = report.join("\n");
  try { await navigator.clipboard.writeText(text); $("#copy").textContent = "Copied"; setTimeout(() => ($("#copy").textContent = "Copy the report"), 2000); }
  catch { const ta = document.createElement("textarea"); ta.value = text; ta.readOnly = true; ta.style.cssText = "width:100%;height:220px;margin-top:14px"; $("#note").after(ta); ta.select(); }
};
