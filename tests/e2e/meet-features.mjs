// Breakout rooms, webinar Q&A, voice changer, Kayak Avatar and the Notes.AI record.
// Run with the meet worker on :8704 and meeting abc-defg-hjk in local D1.
import { createRequire } from "node:module";
import fs from "node:fs"; import crypto from "node:crypto";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = "http://localhost:8704", R = "abc-defg-hjk", SHOTS = process.argv[2] || "";
const KEY = fs.readFileSync(new URL("../../apps/meet/.dev.vars", import.meta.url), "utf8").match(/MEET_SIGNING_KEY=(.*)/)[1].trim().replace(/^"|"$/g, "");
const b64u = (b) => Buffer.from(b).toString("base64url");
const tok = (c) => { const body = b64u(JSON.stringify(c)); return body + "." + crypto.createHmac("sha256", KEY).update(body).digest("base64url"); };
const x = Date.now() + 3600e3;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
const join = async (role, n, e) => {
  const c = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, permissions: ["camera", "microphone"] });
  const p = await c.newPage(); p.errs = []; p.on("pageerror", (er) => p.errs.push(n + ": " + er.message)); p.n = n;
  p.tokn = tok({ r: R, role, n, e, x });
  await p.goto(`${BASE}/${R}?t=${p.tokn}`); await p.click("#join"); await p.waitForSelector("#grid .tile"); return p;
};
const more = async (p, label) => { if (label === "Q&A" && await p.$("#bqa")) return p.click("#bqa"); await p.click("#bmore"); await p.locator(".menu button", { hasText: label }).first().click(); };
const tiles = (p) => p.evaluate(() => document.querySelectorAll("#grid .tile:not(.screen)").length);
const A = await join("host", "Anuj", "anuj@kayaksa.com");
const B = await join("member", "Ria", "ria@kayaksa.com");
const C = await join("member", "Kabir", "kabir@kayaksa.com");
const D = await join("member", "Meera", "meera@kayaksa.com");
await A.waitForFunction(() => document.querySelectorAll("#grid .tile").length >= 4, null, { timeout: 20000 });
ok((await tiles(A)) === 4, "four people in the meeting");

console.log("Q&A");
await more(B, "Q&A"); await B.fill("#qai", "Will the slides be shared after the session?"); await B.check("#qaanon"); await B.click("#qaf button");
await more(A, "Q&A"); await A.waitForSelector(".q");
ok((await A.textContent(".q .qh b")) === "Anonymous", "an anonymous question reaches the host without a name");
await more(C, "Q&A"); await C.waitForSelector("[data-up]"); await C.click("[data-up]");
await A.waitForFunction(() => document.querySelector("[data-up]")?.textContent.trim().endsWith("1"));
ok(true, "an upvote is counted for everyone");
await A.click('[data-qs="live"]');
await B.waitForSelector("#liveq", { timeout: 5000 }).catch(() => {});
ok(!!(await B.$("#liveq")), "attendees see the question being answered live on stage");
await A.click("[data-qw]"); await A.fill(".qa-wr textarea", "Yes - everyone gets them by email today."); await A.click(".qa-wr button");
await B.waitForSelector(".qa-ans", { timeout: 5000 }).catch(() => {});
ok(/everyone gets them/.test((await B.textContent(".qa-ans").catch(() => "")) || ""), "a typed answer is published to everyone");
if (SHOTS) await A.screenshot({ path: SHOTS + "/qa.png" });
for (const p of [A, B, C]) await p.click("#pclose").catch(() => {});

