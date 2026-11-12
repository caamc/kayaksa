// Kayak Four: drop discs into a 7 × 6 grid, first to line up four wins. Two colleagues, or one
// against Kayak AI (minimax with alpha-beta pruning, about 7 moves deep).
const COLS = 7, ROWS = 6;
export const empty = () => Array.from({ length: COLS }, () => []);
export function drop(g, c, who) { if (c < 0 || c >= COLS || g[c].length >= ROWS) return null; const n = g.map((col) => col.slice()); n[c].push(who); return n; }
const at = (g, c, r) => (c >= 0 && c < COLS && r >= 0 && r < ROWS ? g[c][r] || null : null);
export function winner(g) {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const p = at(g, c, r); if (!p) continue;
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const line = [[c, r]]; for (let k = 1; k < 4; k++) { if (at(g, c + dc * k, r + dr * k) !== p) break; line.push([c + dc * k, r + dr * k]); }
      if (line.length === 4) return { p, line };
    }
  }
  return g.every((col) => col.length === ROWS) ? { p: "draw", line: [] } : null;
}
function score(g, me) {
  const op = me === "a" ? "b" : "a"; let s = 0;
  for (let r = 0; r < ROWS; r++) if (at(g, 3, r) === me) s += 3; else if (at(g, 3, r) === op) s -= 3;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let m = 0, o = 0, e = 0;
    for (let k = 0; k < 4; k++) { const cc = c + dc * k, rr = r + dr * k; if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) { m = -9; break; } const v = at(g, cc, rr); if (v === me) m++; else if (v === op) o++; else e++; }
    if (m < 0) continue;
    if (m && !o) s += m === 3 ? 12 : m === 2 ? 3 : 0;
    if (o && !m) s -= o === 3 ? 14 : o === 2 ? 3 : 0;
  }
  return s;
}
const ORDER = [3, 2, 4, 1, 5, 0, 6];
function search(g, depth, a, b, turn, me) {
  const w = winner(g);
  if (w) return w.p === "draw" ? 0 : w.p === me ? 100000 + depth : -100000 - depth;
  if (!depth) return score(g, me);
  const next = turn === "a" ? "b" : "a";
  if (turn === me) { let v = -Infinity; for (const c of ORDER) { const n = drop(g, c, turn); if (!n) continue; v = Math.max(v, search(n, depth - 1, a, b, next, me)); a = Math.max(a, v); if (a >= b) break; } return v; }
  let v = Infinity; for (const c of ORDER) { const n = drop(g, c, turn); if (!n) continue; v = Math.min(v, search(n, depth - 1, a, b, next, me)); b = Math.min(b, v); if (a >= b) break; } return v;
}
export function bestColumn(g, me, depth = 7) {
  let best = null, bv = -Infinity; const next = me === "a" ? "b" : "a";
  for (const c of ORDER) { const n = drop(g, c, me); if (!n) continue; const v = search(n, depth - 1, -Infinity, Infinity, next, me); if (v > bv) { bv = v; best = c; } }
  return best;
}
const turnOf = (g) => (g.reduce((n, col) => n + col.length, 0) % 2 ? "b" : "a");

