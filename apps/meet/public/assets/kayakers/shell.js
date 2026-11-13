// Kayakers shell: loads a space (whiteboard or game), keeps a live connection to its Durable Object
// and hands the module a small API. Kayak team only.
const $ = (s, el = document) => el.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function toast(t, ms = 3500) { const el = document.createElement("div"); el.className = "kx-toast"; el.textContent = t; $("#kxToasts").append(el); setTimeout(() => el.remove(), ms); }
const id = location.pathname.split("/").filter(Boolean).pop();

function connect(handlers) {
  let ws, tries = 0, alive = true, ping;
  const status = (s) => { const el = $("#kxStatus"); el.dataset.s = s; el.title = s === "on" ? "Live" : s === "off" ? "Reconnecting…" : "Connecting…"; };
  const open = () => {
    status("wait");
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/kayakers/ws/${id}`);
    ws.onopen = () => { tries = 0; status("on"); clearInterval(ping); ping = setInterval(() => ws.readyState === 1 && ws.send('{"t":"ping"}'), 25000); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } (handlers[m.t] || (() => {}))(m); };
    ws.onclose = (e) => { status("off"); clearInterval(ping); if (!alive) return; if (e.code === 1008 || e.code === 4003) return toast("You don't have access to this space."); setTimeout(open, Math.min(8000, 500 * 2 ** tries++)); };
  };
  open();
  const send = (m) => { if (ws?.readyState === 1) { ws.send(JSON.stringify(m)); return true; } toast("Reconnecting… try again in a moment."); return false; };
  return { op: (op) => send({ t: "op", op }), live: (data) => ws?.readyState === 1 && ws.send(JSON.stringify({ t: "live", data })), seat: (seat) => send({ t: "seat", seat }), leaveSeat: () => send({ t: "leaveSeat" }), reset: () => send({ t: "reset" }), close: () => { alive = false; ws?.close(); } };
}

function drawPeople(people) {
  const seen = new Map(); for (const p of people) seen.set(p.id.split(":")[0], p);
  $("#kxPeople").innerHTML = [...seen.values()].slice(0, 8).map((p) => `<span class="kx-av" style="background:${p.color}" title="${esc(p.name)}">${esc(p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span>`).join("") + (seen.size > 8 ? `<span class="kx-av more">+${seen.size - 8}</span>` : "");
}

(async () => {
  const r = await fetch(`/api/ws/kayakers/${id}`);
  if (r.status === 401) { location.href = `/login?next=${encodeURIComponent(location.pathname)}`; return; }
  if (!r.ok) { $("#kx").innerHTML = `<div class="kx-empty"><h2>This space isn't available</h2><p>It may have been removed, or Kayakers is for the Kayak team only.</p><a class="glass" href="/app">Back to Meet by Kayak</a></div>`; $("#kxTitle").textContent = "Kayakers"; return; }
  const { space, me } = await r.json();
  document.title = `${space.title} · Kayakers`;
  $("#kxTitle").textContent = space.title;
  const kindName = { board: "Whiteboard", chess: "Chess", carrom: "Carrom", four: "Kayak Four", snakes: "Snakes & Ladders", ludo: "Ludo", ttt: "Tic Tac Toe", estates: "Kayak Estates", flip: "Kayak Flip", words: "Kayak Wordsmith", rows: "Kayak Rows" }[space.kind];
  $("#kxSub").textContent = `${kindName}${space.kind !== "board" ? (space.mode === "ai" ? " · vs Kayak AI" : " · with colleagues") : ""} · by ${space.created_by_name || "a colleague"}`;
  $("#kxShare").onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast("Link copied. Colleagues who open it join you live."); } catch { toast(location.href, 8000); } };
  const mod = await import(`/assets/kayakers/${space.kind}.js`);
  const handlers = {};
  const api = { space, me, root: $("#kx"), toast, esc, on: (t, fn) => { const prev = handlers[t]; handlers[t] = (m) => { prev?.(m); fn(m); }; } };
  api.on("people", (m) => drawPeople(m.people));
  api.on("hello", (m) => drawPeople(m.people));
  api.on("error", (m) => toast(m.message));
  api.conn = connect(handlers);
  mod.mount(api);
})();
