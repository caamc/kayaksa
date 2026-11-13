// End-to-end checks for Kayakers: the hub, a shared whiteboard, live chess between two colleagues,
// chess against Kayak AI, Kayak Four and Carrom. Run against
// `wrangler dev -c apps/meet/wrangler.local.jsonc --port 8704`:
//   NODE_PATH=$(npm root -g) node tests/e2e/meet-kayakers.mjs [shotdir]
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
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1360, height: 860 } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(name + ": " + e.message));
  await p.goto(`${BASE}/auth/sso?t=${encodeURIComponent(signMeet({ r: "sso", role: "member", n: name, e: email, x: Date.now() + 60000, j: crypto.randomUUID() }))}`);
  await p.waitForSelector(".rail");
  return p;
}
const A = await employee("Anuj Agarwal", "anuj@kayaksa.com");
const R = await employee("Ria Mehta", "ria@kayaksa.com");

console.log("Hub");
await A.click('.rail [data-v="kayakers"]');
await A.waitForSelector(".kx-game");
ok((await A.$$(".kx-game")).length === 10, "the hub lists all ten games");
await shot(A, "k01-hub");

console.log("Whiteboard");
await A.click("#kxNewB"); await A.fill("#kxt", "Project Falcon — workplan"); await A.click("dialog .btn.p");
await A.waitForURL(/\/kayakers\/[a-z0-9]+$/); const boardUrl = A.url();
await A.waitForSelector('#kxStatus[data-s="on"]');
await R.goto(boardUrl); await R.waitForSelector('#kxStatus[data-s="on"]');
const canvas = async (p) => (await p.$("canvas")).boundingBox();
const bb = await canvas(A);
await A.mouse.move(bb.x + 200, bb.y + 200); await A.mouse.down();
for (let i = 0; i < 20; i++) await A.mouse.move(bb.x + 200 + i * 15, bb.y + 200 + Math.sin(i / 3) * 40);
await A.mouse.up(); await sleep(600);
const itemsOn = (p) => p.evaluate(() => window.__kxBoardCount?.() ?? -1);
ok((await itemsOn(R)) >= 1, "a stroke drawn by one colleague appears for the other live");
await R.reload(); await R.waitForSelector('#kxStatus[data-s="on"]'); await sleep(400);
ok((await itemsOn(R)) >= 1, "the whiteboard is saved — it is still there after reloading");
await shot(R, "k02-board");

console.log("Chess between colleagues");
await A.goto(BASE + "/app#kayakers"); await A.waitForSelector(".kx-game");
await A.click('[data-new="chess"][data-mode="team"]'); await A.waitForURL(/\/kayakers\/[a-z0-9]+$/); const chessUrl = A.url();
await A.waitForSelector("#cb .q"); await R.goto(chessUrl); await R.waitForSelector("#cb .q");
await A.click('[data-seat="w"]'); await sleep(300); await R.click('[data-seat="b"]'); await sleep(400);
const sq = (p, name) => p.$(`#cb [data-i="${"abcdefgh".indexOf(name[0]) + (8 - +name[1]) * 8}"]`);
const move = async (p, a, b) => { await (await sq(p, a)).click(); await (await sq(p, b)).click(); await sleep(500); };
await move(A, "e2", "e4"); await move(R, "e7", "e5");
const moves = await R.$eval("#cmoves", (e) => e.textContent);
ok(/e4/.test(moves) && /e5/.test(moves), "moves made by each player show on both boards");
await move(A, "d1", "h5"); await move(R, "b8", "c6"); await move(A, "f1", "c4"); await move(R, "g8", "f6"); await move(A, "h5", "f7");
const st = await R.$eval("#cst", (e) => e.textContent);
ok(/checkmate|wins/i.test(st), "scholar's mate is detected as checkmate on the other player's screen");
await shot(R, "k03-chess");

console.log("Chess against Kayak AI");
await A.goto(BASE + "/app#kayakers"); await A.waitForSelector(".kx-game");
await A.click('[data-new="chess"][data-mode="ai"]'); await A.waitForURL(/\/kayakers\/[a-z0-9]+$/); await A.waitForSelector("#cb .q"); await sleep(500);
await move(A, "e2", "e4"); await sleep(2200);
const aiMoves = await A.$eval("#cmoves", (e) => (e.textContent.match(/–/g) || []).length + 1);
ok(aiMoves >= 3, "Kayak AI replies to the player's move");

console.log("Kayak Four against Kayak AI");
await A.goto(BASE + "/app#kayakers"); await A.waitForSelector(".kx-game");
await A.click('[data-new="four"][data-mode="ai"]'); await A.waitForURL(/\/kayakers\/[a-z0-9]+$/); await A.waitForSelector("#k4 .col");
await A.click('#k4 [data-c="3"]'); await sleep(1200);
ok((await A.$$("#k4 .h.a")).length === 1 && (await A.$$("#k4 .h.b")).length === 1, "the player drops a disc and Kayak AI answers");
await shot(A, "k04-four");

console.log("Carrom with a colleague");
await A.goto(BASE + "/app#kayakers"); await A.waitForSelector(".kx-game");
await A.click('[data-new="carrom"][data-mode="team"]'); await A.waitForURL(/\/kayakers\/[a-z0-9]+$/); const carUrl = A.url();
await A.waitForSelector("#cr"); await R.goto(carUrl); await R.waitForSelector("#cr");
await A.click('[data-seat="p1"]'); await sleep(300); await R.click('[data-seat="p2"]'); await sleep(400);
const cb = await (await A.$("#cr")).boundingBox(); const k = cb.width / 1000;
await A.mouse.move(cb.x + 500 * k, cb.y + 815 * k); await A.mouse.down();
await A.mouse.move(cb.x + 500 * k, cb.y + 900 * k, { steps: 4 }); await A.mouse.move(cb.x + 505 * k, cb.y + 1000 * k, { steps: 4 });
await A.mouse.up(); await sleep(4500);
const rLast = await R.$eval("#clast", (e) => e.textContent), aLast = await A.$eval("#clast", (e) => e.textContent);
ok(/Last shot/.test(rLast) && rLast === aLast, "a shot is played out and both players see the same result");
await shot(R, "k05-carrom");

console.log("Access");
const anon = await browser.newContext({ userAgent: UA }); const N = await anon.newPage();
await N.goto(boardUrl); ok(/\/login/.test(N.url()), "signed-out visitors are sent to sign-in");
ok(!errs.length, "no script errors" + (errs.length ? ": " + errs.join(" | ") : ""));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
