import { esc, toast } from "/_shared/js/ui.js";

// Floating Kayak AI: available on every page. Type or speak; Kayak AI answers in writing and, if you
// like, out loud, with an animated presence that listens and speaks. Speech is transcribed on Kayak's
// own Cloudflare account; replies are read by the browser's own voice, so no audio leaves for an
// outside service. Short questions are answered on Kayak's own infrastructure first.
const ORB = `<svg class="orb" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="og" cx="35%" cy="30%"><stop offset="0" stop-color="#5DB2AB"/><stop offset=".6" stop-color="#17807E"/><stop offset="1" stop-color="#0E2F3C"/></radialGradient></defs><circle class="r3" cx="32" cy="32" r="30" fill="none" stroke="#EE9B1E" stroke-opacity=".35"/><circle class="r2" cx="32" cy="32" r="25" fill="none" stroke="#5DB2AB" stroke-opacity=".5"/><circle cx="32" cy="32" r="20" fill="url(#og)"/><path d="M22 23l7 0 3 6v8zM42 23l-7 0-3 6v8z" fill="#fff" opacity=".9"/><g class="wave"><rect x="24" y="40" width="2.5" height="5" rx="1" fill="#F5C46D"/><rect x="28" y="38" width="2.5" height="9" rx="1" fill="#F5C46D"/><rect x="32" y="39" width="2.5" height="7" rx="1" fill="#F5C46D"/><rect x="36" y="38" width="2.5" height="9" rx="1" fill="#F5C46D"/></g></svg>`;
const QUICK = [
  ["Summarise this week's dashboard in five bullets", "general"],
  ["Draft a polite follow-up email to a prospective client after a first meeting", "draft"],
  ["What should I check before releasing this month's Confluence?", "general"],
];

