// Tic Tac Toe, Kayak edition. Designed and developed by Kayak. Kayak AI plays perfectly (minimax).
import { table } from "./table.js";
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const win = (b) => { for (const l of LINES) if (b[l[0]] != null && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { p: b[l[0]], line: l }; return b.every((x) => x != null) ? { p: -1, line: [] } : null; };
function mm(b, p, me) { const w = win(b); if (w) return w.p === -1 ? 0 : w.p === me ? 10 : -10; let best = p === me ? -99 : 99; for (let i = 0; i < 9; i++) if (b[i] == null) { b[i] = p; const v = mm(b, 1 - p, me) * 0.9; b[i] = null; best = p === me ? Math.max(best, v) : Math.min(best, v); } return best; }
const MARK = ['<svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6"/></svg>', '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.2"/></svg>'];
export const mount = (api) => table(api, {
  kind: "ttt", name: "Tic Tac Toe", tagline: "Three in a row. Simple to learn, hard to beat Kayak AI.", min: 2, max: 2,
  help: "<ul><li>Teal goes first and plays crosses; Saffron plays noughts.</li><li>Take turns to mark an empty square.</li><li>Three in a row across, down or diagonally wins.</li><li>Kayak AI never loses - a draw is a good result.</li></ul>",
  setup: (n, seed) => ({ r: seed, b: Array(9).fill(null), log: ["New game."] }),
  turn: (s) => s.b.filter((x) => x != null).length % 2,
  apply(s, m, t) { if (!Number.isInteger(m) || m < 0 || m > 8 || s.b[m] != null || win(s.b)) return null; s.b[m] = t; return s; },
  over(s) { const w = win(s.b); return w ? { winners: w.p === -1 ? [] : [w.p], text: w.p === -1 ? "It's a draw." : `${["Crosses", "Noughts"][w.p]} win!`, line: w.line } : null; },
  ai(s, t) { let best = -1, bv = -99; for (const i of [4, 0, 2, 6, 8, 1, 3, 5, 7]) if (s.b[i] == null) { s.b[i] = t; const v = mm(s.b, 1 - t, t); s.b[i] = null; if (v > bv) { bv = v; best = i; } } return best; },
  aiDelay: 500,
  view(s, el, c) {
    const w = win(s.b), line = new Set(w?.line || []);
    el.innerHTML = `<div class="ttt">${s.b.map((v, i) => `<button class="tc${v != null ? " m" + v : ""}${line.has(i) ? " w" : ""}" data-i="${i}" aria-label="Square ${i + 1}${v != null ? (v ? ", nought" : ", cross") : ""}" ${v != null || !c.myTurn ? "disabled" : ""}>${v != null ? MARK[v] : ""}</button>`).join("")}</div>
      <style>.ttt{--s:min(26vh,26vw,150px);display:grid;grid-template-columns:repeat(3,var(--s));gap:10px;padding:14px;border-radius:28px;background:linear-gradient(160deg,#1D6F8A,#0E2F3C);box-shadow:0 30px 60px #0007,inset 0 1px 0 #ffffff33}
      .tc{all:unset;cursor:pointer;width:var(--s);height:var(--s);border-radius:18px;background:#06212C;display:grid;place-items:center;box-shadow:inset 0 6px 14px #000a;transition:background .15s}
      .tc:not([disabled]):hover{background:#0B3442}.tc svg{width:62%;height:62%;fill:none;stroke-width:1.6;stroke-linecap:round;animation:tpop .3s cubic-bezier(.3,1.5,.6,1)}
      .tc.m0 svg{stroke:#3FD0C8}.tc.m1 svg{stroke:#F5B04A}.tc.w{background:#ffffff22;box-shadow:0 0 0 3px #fff inset}
      @keyframes tpop{from{transform:scale(.3);opacity:0}}</style>`;
    el.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => c.act(+b.dataset.i)));
  },
  seatInfo: (s, i) => ["Crosses", "Noughts"][i],
});
