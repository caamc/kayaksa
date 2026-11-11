// Kay: the Kayak Strategic Advisors assistant on www.kayaksa.com. Text chat and two-way voice.
// Nothing is stored on Kayak's servers unless the visitor chooses to leave a message for the team;
// the conversation lives in this browser tab only (sessionStorage).

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
  local(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } },
};
const ico = {
  mic: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>`,
  send: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg>`,
  x: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/></svg>`,
  min: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
  wave: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="miter"/></svg>`,
  up: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9Zm0 0 4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 20H7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  down: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13V4h3v9Zm0 0-4 7a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.7 4H17" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" fill="currentColor"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
};

const SUGGEST = [
  "What does Kayak do, in a nutshell?",
  "We are preparing for the DPDP Rules. Where do we start?",
  "Tell me something I don't know about counterfeits in India",
  "Recommend a good book for a long flight",
];

let AV = "";
const state = { msgs: store.get("kay-chat", []), open: false, busy: false, voice: false, muted: store.local("kay-muted") === "1", ctrl: null };

/** Light, safe markdown: bold, italics, links to https or site paths, bullets, paragraphs. */
function md(t) {
  const blocks = esc(t).split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split("\n");
    if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
      const ordered = /^\s*\d+\./.test(lines[0]);
      return `<${ordered ? "ol" : "ul"}>${lines.map((l) => `<li>${inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
    }
    return `<p>${lines.map(inline).join("<br>")}</p>`;
  }).join("");
}
function inline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\(((?:https:\/\/|\/)[^\s)]+)\)/g, (m, txt, url) => `<a href="${url}"${url.startsWith("/") ? ' data-kaygo="1"' : ' target="_blank" rel="noopener"'}>${txt}</a>`);
}
/** Kay can add [[go:/path|Label]] chips and [[handoff]]. */
function parseTags(text) {
  const chips = [];
  let handoff = false;
  const clean = text
    .replace(/\[\[go:(\/[\w\/-]*)\|([^\]]{1,60})\]\]/g, (m, p, l) => { chips.push({ p, l }); return ""; })
    .replace(/\[\[handoff\]\]/g, () => { handoff = true; return ""; })
    .replace(/\[\[[^\]]*$/, "")
    .trim();
  return { clean, chips, handoff };
}
const speakable = (t) => parseTags(t).clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_#`>]/g, "").replace(/https?:\/\/\S+/g, "the link in the chat").replace(/\s+/g, " ").trim();

