import { $, $$, api, esc, html, raw, ico, identifier, toast, confirmDialog, copyText, fmtDateTime } from "/_shared/js/ui.js";

const MODES = { general: "General", draft: "Draft for a client", research: "Research", review: "Review my text" };
const SUGGEST = [
  ["draft", "Draft a two-paragraph cover email for a forensic investigation proposal to a listed pharmaceutical company's audit committee."],
  ["research", "Summarise what the DPDP Rules, 2025 require of a data fiduciary when a personal data breach happens."],
  ["general", "Give me a 10-question checklist for third-party due diligence on a new distributor in the UAE."],
  ["review", "Review this paragraph for clarity and unsupported claims: [paste your text]"],
];

const md = (t) => {
  const h = window.marked ? window.marked.parse(t, { breaks: false, gfm: true }) : esc(t).replace(/\n/g, "<br>");
  return window.DOMPurify ? window.DOMPurify.sanitize(h, { USE_PROFILES: { html: true } }) : esc(t);
};

export async function render(main, ctx) {
  const [{ providers, default: def }, { conversations }] = await Promise.all([api("/api/ai/providers"), api("/api/ai/conversations")]);
  let convId = ctx.rest[0] || null;
  let busy = false;
  let controller = null;

  main.innerHTML = String(html`<div class="page" style="max-width:none">
    <div class="page-head"><div class="stack-sm"><span class="eyebrow">Kayak AI</span><h1>Ask Kayak AI</h1><p class="lead">Drafting, research and review in Kayak's voice. Conversations are private to you. Check facts before anything leaves Kayak.</p></div></div>
    ${providers.length ? "" : html`<div class="note warn"><b>No AI provider is connected yet.</b> An administrator needs to add ANTHROPIC_API_KEY, OPENAI_API_KEY or XAI_API_KEY as a GitHub secret and run the deploy workflow.</div>`}
    <div class="chat">
      <aside class="chat-list"><div style="padding:12px"><a class="btn btn-primary btn-sm" href="#/ai" style="width:100%">${ico("plus")} New conversation</a></div><div class="items" id="convs"></div></aside>
      <section class="chat-main">
        <div class="chat-head">
          <label class="small" for="prov">Model</label>
          <select class="select" id="prov" style="width:auto;min-height:36px">${providers.map((p) => html`<option value="${p.id}"${p.id === def ? raw(" selected") : ""}>${p.label} · ${p.model}</option>`)}</select>
          <label class="small" for="mode">Mode</label>
          <select class="select" id="mode" style="width:auto;min-height:36px">${Object.entries(MODES).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
          <span style="flex:1"></span>
          <button class="btn btn-quiet btn-sm" id="del" hidden>${ico("trash")} Delete</button>
        </div>
        <div class="msgs" id="msgs" aria-live="polite"></div>
        <form class="composer" id="form">
          <label class="sr-only" for="text">Message</label>
          <textarea class="textarea" id="text" placeholder="Ask anything… (Shift+Enter for a new line)" ${providers.length ? "" : "disabled"}></textarea>
          <div class="row between"><span class="small faint">Do not paste passwords or client data you are not allowed to share.</span>
            <div class="row"><button type="button" class="btn btn-ghost btn-sm" id="stop" hidden>Stop</button><button class="btn btn-primary" id="send" ${providers.length ? "" : "disabled"}>${ico("send")} Send</button></div></div>
        </form>
      </section>
    </div></div>`);

  const msgs = $("#msgs");
  const convList = () => {
    $("#convs").innerHTML = conversations.length
      ? conversations.map((c) => `<a href="#/ai/${esc(c.id)}"${c.id === convId ? ' aria-current="true"' : ""} title="${esc(c.title)}">${esc(c.title)}<br><span class="small faint">${esc(fmtDateTime(c.updated_at))}</span></a>`).join("")
      : `<p class="small muted" style="padding:14px">Your conversations will appear here.</p>`;
  };
  const bubble = (role, text) => {
    const d = document.createElement("div");
    d.className = `msg ${role}`;
    d.innerHTML = role === "user"
      ? `<span class="who-ico">${esc((ctx.me.name || "You").slice(0, 1))}</span><div class="bubble"></div>`
      : `<span class="who-ico">${identifier(18)}</span><div class="bubble md"></div>`;
    const b = d.querySelector(".bubble");
    if (role === "user") b.textContent = text; else b.innerHTML = md(text);
    if (role === "assistant") {
      const tools = document.createElement("div");
      tools.className = "row"; tools.style.marginTop = "6px";
      tools.innerHTML = `<button class="btn btn-quiet btn-sm" data-copy>${ico("copy")} Copy</button>`;
      tools.querySelector("[data-copy]").onclick = () => copyText(d.dataset.raw || "");
      b.after(tools);
      d.dataset.raw = text;
    }
    msgs.append(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  };
  const empty = () => {
    msgs.innerHTML = `<div class="stack" style="margin:auto;text-align:center;align-items:center;max-width:760px">${identifier(44)}<h2 style="font-size:1.4rem">How can Kayak AI help?</h2>
      <div class="suggest">${SUGGEST.map(([m, t]) => `<button class="chip" data-m="${m}" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>`;
    $$("[data-t]", msgs).forEach((b) => (b.onclick = () => { $("#mode").value = b.dataset.m; $("#text").value = b.dataset.t; $("#text").focus(); }));
  };

  async function load() {
    convList();
    $("#del").hidden = !convId;
    if (!convId) return empty();
    const { conversation, messages } = await api(`/api/ai/conversations/${encodeURIComponent(convId)}`);
    msgs.innerHTML = "";
    messages.forEach((m) => bubble(m.role, m.content));
    if ($("#prov").querySelector(`option[value="${conversation.provider}"]`)) $("#prov").value = conversation.provider;
  }

  async function send(text) {
    if (busy || !text.trim()) return;
    if (!convId) msgs.innerHTML = "";
    bubble("user", text);
    const out = bubble("assistant", "");
    const b = out.querySelector(".bubble");
    b.innerHTML = `<span class="spinner"></span>`;
    busy = true; $("#send").disabled = true; $("#stop").hidden = false;
    controller = new AbortController();
    let full = "";
    try {
      const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", signal: controller.signal,
        body: JSON.stringify({ message: text, conversationId: convId, provider: $("#prov").value, mode: $("#mode").value }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Request failed (${r.status}).`); }
      const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "", ev = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, "");
          buf = buf.slice(i + 1);
          if (line.startsWith("event:")) ev = line.slice(6).trim();
          else if (line.startsWith("data:")) {
            const d = JSON.parse(line.slice(5).trim() || "{}");
            if (ev === "meta" && !convId) { convId = d.conversationId; history.replaceState(null, "", `#/ai/${convId}`); conversations.unshift({ id: convId, title: text.slice(0, 70), updated_at: new Date().toISOString() }); convList(); $("#del").hidden = false; }
            else if (ev === "delta") { full += d.t; b.innerHTML = md(full); out.dataset.raw = full; msgs.scrollTop = msgs.scrollHeight; }
            else if (ev === "error") throw new Error(d.error);
          }
        }
      }
      if (!full) b.innerHTML = `<p class="muted">No answer came back. Try again.</p>`;
    } catch (e) {
      if (e.name !== "AbortError") b.innerHTML = `<div class="note danger">${esc(e.message)}</div>`;
      else if (!full) b.innerHTML = `<p class="muted">Stopped.</p>`;
    } finally {
      busy = false; $("#send").disabled = false; $("#stop").hidden = true; controller = null;
    }
  }

  $("#form").onsubmit = (e) => { e.preventDefault(); const t = $("#text").value; $("#text").value = ""; send(t); };
  $("#text").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#form").requestSubmit(); } });
  $("#stop").onclick = () => controller?.abort();
  $("#del").onclick = async () => {
    if (!(await confirmDialog("Delete this conversation?", "It cannot be recovered.", "Delete", true))) return;
    await api(`/api/ai/conversations/${encodeURIComponent(convId)}`, { method: "DELETE" });
    location.hash = "#/ai";
  };
  await load();
  $("#text").focus();
}
