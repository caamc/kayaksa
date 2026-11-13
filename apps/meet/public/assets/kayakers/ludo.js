// Ludo, Kayak edition: 2 to 4 players, four counters each. Designed and developed by Kayak.
import { table, roll, COLORS, CNAMES } from "./table.js";

// The 52 squares of the shared track on a 15 × 15 board, clockwise from Teal's start.
const TRACK = [[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6]];
const HOME = [[[1,7],[2,7],[3,7],[4,7],[5,7]], [[7,1],[7,2],[7,3],[7,4],[7,5]], [[13,7],[12,7],[11,7],[10,7],[9,7]], [[7,13],[7,12],[7,11],[7,10],[7,9]]];
const BASE = [[[1.5,1.5],[3.5,1.5],[1.5,3.5],[3.5,3.5]], [[10.5,1.5],[12.5,1.5],[10.5,3.5],[12.5,3.5]], [[10.5,10.5],[12.5,10.5],[10.5,12.5],[12.5,12.5]], [[1.5,10.5],[3.5,10.5],[1.5,12.5],[3.5,12.5]]];
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const GOAL = 56; // 0-50 on the track, 51-55 in the home column, 56 home
const abs = (col, rel) => (rel < 0 || rel > 50 ? -1 : (rel + 13 * col) % 52);
const colOf = (n, i) => (n === 2 ? [0, 2][i] : i);

