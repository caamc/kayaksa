// Chess for Kayakers: play a colleague live, or Kayak AI. Full rules (castling, en passant, promotion,
// check, checkmate, stalemate, fifty-move and insufficient material). Moves are saved by the space, so
// anyone who opens the link sees the game as it stands and can watch.
const FILES = "abcdefgh";
const sq = (s) => FILES.indexOf(s[0]) + (8 - +s[1]) * 8; // a8 = 0 ... h1 = 63
const name = (i) => FILES[i % 8] + (8 - Math.floor(i / 8));
const white = (p) => p && p === p.toUpperCase();
const colorOf = (p) => (p ? (white(p) ? "w" : "b") : null);
const START = "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR";
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export function newGame() { return { b: START.split("").map((c) => (c === "." ? null : c)), turn: "w", castle: "KQkq", ep: -1, half: 0, full: 1, hist: [] }; }
const clone = (g) => ({ b: g.b.slice(), turn: g.turn, castle: g.castle, ep: g.ep, half: g.half, full: g.full, hist: g.hist });
const DIRS = { n: [-17, -15, -10, -6, 6, 10, 15, 17], b: [-9, -7, 7, 9], r: [-8, -1, 1, 8], q: [-9, -8, -7, -1, 1, 7, 8, 9], k: [-9, -8, -7, -1, 1, 7, 8, 9] };
const fileD = (a, b) => Math.abs((a % 8) - (b % 8));

function attacked(b, i, by) { // is square i attacked by colour `by`?
  const pd = by === "w" ? 1 : -1; // pawns attack from the opposite direction
  for (const d of [7, 9]) { const j = i + d * pd; if (j >= 0 && j < 64 && fileD(i, j) === 1 && b[j] === (by === "w" ? "P" : "p")) return true; }
  for (const d of DIRS.n) { const j = i + d; if (j >= 0 && j < 64 && fileD(i, j) <= 2 && b[j] === (by === "w" ? "N" : "n")) return true; }
  for (const d of DIRS.k) { const j = i + d; if (j >= 0 && j < 64 && fileD(i, j) <= 1 && b[j] === (by === "w" ? "K" : "k")) return true; }
  for (const [ds, ps] of [[DIRS.b, "bq"], [DIRS.r, "rq"]]) for (const d of ds) {
    let j = i;
    for (;;) { const k = j + d; if (k < 0 || k > 63 || fileD(j, k) > 1) break; j = k; const p = b[j]; if (p) { if (colorOf(p) === by && ps.includes(p.toLowerCase())) return true; break; } }
  }
  return false;
}
const kingAt = (b, c) => b.indexOf(c === "w" ? "K" : "k");
export const inCheck = (g, c = g.turn) => attacked(g.b, kingAt(g.b, c), c === "w" ? "b" : "w");

