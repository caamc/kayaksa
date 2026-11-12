// End-to-end checks for Meet by Kayak (accounts, privacy walls, workspace, tasks, meetings).
// Run against `wrangler dev -c apps/meet/wrangler.local.jsonc --port 8704`:
//   NODE_PATH=$(npm root -g) node tests/e2e/meet-workspace.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.MEET_URL || "http://localhost:8704";
const SHOTS = process.env.SHOTS || "";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const KEY = fs.readFileSync(new URL("../../apps/meet/.dev.vars", import.meta.url), "utf8").match(/MEET_SIGNING_KEY=(.*)/)[1].trim().replace(/^"|"$/g, "");
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("  ✓", msg); } else { fail++; console.log("  ✗", msg); } };

const b64u = (b) => Buffer.from(b).toString("base64url");
function signMeet(claims) { const body = b64u(JSON.stringify(claims)); return `${body}.${b64u(crypto.createHmac("sha256", KEY).update(body).digest())}`; }
function b32(s) { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "", out = []; for (const ch of s.replace(/=+$/, "")) bits += a.indexOf(ch).toString(2).padStart(5, "0"); for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); }
function totp(secret, step = Math.floor(Date.now() / 30000)) { const m = Buffer.alloc(8); m.writeUInt32BE(Math.floor(step / 2 ** 32), 0); m.writeUInt32BE(step >>> 0, 4); const h = crypto.createHmac("sha1", b32(secret)).update(m).digest(); const o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0"); }
const shot = async (p, n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.png` });

const browser = await chromium.launch();
const emp = await browser.newContext({ userAgent: UA, viewport: { width: 1360, height: 860 } });
const E = await emp.newPage();
const errs = []; E.on("pageerror", (e) => errs.push(e.message));
const call = (page, path, method = "GET", body) => page.evaluate(async ([path, method, body]) => { const r = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; }, [path, method, body]);

console.log("Sign-in");
await E.goto(BASE + "/app");
ok(E.url().endsWith("/login"), "the workspace sends signed-out people to sign-in");
await E.waitForSelector(".au-sso");
await shot(E, "01-login");
const j = crypto.randomUUID();
const ticket = signMeet({ r: "sso", role: "member", n: "Anuj Agarwal", e: "anuj@kayaksa.com", x: Date.now() + 60000, j });
await E.goto(`${BASE}/auth/sso?t=${encodeURIComponent(ticket)}`);
await E.waitForSelector(".rail");
ok(E.url().includes("/app"), "single sign-on from Kayak Internal opens the workspace");
const replay = await (await fetch(`${BASE}/auth/sso?t=${encodeURIComponent(ticket)}`, { redirect: "manual", headers: { "User-Agent": UA } })).headers.get("location");
ok(/\/login\?e=sso/.test(replay || ""), "an SSO ticket cannot be used twice");
const forged = await (await fetch(`${BASE}/auth/sso?t=${encodeURIComponent(ticket.slice(0, -4) + "AAAA")}`, { redirect: "manual", headers: { "User-Agent": UA } })).headers.get("location");
ok(/\/login\?e=sso/.test(forged || ""), "a forged SSO ticket is refused");
// a second employee, for DMs and assignment
const t2 = signMeet({ r: "sso", role: "member", n: "Ria Mehta", e: "ria@kayaksa.com", x: Date.now() + 60000, j: crypto.randomUUID() });
const emp2 = await browser.newContext({ userAgent: UA }); const R = await emp2.newPage(); await R.goto(`${BASE}/auth/sso?t=${encodeURIComponent(t2)}`); await R.waitForSelector(".rail");

console.log("Channels and invitations");
const boot = (await call(E, "/api/ws/boot")).json;
const ria = boot.people.find((p) => p.email === "ria@kayaksa.com");
const ch = await call(E, "/api/ws/channels", "POST", { name: "Acme · FY27 tax health check", kind: "project", topic: "Direct and indirect tax review", due: "2027-03-31", private: true, members: [{ id: ria.id }, { email: "priya@acme.example", name: "Priya Shah", org: "Acme Ltd" }] });
ok(ch.status === 200 && ch.json.invites?.length === 1, "an employee creates a project and invites a client (one-time link returned)");
const internal = await call(E, "/api/ws/channels", "POST", { name: "Kayak partners", private: true });
ok(internal.status === 200, "a private internal channel is created");
await call(E, `/api/ws/channels/${ch.json.id}/messages`, "POST", { body: "Welcome **Priya**. Please upload the FY26 GST returns here. @Ria Mehta will lead the review." });

console.log("Client accepts the invitation");
const cli = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 820 } });
const C = await cli.newPage(); C.on("pageerror", (e) => errs.push(e.message));
let secret = "";
C.on("response", async (r) => { if (r.url().endsWith("/api/auth/invite/check")) secret = (await r.json().catch(() => ({}))).secret || ""; });
await C.goto(ch.json.invites[0].link.replace("https://meet.kayaksa.com", BASE));
await C.waitForSelector("#ok");
ok(new URL(C.url()).pathname === "/join", "the one-time token is removed from the address bar");
await shot(C, "02-invite-privacy");
await C.click("#next");
ok(await C.locator("#ok").isVisible(), "the privacy notice must be accepted before continuing");
await C.check("#ok"); await C.click("#next");
await C.waitForSelector(".au-qr svg");
await shot(C, "03-invite-authenticator");
await C.fill("#cd", "000000"); await C.click("#go"); await C.waitForSelector(".au-err");
ok(true, "a wrong authenticator code is refused");
await C.fill("#cd", totp(secret)); await C.click("#go");
await C.waitForSelector(".rail", { timeout: 10000 }).catch(async () => { console.log("DEBUG", await C.locator("#card").innerText(), C.url()); });
ok(C.url().includes("/app"), "the client finishes set-up and lands in the workspace");
const cboot = (await call(C, "/api/ws/boot")).json;
ok(cboot.channels.length === 1 && cboot.channels[0].id === ch.json.id, "the client sees only the project they were added to");
ok(!cboot.people.some((p) => p.email === "ria@kayaksa.com" && false) && cboot.people.every((p) => p.kind === "employee" ? true : p.id === cboot.me.id), "the client sees no other clients");
ok((await call(C, `/api/ws/channels/${internal.json.id}/messages`)).status === 403, "the client cannot read an internal channel");
ok((await call(C, "/api/ws/channels", "POST", { name: "x" })).status === 403, "the client cannot create channels");
ok((await call(C, `/api/ws/channels/${ch.json.id}/members`, "POST", { members: [{ email: "x@y.com" }] })).status === 403, "the client cannot add people");
ok((await call(C, "/api/ws/search?q=partners")).json.results.length === 0, "search never reaches conversations the client is not in");

console.log("Messaging, threads, reactions, files");
const m1 = await call(C, `/api/ws/channels/${ch.json.id}/messages`, "POST", { body: "Thank you. Uploading now." });
ok(m1.status === 200, "the client posts a message");
const reply = await call(E, `/api/ws/channels/${ch.json.id}/messages`, "POST", { body: "Great, thanks!", parent_id: m1.json.id });
ok(reply.status === 200, "an employee replies in a thread");
ok((await call(E, `/api/ws/messages/${m1.json.id}/react`, "POST", { emoji: "👍" })).json.reactions["👍"].length === 1, "reactions work");
ok((await call(E, `/api/ws/messages/${m1.json.id}`, "PATCH", { body: "hijack" })).status === 403, "nobody can edit someone else's message");
const up = await C.evaluate(async (id) => { const r = await fetch(`/api/ws/channels/${id}/files`, { method: "POST", headers: { "Content-Type": "application/pdf", "X-File-Name": "GSTR-9%20FY26.pdf" }, body: new Blob(["%PDF-1.4 test"]) }); return { s: r.status, j: await r.json() }; }, ch.json.id);
ok(up.s === 200, "the client shares a file");
const bad = await C.evaluate(async (id) => (await fetch(`/api/ws/channels/${id}/files`, { method: "POST", headers: { "X-File-Name": "invoice.exe" }, body: new Blob(["MZ"]) })).status, ch.json.id);
ok(bad === 400, "programs (.exe) are refused");
const outsider = await browser.newContext({ userAgent: UA }); const O = await outsider.newPage(); await O.goto(BASE + "/login");
ok((await O.evaluate(async (f) => (await fetch(`/files/${f}`)).status, up.j.file)) === 401, "files are not reachable without signing in");
const dl = await E.evaluate(async (f) => { const r = await fetch(`/files/${f}`); return [r.status, r.headers.get("content-disposition"), r.headers.get("content-security-policy")]; }, up.j.file);
ok(dl[0] === 200 && /attachment/.test(dl[1]) && /sandbox/.test(dl[2]), "files download as attachments under a sandbox policy");
const dm = await call(C, "/api/ws/dm", "POST", { id: ria.id });
ok(dm.status === 200, "the client can message an employee they work with");

console.log("Tasks");
const cboot2 = (await call(C, "/api/ws/boot")).json;
const task = await call(E, `/api/ws/channels/${ch.json.id}/tasks`, "POST", { title: "Share FY26 GSTR-9 and 9C", assignee: cboot2.me.id, due: "2026-11-20", priority: "high" });
ok(task.status === 200, "a task is assigned to the client");
ok((await call(E, `/api/ws/channels/${ch.json.id}/tasks`, "POST", { title: "x", assignee: "nobody" })).status === 400, "tasks can only be assigned to people in the conversation");
ok((await call(C, "/api/ws/tasks")).json.tasks.length === 1, "the client sees it under My tasks");
ok((await call(C, `/api/ws/tasks/${task.json.id}`, "PATCH", { status: "doing" })).status === 200, "the client moves it to In progress");

console.log("Meetings");
const mt = await call(E, "/api/ws/meetings", "POST", { channel_id: ch.json.id });
ok(mt.status === 200, "an employee starts a meeting from the project");
const room = await call(C, `/api/room/${mt.json.id}`);
ok(room.status === 200 && room.json.role === "guest" && room.json.name === "Priya Shah", "the signed-in client joins with their verified name (no link needed)");
const hostRoom = await call(E, `/api/room/${mt.json.id}`);
ok(hostRoom.json.role === "host", "the employee who started it is the host");
const other = await call(E, "/api/ws/meetings", "POST", { title: "Partners only", startsAt: new Date(Date.now() + 86400000).toISOString(), channel_id: internal.json.id });
ok((await call(C, `/api/room/${other.json.id}`)).status === 401, "the client cannot join a meeting they were not invited to");
const ics = await E.evaluate(async (id) => { const r = await fetch(`/api/ws/meetings/${id}/ics`); return [r.status, await r.text()]; }, other.json.id);
ok(ics[0] === 200 && ics[1].includes("BEGIN:VEVENT"), "calendar invitation (.ics) for Outlook and Google Calendar");
const ml = await call(E, "/api/ws/meetings");
ok(ml.json.upcoming.length >= 2, "upcoming meetings are listed");

console.log("Screens");
await E.goto(`${BASE}/app#c/${ch.json.id}`); await E.waitForSelector(".msg"); await E.waitForTimeout(500);
await shot(E, "04-workspace-chat");
await E.click("button.thr"); await E.waitForSelector(".panel .msgs"); await shot(E, "05-thread");
await E.goto(`${BASE}/app#c/${ch.json.id}/tasks`); await E.waitForSelector(".board"); await E.waitForTimeout(300); await shot(E, "06-board");
await E.goto(`${BASE}/app#meetings`); await E.waitForSelector(".mt-row"); await shot(E, "07-meetings");
await C.goto(`${BASE}/app#c/${ch.json.id}`); await C.waitForSelector(".msg"); await C.waitForTimeout(400); await shot(C, "08-client-view");
const mob = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 780 }, storageState: await cli.storageState() });
const M = await mob.newPage(); await M.goto(`${BASE}/app#c/${ch.json.id}`); await M.waitForSelector(".msg"); await shot(M, "09-mobile");
const wide = await M.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
ok(wide, "no sideways scrolling on a phone");