export function mount(me) {
  if (document.querySelector(".fab")) return;
  const root = document.createElement("div");
  root.className = "fab";
  root.innerHTML = `<button class="fab-btn" aria-expanded="false" aria-controls="fab-panel" title="Kayak AI">${ORB}<span class="sr-only">Open Kayak AI</span></button>
    <section class="fab-panel" id="fab-panel" role="dialog" aria-label="Kayak AI" hidden>
      <header><div class="fab-av" data-state="idle">${ORB}</div><div><b>Kayak AI</b><span id="fab-st">Ready. Type, or hold the microphone to speak.</span></div>
        <label class="fab-tg" title="Read answers aloud"><input type="checkbox" id="fab-voice"> Voice</label><button class="fab-x" aria-label="Close">×</button></header>
      <div class="fab-log" id="fab-log" aria-live="polite"><div class="fab-q">${QUICK.map(([q, m]) => `<button data-q="${esc(q)}" data-m="${m}">${esc(q)}</button>`).join("")}${me?.can?.admin ? `<a href="#/digital" data-fp>Run a digital footprint report on Kayak</a>` : ""}</div></div>
      <form class="fab-in" id="fab-f"><button type="button" class="fab-mic" id="fab-mic" aria-label="Hold to speak">🎙</button><textarea id="fab-t" rows="1" placeholder="Ask Kayak AI…" aria-label="Message"></textarea><button class="fab-send" type="submit" aria-label="Send">➤</button></form>
      <p class="fab-note">Answers can be wrong; check facts before you rely on them. Conversations are kept in Kayak AI.</p>
    </section>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  const btn = $(".fab-btn"), panel = $(".fab-panel"), log = $("#fab-log"), av = $(".fab-av"), st = $("#fab-st");
  let conv = "", busy = false;
  try { $("#fab-voice").checked = localStorage.getItem("ksa-fab-voice") === "1"; } catch {}
  $("#fab-voice").onchange = (e) => { try { localStorage.setItem("ksa-fab-voice", e.target.checked ? "1" : "0"); } catch {} if (!e.target.checked) speechSynthesis?.cancel(); };
  const open = (v) => { panel.hidden = !v; btn.setAttribute("aria-expanded", String(v)); root.classList.toggle("open", v); if (v) $("#fab-t").focus(); };
  btn.onclick = () => open(panel.hidden);
  $(".fab-x").onclick = () => open(false);
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(panel.hidden); } });
  const state = (s, t) => { av.dataset.state = s; if (t) st.textContent = t; };
  const add = (who, html) => { log.querySelector(".fab-q")?.remove(); const d = document.createElement("div"); d.className = `fab-m ${who}`; d.innerHTML = html; log.append(d); log.scrollTop = log.scrollHeight; return d; };
  const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^### (.+)$/gm, "<b>$1</b>").replace(/^## (.+)$/gm, "<b>$1</b>").replace(/^[-*] (.+)$/gm, "• $1").replace(/\n/g, "<br>");

  const speak = (text) => {
    if (!$("#fab-voice").checked || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[#*_`>]/g, "").slice(0, 1200));
    const v = speechSynthesis.getVoices().find((x) => /en-IN/i.test(x.lang)) || speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v; u.rate = 1.02;
    u.onstart = () => state("speaking", "Speaking…"); u.onend = () => state("idle", "Ready.");
    speechSynthesis.speak(u);
  };

  async function send(text, mode = "general") {
    if (!text.trim() || busy) return;
    busy = true; state("thinking", "Thinking…");
    add("me", esc(text));
    const out = add("ai", `<span class="spinner"></span>`);
    let full = "", model = "";
    try {
      const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ message: text, conversationId: conv || undefined, mode }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Kayak AI is unavailable."); }
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = (block.match(/^event: (.+)$/m) || [])[1], data = (block.match(/^data: (.*)$/m) || [])[1];
          if (!data) continue;
          const j = JSON.parse(data);
          if (ev === "meta") { if (j.conversationId) conv = j.conversationId; if (j.model) model = j.model; }
          else if (ev === "delta") { full += j.t; out.innerHTML = md(full); log.scrollTop = log.scrollHeight; }
          else if (ev === "error") throw new Error(j.error);
        }
      }
      out.insertAdjacentHTML("beforeend", `<div class="fab-meta">${esc(model)}${me?.can?.edit ? ` · <button data-save>Save to the answer store</button>` : ""} · <a href="#/ai">Open in Kayak AI</a></div>`);
      out.querySelector("[data-save]")?.addEventListener("click", async (e) => { await fetch("/api/ai/cache", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ question: text, answer: full }) }); e.target.replaceWith("Saved"); });
      state("idle", "Ready."); speak(full);
    } catch (e) { out.innerHTML = `<span class="danger">${esc(e.message)}</span>`; state("idle", "Something went wrong."); }
    busy = false;
  }
  $("#fab-f").onsubmit = (e) => { e.preventDefault(); const t = $("#fab-t").value; $("#fab-t").value = ""; send(t); };
  $("#fab-t").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#fab-f").requestSubmit(); } });
  log.addEventListener("click", (e) => { const q = e.target.closest("[data-q]"); if (q) send(q.dataset.q, q.dataset.m); if (e.target.closest("[data-fp]")) open(false); });

  // Hold-to-talk: record, transcribe on Workers AI, then send.
  let rec = null, chunks = [];
  const startRec = async () => {
    if (rec || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = []; rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); rec = null;
        const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
        if (blob.size < 1500) return state("idle", "Hold the microphone a little longer.");
        state("thinking", "Transcribing…");
        try { const r = await fetch("/api/ai/transcribe", { method: "POST", body: blob, credentials: "same-origin" }); const j = await r.json(); if (j.text) send(j.text); else state("idle", j.error || "I did not catch that. Try again."); }
        catch { state("idle", "Voice input is busy. Type instead."); }
      };
      rec.start(); state("listening", "Listening… release to send.");
    } catch { toast("Allow the microphone to talk to Kayak AI.", "err"); }
  };
  const stopRec = () => { if (rec && rec.state === "recording") rec.stop(); };
  const mic = $("#fab-mic");
  mic.addEventListener("pointerdown", (e) => { e.preventDefault(); startRec(); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => mic.addEventListener(ev, stopRec));
}
