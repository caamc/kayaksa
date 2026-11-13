// Kayak Wordsmith: an original crossword tile game. Designed and developed by Kayak.
// Board layout, tile set and scoring are Kayak's own. Words are checked against ENABLE, a public-domain
// English word list. Kayak AI looks for the best-scoring word it can make from its tiles.
import { table, shuffle, COLORS } from "./table.js";

const N = 15, C = 7;
// Tile set: letter, count, points (Kayak's own distribution, 100 tiles including 2 blanks).
const TILES = { A: [9, 1], B: [2, 4], C: [3, 3], D: [4, 2], E: [12, 1], F: [2, 4], G: [3, 3], H: [3, 3], I: [8, 1], J: [1, 9], K: [1, 6], L: [4, 2], M: [3, 3], N: [6, 1], O: [8, 1], P: [2, 3], Q: [1, 10], R: [6, 1], S: [4, 1], T: [6, 1], U: [3, 2], V: [2, 5], W: [2, 4], X: [1, 8], Y: [2, 4], Z: [1, 9], "?": [2, 0] };
const PTS = (l) => TILES[l]?.[1] ?? 0;
// Kayak's premium squares, laid out as a compass: W3 = word ×3, W2 = word ×2, L3 / L2 = letter ×3 / ×2.
const PREM = (() => {
  const g = Array.from({ length: N }, () => Array(N).fill(""));
  const put = (t, list) => { for (const [r, c] of list) for (const [rr, cc] of [[r, c], [c, r], [N - 1 - r, c], [r, N - 1 - c], [N - 1 - r, N - 1 - c], [N - 1 - c, r], [c, N - 1 - r], [N - 1 - c, N - 1 - r]]) g[rr][cc] = t; };
  put("W3", [[0, 3], [3, 0]]);
  put("W2", [[2, 2], [4, 4], [1, 6]]);
  put("L3", [[0, 7], [5, 1], [5, 5]]);
  put("L2", [[1, 1], [3, 3], [2, 7], [6, 6]]);
  g[7][7] = "W2";
  return g;
})();
let DICT = null;
const ready = fetch("/assets/kayakers/words.txt").then((r) => r.text()).then((t) => { DICT = new Set(t.split(/\r?\n/).filter((w) => w.length > 1)); });
const isWord = (w) => DICT.has(w.toLowerCase());

function bag(st) { const b = []; for (const [l, [n]] of Object.entries(TILES)) for (let i = 0; i < n; i++) b.push(l); return shuffle(st, b); }
const draw = (s, t) => { while (s.racks[t].length < C && s.bag.length) s.racks[t].push(s.bag.pop()); };

/** Checks a placement; returns { score, words } or an error string. */
function check(s, place) {
  if (!Array.isArray(place) || !place.length || place.length > C) return "Place some tiles.";
  const b = s.board, seen = new Set();
  for (const p of place) { if (!Array.isArray(p) || p.length < 3) return "Bad move."; const [r, c, l] = p; if (!(r >= 0 && r < N && c >= 0 && c < N) || b[r][c] || seen.has(r * N + c) || !/^[A-Z]$/.test(l)) return "Those squares aren't free."; seen.add(r * N + c); }
  const rows = new Set(place.map((p) => p[0])), cols = new Set(place.map((p) => p[1]));
  if (rows.size > 1 && cols.size > 1) return "Place tiles in one straight line.";
  const across = rows.size === 1 && (place.length > 1 || (() => { const [r, c] = place[0]; return (c > 0 && b[r][c - 1]) || (c < N - 1 && b[r][c + 1]); })());
  const at = (r, c) => { if (r < 0 || c < 0 || r >= N || c >= N) return null; const p = place.find((x) => x[0] === r && x[1] === c); return p ? { l: p[2], blank: !!p[3], fresh: true } : b[r][c] ? { l: b[r][c].l, blank: b[r][c].blank, fresh: false } : null; };
  const [dr, dc] = across ? [0, 1] : [1, 0];
  const line = (r, c, dr, dc) => { while (at(r - dr, c - dc)) { r -= dr; c -= dc; } const out = []; while (at(r, c)) { out.push({ r, c, ...at(r, c) }); r += dr; c += dc; } return out; };
  const main = line(place[0][0], place[0][1], dr, dc);
  if (!place.every((p) => main.some((x) => x.r === p[0] && x.c === p[1]))) return "Tiles must be in one connected word.";
  const empty = s.board.every((row) => row.every((x) => !x));
  if (empty && !place.some((p) => p[0] === 7 && p[1] === 7)) return "The first word must cover the centre star.";
  if (empty && main.length < 2) return "Words need at least two letters.";
  const words = [];
  if (main.length > 1) words.push(main);
  for (const p of place) { const cross = line(p[0], p[1], dc, dr); if (cross.length > 1) words.push(cross); }
  if (!words.length) return "Words need at least two letters.";
  if (!empty && !words.some((w) => w.some((x) => !x.fresh))) return "Join your word to tiles already on the board.";
  let score = 0; const list = [];
  for (const w of words) {
    const txt = w.map((x) => x.l).join("");
    if (!isWord(txt)) return `“${txt}” isn't in the word list.`;
    let sum = 0, mult = 1;
    for (const x of w) { let v = x.blank ? 0 : PTS(x.l); if (x.fresh) { const pr = PREM[x.r][x.c]; if (pr === "L2") v *= 2; if (pr === "L3") v *= 3; if (pr === "W2") mult *= 2; if (pr === "W3") mult *= 3; } sum += v; }
    score += sum * mult; list.push(txt);
  }
  if (place.length === C) score += 40; // all seven tiles: Kayak bonus
  return { score, words: list };
}
function rackHas(rack, place) { const r = rack.slice(); for (const p of place) { const i = r.indexOf(p[3] ? "?" : p[2]); if (i < 0) return false; r.splice(i, 1); } return true; }
const nextT = (s) => { s.t = (s.t + 1) % s.racks.length; };

