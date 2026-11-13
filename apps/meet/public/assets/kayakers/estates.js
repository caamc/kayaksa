// Kayak Estates: an original property-trading board game with Kayak's own board, districts and cards.
// Designed and developed by Kayak. Buy districts, complete sets, build offices, collect rent.
import { table, roll, shuffle, COLORS } from "./table.js";

const G6 = [["Startup", "#8FB8B5"], ["Ledger", "#2D6A9F"], ["Harbour", "#17807E"], ["Compass", "#7A8F2E"], ["Summit", "#9C630E"], ["Charter", "#5E4B78"]];
// 24 spaces around the board. p = price, g = set.
const B = [
  { k: "go", n: "Start", d: "Collect ₹200 as you pass" },
  { k: "prop", n: "Startup Lane", g: 0, p: 60 }, { k: "prop", n: "Founders Row", g: 0, p: 70 }, { k: "card", n: "Kayak Insight" },
  { k: "prop", n: "Mint Street", g: 0, p: 90 }, { k: "tax", n: "GST", d: "Pay 10% of your cash (up to ₹150)" },
  { k: "rest", n: "Coffee Break", d: "Just visiting" },
  { k: "prop", n: "Ledger Square", g: 1, p: 110 }, { k: "prop", n: "Treaty Court", g: 1, p: 130 }, { k: "card", n: "Kayak Insight" },
  { k: "prop", n: "Harbour Exchange", g: 2, p: 150 }, { k: "prop", n: "Pilot Wharf", g: 2, p: 160 },
  { k: "pot", n: "Networking Lounge", d: "Collect the fines pot" },
  { k: "prop", n: "Compass Park", g: 3, p: 180 }, { k: "prop", n: "Summit Plaza", g: 3, p: 200 }, { k: "card", n: "Kayak Insight" },
  { k: "prop", n: "Charter Gate", g: 3, p: 210 }, { k: "tax", n: "Professional Tax", d: "Pay ₹75" },
  { k: "notice", n: "Regulator's Notice", d: "Pay a ₹100 fine into the pot" },
  { k: "prop", n: "Meridian Tower", g: 4, p: 240 }, { k: "prop", n: "Atlas Heights", g: 4, p: 260 }, { k: "card", n: "Kayak Insight" },
  { k: "prop", n: "Kayak Quay", g: 5, p: 320 }, { k: "prop", n: "Grand Mandate", g: 5, p: 380 },
];
const SET = (g) => B.map((x, i) => [x, i]).filter(([x]) => x.g === g).map(([, i]) => i);
const CARDS = [
  ["A client paid early. Collect ₹100.", (s, t) => (s.cash[t] += 100)],
  ["Training budget. Pay ₹50 into the pot.", (s, t) => fine(s, t, 50)],
  ["Won a pitch! Collect ₹150.", (s, t) => (s.cash[t] += 150)],
  ["Compliance review. Pay ₹100 into the pot.", (s, t) => fine(s, t, 100)],
  ["Advance to Start and collect ₹200.", (s, t) => { s.pos[t] = 0; s.cash[t] += 200; }],
  ["Everyone pays you ₹25 for advice.", (s, t) => s.cash.forEach((_, o) => { if (o !== t && !s.out[o]) { s.cash[o] -= 25; s.cash[t] += 25; } })],
  ["Office maintenance: pay ₹25 for each office you own.", (s, t) => fine(s, t, 25 * s.off.reduce((a, n, i) => a + (s.own[i] === t ? n : 0), 0))],
  ["Referral bonus. Collect ₹75.", (s, t) => (s.cash[t] += 75)],
  ["Late filing penalty. Pay ₹60 into the pot.", (s, t) => fine(s, t, 60)],
  ["Annual retreat. Every other player collects ₹20 from you.", (s, t) => s.cash.forEach((_, o) => { if (o !== t && !s.out[o]) { s.cash[t] -= 20; s.cash[o] += 20; } })],
];
function fine(s, t, n) { s.cash[t] -= n; s.pot += n; }
const ownsSet = (s, t, g) => SET(g).every((i) => s.own[i] === t);
function rent(s, i) { const x = B[i], o = s.own[i]; let r = Math.round(x.p / 8); if (s.off[i]) r = Math.round(x.p * [0, 0.5, 1.4, 3][s.off[i]]); else if (ownsSet(s, o, x.g)) r *= 2; return r; }
const buildCost = (i) => Math.round(B[i].p * 0.6);
const worth = (s, t) => s.cash[t] + s.own.reduce((a, o, i) => a + (o === t ? B[i].p + s.off[i] * buildCost(i) : 0), 0);
function settle(s, t) {
  // Can't pay? Offices are sold back at half price, then districts at half price. Still short: out of the game.
  while (s.cash[t] < 0) {
    const off = s.own.findIndex((o, i) => o === t && s.off[i] > 0);
    if (off >= 0) { s.off[off]--; s.cash[t] += Math.round(buildCost(off) / 2); continue; }
    const pr = s.own.findIndex((o) => o === t);
    if (pr >= 0) { s.own[pr] = null; s.cash[t] += Math.round(B[pr].p / 2); s.log.push(`${nm(s, t)} sold ${B[pr].n} to the bank.`); continue; }
    s.out[t] = true; s.log.push(`${nm(s, t)} is out of the game.`); break;
  }
}
const nm = (s, t) => s.names?.[t] || `Player ${t + 1}`;
function nextT(s) { s.dbl = 0; s.phase = "roll"; s.dice = null; const n = s.cash.length; do { s.t = (s.t + 1) % n; if (s.t === 0) s.round++; } while (s.out[s.t] && s.out.filter((x) => !x).length > 1); }