export function mount(api) {
  const { root, conn, me, space, toast, esc } = api;
  const ai = space.mode === "ai", owner = space.created_by === me.id;
  root.innerHTML = `<div class="gm"><div class="gm-stage"><div class="k4" id="k4" role="grid" aria-label="Kayak Four board"></div></div>
    <aside class="gm-side"><h3>Kayak Four</h3><div class="gm-status" id="fst">Connecting…</div><div class="gm-seats" id="fseats"></div>
      <div class="gm-actions"><button class="glass" id="fnew">New game</button></div>
      <p class="gm-note">Drop discs by clicking a column. Line up four in a row — across, down or diagonally — to win. ${ai ? (owner ? "You play teal and go first; Kayak AI plays saffron." : `${esc(space.created_by_name || "A colleague")} is playing Kayak AI. You are watching live.`) : "Take a seat to play; everyone else watches live."}</p></aside></div>
    <style>
      .k4{--s:min(calc((100vh - 150px) / 6.6),calc((100vw - 400px) / 7.4),92px);display:grid;grid-template-columns:repeat(7,var(--s));gap:calc(var(--s) * .12);padding:calc(var(--s) * .22);border-radius:28px;background:linear-gradient(160deg,#1D6F8A,#0E3B4C);box-shadow:0 40px 90px #000a,inset 0 2px 0 #ffffff33}
      @media (max-width:900px){.k4{--s:min(calc((100vw - 60px) / 8),60px)}}
      .k4 .col{display:grid;grid-template-rows:repeat(6,var(--s));gap:calc(var(--s) * .12);cursor:pointer;border-radius:999px;transition:background .2s}
      .k4 .col:hover{background:#ffffff14}
      .k4 .h{border-radius:50%;background:#06212C;box-shadow:inset 0 6px 12px #000a}
      .k4 .h.a,.k4 .h.b{animation:k4drop .38s cubic-bezier(.3,1.4,.6,1) both}
      .k4 .h.a{background:radial-gradient(circle at 35% 30%,#7FE3DF,#17807E 60%,#0C5250);box-shadow:inset 0 -4px 8px #0006,0 2px 6px #0007}
      .k4 .h.b{background:radial-gradient(circle at 35% 30%,#FFE0A0,#EE9B1E 60%,#B26A08);box-shadow:inset 0 -4px 8px #0006,0 2px 6px #0007}
      .k4 .h.win{outline:4px solid #fff;outline-offset:-4px}
      .k4 .h.old{animation:none}
      @keyframes k4drop{from{transform:translateY(calc(var(--s) * -6))}}
    </style>`;
  let moves = [], seats = {}, g = empty(), thinking = false, shown = 0;
  const rebuild = () => { g = empty(); for (const c of moves) { const n = drop(g, c, turnOf(g)); if (n) g = n; } };
  const label = (k) => (ai && k === "b" ? "Kayak AI" : ai && k === "a" ? space.created_by_name || "Player" : seats[k === "a" ? "p1" : "p2"]?.name || null);
  const mine = () => (ai ? (owner ? "a" : null) : seats.p1?.id === me.id ? "a" : seats.p2?.id === me.id ? "b" : null);
  function draw() {
    const lastC = moves[moves.length - 1], w = winner(g), win = new Set((w?.line || []).map(([c, r]) => c + ":" + r)), total = moves.length;
    root.querySelector("#k4").innerHTML = Array.from({ length: COLS }, (_, c) => `<div class="col" data-c="${c}" role="button" aria-label="Column ${c + 1}">${Array.from({ length: ROWS }, (_, i) => { const r = ROWS - 1 - i, p = at(g, c, r); return `<div class="h${p ? " " + p : ""}${win.has(c + ":" + r) ? " win" : ""}${p && !(shown < total && c === lastC && r === g[c].length - 1) ? " old" : ""}"></div>`; }).join("")}</div>`).join("");
    shown = total;
    const st = root.querySelector("#fst"), t = turnOf(g);
    st.classList.toggle("win", !!w);
    st.textContent = w ? (w.p === "draw" ? "It's a draw!" : `${label(w.p) || (w.p === "a" ? "Teal" : "Saffron")} wins!`) : thinking ? "Kayak AI is thinking…" : `${label(t) || (t === "a" ? "Teal" : "Saffron")} to play${mine() === t ? " · your turn" : ""}`;
    root.querySelector("#fseats").innerHTML = [["p1", "a", "Teal", "#17807E"], ["p2", "b", "Saffron", "#EE9B1E"]].map(([k, c, l, col]) => {
      const who = label(c);
      return `<div class="gm-seat${!w && t === c ? " turn" : ""}"><span class="chip" style="background:${col}"></span><b>${who ? esc(who) : `<small>${l} — free</small>`}<br><small>${l}</small></b>${!ai ? (seats[k]?.id === me.id ? `<button class="glass" data-leave>Leave</button>` : !seats[k] ? `<button class="glass p" data-seat="${k}">Play</button>` : "") : ""}</div>`;
    }).join("");
  }
  function aiTurn() {
    if (!ai || !owner || winner(g) || turnOf(g) !== "b" || thinking) return;
    thinking = true; draw();
    setTimeout(() => { const c = bestColumn(g, "b"); thinking = false; if (c !== null) play(c, true); }, 380);
  }
  function play(c, byAi = false) {
    if (!drop(g, c, turnOf(g))) return toast("That column is full.");
    moves.push(c); rebuild(); draw();
    conn.op({ type: "drop", c, n: moves.length, ai: byAi });
    aiTurn();
  }
  root.querySelector("#k4").addEventListener("click", (e) => {
    const col = e.target.closest("[data-c]"); if (!col) return;
    if (winner(g)) return toast("Start a new game.");
    const m = mine(); if (!m) return toast(ai ? "You are watching this game." : "Take a seat to play.");
    if (turnOf(g) !== m) return toast("Wait for your turn.");
    play(+col.dataset.c);
  });
  root.addEventListener("click", (e) => { const s = e.target.closest("[data-seat]"); if (s) conn.seat(s.dataset.seat); if (e.target.closest("[data-leave]")) conn.leaveSeat(); });
  root.querySelector("#fnew").onclick = () => { if (confirm("Start a new game for everyone?")) conn.reset(); };
  const fromOps = (ops) => { const out = []; for (const o of ops) if (o.type === "drop" && o.n === out.length + 1) out.push(o.c); return out; };
  api.on("hello", (m) => { seats = m.seats || {}; moves = fromOps(m.ops); rebuild(); shown = moves.length; draw(); aiTurn(); });
  api.on("op", (m) => { const o = m.op; if (o.type !== "drop") return; if (o.n === moves.length + 1) { moves.push(o.c); rebuild(); draw(); aiTurn(); } });
  api.on("seats", (m) => { seats = m.seats; draw(); });
  api.on("reset", (m) => { moves = []; rebuild(); shown = 0; draw(); toast(`${m.by} started a new game.`); aiTurn(); });
  draw();
}
