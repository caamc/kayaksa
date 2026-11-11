// End-to-end check of internal.kayaksa.com against `wrangler dev` (default http://127.0.0.1:8702).
// Runs the first-run SuperAdmin set-up with two-factor enrolment, then opens every module.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { createHmac } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8702";
const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const vars = Object.fromEntries(readFileSync(new URL("../../apps/internal/.dev.vars", import.meta.url), "utf8").trim().split("\n").map((l) => l.split("=")));
const EMAIL = "anuj@kayaksa.com";
const PASSWORD = "Test-only passphrase 4 local dev!";

function b32(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, v = 0; const out = [];
  for (const c of s.replace(/\s/g, "")) { v = (v << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function totp(secret, offset = 0) {
  const ctr = Math.floor(Date.now() / 30000) + offset; const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(ctr));
  const h = createHmac("sha1", b32(secret)).update(m).digest(); const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0");
}

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails.push(msg); };

const browser = await chromium.launch();
// Kayak Shield refuses "HeadlessChrome", so present as a normal browser.
const _nc = browser.newContext.bind(browser); browser.newContext = (o = {}) => _nc({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36", ...o });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|401|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });

// Unauthenticated access is refused
const r = await page.request.get(`${BASE}/api/me`);
check(r.status() === 401, "API refuses requests without a session");
const r2 = await page.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: "x" }, headers: { Origin: "https://evil.example" } });
check(r2.status() === 403, "cross-site POST is refused");

// First-run set-up
await page.goto(`${BASE}/setup`);
await page.fill("#email", EMAIL);
await page.fill("#name", "Anuj Matushankar Choudhary");
await page.fill("#token", vars.BOOTSTRAP_TOKEN);
await page.fill("#password", PASSWORD);
await page.click("button[type=submit]");
await page.waitForSelector("text=Set-up key", { timeout: 15000 });
const secret = (await page.textContent("code")).replace(/\s/g, "");
check(secret.length >= 32, "authenticator secret shown");
await page.screenshot({ path: OUT + "internal-enrol.png" });
await page.fill("#code", totp(secret));
await page.click("button[type=submit]");
await page.waitForSelector(".codes", { timeout: 15000 });
const codes = (await page.$$eval(".codes span", (s) => s.map((x) => x.textContent)));
check(codes.length === 10, "ten recovery codes issued");
await page.check("#saved");
await page.click("#go");
await page.waitForSelector(".dash-hero h1", { timeout: 15000 });
check((await page.textContent(".dash-hero h1")).includes("Anuj"), "lands on the portal home dashboard");
await page.waitForSelector(".kpis", { timeout: 15000 });
check(await page.locator(".kpi2").count() >= 6, "home dashboard shows its KPI cards");
check(await page.locator(".fab-btn").count() === 1, "floating Kayak AI is on the page");
await page.screenshot({ path: OUT + "internal-home.png" });

// Forgot password answers the same way whether or not the account exists
const fg1 = await page.request.post(`${BASE}/api/auth/forgot`, { data: { email: EMAIL }, headers: { Origin: BASE } });
const fg2 = await page.request.post(`${BASE}/api/auth/forgot`, { data: { email: "nobody@kayaksa.com" }, headers: { Origin: BASE } });
check(fg1.ok() && fg2.ok() && (await fg1.json()).message === (await fg2.json()).message, "forgot password does not reveal which accounts exist");

// Set-up cannot be repeated for an active account
const again = await page.request.post(`${BASE}/api/auth/setup`, { data: { email: EMAIL, token: vars.BOOTSTRAP_TOKEN, name: "X", password: PASSWORD + "x" }, headers: { Origin: BASE } });
check(again.status() === 409 || again.status() === 403, "set-up refuses an already active SuperAdmin");

for (const v of ["digital", "updates", "clienttools", "clienttools/monitoring", "studio", "board", "briefs", "store", "launch", "certs", "brain", "brand", "tools", "network", "ai", "cards", "decks", "website", "learn", "admin", "audit", "security/overview", "security/events", "security/blocks", "confluence", "account"]) {
  await page.goto(`${BASE}/app#/${v}`);
  await page.waitForFunction(() => !document.querySelector("#main .spinner") || document.querySelector("#main h1"), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const h1 = await page.textContent("#main h1").catch(() => "");
  const err = await page.$("#main .note.danger").then((e) => (e ? e.textContent() : null));
  check(!!h1 && !err, `${v} renders (${(h1 || "").trim().slice(0, 40)})${err ? " — " + err : ""}`);
  await page.screenshot({ path: OUT + `internal-${v.replace("/", "-")}.png`, fullPage: v === "cards" });
}

// Invite a colleague and accept the invite in a fresh browser
await page.goto(`${BASE}/app#/admin`);
await page.click("#inv");
await page.fill("[name=email]", "priya@kayaksa.com");
await page.fill("[name=name]", "Priya Shah");
await page.click("[data-a=s]");
const link = await page.inputValue("#lk", { timeout: 10000 });
check(link.includes("/welcome?t="), "invitation link issued");
const ctx2 = await browser.newContext();
const p2 = await ctx2.newPage();
await p2.goto(link.replace("https://internal.kayaksa.com", BASE));
await p2.fill("#password", "Another long passphrase 99");
await p2.fill("#password2", "Another long passphrase 99");
await p2.click("button[type=submit]");
await p2.waitForSelector("text=Set-up key", { timeout: 15000 });
const s2 = (await p2.textContent("code")).replace(/\s/g, "");
await p2.fill("#code", totp(s2));
await p2.click("button[type=submit]");
await p2.waitForSelector(".codes");
await p2.check("#saved"); await p2.click("#go");
await p2.waitForSelector(".dash-hero h1");
const adminLink = await p2.$("#side a[href='#/admin']");
check(!adminLink, "an employee does not see administration");
const forbidden = await p2.request.get(`${BASE}/api/admin/users`);
check(forbidden.status() === 403, "an employee cannot call admin APIs");
const reuse = await ctx2.request.post(`${BASE}/api/auth/redeem`, { data: { token: new URL(link).searchParams.get("t"), password: "Yet another passphrase 77" }, headers: { Origin: BASE } });
check(reuse.status() === 410, "an invitation link works only once");

// Wrong TOTP and lockout behaviour
const ctx3 = await browser.newContext();
const r3 = await ctx3.request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD }, headers: { Origin: BASE } });
check((await r3.json()).next === "totp", "password step asks for the second factor");
const bad = await ctx3.request.post(`${BASE}/api/auth/totp`, { data: { code: "000000" }, headers: { Origin: BASE } });
check(bad.status() === 401, "a wrong code is refused");
const me3 = await ctx3.request.get(`${BASE}/api/me`);
check(me3.status() === 401, "password alone does not open the portal");
const rc = await ctx3.request.post(`${BASE}/api/auth/totp`, { data: { code: codes[0] }, headers: { Origin: BASE } });
check(rc.ok(), "a recovery code signs in");
const rc2 = await (await browser.newContext()).request.post(`${BASE}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD }, headers: { Origin: BASE } });
check(rc2.ok(), "login works again");

check(errors.length === 0, `no browser errors${errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""}`);
await browser.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log("\nAll internal checks passed");
