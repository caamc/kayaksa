// Kayak Rows: an original tile-and-card strategy game. Designed and developed by Kayak.
// Play a route card to claim the matching tile; make rows of five. Two players or teams need two rows;
// three need one.
import { table, shuffle, COLORS } from "./table.js";

const N = 8;
const HUES = [["#17807E", "Teal"], ["#EE9B1E", "Saffron"], ["#2D6A9F", "Sky"], ["#B4472F", "Clay"], ["#5E4B78", "Plum"], ["#7A8F2E", "Olive"]];
const ICON = ["⚓", "✦", "◆", "▲", "●", "■", "✚", "◗", "✿", "☀"];
const CORNERS = new Set([0, N - 1, N * (N - 1), N * N - 1]);
// The board: 60 route tiles (6 colours × 10 symbols) in a fixed Kayak layout, with free corners.
const BOARD = (() => {
  const tiles = []; for (let h = 0; h < 6; h++) for (let i = 0; i < 10; i++) tiles.push(h * 10 + i);
  const st = { r: 20261113 }; const mul = () => { st.r = (st.r + 0x6D2B79F5) | 0; let t = st.r; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(mul() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  const out = []; let k = 0; for (let i = 0; i < N * N; i++) out.push(CORNERS.has(i) ? -1 : tiles[k++]); return out;
})();
const WILD = 100, CUT = 101; // Wild claims any free tile; Cut removes a rival chip that isn't in a finished row
function deck(st) { const d = []; for (let t = 0; t < 60; t++) d.push(t, t); for (let i = 0; i < 8; i++) d.push(WILD, CUT); return shuffle(st, d); }
const teamOf = (s, p) => (s.teams === 2 && s.n === 4 ? p % 2 : p);
const handSize = (n) => (n === 2 ? 7 : n === 3 ? 6 : 5);
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const owner = (s, i) => (CORNERS.has(i) ? "*" : s.chips[i]);

/** Finished rows of five for a team (each row = list of 5 cells). Rows may share one cell. */
function rowsOf(s, team) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of DIRS) {
    const cells = []; for (let k = 0; k < 5; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= N || cc < 0 || cc >= N) break; const o = owner(s, rr * N + cc); if (o !== "*" && o !== team) break; cells.push(rr * N + cc); }
    if (cells.length === 5) out.push(cells);
  }
  // keep non-overlapping rows (sharing at most one cell)
  const kept = []; for (const row of out) if (kept.every((k) => k.filter((x) => row.includes(x)).length <= 1)) kept.push(row);
  return kept;
}
const locked = (s, i) => { const t = s.chips[i]; return t != null && rowsOf(s, t).some((row) => row.includes(i)); };
const need = (s) => (s.teams === 3 ? 1 : 2);

