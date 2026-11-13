// Kayak Flip: an original shedding card game with Kayak's own deck. Designed and developed by Kayak.
// Match the top card by colour or symbol; first to empty their hand wins.
import { table, shuffle } from "./table.js";

const SUITS = [["teal", "#17807E", "Teal"], ["saffron", "#EE9B1E", "Saffron"], ["sky", "#2D6A9F", "Sky"], ["olive", "#7A8F2E", "Olive"]];
const SUIT = Object.fromEntries(SUITS.map(([k, c, n]) => [k, { c, n }]));
// Actions: block (next player misses a turn), turn (reverse direction), plus2 (next draws 2 and misses a turn),
// switch (choose the colour), surge (choose the colour; next draws 4 and misses a turn).
const SYM = { block: "⊘", turn: "⇄", plus2: "+2", switch: "◐", surge: "+4" };
const NAME = { block: "Block", turn: "Turn", plus2: "Plus 2", switch: "Switch", surge: "Surge" };
function deck(st) {
  const d = []; let id = 0;
  for (const [s] of SUITS) { d.push({ id: id++, s, v: "0" }); for (let k = 0; k < 2; k++) { for (let v = 1; v <= 9; v++) d.push({ id: id++, s, v: String(v) }); for (const a of ["block", "turn", "plus2"]) d.push({ id: id++, s, v: a }); } }
  for (let k = 0; k < 4; k++) { d.push({ id: id++, s: "wild", v: "switch" }); d.push({ id: id++, s: "wild", v: "surge" }); }
  return shuffle(st, d);
}
const top = (s) => s.pile[s.pile.length - 1];
const playable = (s, c) => c.s === "wild" || c.s === s.color || c.v === top(s).v;
function take(s, t, n) { for (let i = 0; i < n; i++) { if (!s.deck.length) { const keep = s.pile.pop(); s.deck = shuffle(s, s.pile); s.pile = [keep]; } if (!s.deck.length) break; s.hands[t].push(s.deck.pop()); } }
const step = (s, k = 1) => { const n = s.hands.length; s.t = (((s.t + s.dir * k) % n) + n) % n; };
const label = (c) => (/^\d$/.test(c.v) ? c.v : SYM[c.v]);

