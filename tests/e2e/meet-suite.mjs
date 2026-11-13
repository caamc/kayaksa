// End-to-end checks for Activity, Meet Calls, the Status Manager, profiles and photos, Settings,
// keyboard shortcuts, Meet Studio and Cast to a screen. Run against
// `wrangler dev -c apps/meet/wrangler.local.jsonc --port 8704`:
//   node tests/e2e/meet-suite.mjs [shotdir]
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

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const errs = [];
async function employee(name, email, theme) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1360, height: 860 }, permissions: ["camera", "microphone"], colorScheme: theme || "light" });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(name + ": " + e.message));
  await p.goto(`${BASE}/auth/sso?t=${encodeURIComponent(signMeet({ r: "sso", role: "member", n: name, e: email, x: Date.now() + 60000, j: crypto.randomUUID() }))}`);
  await p.waitForSelector(".rail");
  return p;
}
const A = await employee("Anuj Agarwal", "anuj@kayaksa.com");
const R = await employee("Ria Mehta", "ria@kayaksa.com");
const api = (p, path, method = "GET", body) => p.evaluate(async ([path, method, body]) => { const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json().catch(() => ({})) }; }, [path, method, body]);

console.log("Rail");
for (const v of ["activity", "chat", "calls", "meetings", "settings"]) ok(!!(await A.$(`.rail [data-v="${v}"]`)), `rail has ${v}`);

