// Snakes & Ladders, Kayak edition: an original board, 2 to 4 players. Designed and developed by Kayak.
import { table, roll, COLORS } from "./table.js";
// Kayak's own board: ladders reward good habits, snakes are the risks every adviser knows.
const LADDERS = { 3: [22, "Second opinion"], 8: [26, "Clean audit"], 20: [41, "Due diligence done"], 28: [55, "Client referral"], 36: [57, "Early filing"], 51: [72, "Team effort"], 63: [84, "Board approval"], 71: [92, "Deal closed"] };
const SNAKES = { 17: [4, "Missed deadline"], 47: [19, "Conflict of interest"], 54: [34, "Lost the file"], 62: [18, "Unsigned engagement letter"], 87: [57, "Reply-all mistake"], 93: [70, "Scope creep"], 95: [75, "Audit query"], 99: [78, "Late invoice"] };
const cell = (n) => { const r = Math.floor((n - 1) / 10), c = (n - 1) % 10; return { x: (r % 2 ? 9 - c : c) * 10 + 5, y: (9 - r) * 10 + 5 }; };
export const mount = (api) => table(api, {
  kind: "snakes", name: "Snakes & Ladders", tagline: "Climb the ladders, dodge the snakes, first to square 100 wins.", min: 2, max: 4,
  help: "<ul><li>Roll the dice and move your counter forward.</li><li>Land at the foot of a ladder to climb it; land on a snake's head to slide down.</li><li>Roll a 6 for another turn.</li><li>You need the exact number to land on 100. If the roll is too big, you bounce back.</li></ul>",
  setup: (n, seed) => ({ r: seed, pos: Array(n).fill(0), t: 0, last: null, log: ["Everyone starts off the board."] }),
  turn: (s) => s.t,
  apply(s, m, t) {
    if (m !== "roll" || s.pos.some((p) => p === 100)) return null;
    const d = roll(s); let p = s.pos[t] + d, note = "";
    if (p > 100) p = 100 - (p - 100);
    if (LADDERS[p]) { note = ` - ladder: ${LADDERS[p][1]}! Up to ${LADDERS[p][0]}`; p = LADDERS[p][0]; }
    else if (SNAKES[p]) { note = ` - snake: ${SNAKES[p][1]}. Down to ${SNAKES[p][0]}`; p = SNAKES[p][0]; }
    s.pos[t] = p; s.last = { who: t, d };
    s.log.push(`${["Teal", "Saffron", "Sky", "Clay"][t]} rolled ${d} → ${p}${note}`);
    if (p !== 100 && d !== 6) s.t = (t + 1) % s.pos.length;
    return s;
  },
  over(s) { const w = s.pos.indexOf(100); return w < 0 ? null : { winners: [w], text: `${["Teal", "Saffron", "Sky", "Clay"][w]} reached 100 and wins!` }; },
  ai: () => "roll", aiDelay: 900,
  seatInfo: (s, i) => `Square ${s.pos[i] || "start"}`,
  view(s, el, c) {
    const sq = Array.from({ length: 100 }, (_, i) => { const n = i + 1, { x, y } = cell(n), dark = (Math.floor((n - 1) / 10) + ((n - 1) % 10)) % 2;
      return `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${dark ? "#123E4C" : "#174B5B"}"/><text x="${x - 4}" y="${y - 2.4}" class="n">${n}</text>`; }).join("");
    const lad = Object.entries(LADDERS).map(([a, [b]]) => { const p = cell(+a), q = cell(b), dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy), ox = (-dy / L) * 1.4, oy = (dx / L) * 1.4;
      const rungs = Array.from({ length: Math.floor(L / 3.2) }, (_, i) => { const k = (i + 1) / (Math.floor(L / 3.2) + 1); return `<line x1="${p.x + dx * k - ox}" y1="${p.y + dy * k - oy}" x2="${p.x + dx * k + ox}" y2="${p.y + dy * k + oy}"/>`; }).join("");
      return `<g class="lad"><line x1="${p.x - ox}" y1="${p.y - oy}" x2="${q.x - ox}" y2="${q.y - oy}"/><line x1="${p.x + ox}" y1="${p.y + oy}" x2="${q.x + ox}" y2="${q.y + oy}"/>${rungs}</g>`; }).join("");
    const sn = Object.entries(SNAKES).map(([a, [b]], i) => { const p = cell(+a), q = cell(b), mx = (p.x + q.x) / 2 + (i % 2 ? 7 : -7), my = (p.y + q.y) / 2;
      const col = ["#B4472F", "#5E4B78", "#9C630E", "#2D6A9F"][i % 4];
      return `<g class="snk"><path d="M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}" stroke="${col}"/><path d="M${p.x} ${p.y} Q${mx} ${my} ${q.x} ${q.y}" stroke="#ffffff30" stroke-width=".6" stroke-dasharray="1 2"/><circle cx="${p.x}" cy="${p.y}" r="2" fill="${col}"/><circle cx="${p.x - .6}" cy="${p.y - .5}" r=".35" fill="#fff"/><circle cx="${p.x + .6}" cy="${p.y - .5}" r=".35" fill="#fff"/></g>`; }).join("");
    const tok = s.pos.map((p, i) => { if (!p) return ""; const { x, y } = cell(p); const o = [[-2, -2], [2, -2], [-2, 2], [2, 2]][i]; return `<circle class="tok" cx="${x + o[0]}" cy="${y + o[1]}" r="2.4" fill="${COLORS[i]}"/>`; }).join("");
    el.innerHTML = `<div><svg class="sl" viewBox="0 0 100 100" role="img" aria-label="Snakes and Ladders board">${sq}${lad}${sn}${tok}<text x="95" y="7" class="hm">★</text></svg>
      <div class="tb-bar"><span class="tb-dice ${s.last ? "rolling" : ""}" aria-label="Dice">${s.last ? "⚀⚁⚂⚃⚄⚅"[s.last.d - 1] : "🎲"}</span>${c.myTurn ? `<button class="glass p" id="slRoll">Roll the dice</button>` : ""}</div></div>
      <style>.sl{width:min(calc(100vh - 210px),calc(100vw - 420px),720px);min-width:300px;border-radius:20px;box-shadow:0 30px 60px #0007;background:#0E2F3C}
      .sl .n{font:600 2.4px Archivo,system-ui;fill:#ffffff70}.sl .hm{font-size:5px;fill:#EE9B1E}
      .lad line{stroke:#E8C77A;stroke-width:.7;stroke-linecap:round}.snk path{fill:none;stroke-width:2.2;stroke-linecap:round}
      .tok{stroke:#fff;stroke-width:.5;filter:drop-shadow(0 .6px .6px #0009);transition:cx .5s,cy .5s}
      @media (max-width:900px){.sl{width:calc(100vw - 32px)}}</style>`;
    el.querySelector("#slRoll") && (el.querySelector("#slRoll").onclick = () => c.act("roll"));
  },
});