export const mount = (api) => table(api, {
  kind: "flip", name: "Kayak Flip", tagline: "Match colours and symbols, play your action cards at the right moment, and empty your hand first.", min: 2, max: 6,
  help: "<ul><li>Play a card that matches the top card's colour or symbol, or a Switch / Surge card at any time.</li><li>Block: the next player misses a turn. Turn: play reverses direction. Plus 2: the next player draws two and misses a turn.</li><li>Switch: choose the colour. Surge: choose the colour, and the next player draws four and misses a turn.</li><li>Can't play? Draw a card. If it fits, you can play it straight away; otherwise keep it and your turn ends.</li><li>When you're down to one card, everyone sees “Flip!”. First to play their last card wins.</li></ul>",
  setup(n, seed, opts, names) {
    const s = { r: seed, names, hands: Array.from({ length: n }, () => []), pile: [], t: 0, dir: 1, drew: null, done: null, log: ["Seven cards each."] };
    s.deck = deck(s); for (let i = 0; i < n; i++) take(s, i, 7);
    let c; do { c = s.deck.pop(); if (c.s === "wild") s.deck.unshift(c); } while (c.s === "wild");
    s.pile.push(c); s.color = c.s; return s;
  },
  turn: (s) => s.t,
  apply(s, m, t) {
    if (s.done != null) return null;
    const who = s.names?.[t] || `Player ${t + 1}`, hand = s.hands[t];
    if (m === "draw") { if (s.drew != null) return null; take(s, t, 1); const c = hand[hand.length - 1]; if (c && playable(s, c)) { s.drew = c.id; s.log.push(`${who} drew a card.`); } else { s.log.push(`${who} drew a card and passed.`); step(s); } return s; }
    if (m === "pass") { if (s.drew == null) return null; s.drew = null; s.log.push(`${who} kept the card.`); step(s); return s; }
    if (!m || typeof m !== "object") return null;
    const i = hand.findIndex((c) => c.id === m.play); if (i < 0) return null;
    const c = hand[i];
    if (s.drew != null && c.id !== s.drew) return null;
    if (!playable(s, c)) return null;
    if (c.s === "wild" && !SUIT[m.color]) return null;
    hand.splice(i, 1); s.pile.push(c); s.color = c.s === "wild" ? m.color : c.s; s.drew = null;
    let msg = `${who} played ${c.s === "wild" ? NAME[c.v] + " → " + SUIT[m.color].n : SUIT[c.s].n + " " + (/^\d$/.test(c.v) ? c.v : NAME[c.v])}`;
    if (!hand.length) { s.done = t; s.log.push(msg + ` - and wins!`); return s; }
    if (hand.length === 1) msg += ". Flip!";
    s.log.push(msg + (msg.endsWith("!") ? "" : "."));
    const n = s.hands.length;
    if (c.v === "turn") { s.dir = -s.dir; if (n === 2) step(s, 2); else step(s); }
    else if (c.v === "block") step(s, 2);
    else if (c.v === "plus2" || c.v === "surge") { step(s); take(s, s.t, c.v === "plus2" ? 2 : 4); s.log.push(`${s.names?.[s.t] || "Next player"} draws ${c.v === "plus2" ? 2 : 4} and misses a turn.`); step(s); }
    else step(s);
    return s;
  },
  over: (s) => (s.done == null ? null : { winners: [s.done], text: `${s.names?.[s.done] || "Player " + (s.done + 1)} wins!` }),
  ai(s, t) {
    const hand = s.hands[t];
    const opts = hand.filter((c) => (s.drew == null ? true : c.id === s.drew) && playable(s, c));
    if (!opts.length) return s.drew != null ? "pass" : "draw";
    const nextSize = s.hands[(((t + s.dir) % s.hands.length) + s.hands.length) % s.hands.length].length;
    const rank = (c) => (c.s === "wild" ? (c.v === "surge" && nextSize <= 2 ? 50 : -20) : ["plus2", "block"].includes(c.v) ? (nextSize <= 3 ? 40 : 10) : c.v === "turn" ? 8 : 0) + hand.filter((x) => x.s === c.s).length * 3;
    const c = opts.sort((a, b) => rank(b) - rank(a))[0];
    const counts = {}; for (const x of hand) if (x.s !== "wild" && x.id !== c.id) counts[x.s] = (counts[x.s] || 0) + 1;
    const color = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "teal";
    return c.s === "wild" ? { play: c.id, color } : { play: c.id };
  },
  aiDelay: 900,
  seatInfo: (s, i) => `${s.hands[i].length} card${s.hands[i].length === 1 ? "" : "s"}${s.hands[i].length === 1 ? " · Flip!" : ""}`,
  view(s, el, c) {
    const me = c.me, hand = me >= 0 ? s.hands[me] : [];
    const card = (k, attrs = "", small = false) => `<button class="fc ${k.s}${small ? " sm" : ""}" ${attrs} style="--c:${k.s === "wild" ? "#0E2F3C" : SUIT[k.s].c}"><span class="tl">${label(k)}</span><span class="mid">${label(k)}</span><span class="br">${label(k)}</span><span class="lg" aria-hidden="true">K</span></button>`;
    const others = s.hands.map((h, i) => i === me ? "" : `<div class="fo${i === c.turn ? " turn" : ""}"><div class="fan">${h.slice(0, 12).map(() => '<span class="back"></span>').join("")}</div><small>${c.esc(c.players[i].name)} · ${h.length}</small></div>`).join("");
    const can = (k) => c.myTurn && (s.drew == null || k.id === s.drew) && playable(s, k);
    el.innerHTML = `<div class="fl"><div class="fl-others">${others}</div>
      <div class="fl-mid"><button class="fc back deck" id="fDeck" ${c.myTurn && s.drew == null ? "" : "disabled"} aria-label="Draw a card"><span class="lg">Kayak<br>Flip</span></button>
        ${card(top(s), "disabled")}<div class="fl-col" style="--c:${SUIT[s.color].c}">${SUIT[s.color].n}<small>${s.dir > 0 ? "↻" : "↺"}</small></div></div>
      ${me >= 0 ? `<div class="fl-hand">${hand.map((k) => card(k, `data-id="${k.id}" ${can(k) ? "" : 'aria-disabled="true"'}`)).join("")}</div>
      <div class="tb-bar">${c.myTurn ? (s.drew != null ? `<span>You drew a card you can play.</span><button class="glass" id="fKeep">Keep it</button>` : `<span>Your turn: play a card or draw.</span>`) : ""}</div>` : ""}</div>
      <style>.fl{display:grid;gap:18px;justify-items:center;width:100%}.fl-others{display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
      .fo{display:grid;justify-items:center;gap:4px;color:#C9D8DC;padding:6px 10px;border-radius:14px}.fo.turn{background:#EE9B1E26;box-shadow:0 0 0 2px #EE9B1E}
      .fan{display:flex}.fan .back{width:26px;height:38px;margin-left:-14px;border-radius:5px;background:linear-gradient(150deg,#1FA3A0,#0E2F3C);border:1.5px solid #fff;box-shadow:0 2px 4px #0006}.fan .back:first-child{margin-left:0}
      .fl-mid{display:flex;gap:18px;align-items:center}
      .fc{all:unset;box-sizing:border-box;cursor:pointer;width:96px;height:140px;border-radius:14px;background:#fff;border:6px solid #fff;position:relative;display:grid;place-items:center;box-shadow:0 12px 26px #0007;transition:transform .15s;
        background:radial-gradient(circle at 50% 50%,#fff 34%,var(--c) 35%)}
      .fc.wild{background:conic-gradient(#17807E 0 25%,#EE9B1E 0 50%,#2D6A9F 0 75%,#7A8F2E 0)}
      .fc .mid{font:800 2rem Archivo,system-ui;color:var(--c);z-index:1}.fc.wild .mid{color:#0E2F3C;background:#fff;border-radius:50%;width:54px;height:54px;display:grid;place-items:center;font-size:1.4rem}
      .fc .tl,.fc .br{position:absolute;font:800 .95rem Archivo,system-ui;color:#fff;text-shadow:0 1px 2px #0006}.fc .tl{left:8px;top:6px}.fc .br{right:8px;bottom:6px;transform:rotate(180deg)}
      .fc .lg{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font:800 .55rem Archivo,system-ui;color:#fff8;letter-spacing:.1em}
      .fc.back{background:linear-gradient(150deg,#1FA3A0,#0E2F3C);border-color:#fff}.fc.back .lg{position:static;transform:none;font-size:.95rem;text-align:center;color:#fff;line-height:1.1}
      .fl-hand{display:flex;flex-wrap:wrap;justify-content:center;gap:0;max-width:min(980px,calc(100vw - 420px))}.fl-hand .fc{margin:0 -14px;width:84px;height:124px}
      .fl-hand .fc:not([aria-disabled]):hover{transform:translateY(-16px);z-index:2}.fl-hand .fc[aria-disabled]{filter:saturate(.35) brightness(.8)}
      .fl-col{color:#fff;font-weight:800;display:grid;justify-items:center;gap:4px}.fl-col::before{content:"";width:34px;height:34px;border-radius:50%;background:var(--c);box-shadow:0 0 0 4px #ffffff33}
      @media (max-width:900px){.fl-hand{max-width:calc(100vw - 32px)}.fl-hand .fc{width:64px;height:96px;margin:0 -10px}}</style>`;
    el.querySelector("#fDeck").onclick = () => c.act("draw");
    el.querySelector("#fKeep") && (el.querySelector("#fKeep").onclick = () => c.act("pass"));
    el.querySelectorAll(".fl-hand [data-id]").forEach((b) => (b.onclick = () => {
      const k = hand.find((x) => x.id === +b.dataset.id); if (!k) return;
      if (!can(k)) return c.toast(c.myTurn ? "That card doesn't match." : "Wait for your turn.");
      if (k.s !== "wild") return c.act({ play: k.id });
      const box = document.createElement("div"); box.className = "fl-pick"; box.innerHTML = `<b>Choose the colour</b><div>${SUITS.map(([key, col, n]) => `<button data-c="${key}" style="background:${col}">${n}</button>`).join("")}</div>
        <style>.fl-pick{position:fixed;inset:0;display:grid;place-content:center;justify-items:center;gap:14px;background:#0009;color:#fff;z-index:20;font:800 1.2rem Archivo,system-ui}.fl-pick div{display:flex;gap:10px}.fl-pick button{all:unset;cursor:pointer;padding:16px 22px;border-radius:14px;color:#fff;font-weight:800;box-shadow:0 8px 20px #0006}</style>`;
      document.body.append(box);
      box.onclick = (e) => { const p = e.target.closest("[data-c]"); box.remove(); if (p) c.act({ play: k.id, color: p.dataset.c }); };
    }));
  },
});
