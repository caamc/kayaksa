// End-to-end checks for the seven Kayak table games: each is created, started against Kayak AI,
// played for several turns (a human seat and AI seats), and checked for script errors.
// Also checks two colleagues see the same game state. Run against the meet worker on :8704:
//   node tests/e2e/meet-games.mjs [shotdir]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.MEET_URL || "http://localhost:8704";
const SHOTS = process.argv[2] || "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const KEY = fs.readFileSync(new URL("../../apps/meet/.dev.vars", import.meta.url), "utf8").match(/MEET_SIGNING_KEY=(.*)/)[1].trim().replace(/^"|"$/g, "");
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ✓", msg); } else { fail++; console.log("  ✗", msg); } };
const b64u = (b) => Buffer.from(b).toString("base64url");
const signMeet = (claims) => { const body = b64u(JSON.stringify(claims)); return `${body}.${b64u(crypto.createHmac("sha256", KEY).update(body).digest())}`; };
const shot = async (p, n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.png` });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const errs = [];
async function employee(name, email) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(name + ": " + e.message));
  p.on("dialog", (d) => d.accept("E"));
  await p.goto(`${BASE}/auth/sso?t=${encodeURIComponent(signMeet({ r: "sso", role: "member", n: name, e: email, x: Date.now() + 60000, j: crypto.randomUUID() }))}`);
  await p.waitForSelector(".rail");
  return p;
}
const A = await employee("Anuj Agarwal", "anuj@kayaksa.com");
const R = await employee("Ria Mehta", "ria@kayaksa.com");
const create = (p, kind, mode) => p.evaluate(async ([kind, mode]) => (await (await fetch("/api/ws/kayakers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, mode }) })).json()).id, [kind, mode]);
const status = (p) => p.$eval("#tbStatus", (e) => e.textContent).catch(() => "");
const logLen = (p) => p.$$eval(".tb-log div", (d) => d.length).catch(() => 0);

console.log("Hub");
await A.goto(`${BASE}/app#kayakers`); await A.waitForSelector(".kx-game");
ok((await A.$$(".kx-game")).length === 10, "the hub lists ten games");
await shot(A, "g00-hub");

// One human move per game, by clicking what a person would click.
const human = {
  ttt: async (p) => { const b = await p.$(".tc:not([disabled])"); await b?.click(); },
  snakes: async (p) => { await p.click("#slRoll"); },
  ludo: async (p) => { if (await p.$("#ldRoll")) await p.click("#ldRoll"); else { const t = await p.$("[data-tok]"); await t?.click({ force: true }); } },
  flip: async (p) => { const ok = await p.$(".fl-hand [data-id]:not([aria-disabled])"); if (ok) { await ok.click(); const pick = await p.waitForSelector(".fl-pick [data-c]", { timeout: 800 }).catch(() => null); if (pick) await pick.click(); } else await p.click("#fDeck"); },
  rows: async (p) => { const cards = await p.$$(".rc"); for (const c of cards) { await c.click(); await sleep(80); const t = await p.$(".rt.can"); if (t) { await t.click(); return; } if (await p.$("#rDead")) { await p.click("#rDead"); return; } await c.click(); } },
  estates: async (p) => { const b = await p.$('[data-m="roll"]') || await p.$('[data-m="buy"]:not([disabled])') || await p.$('[data-m="end"]') || await p.$('[data-m="skip"]'); await b?.click(); },
  words: async (p) => { await p.click("#wPass"); },
};
for (const kind of ["ttt", "snakes", "ludo", "flip", "rows", "estates", "words"]) {
  console.log(kind);
  const id = await create(A, kind, "ai");
  await A.goto(`${BASE}/kayakers/${id}`);
  await A.waitForSelector("#tbStart", { timeout: 20000 });
  ok((await A.$eval(".tb-brand small", (e) => e.textContent)).includes("Designed and developed by Kayak"), `${kind}: branded as Kayak's`);
  await shot(A, `g-${kind}-lobby`);
  await A.click("#tbStart");
  await A.waitForSelector(".gm-seat.turn", { timeout: 10000 }).catch(() => {});
  let moves = 0;
  for (let i = 0; i < 40 && moves < 8; i++) {
    const s = await status(A);
    if (/wins|draw|Game over|out!/i.test(s)) break;
    if (s.includes("your turn")) { await human[kind](A); moves++; await sleep(400); }
    else await sleep(500);
  }
  await sleep(1500);
  ok(moves > 0 || /wins|draw/i.test(await status(A)), `${kind}: you can take turns (${moves})`);
  ok((await logLen(A)) >= 2 || kind === "ttt", `${kind}: moves are logged`);
  if (kind !== "ttt" && kind !== "words") ok(/Kayak AI/.test(await A.$eval("#tbSeats", (e) => e.textContent)), `${kind}: Kayak AI is playing`);
  await shot(A, `g-${kind}-play`);
  // A colleague who opens the link sees the same game.
  await R.goto(`${BASE}/kayakers/${id}`); await R.waitForSelector(".gm-seat", { timeout: 10000 });
  await sleep(800);
  ok((await status(R)).replace(/ · your turn/, "") === (await status(A)).replace(/ · your turn/, ""), `${kind}: a colleague sees the same state`);
}

console.log("Two colleagues, Tic Tac Toe");
const id = await create(A, "ttt", "team");
await A.goto(`${BASE}/kayakers/${id}`); await R.goto(`${BASE}/kayakers/${id}`);
await A.waitForSelector('[data-seat="p1"]'); await A.click('[data-seat="p1"]');
await R.waitForSelector('[data-seat="p2"]'); await R.click('[data-seat="p2"]');
await sleep(500); await A.selectOption("#tbAi", "0"); await A.click("#tbStart");
await A.waitForSelector(".tc:not([disabled])");
const seq = [[A, 0], [R, 3], [A, 1], [R, 4], [A, 2]];
for (const [p, i] of seq) { await p.waitForSelector(`.tc[data-i="${i}"]:not([disabled])`, { timeout: 5000 }).catch(() => {}); await p.click(`.tc[data-i="${i}"]`); await sleep(400); }
await sleep(600);
ok(/Crosses win/.test(await status(R)), "the winner shows on both screens");
await shot(R, "g-ttt-two");

console.log(`\n${pass} passed, ${fail} failed`);
if (errs.length) console.log("Page errors:\n  " + [...new Set(errs)].join("\n  "));
await browser.close();
process.exit(fail || errs.length ? 1 : 0);