console.log("Live updates");
await E.goto(`${BASE}/app#c/${ch.json.id}`); await E.waitForSelector(".msg");
await call(C, `/api/ws/channels/${ch.json.id}/messages`, "POST", { body: "Live update check 42" });
await E.waitForSelector("text=Live update check 42", { timeout: 9000 }).then(() => ok(true, "new messages appear without reloading")).catch(() => ok(false, "new messages appear without reloading"));

console.log("Client sign-in, data rights");
await call(C, "/api/auth/logout", "POST");
const signIn = async (code) => { await C.goto(BASE + "/login"); await C.click("[data-t=client]"); await C.fill("#em", "priya@acme.example"); await C.fill("#cd", code); };
const step = Math.floor(Date.now() / 30000);
await signIn(totp(secret, step + 1)); // submits by itself at 6 digits
await C.waitForSelector(".rail", { timeout: 9000 }).then(() => ok(true, "the client signs in with email and authenticator code")).catch(() => ok(false, "the client signs in with email and authenticator code"));
await call(C, "/api/auth/logout", "POST");
await signIn(totp(secret, step + 1));
await C.waitForSelector(".au-err", { timeout: 9000 }).then(() => ok(true, "a code that was already used cannot be used again")).catch(() => ok(false, "a code that was already used cannot be used again"));
const wrong = await C.evaluate(async () => (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "nobody@acme.example", code: "123456" }) })).json());
ok(/don't match/.test(wrong.error || ""), "unknown accounts get the same answer as wrong codes (no account discovery)");
// Sign in again for the data-rights checks: wait for the next 30-second window so the code is fresh.
while (Math.floor(Date.now() / 30000) < step + 1) await new Promise((r) => setTimeout(r, 1000));
await signIn(totp(secret, step + 2)); await C.waitForSelector(".rail", { timeout: 9000 });
const exp = await C.evaluate(async () => { const r = await fetch("/api/ws/me/export"); return r.ok ? await r.json() : null; });
ok(exp && exp.profile.email === "priya@acme.example" && exp.messages.length >= 2, "the client downloads a copy of their data");
const er = await call(C, "/api/ws/me/erase", "POST", { confirm: "ERASE" });
ok(er.status === 200, "the client closes their account");
ok((await call(C, "/api/ws/boot")).status === 401, "and is signed out at once");
const after = (await call(E, `/api/ws/channels/${ch.json.id}`)).json;
ok(!after.members.some((m) => m.name === "Priya Shah"), "their name and email are erased");

ok(!errs.length, "no script errors" + (errs.length ? ": " + errs.join(" | ") : ""));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