export const mount = (api) => table(api, {
  kind: "estates", name: "Kayak Estates", tagline: "Buy business districts, complete sets, build offices and out-earn your colleagues.", min: 2, max: 6,
  help: "<ul><li>Roll two dice and move. Passing Start pays ₹200.</li><li>Land on a free district to buy it. Land on someone else's and pay them rent.</li><li>Own every district of one colour to double its rent, and build up to three offices on them for much higher rent.</li><li>Kayak Insight cards bring good and bad news. Fines go into the pot at the Networking Lounge - land there to collect it.</li><li>Roll doubles to go again. If you can't pay, offices and districts are sold back to the bank at half price; if that's not enough, you're out.</li><li>The game ends when only one player is left, or after the agreed number of rounds - then the highest net worth wins.</li></ul>",
  options: () => `<label class="tb-opt">Rounds <select id="esRounds"><option>10</option><option selected>15</option><option>25</option><option>40</option></select></label>`,
  readOptions: (root) => ({ rounds: Number(root.querySelector("#esRounds")?.value || 15) }),
  setup(n, seed, opts, names) {
    const s = { r: seed, names, cash: Array(n).fill(1500), pos: Array(n).fill(0), out: Array(n).fill(false), own: B.map(() => null), off: B.map(() => 0), t: 0, phase: "roll", dice: null, dbl: 0, pot: 0, round: 1, rounds: Math.min(60, Math.max(5, opts.rounds || 15)), card: null, log: ["Everyone starts with ₹1,500."] };
    s.deck = shuffle(s, CARDS.map((_, i) => i)); return s;
  },
  turn: (s) => s.t,
  apply(s, m, t) {
    if (this_over(s)) return null;
    const who = nm(s, t);
    if (m === "roll") {
      if (s.phase !== "roll") return null;
      const a = roll(s), b = roll(s); s.dice = [a, b]; s.card = null;
      const dbl = a === b; s.dbl = dbl ? s.dbl + 1 : 0;
      let p = s.pos[t] + a + b; if (p >= B.length) { p -= B.length; s.cash[t] += 200; s.log.push(`${who} passed Start: +₹200.`); }
      s.pos[t] = p; const x = B[p];
      s.log.push(`${who} rolled ${a}+${b} → ${x.n}.`);
      s.phase = "act";
      if (x.k === "prop") { if (s.own[p] == null) s.phase = "buy"; else if (s.own[p] !== t && !s.out[s.own[p]]) { const r = rent(s, p); s.cash[t] -= r; s.cash[s.own[p]] += r; s.log.push(`${who} paid ₹${r} rent to ${nm(s, s.own[p])}.`); } }
      else if (x.k === "tax") { const amt = x.n === "GST" ? Math.min(150, Math.round(Math.max(0, s.cash[t]) * 0.1)) : 75; fine(s, t, amt); s.log.push(`${who} paid ₹${amt} ${x.n}.`); }
      else if (x.k === "notice") { fine(s, t, 100); s.log.push(`${who} paid a ₹100 fine.`); }
      else if (x.k === "pot" && s.pot) { s.cash[t] += s.pot; s.log.push(`${who} collected the ₹${s.pot} pot!`); s.pot = 0; }
      else if (x.k === "card") { if (!s.deck.length) s.deck = shuffle(s, CARDS.map((_, i) => i)); const c = s.deck.pop(); s.card = CARDS[c][0]; CARDS[c][1](s, t); s.log.push(`${who}: ${CARDS[c][0]}`); }
      settle(s, t); if (s.out[t]) nextT(s);
      return s;
    }
    if (m === "buy" || m === "skip") {
      if (s.phase !== "buy") return null;
      const p = s.pos[t];
      if (m === "buy") { if (s.cash[t] < B[p].p) return null; s.cash[t] -= B[p].p; s.own[p] = t; s.log.push(`${who} bought ${B[p].n} for ₹${B[p].p}.`); }
      s.phase = "act"; return s;
    }
    if (m?.build != null) {
      const i = m.build; if (s.phase !== "act" || s.own[i] !== t || B[i].k !== "prop" || !ownsSet(s, t, B[i].g) || s.off[i] >= 3 || s.cash[t] < buildCost(i)) return null;
      const set = SET(B[i].g); if (s.off[i] > Math.min(...set.map((j) => s.off[j]))) return null; // build evenly
      s.cash[t] -= buildCost(i); s.off[i]++; s.log.push(`${who} built an office on ${B[i].n}.`); return s;
    }
    if (m === "end") {
      if (s.phase !== "act") return null;
      if (s.dice && s.dice[0] === s.dice[1] && s.dbl < 3 && !s.out[t]) { s.phase = "roll"; s.log.push(`${who} rolled doubles - roll again.`); return s; }
      nextT(s); return s;
    }
    return null;
  },
  over: (s) => this_over(s),
  ai(s, t) {
    if (s.phase === "roll") return "roll";
    if (s.phase === "buy") { const p = s.pos[t], x = B[p]; const ownedInSet = SET(x.g).filter((i) => s.own[i] === t).length; return s.cash[t] - x.p >= (ownedInSet ? 80 : 200) ? "buy" : "skip"; }
    const can = s.own.map((o, i) => i).filter((i) => s.own[i] === t && B[i].k === "prop" && ownsSet(s, t, B[i].g) && s.off[i] < 3 && s.cash[t] - buildCost(i) >= 250 && s.off[i] <= Math.min(...SET(B[i].g).map((j) => s.off[j])));
    return can.length ? { build: can[0] } : "end";
  },
  aiDelay: 850,
  seatInfo: (s, i) => (s.out[i] ? "Out" : `₹${s.cash[i].toLocaleString("en-IN")} · worth ₹${worth(s, i).toLocaleString("en-IN")}`),
  view(s, el, c) {
    const t = c.turn, mine = c.myTurn;
    const pos = (i) => { if (i <= 6) return [6 - i, 6]; if (i <= 12) return [0, 6 - (i - 6)]; if (i <= 18) return [i - 12, 0]; return [6, i - 18]; };
    const tiles = B.map((x, i) => { const [cx, cy] = pos(i); const o = s.own[i];
      return `<div class="et ${x.k}" style="grid-column:${cx + 1};grid-row:${cy + 1};${x.g != null ? `--g:${G6[x.g][1]}` : ""}" title="${c.esc(x.n)}${x.p ? ` · ₹${x.p} · rent ₹${o != null ? rent(s, i) : Math.round(x.p / 8)}` : x.d ? " · " + c.esc(x.d) : ""}">
        ${x.g != null ? `<span class="band"></span>` : ""}<b>${c.esc(x.n)}</b>${x.p ? `<small>₹${x.p}</small>` : x.k === "pot" && s.pot ? `<small>Pot ₹${s.pot}</small>` : ""}
        ${o != null ? `<span class="own" style="background:${COLORS[o]}">${"▪".repeat(s.off[i])}</span>` : ""}
        <span class="tks">${s.pos.map((p, k) => (p === i && !s.out[k] ? `<i style="background:${COLORS[k]}"></i>` : "")).join("")}</span></div>`; }).join("");
    const here = B[s.pos[t]];
    const builds = mine && s.phase === "act" ? s.own.map((o, i) => i).filter((i) => s.own[i] === t && B[i].k === "prop" && ownsSet(s, t, B[i].g) && s.off[i] < 3 && s.off[i] <= Math.min(...SET(B[i].g).map((j) => s.off[j]))) : [];
    const centre = `<div class="ec"><div class="ec-brand">KAYAK<br><span>ESTATES</span></div>
      ${s.dice ? `<div class="ec-dice"><span class="tb-dice">${"⚀⚁⚂⚃⚄⚅"[s.dice[0] - 1]}</span><span class="tb-dice">${"⚀⚁⚂⚃⚄⚅"[s.dice[1] - 1]}</span></div>` : ""}
      ${s.card ? `<div class="ec-card"><small>KAYAK INSIGHT</small>${c.esc(s.card)}</div>` : ""}
      <div class="ec-acts">${!mine ? `<span>${c.esc(c.players[t]?.name || "")} is playing…</span>` : s.phase === "roll" ? `<button class="glass p" data-m="roll">Roll the dice</button>` : s.phase === "buy" ? `<span>Buy <b>${c.esc(here.n)}</b> for ₹${here.p}?</span><button class="glass p" data-m="buy" ${s.cash[t] < here.p ? "disabled" : ""}>Buy</button><button class="glass" data-m="skip">No thanks</button>` : `${builds.map((i) => `<button class="glass" data-b="${i}" ${s.cash[t] < buildCost(i) ? "disabled" : ""}>Build on ${c.esc(B[i].n)} · ₹${buildCost(i)}</button>`).join("")}<button class="glass p" data-m="end">${s.dice && s.dice[0] === s.dice[1] ? "Roll again" : "End turn"}</button>`}</div>
      <small class="ec-round">Round ${Math.min(s.round, s.rounds)} of ${s.rounds}</small></div>`;
    el.innerHTML = `<div class="eb">${tiles}${centre}</div>
      <style>.eb{--q:min(calc((100vh - 120px) / 7),calc((100vw - 420px) / 7),118px);display:grid;grid-template-columns:repeat(7,var(--q));grid-template-rows:repeat(7,var(--q));gap:3px;padding:8px;border-radius:22px;background:#0B2A34;box-shadow:0 30px 60px #0007}
      .et{background:#F4F8F7;border-radius:8px;position:relative;padding:calc(var(--q) * .14) 4px 4px;display:flex;flex-direction:column;gap:2px;overflow:hidden;color:#0E2F3C}
      .et b{font:800 calc(var(--q) * .11) Archivo,system-ui;line-height:1.1}.et small{font:600 calc(var(--q) * .1) Archivo,system-ui;color:#4A6A72}
      .et .band{position:absolute;left:0;right:0;top:0;height:calc(var(--q) * .1);background:var(--g)}
      .et.go{background:linear-gradient(160deg,#1FA3A0,#17807E);color:#fff}.et.go small{color:#E0F2F1}.et.card{background:#FFF6E4}.et.tax,.et.notice{background:#F6E2DD}.et.rest,.et.pot{background:#E1EEF7}
      .et .own{position:absolute;right:3px;bottom:3px;min-width:12px;height:12px;border-radius:6px;color:#fff;font-size:9px;line-height:12px;padding:0 2px;border:1.5px solid #fff}
      .et .tks{position:absolute;left:4px;bottom:4px;display:flex;gap:2px}.et .tks i{width:calc(var(--q) * .13);height:calc(var(--q) * .13);border-radius:50%;border:1.5px solid #fff;box-shadow:0 2px 4px #0007}
      .ec{grid-column:2/7;grid-row:2/7;border-radius:16px;background:radial-gradient(circle at 50% 30%,#1B5566,#0E2F3C);display:grid;place-content:center;justify-items:center;gap:12px;padding:10px;color:#fff;text-align:center}
      .ec-brand{font:800 calc(var(--q) * .34) Archivo,system-ui;letter-spacing:.12em;line-height:1}.ec-brand span{color:#EE9B1E;font-size:.62em;letter-spacing:.3em}
      .ec-dice{display:flex;gap:10px}.ec-card{background:#FFF6E4;color:#0E2F3C;border-radius:12px;padding:10px 14px;max-width:320px;font-weight:600;display:grid;gap:4px}.ec-card small{color:#9C630E;font-weight:800;letter-spacing:.12em;font-size:.68rem}
      .ec-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;max-width:520px}.ec-round{color:#8FA8AE}
      @media (max-width:900px){.eb{--q:calc((100vw - 48px) / 7)}.et b{font-size:7px}}</style>`;
    el.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => c.act(b.dataset.m)));
    el.querySelectorAll("[data-b]").forEach((b) => (b.onclick = () => c.act({ build: +b.dataset.b })));
  },
});
function this_over(s) {
  const alive = s.out.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
  if (alive.length === 1) return { winners: alive, text: `${nm(s, alive[0])} wins - everyone else is out!` };
  if (s.round > s.rounds) { const best = Math.max(...alive.map((i) => worth(s, i))); const w = alive.filter((i) => worth(s, i) === best); return { winners: w, text: `${w.map((i) => nm(s, i)).join(" and ")} win${w.length > 1 ? "" : "s"} with ₹${best.toLocaleString("en-IN")}!` }; }
  return null;
}
