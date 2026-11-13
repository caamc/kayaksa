// Kayakers table: the shared frame for Kayak's turn-based games (seats, Kayak AI players, turns,
// dice and shuffles, replay and a running log). Designed and developed by Kayak Strategic Advisors.
//
// Every game is a pure reducer over saved moves: a "start" op fixes the players and a random seed, and
// each "move" op is checked against whose turn it is before it's applied. Everyone's browser replays the
// same moves with the same seed, so all screens agree. Kayak AI players are run by the browser of the
// person who started the game.

export function rng(st) { // mulberry32 on the game state, so dice and shuffles replay identically
  st.r = (st.r + 0x6D2B79F5) | 0; let t = st.r;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const roll = (st, sides = 6) => 1 + Math.floor(rng(st) * sides);
export function shuffle(st, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const COLORS = ["#17807E", "#EE9B1E", "#2D6A9F", "#B4472F", "#5E4B78", "#4B7A4E"];
export const CNAMES = ["Teal", "Saffron", "Sky", "Clay", "Plum", "Olive"];
const clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

export function table(api, G) {
  const { root, conn, me, space, toast, esc } = api;
  const owner = space.created_by === me.id;
  root.innerHTML = `<div class="gm tb tb-${G.kind}"><div class="gm-stage"><div class="tb-stage" id="tbStage"></div></div>
    <aside class="gm-side"><div class="tb-brand"><h3>${esc(G.name)}</h3><small>Designed and developed by Kayak</small></div>
      <div class="gm-status" id="tbStatus">Connecting…</div><div class="gm-seats" id="tbSeats"></div><div id="tbSide"></div>
      <div class="gm-actions" id="tbActs"></div>
      <details class="tb-help"><summary>How to play</summary><div>${G.help}</div></details>
      <div class="tb-log" id="tbLog" aria-live="polite"></div></aside></div>${STYLE}`;
  let ops = [], seats = {}, st = null, started = null, aiBusy = false;
  // Games that need data before they can check moves (Wordsmith's dictionary) wait for it here.
  let ready = !G.ready;
  if (G.ready) G.ready.then(() => { ready = true; replay(); draw(); }, () => { $("#tbStatus").textContent = "The game couldn't load. Reload the page."; });
  const players = () => started?.players || [];
  const mySeat = () => players().findIndex((p) => !p.ai && p.id === me.id);
  const isHost = () => started && started.by === me.id;

  function replay() {
    st = null; started = null;
    if (!ready) return;
    const s = ops.find((o) => o.type === "start"); if (!s) return;
    started = s;
    let state = G.setup(s.players.length, s.seed, s.opts || {}, s.players.map((p) => p.name));
    state.log = state.log || [];
    let n = 1;
    for (const o of ops) {
      if (o.type !== "move" || o.n !== n + 1) continue;
      const t = G.turn(state); const p = s.players[t];
      if (!p || G.over(state)) continue;
      const allowed = p.ai ? o.ai && o.by === s.by : !o.ai && o.by === p.id;
      if (!allowed) continue;
      const next = G.apply(clone(state), o.move, t);
      if (!next) continue; // illegal move: ignored on every screen
      state = next; n++;
    }
    state.n = n; st = state;
  }
  const say = (st2) => { const l = (st2.log || []).slice(-40).reverse(); $("#tbLog").innerHTML = l.map((x) => `<div>${esc(x)}</div>`).join(""); };
  const $ = (s) => root.querySelector(s);

  function draw() {
    if (!ready) { $("#tbStatus").textContent = G.loading || "Loading…"; return; }
    const P = players(), over = st && G.over(st), t = st && !over ? G.turn(st) : -1, mine = mySeat();
    // Seats
    if (!started) {
      const max = G.max;
      $("#tbSeats").innerHTML = Array.from({ length: max }, (_, i) => { const k = "p" + (i + 1), who = seats[k];
        return `<div class="gm-seat"><span class="chip" style="background:${COLORS[i]}"></span><b>${who ? esc(who.name) : `<small>Seat ${i + 1} - free</small>`}</b>${who?.id === me.id ? `<button class="glass" data-leave>Leave</button>` : who ? "" : `<button class="glass" data-seat="${k}">Sit here</button>`}</div>`; }).join("");
      const humans = Object.keys(seats).filter((k) => /^p[1-6]$/.test(k)).length;
      const canStart = owner || Object.values(seats).some((v) => v.id === me.id);
      const defAi = space.mode === "ai" ? Math.max(1, G.min - Math.max(1, humans)) : Math.max(0, G.min - humans);
      $("#tbStatus").textContent = canStart ? "Choose players, then start." : "Take a seat to play.";
      $("#tbActs").innerHTML = canStart ? `<label class="tb-ai">Kayak AI players <select id="tbAi">${Array.from({ length: G.max }, (_, i) => `<option ${i === defAi ? "selected" : ""}>${i}</option>`).join("")}</select></label>${G.options ? G.options() : ""}<button class="glass p" id="tbStart">Start game</button>` : "";
      $("#tbStart") && ($("#tbStart").onclick = startGame);
      $("#tbStage").innerHTML = `<div class="tb-lobby">${G.cover ? G.cover() : ""}<h2>${esc(G.name)}</h2><p>${esc(G.tagline)}</p><p class="tb-small">${G.min === G.max ? `${G.min} players` : `${G.min} to ${G.max} players`} · colleagues and Kayak AI</p></div>`;
      $("#tbSide").innerHTML = "";
      $("#tbLog").innerHTML = "";
      return;
    }
    $("#tbSeats").innerHTML = P.map((p, i) => `<div class="gm-seat${i === t ? " turn" : ""}${over?.winners?.includes(i) ? " won" : ""}"><span class="chip" style="background:${COLORS[i]}"></span><b>${esc(p.name)}${i === mine ? " (you)" : ""}<br><small>${esc(G.seatInfo ? G.seatInfo(st, i) : CNAMES[i])}</small></b></div>`).join("");
    const status = $("#tbStatus"); status.classList.toggle("win", !!over);
    status.textContent = over ? over.text : aiBusy ? `${P[t].name} is thinking…` : `${P[t].name} to play${t === mine ? " · your turn" : ""}`;
    $("#tbActs").innerHTML = `<button class="glass" id="tbNew">New game</button>`;
    $("#tbNew").onclick = () => newGame();
    const ctx = { me: mine, myTurn: t === mine && !over, turn: t, players: P, colors: COLORS, act, toast, esc, side: (h) => ($("#tbSide").innerHTML = h), over };
    ctx.view = () => G.view(st, $("#tbStage"), ctx);
    G.view(st, $("#tbStage"), ctx);
    say(st);
    aiTurn();
  }
  let confirmT = 0;
  function newGame() {
    if (Date.now() - confirmT > 4000) { confirmT = Date.now(); return toast("Press New game again to start over for everyone."); }
    conn.reset();
  }
  function startGame() {
    const humans = Object.entries(seats).filter(([k]) => /^p[1-6]$/.test(k)).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ id: v.id, name: v.name }));
    if (!humans.length) humans.push({ id: me.id, name: me.name });
    const nAi = Number($("#tbAi")?.value || 0);
    const P = [...humans, ...Array.from({ length: nAi }, (_, i) => ({ ai: true, name: nAi > 1 ? `Kayak AI ${i + 1}` : "Kayak AI" }))].slice(0, G.max);
    if (P.length < G.min) return toast(`${G.name} needs at least ${G.min} players. Add Kayak AI players or ask colleagues to sit down.`);
    const opts = G.readOptions ? G.readOptions(root) : {};
    conn.op({ type: "start", players: P, seed: crypto.getRandomValues(new Uint32Array(1))[0] | 0, opts, by: me.id });
  }
  function act(move, ai = false) {
    if (!st) return;
    const t = G.turn(st), test = G.apply(clone(st), move, t);
    if (!test) return toast(G.illegal || "You can't do that now.");
    conn.op({ type: "move", move, n: st.n + 1, ai });
  }
  function aiTurn() {
    if (!st || !isHost() || aiBusy) return;
    const t = G.turn(st); if (G.over(st) || !players()[t]?.ai) return;
    aiBusy = true; const at = st.n;
    setTimeout(async () => {
      try { if (st.n === at) { const mv = await G.ai(clone(st), t); if (mv !== undefined && st.n === at) act(mv, true); } }
      finally { aiBusy = false; }
    }, G.aiDelay || 650);
  }
  root.addEventListener("click", (e) => { const s = e.target.closest("[data-seat]"); if (s) conn.seat(s.dataset.seat); if (e.target.closest("[data-leave]")) conn.leaveSeat(); });
  const take = (list) => { ops = list; replay(); draw(); };
  api.on("hello", (m) => { seats = m.seats || {}; take(m.ops || []); });
  api.on("op", (m) => { ops.push(m.op); replay(); draw(); });
  api.on("seats", (m) => { seats = m.seats; if (!started) draw(); });
  api.on("reset", (m) => { ops = []; replay(); draw(); toast(`${m.by} started a new game.`); });
  draw();
}