console.log("Profile and photo");
await A.goto(`${BASE}/app#settings/profile`); await A.waitForSelector("#pf");
await A.fill("#pt", "Partner"); await A.fill("#pd", "Risk and Investigations"); await A.fill("#pph", "+91 98200 00000"); await A.fill("#pl", "Mumbai"); await A.fill("#pb", "Leads forensic work.");
await A.fill('[data-ll="0"]', "LinkedIn"); await A.fill('[data-lu="0"]', "https://www.linkedin.com/in/example");
await A.click("#pf .btn.p"); await sleep(600);
let prof = await api(A, "/api/wsx/profile/" + (await A.evaluate(() => fetch("/api/ws/boot").then((r) => r.json()).then((j) => j.me.id))));
ok(prof.j.title === "Partner" && prof.j.location === "Mumbai" && prof.j.links.length === 1, "profile saves title, location and links");
// a 64x64 PNG made in the page
const up = await A.evaluate(async () => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#17807E"; x.fillRect(0, 0, 64, 64); const b = await new Promise((r) => c.toBlob(r, "image/png")); const r = await fetch("/api/wsx/avatar", { method: "PUT", body: b, headers: { "Content-Type": "image/png" } }); return r.status; });
ok(up === 200, "photo upload accepted");
const bad = await A.evaluate(async () => (await fetch("/api/wsx/avatar", { method: "PUT", body: new Blob(["<svg onload=alert(1)>"]), headers: { "Content-Type": "image/png" } })).status);
ok(bad === 400, "non-image refused as a photo");
const aid = prof.j.id;
ok((await R.evaluate(async (id) => (await fetch("/api/wsx/avatar/" + id)).status, aid)) === 200, "a colleague can see the photo");
await R.reload(); await R.waitForSelector(".rail");
await shot(A, "s01-profile");

console.log("Status Manager");
await A.click("#meBtn"); await A.waitForSelector(".mecard");
await shot(A, "s02-mecard");
await A.click('.mecard [data-p="busy"]'); await sleep(700);
let ppl = await api(R, "/api/ws/people");
ok(ppl.j.people.find((p) => p.name === "Anuj Agarwal")?.presence === "busy", "colleagues see Busy");
await A.click("#meBtn"); await A.click("#mcStatus"); await A.waitForSelector(".status-dlg");
await A.click('.st-presets [data-i="5"]'); await A.click(".status-dlg .btn.p"); await sleep(700);
ppl = await api(R, "/api/ws/people");
const an = ppl.j.people.find((p) => p.name === "Anuj Agarwal");
ok(an?.custom?.text === "Focusing" && an.presence === "dnd", "status message and Do not disturb set");
await api(A, "/api/wsx/status", "PUT", { presence: "auto" });

console.log("Activity");
await A.goto(`${BASE}/app`); await A.waitForSelector(".rail");
const ch = await api(A, "/api/ws/channels", "POST", { name: "suite-test", kind: "channel", members: [{ email: "ria@kayaksa.com" }] });
await api(A, `/api/ws/channels/${ch.j.id}/messages`, "POST", { body: "@Ria Mehta please review the draft" });
await sleep(800);
const act = await api(R, "/api/wsx/activity");
ok(act.j.items.some((x) => x.kind === "added"), "being added to a channel shows in Activity");
ok(act.j.items.some((x) => x.kind === "mention" && x.text.includes("review the draft")), "an @mention shows in Activity");
const msgs = await api(R, `/api/ws/channels/${ch.j.id}/messages`);
const mid = msgs.j.messages.find((m) => m.body.includes("review"))?.id;
await api(R, `/api/ws/messages/${mid}/react`, "POST", { emoji: "👍" });
ok((await api(A, "/api/wsx/activity")).j.items.some((x) => x.kind === "reaction"), "a reaction shows in the author's Activity");
await R.goto(`${BASE}/app#activity`); await R.waitForSelector(".act");
ok((await R.$$(".act.unread")).length >= 2, "unread items are highlighted");
ok(await R.$eval('.rail [data-v="activity"] .dot', (e) => +e.textContent >= 2).catch(() => false), "Activity badge shows the unread count");
await shot(R, "s03-activity");
await R.click("#actAll"); await sleep(500);
ok((await api(R, "/api/wsx/activity")).j.unread === 0, "mark all read");

console.log("Meet Calls");
const people = (await api(A, "/api/ws/people")).j.people; const rid = people.find((p) => p.name === "Ria Mehta").id;
await A.goto(`${BASE}/app#calls`); await A.waitForSelector(".dial-row");
await shot(A, "s04-calls");
await A.click(`[data-call="${rid}"]`); await A.waitForSelector(".outgoing");
ok(true, "caller sees the calling screen");
await R.goto(`${BASE}/app#chat`); await R.waitForSelector(".incoming", { timeout: 15000 }).catch(() => {});
ok(!!(await R.$(".incoming")), "callee gets a ringing call");
await shot(R, "s05-incoming");
await Promise.all([R.waitForURL(/\/[a-z0-9-]{8,}$/i, { timeout: 15000 }).catch(() => {}), R.click(".incoming [data-x=audio]")]);
await A.waitForURL(/\/[a-z0-9-]{8,}$/i, { timeout: 15000 }).catch(() => {});
ok(/\/[a-z0-9-]{8,}$/i.test(new URL(R.url()).pathname) && new URL(R.url()).pathname === new URL(A.url()).pathname, "both end up in the same call room");
const hist = (await api(R, "/api/wsx/calls")).j.calls;
ok(hist[0]?.state === "live" && hist[0].my_state === "joined", "call history records the answered call");
// missed call
await A.goto(`${BASE}/app#calls`); await A.waitForSelector(".dial-row");
await R.goto(`${BASE}/app#calls`); await R.waitForSelector(".rail");
await A.click(`[data-call="${rid}"]`); await A.waitForSelector(".outgoing");
await R.waitForSelector(".incoming", { timeout: 15000 }).catch(() => {});
await A.click("#outEnd"); await sleep(5000);
ok(!(await R.$(".incoming")), "ringing stops when the caller hangs up");
ok((await api(R, "/api/wsx/activity")).j.items.some((x) => x.kind === "missed"), "a missed call shows in Activity");

console.log("Settings");
await A.goto(`${BASE}/app#settings`); await A.waitForSelector(".set-nav");
const tabs = await A.$$eval(".set-nav [data-t]", (b) => b.map((x) => x.dataset.t));
ok(tabs.length >= 15, `settings has ${tabs.length} sections`);
for (const t of tabs) {
  await A.click(`.set-nav [data-t="${t}"]`); await A.waitForSelector(".set-h", { timeout: 5000 }).catch(() => {});
  const h = await A.$eval(".set-h", (e) => e.textContent).catch(() => "");
  ok(!!h, `section ${t} opens (${h})`);
  if (["notifications", "appearance", "plugins", "updates"].includes(t)) await shot(A, "s06-settings-" + t);
}
await A.click('.set-nav [data-t="appearance"]'); await A.click('.theme.t-dark'); await sleep(900);
ok((await A.evaluate(() => document.documentElement.dataset.theme)) === "dark", "dark theme applies");
await shot(A, "s07-dark");
const pr = await api(A, "/api/wsx/prefs");
ok(pr.j.prefs.theme === "dark", "settings sync to the account");
await A.click('.theme.t-system'); await sleep(900);

console.log("Shortcuts and zoom");
await A.keyboard.press("Control+/"); await A.waitForSelector(".keys", { timeout: 3000 }).catch(() => {});
ok(!!(await A.$(".keys")), "Ctrl+/ shows keyboard shortcuts");
await shot(A, "s08-keys");
await A.keyboard.press("Escape");
await A.keyboard.press("Alt+1"); await sleep(300);
ok(A.url().endsWith("#activity"), "Alt+1 opens Activity");
await A.keyboard.press("Control+="); await sleep(200);
ok((await A.evaluate(() => document.documentElement.style.zoom)) === "110%", "Ctrl+= zooms in");
await A.keyboard.press("Control+0");

console.log("Meet Studio");
const S = A; await S.goto(`${BASE}/studio`); await S.waitForSelector(".sx-tabs");
await sleep(1500);
const tabsS = await S.$$eval("[data-tab]", (b) => b.map((x) => x.dataset.tab));
let controls = 0;
for (const t of tabsS) { await S.click(`[data-tab="${t}"]`); controls += (await S.$$("#ctl input, #ctl select, #ctl [data-look], #ctl [data-bg]")).length; }
ok(controls >= 30, `Meet Studio has ${controls} controls across ${tabsS.length} sections`);
await S.click('[data-tab="look"]'); await S.click('[data-look="cinema"]');
await S.click('[data-tab="light"]'); await S.$eval('[data-s="key"]', (e) => { e.value = 60; e.dispatchEvent(new Event("input")); });
await S.click('[data-tab="overlay"]'); await S.click('[data-t="tag"]'); await sleep(300);
await sleep(500);
const st = await S.evaluate(() => JSON.parse(localStorage.getItem("km:studio")));
ok(st.look === "cinema" && st.key === 60 && st.tag, "studio look is saved for meetings");
await S.click("#tSplit"); await sleep(400);
await shot(S, "s09-studio");
const px = await S.evaluate(() => { const c = document.getElementById("out"); const d = c.getContext("2d").getImageData(c.width / 2, c.height / 2, 1, 1).data; return d[0] + d[1] + d[2]; });
ok(px > 0, "the studio preview is drawing");
await S.click("#tSnap"); await S.waitForSelector(".sx-dlg img"); ok(true, "snapshot works"); await S.keyboard.press("Escape");
await S.click("#tReset");
await S.evaluate(() => localStorage.removeItem("km:studio"));

console.log("Cast to a screen");
const tvCtx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 720 } });
const TV = await tvCtx.newPage(); TV.on("pageerror", (e) => errs.push("tv: " + e.message));
await TV.goto(`${BASE}/cast`); await TV.waitForFunction(() => /\d{3} \d{3}/.test(document.getElementById("code").textContent));
const code = (await TV.$eval("#code", (e) => e.textContent)).replace(/\D/g, "");
ok(code.length === 6, "the screen shows a 6-digit code");
await shot(TV, "s10-cast");
const mt = await api(A, "/api/ws/meetings", "POST", { title: "Board review" });
const cast = await api(A, "/api/wsx/cast", "POST", { code, room: mt.j.id });
ok(cast.status === 200, "sending a meeting to the code works");
await TV.waitForURL(new RegExp(mt.j.id), { timeout: 10000 }).catch(() => {});
ok(TV.url().includes(mt.j.id), "the screen joins the meeting");
ok((await api(A, "/api/wsx/cast", "POST", { code: "000000", room: mt.j.id })).status === 404, "a wrong code is refused");

console.log(`\n${pass} passed, ${fail} failed`);
if (errs.length) console.log("Page errors:\n  " + [...new Set(errs)].join("\n  "));
await browser.close();
process.exit(fail || errs.length ? 1 : 0);
