// Multi-screen share: two people present two screens each (4 total); a fifth is refused.
// Run with the meet worker on :8704 and meeting abc-defg-hjk in local D1.
import { createRequire } from "node:module";
import fs from "node:fs"; import crypto from "node:crypto";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = "http://localhost:8704", R = "abc-defg-hjk";
const KEY = fs.readFileSync(new URL("../../apps/meet/.dev.vars", import.meta.url), "utf8").match(/MEET_SIGNING_KEY=(.*)/)[1].trim().replace(/^"|"$/g, "");
const b64u = (b) => Buffer.from(b).toString("base64url");
const tok = (c) => { const body = b64u(JSON.stringify(c)); return body + "." + crypto.createHmac("sha256", KEY).update(body).digest("base64url"); };
const x = Date.now() + 3600e3;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--autoplay-policy=no-user-gesture-required"] });
const mk = async () => { const c = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, permissions: ["camera", "microphone"] }); const p = await c.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message)); return p; };
const a = await mk(), b = await mk();
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
await a.goto(`${BASE}/${R}?t=${tok({ r: R, role: "host", n: "Anuj", e: "anuj@kayaksa.com", x })}`); await a.click("#join"); await a.waitForSelector("#grid .tile");
await b.goto(`${BASE}/${R}?t=${tok({ r: R, role: "member", n: "Ria", e: "ria@kayaksa.com", x })}`); await b.click("#join"); await b.waitForSelector("#grid .tile");
await a.waitForFunction(() => document.querySelectorAll("#grid .tile").length >= 2, null, { timeout: 15000 });
// Each page shares screens through the app's own function (headless Chrome supplies a fake screen).
const mine = (p) => p.evaluate(() => document.querySelectorAll('[data-k^="me:screen:"]').length);
const share = async (p) => {
  if (!(await mine(p))) return p.click("#bscr");
  await p.click("#bscr");
  const item = p.locator(".menu button", { hasText: "Share another screen" });
  if (await item.count()) await item.first().click(); else await p.keyboard.press("Escape");
};
await share(a); await a.waitForTimeout(800);
ok((await mine(a)) === 1, "first screen shared");
await share(a); await a.waitForTimeout(800);
ok((await mine(a)) === 2, "one person presents a second screen");
await share(b); await b.waitForTimeout(800); await share(b);
await b.waitForTimeout(2500);
ok((await mine(b)) === 2, "another person presents two screens");
const seen = async (p) => p.evaluate(() => document.querySelectorAll("#sgrid .tile").length);
await a.waitForFunction(() => document.querySelectorAll("#sgrid .tile").length === 4, null, { timeout: 15000 }).catch(() => {});
ok((await seen(a)) === 4, "presenter A sees all 4 screens in the presentation grid");
await b.waitForFunction(() => document.querySelectorAll("#sgrid .tile").length === 4, null, { timeout: 15000 }).catch(() => {});
ok((await seen(b)) === 4, "presenter B sees all 4 screens in the presentation grid");
if (process.argv[2]) await a.screenshot({ path: process.argv[2] + "/multiscreen.png" });
await a.click("#bscr"); await a.waitForTimeout(300);
ok((await a.locator(".menu button", { hasText: "Share another screen" }).count()) === 0, "a fifth screen is not offered (limit of 4)");
await a.locator(".menu button", { hasText: "Stop all sharing" }).click(); await b.waitForTimeout(2500);
ok((await seen(b)) <= 2, "when A stops, B's view drops back to B's own screens");
ok(!a.errs.length && !b.errs.length, "no script errors " + [...a.errs, ...b.errs].join(" | "));
await browser.close();
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
