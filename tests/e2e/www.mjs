// End-to-end check of www.kayaksa.com against `wrangler dev` (default http://127.0.0.1:8701).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://127.0.0.1:8701";
const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails.push(msg); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|503/.test(m.text())) errors.push(`console: ${m.text()}`); });

await page.goto(BASE + "/");
await page.waitForSelector("#main .hero, #main .page:not(.ssr)", { timeout: 15000 });
check((await page.title()) === "Kayak Strategic Advisors", "home renders");
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + "www-home.png" });
// navigation uses real paths
await page.click('.mainnav [data-sec="services"], .mainnav a[href="/services"]').catch(() => {});
const svcLink = await page.$('a[href="/services/crisis-resilience"]');
check(!!svcLink, "links are real paths");
await page.goto(BASE + "/#crisis-resilience");
await page.waitForFunction(() => location.pathname === "/services/crisis-resilience");
check(true, "old #links move to real paths");
await page.goto(BASE + "/tools/seecounter");
await page.waitForSelector("#cases .caselist .empty, #cases .case", { timeout: 10000 });
check(true, "SeeCounter case repository section loads");
await page.screenshot({ path: OUT + "www-seecounter.png", fullPage: false });
// contact form
await page.goto(BASE + "/contact");
await page.waitForSelector("#contactForm");
await page.fill("#f-name", "Rohan Mehta"); await page.fill("#f-org", "Example Industries"); await page.fill("#f-email", "rohan@example.com");
await page.fill("#f-msg", "We need a vendor risk review before our audit."); await page.check("#f-consent");
await page.waitForTimeout(2600);
await page.click("#contactForm button[type=submit]");
await page.waitForSelector(".form-ok", { timeout: 10000 });
check((await page.textContent(".form-ok")).includes("Rohan"), "contact form is saved");
// Kay
await page.waitForSelector(".kay-launch");
await page.click(".kay-launch");
await page.waitForSelector(".kay-panel:not([hidden]) .kay-msg.assistant");
check((await page.textContent(".kay-log")).includes("I'm Kay"), "Kay greets the visitor");
await page.screenshot({ path: OUT + "www-kay.png" });
await page.click('[data-k="voice"]');
await page.waitForSelector(".kay-stage:not([hidden])");
await page.screenshot({ path: OUT + "www-kay-voice.png" });
await page.click('[data-k="text"]');
// SSR content for crawlers
const raw = await (await page.request.get(BASE + "/insights/growth-and-risk")).text();
check(raw.includes("<h1>Growth and risk are one decision</h1>") && raw.includes('"@type":"Article"'), "articles are server-rendered with structured data");
const nf = await page.request.get(BASE + "/no-such-page");
check(nf.status() === 404, "unknown pages return 404");
const h = (await page.request.get(BASE + "/")).headers();
check(h["permissions-policy"].includes("microphone=(self)") && h["content-security-policy"].includes("script-src 'self'"), "security headers allow the microphone only for this site");
// phone
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(BASE + "/services/crisis-resilience");
await m.waitForTimeout(1200);
check(!(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "no sideways scroll on a phone");
await m.click(".kay-launch"); await m.waitForTimeout(500);
await m.screenshot({ path: OUT + "www-kay-mobile.png" });
check(errors.length === 0, `no browser errors${errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""}`);
await browser.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log("\nAll www checks passed");