function legal(s, t) {
  const d = s.dice; if (!d) return [];
  const out = [];
  s.tok[t].forEach((r, i) => { if (r === GOAL) return; if (r < 0) { if (d === 6) out.push(i); return; } if (r + d <= GOAL) out.push(i); });
  return out;
}
function nextTurn(s) { s.t = (s.t + 1) % s.tok.length; s.sixes = 0; s.dice = null; }
export const mount = (api) => table(api, {
  kind: "ludo", name: "Ludo", tagline: "Race all four counters home. Roll a six to set out, and send rivals back to base.", min: 2, max: 4,
  help: "<ul><li>Roll a 6 to move a counter out of your base.</li><li>Move around the board and up your coloured home column. You need the exact roll to get home.</li><li>Landing on a rival's counter sends it back to base - except on the starred safe squares and start squares.</li><li>A 6, a capture or getting a counter home gives you another roll. Three 6s in a row end your turn.</li><li>First to bring all four counters home wins.</li></ul>",
  setup: (n, seed) => ({ r: seed, tok: Array.from({ length: n }, () => [-1, -1, -1, -1]), t: 0, dice: null, sixes: 0, done: [], log: ["Roll a 6 to set out."] }),
  turn: (s) => s.t,
  apply(s, m, t) {
    if (s.done.length) return null;
    const C = colOf(s.tok.length, t), name = CNAMES[C];
    if (m === "roll") {
      if (s.dice) return null;
      const d = roll(s); s.dice = d; s.sixes = d === 6 ? s.sixes + 1 : 0;
      if (s.sixes === 3) { s.log.push(`${name} rolled a third 6 - turn over.`); nextTurn(s); return s; }
      if (!legal(s, t).length) { s.log.push(`${name} rolled ${d} - no move.`); nextTurn(s); return s; }
      s.log.push(`${name} rolled ${d}.`); return s;
    }
    if (typeof m !== "object" || !Number.isInteger(m.tok) || !legal(s, t).includes(m.tok)) return null;
    const d = s.dice, from = s.tok[t][m.tok], to = from < 0 ? 0 : from + d;
    s.tok[t][m.tok] = to;
    let again = d === 6, msg = from < 0 ? `${name} brought a counter out.` : to === GOAL ? `${name} got a counter home!` : `${name} moved ${d}.`;
    const a = abs(C, to);
    if (a >= 0 && !SAFE.has(a)) s.tok.forEach((ts, o) => { if (o === t) return; const oc = colOf(s.tok.length, o); ts.forEach((r, k) => { if (abs(oc, r) === a) { ts[k] = -1; again = true; msg += ` Captured ${CNAMES[oc]}!`; } }); });
    if (to === GOAL) again = true;
    s.log.push(msg);
    if (s.tok[t].every((r) => r === GOAL) && !s.done.includes(t)) { s.done.push(t); s.log.push(`${name} has all four home - place ${s.done.length}!`); again = false; }
    if (again && !s.done.includes(t)) s.dice = null; else { nextTurn(s); while (s.done.includes(s.t) && s.done.length < s.tok.length) nextTurn(s); }
    return s;
  },
  over(s) { return s.done.length ? { winners: [s.done[0]], text: `${CNAMES[colOf(s.tok.length, s.done[0])]} wins!` } : null; },
  ai(s, t) {
    if (!s.dice) return "roll";
    const C = colOf(s.tok.length, t), opts = legal(s, t);
    const danger = (a) => s.tok.some((ts, o) => o !== t && ts.some((r) => { const oa = abs(colOf(s.tok.length, o), r); return oa >= 0 && ((a - oa + 52) % 52) >= 1 && ((a - oa + 52) % 52) <= 6; }));
    let best = opts[0], bv = -1e9;
    for (const i of opts) {
      const from = s.tok[t][i], to = from < 0 ? 0 : from + s.dice, a = abs(C, to); let v = to / 4;
      if (from < 0) v += 30; if (to === GOAL) v += 45; if (to > 50) v += 20;
      if (a >= 0 && !SAFE.has(a) && s.tok.some((ts, o) => o !== t && ts.some((r) => abs(colOf(s.tok.length, o), r) === a))) v += 60;
      if (a >= 0 && SAFE.has(a)) v += 12; if (a >= 0 && !SAFE.has(a) && danger(a)) v -= 18;
      const fa = abs(C, from); if (fa >= 0 && !SAFE.has(fa) && danger(fa)) v += 14;
      if (v > bv) { bv = v; best = i; }
    }
    return { tok: best };
  },
  aiDelay: 800,
  seatInfo: (s, i) => `${CNAMES[colOf(s.tok.length, i)]} · ${s.tok[i].filter((r) => r === GOAL).length}/4 home`,
  view(s, el, c) {
    const n = s.tok.length, U = 10;
    const cells = [];
    TRACK.forEach(([x, y], i) => { const startOf = [0, 13, 26, 39].indexOf(i); const fill = startOf >= 0 ? COLORS[startOf] : "#F4F8F7"; cells.push(`<rect x="${x * U}" y="${y * U}" width="${U}" height="${U}" fill="${fill}" stroke="#0E2F3C33" stroke-width=".4"/>${[8, 21, 34, 47].includes(i) ? `<text x="${x * U + 5}" y="${y * U + 7.4}" class="st">★</text>` : ""}`); });
    HOME.forEach((h, k) => h.forEach(([x, y]) => cells.push(`<rect x="${x * U}" y="${y * U}" width="${U}" height="${U}" fill="${COLORS[k]}" opacity=".85" stroke="#0E2F3C33" stroke-width=".4"/>`)));
    const bases = [[0, 0], [9, 0], [9, 9], [0, 9]].map(([x, y], k) => `<rect x="${x * U}" y="${y * U}" width="${6 * U}" height="${6 * U}" rx="6" fill="${COLORS[k]}"/><rect x="${x * U + 8}" y="${y * U + 8}" width="${6 * U - 16}" height="${6 * U - 16}" rx="5" fill="#fff" opacity=".92"/>`).join("");
    const centre = `<polygon points="60,60 90,60 75,75" fill="${COLORS[1]}"/><polygon points="90,60 90,90 75,75" fill="${COLORS[2]}"/><polygon points="90,90 60,90 75,75" fill="${COLORS[3]}"/><polygon points="60,90 60,60 75,75" fill="${COLORS[0]}"/><text x="75" y="78" class="ctr">KAYAK</text>`;
    const movable = new Set(c.myTurn && s.dice ? legal(s, c.turn) : []);
    const pieces = [];
    s.tok.forEach((ts, p) => { const C = colOf(n, p); ts.forEach((r, k) => {
      let x, y; if (r < 0) [x, y] = BASE[C][k].map((v) => v * U + U / 2); else if (r === GOAL) { x = 75 + [-6, 6, -6, 6][k] * .6 + [-4, 4, 4, -4][C]; y = 75 + [-6, -6, 6, 6][k] * .6 + [-4, -4, 4, 4][C]; } else if (r > 50) [x, y] = HOME[C][r - 51].map((v) => v * U + U / 2); else [x, y] = TRACK[abs(C, r)].map((v) => v * U + U / 2);
      const same = s.tok.flatMap((t2, p2) => t2.map((r2, k2) => [p2, k2, r2])).filter(([p2, k2, r2]) => (r >= 0 && r2 >= 0 && r < GOAL && ((r <= 50 && r2 <= 50 && abs(colOf(n, p2), r2) === abs(C, r)) || (p2 === p && r2 === r && r > 50))));
      const off = same.length > 1 ? (same.findIndex(([p2, k2]) => p2 === p && k2 === k) - (same.length - 1) / 2) * 2.4 : 0;
      const mv = p === c.turn && movable.has(k);
      pieces.push(`<g class="pc${mv ? " mv" : ""}" ${mv ? `data-tok="${k}" tabindex="0" role="button" aria-label="Move ${CNAMES[C]} counter ${k + 1}"` : ""}><circle cx="${x + off}" cy="${y + 1}" r="3.6" fill="#0006"/><circle cx="${x + off}" cy="${y}" r="3.6" fill="${COLORS[C]}" stroke="#fff" stroke-width="1"/><circle cx="${x + off - 1}" cy="${y - 1}" r="1.2" fill="#ffffff80"/></g>`);
    }); });
    el.innerHTML = `<div><svg class="ld" viewBox="0 0 150 150" role="img" aria-label="Ludo board">${bases}${cells.join("")}${centre}${pieces.join("")}</svg>
      <div class="tb-bar"><span class="tb-dice ${s.dice ? "rolling" : ""}">${s.dice ? "⚀⚁⚂⚃⚄⚅"[s.dice - 1] : "🎲"}</span>${c.myTurn && !s.dice ? `<button class="glass p" id="ldRoll">Roll the dice</button>` : c.myTurn ? `<span>Choose a counter to move ${s.dice}.</span>` : ""}</div></div>
      <style>.ld{width:min(calc(100vh - 210px),calc(100vw - 420px),720px);min-width:300px;border-radius:22px;background:#fff;box-shadow:0 30px 60px #0007}
      .ld .st{font-size:7px;text-anchor:middle;fill:#9C630E}.ld .ctr{font:800 4px Archivo,system-ui;fill:#fff;text-anchor:middle;letter-spacing:.4px}
      .pc.mv{cursor:pointer;animation:ldp 1s ease-in-out infinite}.pc.mv circle:nth-child(2){stroke:#EE9B1E;stroke-width:1.6}
      @keyframes ldp{50%{transform:translateY(-1.2px)}}@media (max-width:900px){.ld{width:calc(100vw - 32px)}}</style>`;
    el.querySelector("#ldRoll") && (el.querySelector("#ldRoll").onclick = () => c.act("roll"));
    el.querySelectorAll("[data-tok]").forEach((g) => { const go = () => c.act({ tok: +g.dataset.tok }); g.addEventListener("click", go); g.addEventListener("keydown", (e) => e.key === "Enter" && go()); });
  },
});