export const mount = (api) => table(api, {
  kind: "rows", name: "Kayak Rows", tagline: "Claim tiles with your route cards and line up rows of five before your rivals.", min: 2, max: 4,
  help: "<ul><li>Each card matches a tile on the board (same colour and symbol; every tile appears on two cards). Play a card to put your chip on a matching free tile.</li><li>Wild claims any free tile. Cut removes a rival's chip, unless it's part of a finished row.</li><li>The four corners count for everyone.</li><li>Two players (or two teams of two, sitting alternately) need two rows of five. Three players need one row.</li><li>If both tiles for a card are taken, it's a dead card: swap it for a new one, then play.</li></ul>",
  setup(n, seed, opts, names) {
    const s = { r: seed, n, names, teams: n === 4 ? 2 : n, chips: Array(N * N).fill(null), hands: [], t: 0, swapped: false, last: null, log: [n === 4 ? "Teams: seats 1 and 3 against seats 2 and 4." : "Make rows of five."] };
    s.deck = deck(s); for (let i = 0; i < n; i++) s.hands.push(s.deck.splice(-handSize(n)));
    return s;
  },
  turn: (s) => s.t,
  apply(s, m, t) {
    if (this_over(s)) return null;
    const hand = s.hands[t], team = teamOf(s, t), who = s.names?.[t] || `Player ${t + 1}`;
    if (!m || typeof m !== "object" || !Number.isInteger(m.card) || m.card < 0 || m.card >= hand.length) return null;
    const card = hand[m.card];
    if (m.dead) { if (s.swapped || card >= 60 || BOARD.some((b, i) => b === card && s.chips[i] == null)) return null; hand.splice(m.card, 1); if (s.deck.length) hand.push(s.deck.pop()); s.swapped = true; s.log.push(`${who} swapped a dead card.`); return s; }
    const i = m.cell; if (!Number.isInteger(i) || i < 0 || i >= N * N || CORNERS.has(i)) return null;
    if (card === CUT) { if (s.chips[i] == null || teamOf(s, t) === s.chips[i] || locked(s, i)) return null; s.chips[i] = null; s.log.push(`${who} cut a rival chip.`); }
    else { if (s.chips[i] != null || (card !== WILD && BOARD[i] !== card)) return null; s.chips[i] = team; s.log.push(`${who} claimed ${card === WILD ? "a tile with a Wild" : HUES[Math.floor(card / 10)][1] + " " + ICON[card % 10]}.`); }
    hand.splice(m.card, 1); if (s.deck.length) hand.push(s.deck.pop());
    s.last = i; s.swapped = false;
    const rw = rowsOf(s, team).length; if (rw && card !== CUT) s.log.push(`${who}'s side has ${rw} row${rw > 1 ? "s" : ""}.`);
    s.t = (t + 1) % s.n; return s;
  },
  over: (s) => this_over(s),
  ai(s, t) {
    const hand = s.hands[t], team = teamOf(s, t);
    const run = (i, tm) => { let best = 0; const r0 = Math.floor(i / N), c0 = i % N; for (const [dr, dc] of DIRS) { let n = 1; for (const sg of [1, -1]) for (let k = 1; k < 5; k++) { const r = r0 + dr * k * sg, c = c0 + dc * k * sg; if (r < 0 || r >= N || c < 0 || c >= N) break; const o = owner(s, r * N + c); if (o !== "*" && o !== tm) break; n++; } best = Math.max(best, n); } return best; };
    let best = null, bv = -1;
    hand.forEach((card, k) => {
      if (card < 60 && !BOARD.some((b, i) => b === card && s.chips[i] == null) && !s.swapped) { if (bv < 0) { best = { card: k, dead: true }; bv = 0; } return; }
      for (let i = 0; i < N * N; i++) {
        if (CORNERS.has(i)) continue;
        if (card === CUT) { if (s.chips[i] == null || s.chips[i] === team || locked(s, i)) continue; const v = run(i, s.chips[i]) * 9 - 6; if (v > bv) { bv = v; best = { card: k, cell: i }; } continue; }
        if (s.chips[i] != null || (card !== WILD && BOARD[i] !== card)) continue;
        let v = run(i, team) * 10; for (let o = 0; o < s.teams; o++) if (o !== team) v += run(i, o) * 6;
        if (card === WILD) v -= 12;
        if (v > bv) { bv = v; best = { card: k, cell: i }; }
      }
    });
    return best || { card: 0, dead: true };
  },
  aiDelay: 900,
  seatInfo: (s, i) => `${s.teams === 2 && s.n === 4 ? `Team ${["A", "B"][i % 2]} · ` : ""}${rowsOf(s, teamOf(s, i)).length} row${rowsOf(s, teamOf(s, i)).length === 1 ? "" : "s"}`,
  view(s, el, c) {
    const me = c.me, hand = me >= 0 ? s.hands[me] : [];
    if (!el._rw || el._rw.n !== s.n || el._rw.turn !== c.turn) el._rw = { sel: null, n: s.n, turn: c.turn };
    const R = el._rw, selCard = R.sel != null ? hand[R.sel] : null;
    const chipCol = (team) => COLORS[s.n === 4 ? team : team];
    const done = new Set(); for (let tm = 0; tm < s.teams; tm++) for (const row of rowsOf(s, tm)) row.forEach((x) => done.add(x));
    const target = (i) => { if (selCard == null || !c.myTurn || CORNERS.has(i)) return false; if (selCard === CUT) return s.chips[i] != null && s.chips[i] !== teamOf(s, me) && !locked(s, i); return s.chips[i] == null && (selCard === WILD || BOARD[i] === selCard); };
    const tile = (b) => b < 0 ? `<span class="rk">★</span>` : `<span class="ri" style="color:${HUES[Math.floor(b / 10)][0]}">${ICON[b % 10]}</span>`;
    const cardHtml = (b, k) => `<button class="rc${R.sel === k ? " sel" : ""}" data-k="${k}" style="--c:${b >= 60 ? "#0E2F3C" : HUES[Math.floor(b / 10)][0]}">${b === WILD ? "<b>Wild</b><small>any free tile</small>" : b === CUT ? "<b>Cut</b><small>remove a chip</small>" : `<i>${ICON[b % 10]}</i><small>${HUES[Math.floor(b / 10)][1]}</small>`}</button>`;
    el.innerHTML = `<div class="rw"><div class="rb">${BOARD.map((b, i) => `<button class="rt${target(i) ? " can" : ""}${s.last === i ? " last" : ""}${done.has(i) ? " row" : ""}" data-i="${i}" aria-label="Tile ${i + 1}">${tile(b)}${s.chips[i] != null ? `<span class="chip" style="background:${chipCol(s.chips[i])}"></span>` : ""}</button>`).join("")}</div>
      ${me >= 0 ? `<div class="rh">${hand.map(cardHtml).join("")}</div><div class="tb-bar">${c.myTurn ? (selCard == null ? "<span>Pick a card, then a highlighted tile.</span>" : selCard < 60 && !BOARD.some((b, i) => b === selCard && s.chips[i] == null) ? `<button class="glass" id="rDead">Swap dead card</button>` : "<span>Now pick a highlighted tile.</span>") : ""}</div>` : ""}</div>
      <style>.rw{display:grid;gap:14px;justify-items:center}.rb{--q:min(calc((100vh - 290px) / 8),calc((100vw - 420px) / 8),76px);display:grid;grid-template-columns:repeat(8,var(--q));gap:4px;padding:10px;border-radius:20px;background:#0B2A34;box-shadow:0 30px 60px #0007}
      .rt{all:unset;box-sizing:border-box;width:var(--q);height:var(--q);border-radius:10px;background:#F4F8F7;display:grid;place-items:center;position:relative;cursor:default}
      .rt .ri{font-size:calc(var(--q) * .46)}.rt .rk{color:#EE9B1E;font-size:calc(var(--q) * .5)}.rt.can{cursor:pointer;box-shadow:0 0 0 3px #EE9B1E inset;animation:rpulse 1.2s infinite}
      .rt .chip{position:absolute;inset:16%;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 10px #0007}.rt.row .chip{box-shadow:0 0 0 3px #3FD09A,0 4px 10px #0007}.rt.last{outline:2px solid #3FD0C8;outline-offset:-2px}
      @keyframes rpulse{50%{box-shadow:0 0 0 3px #EE9B1E88 inset}}
      .rh{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.rc{all:unset;cursor:pointer;width:72px;height:98px;border-radius:12px;background:linear-gradient(170deg,#fff,#E8EFEE);display:grid;place-items:center;align-content:center;gap:4px;color:var(--c);box-shadow:0 8px 18px #0006;border:3px solid var(--c);transition:transform .15s}
      .rc i{font-style:normal;font-size:2rem}.rc b{font:800 1rem Archivo,system-ui}.rc small{font-size:.7rem;font-weight:700}.rc.sel{transform:translateY(-12px);box-shadow:0 0 0 3px #EE9B1E,0 12px 22px #0007}
      @media (max-width:900px){.rb{--q:calc((100vw - 60px) / 8)}}</style>`;
    el.querySelectorAll(".rc").forEach((b) => (b.onclick = () => { if (!c.myTurn) return c.toast("Wait for your turn."); R.sel = R.sel === +b.dataset.k ? null : +b.dataset.k; c.view(); }));
    el.querySelectorAll(".rt").forEach((b) => (b.onclick = () => { const i = +b.dataset.i; if (target(i)) c.act({ card: R.sel, cell: i }); }));
    el.querySelector("#rDead") && (el.querySelector("#rDead").onclick = () => c.act({ card: R.sel, dead: true }));
  },
});
function this_over(s) {
  for (let tm = 0; tm < s.teams; tm++) if (rowsOf(s, tm).length >= need(s)) {
    const winners = []; for (let p = 0; p < s.n; p++) if (teamOf(s, p) === tm) winners.push(p);
    return { winners, text: s.teams === 2 && s.n === 4 ? `Team ${["A", "B"][tm]} wins!` : `${s.names?.[tm] || "Player " + (tm + 1)} wins!` };
  }
  if (!s.deck.length && s.hands.every((h) => !h.length)) return { winners: [], text: "No cards left - it's a draw." };
  return null;
}