console.log("Breakout rooms");
await more(A, "Breakout rooms"); await A.fill("#brn", "2"); await A.selectOption("#bra", "manual"); await A.click("#brf button");
await A.waitForSelector("[data-mv]");
const ids = await A.$$eval("[data-mv]", (els) => els.map((e) => [e.closest(".mv").textContent.trim(), e.dataset.mv]));
const idOf = (n) => ids.find(([t]) => t.startsWith(n))[1];
await A.selectOption(`[data-mv="${idOf("Ria")}"]`, "b1"); await A.waitForTimeout(300);
await A.selectOption(`[data-mv="${idOf("Kabir")}"]`, "b1"); await A.waitForTimeout(300);
await A.selectOption(`[data-mv="${idOf("Meera")}"]`, "b2"); await A.waitForTimeout(300);
await A.selectOption("#brt2", "0"); await A.click("#bropen");
await B.waitForSelector("#brb", { timeout: 8000 });
await B.waitForFunction(() => document.querySelectorAll("#grid .tile:not(.screen)").length === 2, null, { timeout: 15000 }).catch(() => {});
await D.waitForFunction(() => document.querySelectorAll("#grid .tile:not(.screen)").length === 1, null, { timeout: 15000 }).catch(() => {});
ok((await tiles(B)) === 2 && (await tiles(C)) === 2, "Room 1 (Ria, Kabir) see only each other");
ok((await tiles(D)) === 1, "Room 2 (Meera) sees only herself");
ok((await tiles(A)) === 1, "the host in the main room no longer sees the people in rooms");
ok(/Room 1/.test(await B.textContent("#brb")), "a banner tells people which room they're in");
const conns = (p) => p.evaluate(() => 0); // placeholder kept simple: connections are checked through tiles
await B.click("#bchat"); await B.fill("#ci", "room one only"); await B.press("#ci", "Enter"); await B.waitForTimeout(800);
await D.click("#bchat"); await D.waitForTimeout(300);
const dChat = await D.textContent("#cb"); await C.click("#bchat"); await C.waitForTimeout(300); const cChat = await C.textContent("#cb");
ok(/room one only/.test(cChat) && !/room one only/.test(dChat), "chat stays inside its breakout room");
for (const p of [B, C, D]) await p.click("#pclose").catch(() => {});
// host visits Room 2
await A.click('[data-visit="b2"]'); await A.waitForTimeout(2500);
await A.waitForFunction(() => document.querySelectorAll("#grid .tile:not(.screen)").length === 2, null, { timeout: 15000 }).catch(() => {});
ok((await tiles(A)) === 2, "the host can join a breakout room");
await A.click("#brmf input").catch(() => {}); await A.fill("#brm", "Two minutes left"); await A.click("#brmf button");
await B.waitForFunction(() => /Two minutes left/.test(document.querySelector(".kt-toasts")?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
ok(/Two minutes left/.test(await B.textContent(".kt-toasts").catch(() => "")), "a message to all rooms reaches everyone");
if (SHOTS) await A.screenshot({ path: SHOTS + "/breakouts.png" });
await A.click("#brnow");
await B.waitForFunction(() => document.querySelectorAll("#grid .tile:not(.screen)").length === 4, null, { timeout: 20000 }).catch(() => {});
await A.waitForFunction(() => document.querySelectorAll("#grid .tile:not(.screen)").length === 4, null, { timeout: 20000 }).catch(() => {});
ok((await tiles(B)) === 4 && (await tiles(A)) === 4 && !(await B.$("#brb")), "closing the rooms brings everyone back together");
await A.click("#pclose").catch(() => {});

console.log("Voice changer and Kayak Avatar");
await more(B, "Voice changer"); await B.locator(".menu button", { hasText: "Deeper" }).click();
// Headless test browsers can't run audio worklets; real Chrome, Edge and Firefox can.
const worklets = await B.evaluate(async () => { try { const ac = new AudioContext(); await ac.audioWorklet.addModule(URL.createObjectURL(new Blob(["registerProcessor('t',class extends AudioWorkletProcessor{process(){return true}})"], { type: "text/javascript" }))); return true; } catch { return false; } });
if (worklets) {
  await A.waitForFunction(() => /Voice changed/.test(document.querySelector("#grid").textContent), null, { timeout: 8000 }).catch(() => {});
  ok(/Voice changed/.test(await A.textContent("#grid")), "everyone sees a 'Voice changed' badge");
} else {
  await B.waitForFunction(() => /isn't available/.test(document.querySelector(".kt-toasts")?.textContent || ""), null, { timeout: 5000 }).catch(() => {});
  ok(/isn't available/.test(await B.textContent(".kt-toasts")) && !/Voice changed/.test(await A.textContent("#grid")), "where the browser can't change voices, it says so and no badge is shown (worklets unsupported in this test browser)");
}
await more(C, "Kayak Avatar"); await C.waitForSelector("#avon"); await C.click('[data-hair="1"]'); await C.check("#avon"); await C.waitForTimeout(1500);
if (SHOTS) await C.screenshot({ path: SHOTS + "/avatar-editor.png" });
await C.click("#avdone");
await A.waitForFunction(() => /Avatar/.test(document.querySelector("#grid").textContent), null, { timeout: 8000 }).catch(() => {});
ok(/Avatar/.test(await A.textContent("#grid")), "everyone sees an 'Avatar' badge");
await A.waitForTimeout(2500);
if (SHOTS) await A.screenshot({ path: SHOTS + "/avatar-call.png" });

console.log("Notes.AI");
const notes = await A.evaluate(async (t) => { const r = await fetch(`/api/notes/abc-defg-hjk`, { headers: { "X-Meet-Token": t } }); return { s: r.status, h: r.headers.get("X-Content-SHA256"), t: await r.text() }; }, A.tokn);
ok(notes.s === 200 && /NOTES\.AI/.test(notes.t) && /^[0-9a-f]{64}$/.test(notes.h || "") && notes.t.includes(notes.h), "the host exports the Notes.AI record with a SHA-256 fingerprint");
const notesB = await B.evaluate(async (t) => (await fetch(`/api/notes/abc-defg-hjk`, { headers: { "X-Meet-Token": t } })).status, B.tokn);
ok(notesB === 403, "only the host can export the record");

const errs = [A, B, C, D].flatMap((p) => p.errs);
ok(!errs.length, "no script errors " + errs.join(" | "));
await browser.close();
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