// Kayak AI: words that can be made from the rack plus one letter already on the board.
function aiMove(s, t) {
  const rack = s.racks[t], blanks = rack.filter((x) => x === "?").length, counts = {};
  for (const l of rack) if (l !== "?") counts[l] = (counts[l] || 0) + 1;
  const fits = (w, extra) => { const c = { ...counts }; if (extra) c[extra] = (c[extra] || 0) + 1; let need = 0; for (const ch of w) { if (c[ch] > 0) c[ch]--; else need++; } return need <= blanks; };
  const empty = s.board.every((row) => row.every((x) => !x));
  const tiles = []; s.board.forEach((row, r) => row.forEach((x, c) => x && tiles.push([r, c, x.l])));
  let best = null; const t0 = Date.now();
  const tryPlace = (word, r0, c0, dr, dc) => {
    const place = []; const c = { ...counts }; let bl = blanks;
    for (let i = 0; i < word.length; i++) { const r = r0 + dr * i, cc = c0 + dc * i; if (r >= N || cc >= N || r < 0 || cc < 0) return; const on = s.board[r][cc]; if (on) { if (on.l !== word[i]) return; continue; } if (c[word[i]] > 0) { c[word[i]]--; place.push([r, cc, word[i]]); } else if (bl > 0) { bl--; place.push([r, cc, word[i], 1]); } else return; }
    if (!place.length) return;
    const res = check(s, place); if (typeof res === "string") return;
    if (!best || res.score > best.score) best = { score: res.score, place };
  };
  const words = [];
  for (const w of DICT) { if (w.length > 9) continue; const W = w.toUpperCase(); if (empty ? fits(W) : true) words.push(W); }
  if (empty) { for (const W of words) { if (W.length > C || !fits(W)) continue; for (let k = 0; k < W.length; k++) tryPlace(W, 7, 7 - k, 0, 1); if (Date.now() - t0 > 2500) break; } }
  else for (const [r, c, l] of shuffle({ r: s.r ^ 99 }, tiles.slice()).slice(0, 40)) {
    for (const W of words) {
      if (W.length < 2 || !W.includes(l) || !fits(W, l)) continue;
      for (let k = 0; k < W.length; k++) if (W[k] === l) { tryPlace(W, r, c - k, 0, 1); tryPlace(W, r - k, c, 1, 0); }
    }
    if (Date.now() - t0 > 3500) break;
  }
  if (best) return { place: best.place };
  return s.bag.length >= C ? { swap: rack.slice(0, Math.min(rack.length, 4)) } : "pass";
}

