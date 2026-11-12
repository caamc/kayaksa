import { $, $$, api, esc, html, raw, ico, wordmark, toast, initTheme, toggleTheme } from "/_shared/js/ui.js";

initTheme();

export const NAV = [
  { group: "Workspace", items: [
    { id: "home", label: "Home", icon: "home" },
    { id: "digital", label: "Digital Dashboard", icon: "activity" },
    { id: "updates", label: "Kayakers Update", icon: "send" },
    { id: "meet", label: "Kayak Meet", icon: "play" },
    { id: "brand", label: "Brand Portal", icon: "brand" },
    { id: "tools", label: "Kayak Tools", icon: "tools" },
    { id: "clienttools", label: "Client Tools", icon: "grid" },
  ] },
  { group: "Studio", items: [
    { id: "studio", label: "Kayak Studio", icon: "sun" },
    { id: "ai", label: "Kayak AI", icon: "spark" },
    { id: "board", label: "Whiteboard", icon: "palette" },
    { id: "briefs", label: "Briefing studio", icon: "briefcase" },
    { id: "confluence", label: "Confluence", icon: "book" },
    { id: "cards", label: "Business Cards", icon: "card" },
    { id: "decks", label: "Presentations", icon: "slides" },
    { id: "store", label: "Kayakers Store", icon: "pin" },
  ] },
  { group: "Governance", items: [{ id: "launch", label: "Launch monitor", icon: "clock" }, { id: "certs", label: "Certifications", icon: "award" }] },
  { group: "Grow & Connect", items: [{ id: "network", label: "Kayak Network", icon: "network" }, { id: "website", label: "Website & competitors", icon: "globe" }, { id: "learn", label: "Kayak Learn", icon: "learn" }] },
  { group: "HR & Admin", items: [{ id: "roles", label: "Roles & responsibilities", icon: "briefcase" }, { id: "masters", label: "People Masters", icon: "lock" }, { id: "drive", label: "Document Drive", icon: "folder" }] },
  { group: "Administration", admin: true, items: [{ id: "admin", label: "People & access", icon: "users" }, { id: "brain", label: "Kayak AI memory", icon: "key" }, { id: "sales", label: "Learn sales", icon: "briefcase" }, { id: "security", label: "Security", icon: "shield" }, { id: "audit", label: "Audit log", icon: "activity" }] },
];

const VIEWS = { home: "home", digital: "digital", updates: "updates", meet: "meet", confluence: "confluence", brand: "brand", tools: "tools", clienttools: "clienttools", network: "network", studio: "studio", ai: "ai", board: "board", briefs: "briefs", cards: "cards", decks: "decks", store: "store", launch: "launch", certs: "certs", learn: "learn", website: "website", roles: "roles", masters: "masters", drive: "drive", security: "security", sales: "sales", admin: "admin", brain: "brain", audit: "security", account: "account" };

export const state = { me: null };

function initials(n, e) {
  const s = (n || e || "?").trim().split(/\s+/);
  return ((s[0]?.[0] || "") + (s.length > 1 ? s[s.length - 1][0] : "")).toUpperCase();
}

function shell() {
  $("#logo").innerHTML = `${wordmark(22)}<span class="sub">Internal</span>`;
  const me = state.me;
  $("#who").innerHTML = String(html`<span class="avatar">${initials(me.name, me.email)}</span><span class="meta">${me.name || me.email}<small>${me.title || ({ superadmin: "SuperAdmin", admin: "Administrator", editor: "Editor", employee: "Employee" })[me.role]}</small></span>`);
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
  import("/app/fab.js").then((m) => m.mount(state.me)).catch(() => {});
  window.addEventListener("hashchange", route);
  if (!location.hash) location.replace("#/home");
  else route();
  const left = sessionStorage.getItem("ksa-recovery-warning");
  if (left) { sessionStorage.removeItem("ksa-recovery-warning"); toast(`You have ${left} recovery codes left. Create new ones in My account.`, "err", 9000); }
})();
