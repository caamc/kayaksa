import { $, $$, api, esc, html, raw, ico, wordmark, toast, initTheme, toggleTheme } from "/_shared/js/ui.js";

initTheme();

export const NAV = [
  { group: "Workspace", items: [
    { id: "home", label: "Home", icon: "home" },
    { id: "brand", label: "Brand Portal", icon: "brand" },
    { id: "tools", label: "Kayak Tools", icon: "tools" },
    { id: "network", label: "Kayak Network", icon: "network" },
  ] },
  { group: "Studio", items: [
    { id: "ai", label: "Kayak AI", icon: "spark" },
    { id: "cards", label: "Business Cards", icon: "card" },
    { id: "decks", label: "Presentations", icon: "slides" },
  ] },
  { group: "Grow", items: [{ id: "learn", label: "Kayak Learn", icon: "learn" }] },
  { group: "Administration", admin: true, items: [{ id: "admin", label: "People & access", icon: "users" }, { id: "audit", label: "Audit log", icon: "activity" }] },
];

const VIEWS = { home: "home", brand: "brand", tools: "tools", network: "network", ai: "ai", cards: "cards", decks: "decks", learn: "learn", admin: "admin", audit: "admin", account: "account" };

export const state = { me: null };

function initials(n, e) {
  const s = (n || e || "?").trim().split(/\s+/);
  return ((s[0]?.[0] || "") + (s.length > 1 ? s[s.length - 1][0] : "")).toUpperCase();
}

function shell() {
  $("#logo").innerHTML = `${wordmark(22)}<span class="sub">Internal</span>`;
  const me = state.me;
  $("#who").innerHTML = String(html`<span class="avatar">${initials(me.name, me.email)}</span><span class="meta">${me.name || me.email}<small>${me.title || me.role}</small></span>`);
  $("#side").innerHTML = NAV.filter((g) => !g.admin || me.can.admin)
    .map((g) => `<div class="grp">${esc(g.group)}</div>` + g.items.map((i) => `<a href="#/${i.id}" data-id="${i.id}">${ico(i.icon)}<span>${esc(i.label)}</span></a>`).join(""))
    .join("") + `<a href="#/account" data-id="account">${ico("settings")}<span>My account</span></a><a href="#" id="signout">${ico("logout")}<span>Sign out</span></a>
    <div class="foot">Kayak Strategic Advisors · Mumbai · Thane<br>Confidential: for Kayak staff only.</div>`;
  $("#signout").onclick = async (e) => { e.preventDefault(); await api("/api/auth/logout", { body: {} }).catch(() => {}); location.href = "/login"; };
  const side = $("#side"), btn = $("#menu");
  const close = () => { side.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); $(".side-backdrop")?.remove(); };
  btn.onclick = () => {
    const open = !side.classList.contains("open");
    side.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) { const b = document.createElement("div"); b.className = "side-backdrop"; b.onclick = close; document.body.append(b); } else close();
  };
  side.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
  $("#theme").onclick = () => { const t = toggleTheme(); $("#theme").innerHTML = String(ico(t === "dark" ? "sun" : "moon")); };
}

export function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [p, q = ""] = h.split("?");
  const parts = p.split("/").filter(Boolean);
  return { view: parts[0] || "home", rest: parts.slice(1), query: new URLSearchParams(q) };
}

let current = 0;
async function route() {
  const r = parseHash();
  const name = VIEWS[r.view] ? r.view : "home";
  $$("#side a[data-id]").forEach((a) => (a.dataset.id === name ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  const main = $("#main");
  const token = ++current;
  main.innerHTML = `<div class="page"><div class="row muted"><span class="spinner"></span> Loading…</div></div>`;
  try {
    const mod = await import(`/app/views/${VIEWS[name]}.js`);
    if (token !== current) return;
    await mod.render(main, { ...r, view: name, me: state.me });
    const title = NAV.flatMap((g) => g.items).find((i) => i.id === name)?.label || (name === "account" ? "My account" : "Home");
    document.title = `${title} · Kayak Internal`;
    if (r.view !== "ai") main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    if (token !== current) return;
    main.innerHTML = String(html`<div class="page"><div class="note danger">${e.message || "This page could not load."}</div></div>`);
  }
}

(async () => {
  try { state.me = await api("/api/me"); } catch { return; }
  shell();
  window.addEventListener("hashchange", route);
  if (!location.hash) location.replace("#/home");
  else route();
  const left = sessionStorage.getItem("ksa-recovery-warning");
  if (left) { sessionStorage.removeItem("ksa-recovery-warning"); toast(`You have ${left} recovery codes left. Create new ones in My account.`, "err", 9000); }
})();
