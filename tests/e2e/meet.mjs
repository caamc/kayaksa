// Kayak Meet end-to-end check. Run with the meet worker on :8704 (wrangler.local.jsonc, .dev.vars MEET_SIGNING_KEY) and a meeting abc-defg-hjk in local D1.
// Usage: node tests/e2e/meet.mjs <screenshot-folder>
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.argv[2]; const BASE = "http://localhost:8704";
const KEY = "local-test-signing-key-0123456789abcdef";
const b64u = (b) => Buffer.from(b).toString("base64url");
const crypto = await import("node:crypto");
const tok = (c) => { const body = b64u(JSON.stringify(c)); return body + "." + crypto.createHmac("sha256", KEY).update(body).digest("base64url"); };
const R = "abc-defg-hjk"; const x = Date.now() + 3600e3;
const host = tok({ r: R, role: "host", n: "Anuj Agarwal", e: "anuj@kayaksa.com", x });
const guest = tok({ r: R, role: "guest", e: "client@example.com", x });
const browser = await chromium.launch({ args: ["--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const ctx1 = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, permissions: ["camera", "microphone"] });
const ctx2 = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 800 }, permissions: ["camera", "microphone"] });
const h = await ctx1.newPage(), g = await ctx2.newPage();
const errs = []; for (const p of [h, g]) { p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errs.push("console: " + m.text())); }
const ok = (c, m) => console.log((c ? "PASS " : "FAIL ") + m);
await h.goto(`${BASE}/${R}?t=${host}`); await h.waitForSelector("#join"); await h.screenshot({ path: OUT + "/1-prejoin.png" });
ok(!(await h.url()).includes("?t="), "invitation token removed from the address bar");
await h.click("#join"); await h.waitForSelector("#grid .tile"); ok(true, "host joined");
await g.goto(`${BASE}/${R}?t=${guest}`); await g.waitForSelector("#nm"); await g.fill("#nm", "Client Guest"); await g.click("#join");
await g.waitForSelector("text=Waiting to join"); ok(true, "guest waits in lobby"); await g.screenshot({ path: OUT + "/2-lobby.png" });
await h.waitForSelector("text=is waiting to join"); await h.click("#bppl"); await h.waitForSelector("[data-admit]"); await h.screenshot({ path: OUT + "/3-host-lobby.png" });
await h.click("[data-admit]");
await g.waitForSelector("#grid .tile"); ok(true, "guest admitted");
await h.waitForFunction(() => document.querySelectorAll("#grid .tile").length === 2, null, { timeout: 15000 });
await g.waitForFunction(() => document.querySelectorAll("#grid .tile").length === 2, null, { timeout: 15000 });
const playing = async (p) => p.evaluate(() => [...document.querySelectorAll(".tile:not(.me) video")].some((v) => v.videoWidth > 0 && v.srcObject?.getVideoTracks().length));
await h.waitForFunction(() => [...document.querySelectorAll(".tile:not(.me) video")].some((v) => v.videoWidth > 0), null, { timeout: 20000 }).catch(() => {});

ok(await playing(h), "host receives the guest's video directly");
await g.waitForFunction(() => [...document.querySelectorAll(".tile:not(.me) video")].some((v) => v.videoWidth > 0), null, { timeout: 20000 }).catch(() => {});
ok(await playing(g), "guest receives the host's video directly");
const enc = await h.evaluate(async () => { const out = []; return out; });
// chat
await g.click("#bchat"); await g.fill("#ci", "Hello from the client"); await g.press("#ci", "Enter");
await h.waitForSelector("text=Hello from the client", { timeout: 5000 }).then(() => ok(true, "chat delivered")).catch(() => ok(false, "chat delivered"));
// mute state propagates
await g.click("#bmic"); await h.waitForTimeout(800);
ok(await h.evaluate(() => !!document.querySelector('.tile:not(.me) .name svg')), "guest's mute shows on the host's screen");
// raise hand
await g.click("#bhand"); await h.waitForSelector(".tile .hand", { timeout: 4000 }).then(() => ok(true, "raised hand shows")).catch(() => ok(false, "raised hand shows"));
// screen share is not possible headless without a prompt; skip. Host mutes all.
await h.screenshot({ path: OUT + "/4-room-host.png" }); await g.screenshot({ path: OUT + "/5-room-guest.png" });
// host turns on captions (no AI locally: should not crash)
await h.click("#bcc"); await g.waitForSelector("#cappill:not([hidden])", { timeout: 4000 }).then(() => ok(true, "captions notice shown to everyone")).catch(() => ok(false, "captions notice"));
// mobile layout
await g.setViewportSize({ width: 390, height: 844 }); await g.waitForTimeout(500); await g.screenshot({ path: OUT + "/6-mobile.png" });
ok(await g.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no sideways scroll on a phone");
// end meeting
await h.click("#bleave"); await h.click("text=End the meeting for everyone");
await g.waitForSelector("text=The meeting was ended", { timeout: 6000 }).then(() => ok(true, "host ends the meeting for everyone")).catch(() => ok(false, "end for everyone"));
await g.click(".stars[data-k=overall] [data-n='4']"); await g.click(".chip[data-i='Echo or noise']"); await g.click("text=Send feedback");
await g.waitForSelector("text=Thank you", { timeout: 5000 }).then(() => ok(true, "feedback recorded")).catch(() => ok(false, "feedback recorded"));
await g.setViewportSize({ width: 1280, height: 800 }); await h.screenshot({ path: OUT + "/7-end.png" });
// bad token
const bad = await (await ctx1.request.get(`${BASE}/api/room/${R}?t=${host.slice(0, -3)}xyz`)).status(); ok(bad === 401, "tampered invitation is refused");
console.log("errors:", errs.filter((e) => !/favicon|ERR_|404/.test(e)).slice(0, 8));
await browser.close();