export async function mountKay() {
  if ($("#kay")) return;
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = "/assets/kay.css";
  document.head.append(css);
  AV = `<img src="/assets/kay-320.webp" alt="" width="320" height="320" decoding="async">`;
  const root = document.createElement("div");
  root.id = "kay";
  root.innerHTML = `
  <div class="kay-nudge" hidden><button class="kay-nudge-x" aria-label="Dismiss">${ico.x}</button><b>Hi, I'm Kay.</b> Kayak's AI assistant. Ask me anything, about work or otherwise. I can talk, too.</div>
  <button class="kay-launch" aria-label="Chat with Kay, Kayak's AI assistant" aria-expanded="false" aria-controls="kay-panel"><span class="kay-av"><img src="/assets/kay-120.webp" alt="" width="120" height="120"></span><span class="kay-dot" aria-hidden="true"></span></button>
  <section class="kay-panel" id="kay-panel" role="dialog" aria-label="Chat with Kay" hidden>
    <header class="kay-head">
      <span class="kay-av sm" aria-hidden="true">${AV}</span>
      <div class="kay-title"><b>Kay</b><span>Kayak's AI assistant · replies in seconds</span></div>
      <button class="kay-ib" data-k="voice" aria-pressed="false" title="Talk with Kay">${ico.wave}<span class="sr">Talk with Kay</span></button>
      <button class="kay-ib" data-k="mute" aria-pressed="${state.muted}" title="Kay's voice on or off">${state.muted ? ico.mute : ico.speaker}<span class="sr">Kay's voice</span></button>
      <button class="kay-ib" data-k="close" title="Close">${ico.min}<span class="sr">Close</span></button>
    </header>
    <div class="kay-stage" hidden>
      <div class="kay-av xl" aria-hidden="true"><img src="/assets/kay-640.webp" alt="" width="640" height="640"><i class="kay-ring"></i><i class="kay-ring r2"></i></div>
      <p class="kay-status" aria-live="polite">Tap the microphone and speak.</p>
      <p class="kay-heard" aria-live="polite"></p>
      <div class="kay-stage-acts"><button class="kay-mic big" data-k="talk" aria-label="Start speaking">${ico.mic}</button><button class="kay-ib light" data-k="text" title="Back to text chat">${ico.chat}<span class="sr">Back to text chat</span></button></div>
    </div>
    <div class="kay-log" role="log" aria-live="polite" aria-relevant="additions"></div>
    <form class="kay-form" autocomplete="off">
      <label class="sr" for="kay-in">Message Kay</label>
      <textarea id="kay-in" rows="1" maxlength="2000" placeholder="Ask Kay anything…"></textarea>
      <button type="button" class="kay-mic" data-k="dictate" aria-label="Speak your message">${ico.mic}</button>
      <button type="submit" class="kay-send" aria-label="Send">${ico.send}</button>
    </form>
    <p class="kay-fine">Kay is an AI and can make mistakes. Please don't share confidential details. <a href="/legal" data-kaygo="1">Privacy</a></p>
  </section>`;
  document.body.append(root);

  const launch = $(".kay-launch", root), panel = $(".kay-panel", root), log = $(".kay-log", root), input = $("#kay-in", root);
  const nudge = $(".kay-nudge", root);
  if (!store.local("kay-seen")) setTimeout(() => { if (!state.open) nudge.hidden = false; }, 6000);
  $(".kay-nudge-x", root).onclick = (e) => { e.stopPropagation(); nudge.hidden = true; store.local("kay-seen", "1"); };
  nudge.onclick = () => openPanel();
  launch.onclick = () => (state.open ? closePanel() : openPanel());

  function openPanel() {
    state.open = true; nudge.hidden = true; store.local("kay-seen", "1");
    panel.hidden = false; launch.setAttribute("aria-expanded", "true"); root.classList.add("open");
    if (!state.msgs.length) greet(); else renderAll();
    setTimeout(() => input.focus(), 60);
  }
  function closePanel() {
    state.open = false; stopVoice(); panel.hidden = true; launch.setAttribute("aria-expanded", "false"); root.classList.remove("open"); launch.focus();
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.open) closePanel(); });
  // Other parts of the site can open Kay with a link: <a href="#kay">.
  document.addEventListener("click", (e) => { const a = e.target.closest('a[href="#kay"],[data-open-kay]'); if (a) { e.preventDefault(); openPanel(); } });

  function greet() {
    const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
    const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    state.msgs.push({ role: "assistant", content: `${part}, and welcome to Kayak. I'm Kay.\n\nAsk me about our work, or about anything at all: a regulation that's bothering you, a board question, cricket, a recipe. I can also talk, if you'd rather; tap the sound-wave button above.` });
    save(); renderAll();
  }
  function save() { store.set("kay-chat", state.msgs.slice(-40)); }

  function bubble(m, i) {
    const { clean, chips, handoff } = m.role === "assistant" ? parseTags(m.content) : { clean: m.content, chips: [], handoff: false };
    return `<div class="kay-msg ${m.role}" data-i="${i}">${m.role === "assistant" ? `<span class="kay-av xs" aria-hidden="true">${AV}</span>` : ""}
      <div class="kay-b">${m.role === "assistant" ? md(clean) || '<span class="kay-typing"><i></i><i></i><i></i></span>' : `<p>${esc(clean).replace(/\n/g, "<br>")}</p>`}
      ${m.role === "assistant" && i > 0 && clean && !(state.busy && i === state.msgs.length - 1) ? `<div class="kay-rate" aria-label="Was this helpful?">${m.rated ? `<span>${m.rated > 0 ? "Thanks!" : "Thanks, I'll learn from that."}</span>` : `<button data-rate="1" data-i="${i}" title="Helpful" aria-label="Helpful">${ico.up}</button><button data-rate="-1" data-i="${i}" title="Not helpful" aria-label="Not helpful">${ico.down}</button>`}</div>` : ""}
      ${chips.length || handoff ? `<div class="kay-chips">${chips.map((c) => `<a class="kay-chip" href="${esc(c.p)}" data-kaygo="1">${esc(c.l)}</a>`).join("")}${handoff ? `<button class="kay-chip strong" data-k="handoff">Leave a message for the team</button>` : ""}</div>` : ""}</div></div>`;
  }
  function renderAll() {
    log.innerHTML = state.msgs.map(bubble).join("") + (state.msgs.length <= 1 ? `<div class="kay-suggest">${SUGGEST.map((s) => `<button class="kay-chip" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : "");
    log.scrollTop = log.scrollHeight;
  }
  function renderLast() {
    const i = state.msgs.length - 1;
    const el = $(`.kay-msg[data-i="${i}"]`, log);
    const html = bubble(state.msgs[i], i);
    if (el) el.outerHTML = html; else { $(".kay-suggest", log)?.remove(); log.insertAdjacentHTML("beforeend", html); }
    log.scrollTop = log.scrollHeight;
  }

  log.addEventListener("click", (e) => {
    const s = e.target.closest("[data-s]");
    if (s) return send(s.dataset.s);
    if (e.target.closest('[data-k="handoff"]')) return handoffForm();
    const r = e.target.closest("[data-rate]");
    if (r) {
      const i = Number(r.dataset.i), m = state.msgs[i], q = state.msgs.slice(0, i).reverse().find((x) => x.role === "user");
      m.rated = Number(r.dataset.rate); save();
      fetch("/api/kay/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating: m.rated, question: q?.content || "", answer: parseTags(m.content).clean }) }).catch(() => {});
      const el = $(`.kay-msg[data-i="${i}"]`, log); if (el) el.outerHTML = bubble(m, i);
    }
  });
  root.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-kaygo]");
    if (a) {
      e.preventDefault();
      history.pushState(null, "", a.getAttribute("href"));
      dispatchEvent(new PopStateEvent("popstate"));
      if (matchMedia("(max-width: 640px)").matches) closePanel();
    }
  });

  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $(".kay-form", root).requestSubmit(); } });
  $(".kay-form", root).addEventListener("submit", (e) => { e.preventDefault(); const t = input.value.trim(); if (t) { input.value = ""; input.style.height = "auto"; send(t); } });

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-k]");
    if (!b) return;
    const k = b.dataset.k;
    if (k === "close") closePanel();
    if (k === "voice") state.voice ? stopVoice(true) : startVoice();
    if (k === "text") stopVoice(true);
    if (k === "talk") toggleListen();
    if (k === "dictate") dictate(b);
    if (k === "mute") { state.muted = !state.muted; store.local("kay-muted", state.muted ? "1" : "0"); b.setAttribute("aria-pressed", String(state.muted)); b.innerHTML = (state.muted ? ico.mute : ico.speaker) + '<span class="sr">Kay\'s voice</span>'; if (state.muted) speech.stop(); }
  });

  // ------------------------------------------------------------ chat
  async function send(text) {
    if (state.busy) return;
    state.busy = true; root.classList.add("busy");
    state.msgs.push({ role: "user", content: text.slice(0, 2000) });
    state.msgs.push({ role: "assistant", content: "" });
    renderAll();
    const ai = state.msgs[state.msgs.length - 1];
    const ctrl = (state.ctrl = new AbortController());
    let spoken = 0;
    const speakNew = (final) => {
      if (!state.voice || state.muted) return;
      const { clean } = parseTags(ai.content);
      const rest = clean.slice(spoken);
      const m = final ? rest : rest.match(/^[\s\S]*?[.!?](?=\s)/)?.[0];
      if (m && m.trim()) { spoken += m.length; speech.say(speakable(m)); }
    };
    try {
      const r = await fetch("/api/kay/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ messages: state.msgs.slice(0, -1).slice(-20).map(({ role, content }) => ({ role, content: role === "assistant" ? parseTags(content).clean : content })), page: location.pathname, voice: state.voice }),
      });
      if (!r.ok || !r.body) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "I'm having trouble connecting just now."); }
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (\w+)/m.exec(block)?.[1]; const data = /^data: (.*)$/m.exec(block)?.[1];
          if (!data) continue;
          const d = JSON.parse(data);
          if (ev === "delta") { ai.content += d.t; renderLast(); speakNew(false); }
          if (ev === "error") throw new Error(d.error);
        }
      }
      speakNew(true);
    } catch (err) {
      if (err.name !== "AbortError") ai.content = ai.content || `${err.message} You can also write to **enquiries@kayaksa.com** and a senior member of the team will reply within one working day. [[handoff]]`;
      renderLast();
      if (state.voice && !state.muted && ai.content) speech.say(speakable(ai.content));
    } finally {
      state.busy = false; root.classList.remove("busy"); save(); renderLast();
      if (state.voice) speech.whenDone(() => { if (state.voice && !bargeIn.interrupted) listen(); });
    }
  }

  // ------------------------------------------------------------ hand-off to the team (explicit consent)
  function handoffForm() {
    if ($(".kay-hand", log)) return;
    const lastQ = [...state.msgs].reverse().find((m) => m.role === "user")?.content || "";
    log.insertAdjacentHTML("beforeend", `<form class="kay-hand" novalidate><b>Leave a message for the team</b><p>A senior member of the team will reply within one working day.</p>
      <label>Name<input name="name" required autocomplete="name" maxlength="80"></label>
      <label>Work email<input name="email" type="email" required autocomplete="email" maxlength="200"></label>
      <label>Organisation (optional)<input name="org" autocomplete="organization" maxlength="120"></label>
      <label>Message<textarea name="msg" required maxlength="2000">${esc(lastQ)}</textarea></label>
      <label class="chk"><input type="checkbox" name="transcript"> Include this conversation with Kay</label>
      <label class="chk"><input type="checkbox" name="consent" required> I agree that Kayak may use these details to reply, as described in the <a href="/legal" data-kaygo="1">privacy notice</a>.</label>
      <p class="kay-err" role="alert" hidden></p><button class="kay-chip strong" type="submit">Send to the team</button></form>`);
    const f = $(".kay-hand", log);
    log.scrollTop = log.scrollHeight;
    f.querySelector("input").focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f));
      const err = $(".kay-err", f);
      if (!v.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || "") || !v.msg || !v.consent) { err.textContent = "Please add your name, a valid email, a message, and tick the consent box."; err.hidden = false; return; }
      const btn = $("button", f); btn.disabled = true; btn.textContent = "Sending…";
      try {
        const r = await fetch("/api/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "contact", source: "kay", t: Date.now() - 10000, page: location.pathname,
          fields: { name: v.name, email: v.email, org: v.org || "", msg: v.msg, cluster: "Via Kay", consent: true },
          transcript: v.transcript ? state.msgs.map((m) => `${m.role === "user" ? "Visitor" : "Kay"}: ${parseTags(m.content).clean}`).join("\n\n").slice(-12000) : "" }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "That did not go through.");
        f.outerHTML = `<div class="kay-msg assistant"><span class="kay-av xs" aria-hidden="true">${AV}</span><div class="kay-b"><p>Done. I've passed your message to the team, ${esc(v.name.split(" ")[0])}. You'll hear from a senior member of the team within one working day.</p></div></div>`;
        state.msgs.push({ role: "assistant", content: `Done. I've passed your message to the team, ${v.name.split(" ")[0]}. You'll hear from a senior member of the team within one working day.` }); save();
      } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = "Send to the team"; }
    });
  }

  // ------------------------------------------------------------ voice
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const lang = /^hi/i.test(navigator.language) ? "hi-IN" : "en-IN";
  let rec = null, listening = false, mediaRec = null;
  const status = (t) => { $(".kay-status", root).textContent = t; };
  const heard = (t) => { $(".kay-heard", root).textContent = t; };

  function startVoice() {
    state.voice = true; root.classList.add("voice");
    $('[data-k="voice"]', root).setAttribute("aria-pressed", "true");
    $(".kay-stage", root).hidden = false;
    if (state.muted) { state.muted = false; const b = $('[data-k="mute"]', root); b.setAttribute("aria-pressed", "false"); b.innerHTML = ico.speaker + '<span class="sr">Kay\'s voice</span>'; }
    speech.unlock();
    status("Listening. Go ahead.");
    listen();
  }
  function stopVoice(back) {
    state.voice = false; root.classList.remove("voice");
    $('[data-k="voice"]', root)?.setAttribute("aria-pressed", "false");
    $(".kay-stage", root).hidden = true;
    stopListening(); speech.stop();
    if (back) input.focus();
  }
  function toggleListen() { listening ? stopListening(true) : (speech.stop(), listen()); }
  function setListening(on) { listening = on; root.classList.toggle("listening", on); const b = $('[data-k="talk"]', root); b.innerHTML = on ? ico.stop : ico.mic; b.setAttribute("aria-label", on ? "Stop listening" : "Start speaking"); }

  async function listen() {
    if (!state.voice || listening || state.busy) return;
    heard("");
    if (SR) {
      rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      let final = "";
      rec.onresult = (e) => { let t = ""; for (const r of e.results) { t += r[0].transcript; if (r.isFinal) final = t; } heard(t); };
      rec.onerror = (e) => { setListening(false); if (e.error === "not-allowed" || e.error === "service-not-allowed") status("I need permission to use your microphone. You can still type below."); else if (e.error === "no-speech") status("I didn't catch anything. Tap the microphone to try again."); };
      rec.onend = () => { setListening(false); if (final.trim()) { status("Thinking…"); send(final.trim()); } };
      try { rec.start(); setListening(true); status("Listening…"); } catch { setListening(false); }
      return;
    }
    // Browsers without speech recognition: record, then transcribe on the server.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const chunks = [];
      mediaRec = new MediaRecorder(stream);
      mediaRec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mediaRec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); setListening(false);
        const blob = new Blob(chunks, { type: mediaRec.mimeType || "audio/webm" });
        if (blob.size < 2000) { status("I didn't catch anything. Tap the microphone to try again."); return; }
        status("Got it. One moment…");
        const r = await fetch("/api/kay/listen", { method: "POST", headers: { "Content-Type": blob.type }, body: blob }).then((x) => x.json()).catch(() => ({}));
        if (r.text) { heard(r.text); status("Thinking…"); send(r.text); } else status(r.error || "Sorry, I couldn't make that out. Try again, or type below.");
      };
      mediaRec.start(); setListening(true); status("Listening… tap stop when you're done.");
      silenceStop(stream, () => mediaRec?.state === "recording" && mediaRec.stop());
    } catch { status("I need permission to use your microphone. You can still type below."); }
  }
  function stopListening(process) {
    if (rec) { try { process ? rec.stop() : rec.abort(); } catch {} rec = null; }
    if (mediaRec && mediaRec.state === "recording") { if (!process) mediaRec.onstop = () => mediaRec.stream?.getTracks().forEach((t) => t.stop()); mediaRec.stop(); }
    setListening(false);
  }
  function silenceStop(stream, done) {
    const ctx = new AudioContext(); const an = ctx.createAnalyser(); ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize); let spoke = false, quietSince = 0; const start = performance.now();
    const tick = () => {
      if (!listening) { ctx.close(); return; }
      an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += (v - 128) ** 2; const rms = Math.sqrt(s / buf.length);
      const now = performance.now();
      if (rms > 6) { spoke = true; quietSince = 0; } else if (spoke && !quietSince) quietSince = now;
      if ((spoke && quietSince && now - quietSince > 1300) || now - start > 30000) { ctx.close(); done(); return; }
      requestAnimationFrame(tick);
    };
    tick();
  }
  async function dictate(btn) {
    if (!SR) { startVoice(); return; }
    const r = new SR(); r.lang = lang; r.interimResults = true;
    btn.classList.add("on");
    r.onresult = (e) => { input.value = [...e.results].map((x) => x[0].transcript).join(""); input.dispatchEvent(new Event("input")); };
    r.onend = () => { btn.classList.remove("on"); input.focus(); };
    r.onerror = () => btn.classList.remove("on");
    try { r.start(); } catch { btn.classList.remove("on"); }
  }

  // ------------------------------------------------------------ barge-in: talk over Kay to interrupt him
  // While Kay speaks in voice mode, a second recogniser listens. Words that are not Kay's own (his voice
  // can leak from speakers into the microphone) stop him at once, and what the visitor said is answered.
  const bargeIn = (() => {
    let r = null, said = "", heardText = "", interrupted = false;
    const stopR = () => { if (r) { const x = r; r = null; try { x.stop(); } catch {} } };
    const words = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
    const isEcho = (t) => { const w = words(t), k = new Set(words(said)); return w.length && w.filter((x) => k.has(x)).length / w.length > 0.5; };
    return {
      saying(t) { said += " " + t; },
      start() {
        if (!SR || !state.voice || r) return;
        said = ""; heardText = ""; interrupted = false;
        r = new SR(); r.lang = lang; r.interimResults = true; r.continuous = true;
        r.onresult = (e) => {
          let t = ""; for (const x of e.results) t += x[0].transcript;
          if (!interrupted && words(t).length >= 2 && !isEcho(t)) { interrupted = true; speech.stop(); heard(t); status("Listening…"); setListening(true); }
          if (interrupted) { heardText = t; heard(t); if ([...e.results].every((x) => x.isFinal)) { const final = heardText.trim(); stopR(); setListening(false); if (final) { status("Thinking…"); send(final); } } }
        };
        r.onend = () => { r = null; if (interrupted && heardText.trim()) { setListening(false); } };
        r.onerror = () => { r = null; };
        try { r.start(); } catch { r = null; }
      },
      stop() { if (!interrupted) stopR(); },
      get interrupted() { return interrupted; },
    };
  })();

  // ------------------------------------------------------------ speech output with a moving mouth
  const speech = (() => {
    const q = []; let playing = false, ctx = null, cur = null, waiters = [], serverOk = true;
    // Kay's portrait glows and breathes with the loudness of his voice.
    const setMouth = (level) => {
      root.style.setProperty("--lvl", String(Math.max(0, Math.min(1, level)).toFixed(3)));
      root.classList.toggle("speaking", level > 0.04 || playing);
    };
    function unlock() { try { ctx = ctx || new AudioContext(); ctx.resume(); } catch {} }
    function pickVoice() {
      const vs = speechSynthesis.getVoices();
      const pref = [/Rishi/i, /Ravi/i, /Prabhat/i, /en-IN.*Male/i, /Google UK English Male/i, /Daniel/i, /Arthur/i, /Guy/i, /Ryan/i, /Male/i];
      for (const p of pref) { const v = vs.find((x) => p.test(x.name) && /^en/i.test(x.lang)); if (v) return v; }
      return vs.find((x) => x.lang === "en-IN") || vs.find((x) => /^en-GB/.test(x.lang)) || vs.find((x) => /^en/.test(x.lang));
    }
    async function playServer(text) {
      const r = await fetch("/api/kay/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!r.ok) { serverOk = false; throw new Error("no server voice"); }
      const buf = await r.arrayBuffer();
      unlock();
      const audio = await ctx.decodeAudioData(buf);
      const src = ctx.createBufferSource(); src.buffer = audio;
      const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an); an.connect(ctx.destination);
      const data = new Uint8Array(an.fftSize);
      cur = { stop: () => { try { src.stop(); } catch {} } };
      await new Promise((res) => {
        src.onended = res; src.start();
        const tick = () => { if (cur?.src !== src && !playing) return; an.getByteTimeDomainData(data); let s = 0; for (const v of data) s += (v - 128) ** 2; setMouth(Math.sqrt(s / data.length) / 22); if (playing) requestAnimationFrame(tick); };
        cur.src = src; tick();
      });
    }
    function playBrowser(text) {
      return new Promise((res) => {
        if (!("speechSynthesis" in window)) return res();
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
        u.rate = 1.02; u.pitch = 0.92;
        let t = null;
        u.onstart = () => { t = setInterval(() => setMouth(reduced ? 0.3 : 0.2 + Math.random() * 0.6), 120); };
        u.onend = u.onerror = () => { clearInterval(t); setMouth(0); res(); };
        cur = { stop: () => { speechSynthesis.cancel(); clearInterval(t); } };
        speechSynthesis.speak(u);
      });
    }
    async function pump() {
      if (playing) return;
      playing = true; status("Speaking… (just talk to interrupt)");
      bargeIn.start();
      while (q.length) {
        const text = q.shift();
        bargeIn.saying(text);
        try { if (serverOk) await playServer(text); else await playBrowser(text); }
        catch { await playBrowser(text); }
      }
      playing = false; cur = null; setMouth(0); bargeIn.stop();
      if (state.voice && !listening) status("Tap the microphone to reply, or just keep talking.");
      const w = waiters; waiters = []; w.forEach((f) => f());
    }
    return {
      unlock,
      say(text) { if (!text || state.muted) return; q.push(text.slice(0, 600)); pump(); },
      stop() { q.length = 0; cur?.stop(); if ("speechSynthesis" in window) speechSynthesis.cancel(); playing = false; setMouth(0); },
      whenDone(f) { if (!playing && !q.length) setTimeout(f, 150); else waiters.push(f); },
    };
  })();

}