export const mount = (api) => table(api, {
  kind: "words", name: "Kayak Wordsmith", tagline: "Build words across the board from your seven tiles. Premium squares multiply your score.", min: 2, max: 4,
  ready, loading: "Loading the word list…", aiDelay: 300,
  help: "<ul><li>Place tiles from your rack in one line, joined to tiles already on the board. The first word covers the centre star.</li><li>Every word you make must be in the word list (ENABLE, a public-domain English list).</li><li>Premium squares: L2/L3 double or triple a letter; W2/W3 double or triple the word.</li><li>Use all seven tiles in one turn for a 40-point Kayak bonus. A blank (?) can be any letter and scores 0.</li><li>You can swap tiles instead of playing (while 7 or more are left in the bag), or pass. The game ends when the bag is empty and someone uses all their tiles, or after everyone passes twice in a row. Tiles left in your rack are taken off your score.</li></ul>",
  setup(n, seed, opts, names) {
    const s = { r: seed, names, board: Array.from({ length: N }, () => Array(N).fill(null)), racks: Array.from({ length: n }, () => []), score: Array(n).fill(0), t: 0, passes: 0, end: false, log: ["New game. The first word covers the centre star."] };
    s.bag = bag(s); for (let i = 0; i < n; i++) draw(s, i); return s;
  },
  turn: (s) => s.t,
  apply(s, m, t) {
    if (s.end) return null;
    const who = s.names?.[t] || `Player ${t + 1}`;
    if (m === "pass") { s.passes++; s.log.push(`${who} passed.`); nextT(s); }
    else if (m?.swap) {
      if (s.bag.length < C || !Array.isArray(m.swap) || !m.swap.length) return null;
      const r = s.racks[t].slice(); for (const l of m.swap) { const i = r.indexOf(l); if (i < 0) return null; r.splice(i, 1); }
      s.racks[t] = r; draw(s, t); s.bag.push(...m.swap); shuffle(s, s.bag); s.passes++; s.log.push(`${who} swapped ${m.swap.length} tiles.`); nextT(s);
    } else if (m?.place) {
      const place = m.place.map((p) => [p[0], p[1], String(p[2]).toUpperCase(), p[3] ? 1 : 0]);
      if (!rackHas(s.racks[t], place)) return null;
      const res = check(s, place); if (typeof res === "string") return null;
      for (const [r, c, l, bl] of place) { s.board[r][c] = { l, blank: !!bl, by: t }; s.racks[t].splice(s.racks[t].indexOf(bl ? "?" : l), 1); }
      s.score[t] += res.score; s.passes = 0; s.last = place.map((p) => p[0] * N + p[1]);
      s.log.push(`${who} played ${res.words.join(", ")} for ${res.score}.`);
      draw(s, t);
      if (!s.racks[t].length && !s.bag.length) { s.end = true; let bonus = 0; s.racks.forEach((r, i) => { const v = r.reduce((a, l) => a + PTS(l), 0); s.score[i] -= v; bonus += v; }); s.score[t] += bonus; s.log.push(`${who} went out. Game over.`); return s; }
      nextT(s);
    } else return null;
    if (s.passes >= s.racks.length * 2) { s.end = true; s.racks.forEach((r, i) => { s.score[i] -= r.reduce((a, l) => a + PTS(l), 0); }); s.log.push("Everyone passed twice. Game over."); }
    return s;
  },
  over(s) { if (!s.end) return null; const top = Math.max(...s.score); const w = s.score.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0); return { winners: w, text: w.length > 1 ? `A tie on ${top} points!` : `${s.names?.[w[0]] || "Player " + (w[0] + 1)} wins with ${top} points!` }; },
  ai: aiMove,
  seatInfo: (s, i) => `${s.score[i]} points`,
  illegal: "That move isn't allowed - check that it forms real words joined to the board.",
  view(s, el, c) {
    const me = c.me, rack = me >= 0 ? s.racks[me] : [];
    if (!el._ws || el._ws.n !== s.n) el._ws = { n: s.n, pend: [], used: [] };
    const P = el._ws; // tiles you've put down this turn, before you press Play
    const last = new Set(s.last || []);
    const sq = [];
    for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) {
      const t = s.board[r][col], p = P.pend.find((x) => x[0] === r && x[1] === col), pr = PREM[r][col];
      sq.push(`<button class="wdq ${pr}${t ? " t" : ""}${p ? " p" : ""}${last.has(r * N + col) ? " last" : ""}" data-r="${r}" data-c="${col}" ${t ? "disabled" : ""} aria-label="Row ${r + 1}, column ${col + 1}${t ? ", " + t.l : p ? ", " + p[2] : pr ? ", " + pr : ""}">${t ? `<b>${t.l}</b><i>${t.blank ? "" : PTS(t.l)}</i>` : p ? `<b>${p[2]}</b><i>${p[3] ? "" : PTS(p[2])}</i>` : r === 7 && col === 7 ? "★" : pr ? `<span>${pr}</span>` : ""}</button>`);
    }
    const preview = P.pend.length ? check(s, P.pend) : null;
    el.innerHTML = `<div class="ws-wrap"><div class="wdb" role="grid" aria-label="Wordsmith board">${sq.join("")}</div>
      ${me >= 0 ? `<div class="wdr" aria-label="Your tiles">${rack.map((l, i) => `<button class="wdt${P.used.includes(i) ? " used" : ""}${P.sel === i ? " sel" : ""}" data-i="${i}" ${P.used.includes(i) ? "disabled" : ""}><b>${l === "?" ? "" : l}</b><i>${l === "?" ? "" : PTS(l)}</i></button>`).join("")}</div>
      <div class="tb-bar">${c.myTurn ? `<button class="glass p" id="wPlay" ${P.pend.length ? "" : "disabled"}>Play${preview && typeof preview !== "string" ? ` · ${preview.score}` : ""}</button><button class="glass" id="wBack" ${P.pend.length ? "" : "disabled"}>Take back</button><button class="glass" id="wSwap" ${s.bag.length >= C ? "" : "disabled"}>Swap</button><button class="glass" id="wPass">Pass</button>` : "<span>Wait for your turn.</span>"}<span class="wdbag">${s.bag.length} tiles in the bag</span></div>
      ${preview && typeof preview === "string" ? `<p class="wdmsg">${c.esc(preview)}</p>` : ""}` : `<p class="wdmsg">You're watching.</p>`}</div>
      <style>.ws-wrap{display:grid;gap:12px;justify-items:center;align-content:start;height:fit-content}.wdb{height:fit-content;align-content:start;grid-auto-rows:var(--q)}.wdb{--q:min(calc((100vh - 340px) / 15),calc((100vw - 420px) / 15),40px);display:grid;grid-template-columns:repeat(15,var(--q));gap:2px;padding:8px;border-radius:18px;background:#0B2A34;box-shadow:0 30px 60px #0007}
      .wdq{all:unset;box-sizing:border-box;width:var(--q);height:var(--q);border-radius:6px;background:#174B5B;display:grid;place-items:center;position:relative;font:800 calc(var(--q) * .5) Archivo,system-ui;color:#fff;cursor:pointer}
      .wdq span{font:800 calc(var(--q) * .28) Archivo,system-ui;opacity:.9}.wdq.W3{background:#B4472F}.wdq.W2{background:#C9766A}.wdq.L3{background:#2D6A9F}.wdq.L2{background:#5E95C2}
      .wdq.t,.wdq.p,.wdt{background:linear-gradient(160deg,#FFF6E4,#F0DDB8);color:#0E2F3C;box-shadow:inset 0 -2px 0 #0002}.wdq.p{outline:2px solid #EE9B1E;outline-offset:-2px}.wdq.last{box-shadow:0 0 0 2px #3FD0C8 inset}
      .wdq i,.wdt i{position:absolute;right:3px;bottom:1px;font:700 calc(var(--q) * .24) Archivo,system-ui;font-style:normal}
      .wdr{display:flex;gap:6px}.wdt{all:unset;box-sizing:border-box;width:44px;height:44px;border-radius:10px;display:grid;place-items:center;position:relative;font:800 1.5rem Archivo,system-ui;cursor:pointer;background:linear-gradient(160deg,#FFF6E4,#F0DDB8);color:#0E2F3C}
      .wdt i{font-size:.7rem;right:5px;bottom:3px}.wdt.sel{transform:translateY(-6px);box-shadow:0 0 0 3px #EE9B1E}.wdt.used{opacity:.25}
      .wdbag{color:#A9C0C6;font-size:.85rem}.wdmsg{margin:0;color:#F5C46D;font-weight:600}
      @media (max-width:900px){.wdb{--q:calc((100vw - 48px) / 15)}}</style>`;
    const $$ = (q) => el.querySelectorAll(q);
    $$(".wdt").forEach((b) => (b.onclick = () => { P.sel = +b.dataset.i; c.view(); }));
    $$(".wdq").forEach((b) => (b.onclick = () => {
      if (!c.myTurn) return; const r = +b.dataset.r, col = +b.dataset.c;
      const pi = P.pend.findIndex((x) => x[0] === r && x[1] === col);
      if (pi >= 0) { P.used.splice(P.used.indexOf(P.pend[pi][4]), 1); P.pend.splice(pi, 1); return c.view(); }
      if (P.sel == null) return c.toast("Pick a tile from your rack first.");
      let l = rack[P.sel], blank = 0;
      if (l === "?") { const v = (prompt("Which letter should the blank be?") || "").trim().toUpperCase(); if (!/^[A-Z]$/.test(v)) return; l = v; blank = 1; }
      P.pend.push([r, col, l, blank, P.sel]); P.used.push(P.sel); P.sel = null; c.view();
    }));
    const bt = (id, fn) => el.querySelector(id) && (el.querySelector(id).onclick = fn);
    bt("#wPlay", () => { const r = check(s, P.pend.map((p) => p.slice(0, 4))); if (typeof r === "string") return c.toast(r); c.act({ place: P.pend.map((p) => p.slice(0, 4)) }); });
    bt("#wBack", () => { P.pend = []; P.used = []; c.view(); });
    bt("#wPass", () => c.act("pass"));
    bt("#wSwap", () => { const sel = P.sel != null ? [rack[P.sel]] : rack.slice(); c.act({ swap: sel }); c.toast(P.sel != null ? "Swapped one tile." : "Swapped all your tiles. Pick one tile first to swap just that one."); });
  },
});