const STYLE = `<style>
.tb .gm-stage{overflow:auto}
.tb-stage{width:100%;height:100%;display:grid;place-items:safe center;min-height:0;padding:8px 0}
.tb-brand small{display:block;color:#8FA8AE;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;margin-top:2px}
.tb-lobby{text-align:center;color:#fff;display:grid;gap:8px;justify-items:center;max-width:520px;padding:20px}
.tb-lobby h2{margin:8px 0 0;font:800 2rem var(--display)}.tb-lobby p{margin:0;color:#C9D8DC}.tb-small{font-size:.85rem;color:#8FA8AE!important}
.tb-ai{display:flex;gap:8px;align-items:center;color:#C9D8DC;font-size:.88rem}.tb-ai select,.tb-opt select{border-radius:10px;border:1px solid #ffffff33;background:#0E2F3C;color:#fff;padding:6px 8px;font:inherit}
.tb-opt{display:flex;gap:8px;align-items:center;color:#C9D8DC;font-size:.88rem}
.tb-help{color:#C9D8DC;font-size:.85rem;line-height:1.5}.tb-help summary{cursor:pointer;font-weight:700;color:#fff}.tb-help ul{padding-left:18px;margin:6px 0}
.tb-log{font-size:.8rem;color:#A9C0C6;max-height:220px;overflow:auto;background:#00000026;border-radius:12px;padding:8px 10px;display:grid;gap:3px}
.tb-log:empty{display:none}
.gm-seat.won{border-color:#3FD09A;box-shadow:0 0 0 3px #3FD09A44}
.tb-dice{display:inline-grid;place-items:center;width:58px;height:58px;border-radius:14px;background:linear-gradient(160deg,#fff,#DCE7EA);color:#0E2F3C;font:800 1.7rem var(--display);box-shadow:0 8px 20px #0006,inset 0 -3px 0 #0002}
.tb-dice.rolling{animation:tbroll .5s ease}
@keyframes tbroll{0%{transform:rotate(0) scale(.8)}50%{transform:rotate(200deg) scale(1.1)}100%{transform:rotate(360deg) scale(1)}}
.tb-bar{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:14px;color:#fff}
.tb-card{border-radius:12px;padding:10px 12px;background:#ffffff12;border:1px solid #ffffff22;color:#fff}
</style>`;
