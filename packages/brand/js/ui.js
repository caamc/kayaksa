// Shared browser helpers for Kayak apps (no framework).

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template that escapes interpolations unless wrapped with raw(). */
export function html(strings, ...vals) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (v && v.__raw) out += v.html;
      else if (Array.isArray(v)) out += v.map((x) => (x && x.__raw ? x.html : esc(x))).join("");
      else out += esc(v);
    }
  });
  return raw(out);
}
export const raw = (s) => ({ __raw: true, html: String(s), toString() { return this.html; } });

export const ico = (name, cls = "ico") => raw(`<svg class="${cls}" aria-hidden="true"><use href="/_shared/icons.svg#i-${name}"/></svg>`);

// The Kayak wordmark, drawn from the master geometry so it can follow light and dark themes.
export const wordmark = (h = 26) =>
  raw(`<svg viewBox="0 0 416 100" style="height:${h}px;width:auto" role="img" aria-label="Kayak"><g fill="var(--logo-ink)"><path d="M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z"/><path transform="translate(92 0)" d="M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z"/><path transform="translate(161 0)" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/><path transform="translate(232 0)" d="M0 100 L31 0 L59 0 L90 100 L61 100 L45 44 L29 100 Z"/><path transform="translate(332 0)" d="M0 0 H28 V38.7 L52 0 H82 L50.1 51.5 L84 100 H54 L36 74.2 L28 87.1 V100 H0 Z"/></g><path transform="translate(161 0)" fill="var(--logo-left)" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path transform="translate(161 0)" fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/></svg>`);

export const identifier = (h = 28) =>
  raw(`<svg viewBox="0 0 92 100" style="height:${h}px;width:auto" aria-hidden="true"><path fill="var(--logo-left)" d="M0 0 L30 0 L44 26.25 L44 59.3 Z"/><path fill="#EE9B1E" d="M92 0 L62 0 L48 26.25 L48 59.3 Z"/><path fill="var(--logo-ink)" d="M32 51 L46 70 L60 51 L60 100 L32 100 Z"/></svg>`);

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, opts = {}) {
  const init = { method: opts.method || (opts.body !== undefined ? "POST" : "GET"), headers: { Accept: "application/json" }, credentials: "same-origin" };
  if (opts.body instanceof FormData) init.body = opts.body;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers["Content-Type"] = "application/json"; }
  let r;
  try { r = await fetch(path, init); } catch { throw new ApiError(0, "You appear to be offline. Check your connection and try again."); }
  const isJson = (r.headers.get("Content-Type") || "").includes("json");
  const data = isJson ? await r.json().catch(() => ({})) : {};
  if (r.status === 401 && opts.authRedirect !== false) {
    location.href = "/login?next=" + encodeURIComponent(location.pathname + location.hash);
    throw new ApiError(401, data.error || "Signed out.");
  }
  if (!r.ok) throw new ApiError(r.status, data.error || `Request failed (${r.status}).`);
  return data;
}

let toastHost;
export function toast(msg, kind = "ok", ms = 4200) {
  if (!toastHost) { toastHost = document.createElement("div"); toastHost.className = "toasts"; toastHost.setAttribute("role", "status"); toastHost.setAttribute("aria-live", "polite"); document.body.append(toastHost); }
  const t = document.createElement("div");
  t.className = "toast" + (kind === "err" ? " err" : "");
  t.textContent = msg;
  toastHost.append(t);
  setTimeout(() => t.remove(), ms);
}

/** Modal dialog. `body` is HTML; resolves with the clicked action id or null. */
export function dialog({ title, body, actions = [{ id: "ok", label: "OK", kind: "primary" }], wide = false, onOpen }) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "dlg";
    if (wide) d.style.width = "min(860px, calc(100vw - 32px))";
    d.innerHTML = `<div class="dlg-head"><h3>${esc(title)}</h3><button class="btn btn-quiet btn-sm" data-x aria-label="Close">${ico("x")}</button></div>
      <div class="dlg-body">${body}</div>
      <div class="dlg-foot">${actions.map((a) => `<button class="btn btn-${a.kind || "ghost"}" data-a="${esc(a.id)}">${esc(a.label)}</button>`).join("")}</div>`;
    document.body.append(d);
    const done = (v) => { d.close(); d.remove(); resolve(v); };
    d.addEventListener("click", async (e) => {
      if (e.target.closest("[data-x]")) return done(null);
      const b = e.target.closest("[data-a]");
      if (!b) return;
      const a = actions.find((x) => x.id === b.dataset.a);
      if (a?.handler) {
        b.setAttribute("aria-busy", "true");
        try { const keep = await a.handler(d); if (keep === false) { b.removeAttribute("aria-busy"); return; } }
        catch (err) { toast(err.message, "err"); b.removeAttribute("aria-busy"); return; }
      }
      done(b.dataset.a);
    });
    d.addEventListener("cancel", (e) => { e.preventDefault(); done(null); });
    d.showModal();
    onOpen?.(d);
  });
}

export const confirmDialog = (title, text, label = "Confirm", danger = false) =>
  dialog({ title, body: `<p>${esc(text)}</p>`, actions: [{ id: "no", label: "Cancel" }, { id: "yes", label, kind: danger ? "danger" : "primary" }] }).then((v) => v === "yes");

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied."); }
  catch { toast("Copy is blocked by the browser. Select the text and copy it instead.", "err"); }
}

export const fmtDate = (iso, opts = { day: "numeric", month: "short", year: "numeric" }) => (iso ? new Date(iso).toLocaleDateString("en-IN", opts) : "—");
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
export const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) { btn.dataset.label = btn.innerHTML; btn.setAttribute("aria-busy", "true"); btn.disabled = true; btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(label || "Working…")}`; }
  else { btn.removeAttribute("aria-busy"); btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

export function formData(form) {
  const o = {};
  for (const [k, v] of new FormData(form)) o[k] = typeof v === "string" ? v.trim() : v;
  return o;
}

// Theme: follows the system unless the person picks one; remembered per browser.
export function initTheme() {
  try { const t = localStorage.getItem("ksa-theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
}
export function toggleTheme() {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("ksa-theme", next); } catch {}
  return next;
}