function pseudo(g) {
  const out = [], b = g.b, me = g.turn, them = me === "w" ? "b" : "w";
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || colorOf(p) !== me) continue;
    const t = p.toLowerCase();
    if (t === "p") {
      const f = me === "w" ? -8 : 8, start = me === "w" ? 6 : 1, last = me === "w" ? 0 : 7;
      const one = i + f;
      const push = (to, extra = {}) => { if (Math.floor(to / 8) === last) for (const pr of "qrbn") out.push({ from: i, to, promo: pr, ...extra }); else out.push({ from: i, to, ...extra }); };
      if (one >= 0 && one < 64 && !b[one]) { push(one); if (Math.floor(i / 8) === start && !b[one + f]) out.push({ from: i, to: one + f, double: true }); }
      for (const d of [f - 1, f + 1]) { const to = i + d; if (to < 0 || to > 63 || fileD(i, to) !== 1) continue; if (b[to] && colorOf(b[to]) === them) push(to); else if (to === g.ep) out.push({ from: i, to, ep: true }); }
    } else if (t === "n" || t === "k") {
      for (const d of DIRS[t]) { const to = i + d; if (to < 0 || to > 63 || fileD(i, to) > (t === "n" ? 2 : 1)) continue; if (!b[to] || colorOf(b[to]) === them) out.push({ from: i, to }); }
      if (t === "k") {
        const home = me === "w" ? 60 : 4;
        if (i === home && !attacked(b, i, them)) {
          if (g.castle.includes(me === "w" ? "K" : "k") && !b[i + 1] && !b[i + 2] && !attacked(b, i + 1, them) && !attacked(b, i + 2, them)) out.push({ from: i, to: i + 2, castle: "k" });
          if (g.castle.includes(me === "w" ? "Q" : "q") && !b[i - 1] && !b[i - 2] && !b[i - 3] && !attacked(b, i - 1, them) && !attacked(b, i - 2, them)) out.push({ from: i, to: i - 2, castle: "q" });
        }
      }
    } else {
      for (const d of DIRS[t]) { let j = i; for (;;) { const k = j + d; if (k < 0 || k > 63 || fileD(j, k) > 1) break; j = k; if (!b[j]) out.push({ from: i, to: j }); else { if (colorOf(b[j]) === them) out.push({ from: i, to: j }); break; } } }
    }
  }
  return out;
}
export function play(g, m) {
  const n = clone(g), b = n.b, p = b[m.from], t = p.toLowerCase(), cap = b[m.to];
  b[m.to] = m.promo ? (white(p) ? m.promo.toUpperCase() : m.promo) : p; b[m.from] = null;
  if (m.ep) b[m.to + (white(p) ? 8 : -8)] = null;
  if (m.castle === "k") { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
  if (m.castle === "q") { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }
  let c = n.castle;
  if (t === "k") c = c.replace(white(p) ? /[KQ]/g : /[kq]/g, "");
  for (const [s, f] of [[63, "K"], [56, "Q"], [7, "k"], [0, "q"]]) if (m.from === s || m.to === s) c = c.replace(f, "");
  n.castle = c; n.ep = m.double ? (m.from + m.to) / 2 : -1;
  n.half = t === "p" || cap || m.ep ? 0 : n.half + 1;
  if (n.turn === "b") n.full++;
  n.turn = n.turn === "w" ? "b" : "w";
  return n;
}
export function legal(g) { return pseudo(g).filter((m) => { const n = play(g, m); return !attacked(n.b, kingAt(n.b, g.turn), n.turn); }); }
function insufficient(b) { const p = b.filter(Boolean).map((x) => x.toLowerCase()).sort().join(""); return ["kk", "bkk", "kkn"].includes(p); }
export function status(g) {
  const ms = legal(g);
  if (!ms.length) return inCheck(g) ? { over: true, text: `Checkmate · ${g.turn === "w" ? "Black" : "White"} wins`, winner: g.turn === "w" ? "b" : "w" } : { over: true, text: "Stalemate · draw" };
  if (g.half >= 100) return { over: true, text: "Draw · fifty-move rule" };
  if (insufficient(g.b)) return { over: true, text: "Draw · insufficient material" };
  return { over: false, text: `${g.turn === "w" ? "White" : "Black"} to move${inCheck(g) ? " · check!" : ""}` };
}

// ---------------- Kayak AI: alpha-beta search with piece-square tables
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const PST = {
  p: [0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
};
function evaluate(g) { // from the side to move
  let s = 0;
  for (let i = 0; i < 64; i++) { const p = g.b[i]; if (!p) continue; const t = p.toLowerCase(); const v = VAL[t] + PST[t][white(p) ? i : (7 - Math.floor(i / 8)) * 8 + (i % 8)]; s += white(p) ? v : -v; }
  return g.turn === "w" ? s : -s;
}
const order = (g, ms) => ms.map((m) => ({ m, k: (g.b[m.to] ? VAL[g.b[m.to].toLowerCase()] * 10 - VAL[g.b[m.from].toLowerCase()] : 0) + (m.promo ? 800 : 0) })).sort((a, b) => b.k - a.k).map((x) => x.m);
function search(g, depth, alpha, beta, deadline, ply = 0) {
  if (Date.now() > deadline) throw "time";
  if (depth === 0) return quiesce(g, alpha, beta, 4);
  const ms = legal(g);
  if (!ms.length) return inCheck(g) ? -100000 + ply : 0;
  for (const m of order(g, ms)) { const v = -search(play(g, m), depth - 1, -beta, -alpha, deadline, ply + 1); if (v >= beta) return beta; if (v > alpha) alpha = v; }
  return alpha;
}
function quiesce(g, alpha, beta, d) {
  const stand = evaluate(g); if (stand >= beta) return beta; if (stand > alpha) alpha = stand; if (!d) return alpha;
  for (const m of order(g, pseudo(g).filter((m) => g.b[m.to] || m.promo))) { const n = play(g, m); if (attacked(n.b, kingAt(n.b, g.turn), n.turn)) continue; const v = -quiesce(n, -beta, -alpha, d - 1); if (v >= beta) return beta; if (v > alpha) alpha = v; }
  return alpha;
}
export function bestMove(g, ms = 900) {
  const moves = order(g, legal(g)); if (!moves.length) return null;
  const deadline = Date.now() + ms; let best = moves[0];
  for (let depth = 1; depth <= 5; depth++) {
    try {
      let alpha = -Infinity, pick = best;
      for (const m of [best, ...moves.filter((x) => x !== best)]) { const v = -search(play(g, m), depth - 1, -Infinity, -alpha, deadline); if (v > alpha) { alpha = v; pick = m; } }
      best = pick;
    } catch (e) { if (e === "time") break; throw e; }
  }
  return best;
}

// ---------------- the game screen
export function mount(api) {
  const { root, conn, me, space, toast, esc } = api;
  root.innerHTML = `<div class="gm"><div class="gm-stage"><div class="cb" id="cb" role="grid" aria-label="Chess board"></div></div>
    <aside class="gm-side"><h3>Chess</h3><div class="gm-status" id="cst">Connecting…</div><div class="gm-seats" id="cseats"></div>
      <div><b style="font-size:.85rem;color:#A9C0C6">Moves</b><div class="gm-moves" id="cmoves"></div></div>
      <div class="gm-actions"><button class="glass" id="cnew">New game</button><button class="glass" id="cflip">Flip board</button></div>
      <p class="gm-note">${space.mode === "ai" ? (space.created_by === me.id ? "You play White against Kayak AI. It thinks for about a second." : `${esc(space.created_by_name || "A colleague")} is playing Kayak AI. You are watching live.`) : "Take a seat to play. Everyone else watches live. Moves are saved - come back any time."}</p></aside></div>
    <style>
      .cb{--s:min(calc((100vh - 120px) / 8),calc((100vw - 380px) / 8),84px);display:grid;grid-template-columns:repeat(8,var(--s));grid-template-rows:repeat(8,var(--s));border-radius:16px;overflow:hidden;box-shadow:0 40px 90px #000a,0 0 0 10px #ffffff12;user-select:none}
      @media (max-width:900px){.cb{--s:min(calc((100vw - 40px) / 8),64px)}}
      .cb .q{position:relative;display:grid;place-items:center;font-size:calc(var(--s) * .74);line-height:1;cursor:pointer}
      .cb .q.l{background:#EAF1EE}.cb .q.d{background:#5E8F8C}
      .cb .q.last{box-shadow:inset 0 0 0 999px #EE9B1E4d}
      .cb .q.sel{box-shadow:inset 0 0 0 999px #17807E73}
      .cb .q.chk{background:radial-gradient(circle,#E5484D 0%,#E5484Daa 40%,transparent 70%)}
      .cb .q .dot{position:absolute;width:28%;height:28%;border-radius:50%;background:#0E2F3C55}
      .cb .q .ring{position:absolute;inset:6%;border-radius:50%;box-shadow:inset 0 0 0 calc(var(--s) * .07) #0E2F3C55}
      .cb .pc{transition:transform .18s ease}
      .cb .pc.w{color:#fff;text-shadow:0 0 1px #0E2F3C,0 1px 0 #0E2F3C,1px 0 0 #0E2F3C,-1px 0 0 #0E2F3C,0 -1px 0 #0E2F3C,0 4px 8px #0006}
      .cb .pc.b{color:#0E2F3C;text-shadow:0 1px 0 #ffffff66,0 4px 8px #0005}
      .cb .crd{position:absolute;font:700 calc(var(--s) * .15) var(--sans);opacity:.7}
      .cb .crd.f{right:4px;bottom:2px}.cb .crd.r{left:4px;top:2px}
      .cb .q.l .crd{color:#5E8F8C}.cb .q.d .crd{color:#EAF1EE}
      .promo{position:fixed;inset:0;display:grid;place-items:center;background:#06171E99;z-index:20}
      .promo div{display:flex;gap:10px;padding:14px;border-radius:24px;background:#ffffffe6;box-shadow:0 30px 80px #0008}
      .promo button{all:unset;cursor:pointer;width:72px;height:72px;border-radius:18px;display:grid;place-items:center;font-size:52px;color:#0E2F3C}
      .promo button:hover{background:#17807E22}
    </style>`;
  let ops = [], seats = {}, g = newGame(), sel = null, flip = false, thinking = false, lastMove = null;
  const seatName = (k) => (space.mode === "ai" ? (k === "b" ? "Kayak AI" : space.created_by_name || "Player") : seats[k]?.name || null);
  const myColor = () => (space.mode === "ai" ? (space.created_by === me.id ? "w" : null) : seats.w?.id === me.id ? "w" : seats.b?.id === me.id ? "b" : null);
  const rebuild = () => {
    g = newGame(); lastMove = null;
    const list = [];
    for (const op of ops) {
      if (op.type !== "move") continue;
      const m = legal(g).find((x) => x.from === op.from && x.to === op.to && (x.promo || null) === (op.promo || null));
      if (!m) continue; // ignore anything illegal
      list.push(`${name(m.from)}–${name(m.to)}${m.promo ? "=" + m.promo.toUpperCase() : ""}`);
      g = play(g, m); lastMove = m;
    }
    g.hist = list;
  };
  const draw = () => {
    const st = status(g), mine = myColor(), ms = sel !== null ? legal(g).filter((m) => m.from === sel) : [];
    const kingChk = inCheck(g) ? kingAt(g.b, g.turn) : -1;
    const cells = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const i = flip ? (7 - r) * 8 + (7 - f) : r * 8 + f;
      const p = g.b[i], target = ms.find((m) => m.to === i);
      cells.push(`<div class="q ${(Math.floor(i / 8) + (i % 8)) % 2 ? "d" : "l"}${lastMove && (lastMove.from === i || lastMove.to === i) ? " last" : ""}${sel === i ? " sel" : ""}${i === kingChk ? " chk" : ""}" data-i="${i}" role="gridcell" aria-label="${name(i)}${p ? " " + (white(p) ? "white " : "black ") + p.toLowerCase() : ""}">
        ${p ? `<span class="pc ${white(p) ? "w" : "b"}">${GLYPH[p.toLowerCase()]}</span>` : ""}${target ? `<span class="${p ? "ring" : "dot"}"></span>` : ""}
        ${(flip ? r === 0 : r === 7) ? `<span class="crd f">${FILES[i % 8]}</span>` : ""}${(flip ? f === 7 : f === 0) ? `<span class="crd r">${8 - Math.floor(i / 8)}</span>` : ""}</div>`);
    }
    root.querySelector("#cb").innerHTML = cells.join("");
    const s = root.querySelector("#cst"); s.textContent = thinking ? "Kayak AI is thinking…" : st.text + (!st.over && mine && g.turn === mine ? " · your move" : ""); s.classList.toggle("win", !!st.over);
    root.querySelector("#cseats").innerHTML = [["w", "White", "#fff"], ["b", "Black", "#0E2F3C"]].map(([k, l, c]) => {
      const who = seatName(k);
      return `<div class="gm-seat${g.turn === k && !st.over ? " turn" : ""}"><span class="chip" style="background:${c};border:2px solid #ffffff55"></span><b>${who ? esc(who) : `<small>${l} - free</small>`}</b>${space.mode !== "ai" ? (seats[k]?.id === me.id ? `<button class="glass" data-leave>Leave</button>` : !seats[k] ? `<button class="glass p" data-seat="${k}">Play ${l}</button>` : "") : ""}</div>`;
    }).join("");
    const mv = g.hist; root.querySelector("#cmoves").innerHTML = mv.length ? mv.reduce((a, x, i) => a + (i % 2 ? `<span>${x}</span>` : `<span>${i / 2 + 1}.</span><span>${x}</span>`), "") + (mv.length % 2 ? "<span></span>" : "") : `<span style="grid-column:1/-1">No moves yet</span>`;
    const el = root.querySelector("#cmoves"); el.scrollTop = el.scrollHeight;
  };
  const tryMove = async (from, to) => {
    const cands = legal(g).filter((m) => m.from === from && m.to === to); if (!cands.length) return false;
    let m = cands[0];
    if (cands.length > 1) { const pr = await choosePromo(g.turn); m = cands.find((x) => x.promo === pr) || cands[0]; }
    conn.op({ type: "move", from: m.from, to: m.to, promo: m.promo || null });
    ops.push({ type: "move", from: m.from, to: m.to, promo: m.promo || null, local: true }); rebuild(); sel = null; draw();
    return true;
  };
  const choosePromo = (c) => new Promise((res) => { const d = document.createElement("div"); d.className = "promo"; d.innerHTML = `<div>${"qrbn".split("").map((p) => `<button data-p="${p}" aria-label="Promote">${GLYPH[p]}</button>`).join("")}</div>`; document.body.append(d); d.onclick = (e) => { const b = e.target.closest("[data-p]"); if (b) { d.remove(); res(b.dataset.p); } }; });
  const aiTurn = () => {
    if (space.mode !== "ai" || space.created_by !== me.id || g.turn !== "b" || status(g).over || thinking) return;
    thinking = true; draw();
    setTimeout(() => { const m = bestMove(g, 900); thinking = false; if (m) { conn.op({ type: "move", from: m.from, to: m.to, promo: m.promo || null, ai: true }); ops.push({ type: "move", from: m.from, to: m.to, promo: m.promo || null, local: true }); rebuild(); } draw(); }, 350);
  };
  root.querySelector("#cb").addEventListener("click", (e) => {
    const q = e.target.closest("[data-i]"); if (!q) return;
    const i = +q.dataset.i, mine = myColor();
    if (status(g).over) return;
    if (!mine) return toast(space.mode === "ai" ? "You are watching this game." : "Take a seat to play.");
    if (g.turn !== mine) return toast("Wait for your turn.");
    if (sel !== null && sel !== i && legal(g).some((m) => m.from === sel && m.to === i)) { tryMove(sel, i).then(() => aiTurn()); return; }
    sel = g.b[i] && colorOf(g.b[i]) === mine ? (sel === i ? null : i) : null; draw();
  });
  // drag and drop
  let drag = null;
  root.querySelector("#cb").addEventListener("pointerdown", (e) => { const q = e.target.closest("[data-i]"); if (!q) return; const i = +q.dataset.i; if (g.b[i] && colorOf(g.b[i]) === myColor() && g.turn === myColor()) { drag = { i, x: e.clientX, y: e.clientY }; sel = i; draw(); } });
  addEventListener("pointerup", (e) => { if (!drag) return; const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-i]"); const from = drag.i; const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12; drag = null; if (moved && el && +el.dataset.i !== from) tryMove(from, +el.dataset.i).then((ok) => ok && aiTurn()); });
  root.addEventListener("click", (e) => {
    const s = e.target.closest("[data-seat]"); if (s) conn.seat(s.dataset.seat);
    if (e.target.closest("[data-leave]")) conn.leaveSeat();
  });
  root.querySelector("#cnew").onclick = () => { if (confirm("Start a new game? The current one ends for everyone.")) conn.reset(); };
  root.querySelector("#cflip").onclick = () => { flip = !flip; draw(); };
  api.on("hello", (m) => { ops = m.ops; seats = m.seats || {}; rebuild(); if (myColor() === "b") flip = true; draw(); aiTurn(); });
  api.on("op", (m) => { if (m.op.type !== "move") return; const i = ops.findIndex((o) => o.local && o.from === m.op.from && o.to === m.op.to); if (i >= 0) ops[i] = m.op; else ops.push(m.op); rebuild(); draw(); aiTurn(); });
  api.on("seats", (m) => { seats = m.seats; if (myColor() === "b") flip = true; if (myColor() === "w") flip = false; draw(); });
  api.on("reset", (m) => { ops = []; rebuild(); sel = null; draw(); toast(`${m.by} started a new game.`); });
}
