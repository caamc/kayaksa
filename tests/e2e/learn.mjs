// End-to-end check of learn.kayaksa.com against `wrangler dev` (default http://127.0.0.1:8703).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { readFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:8703";
const OUT = new URL("./out/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const CAT = JSON.parse(readFileSync(new URL("../../packages/learnkit/content/catalog.json", import.meta.url), "utf8"));
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails.push(msg); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|401|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });

await page.goto(BASE + "/");
await page.waitForSelector(".course-card");
const cards = await page.$$eval(".course-card", (x) => x.length);
check(cards >= 20, `home lists paths and courses (${cards} cards)`);
const internalShown = await page.$$eval(".course-card", (x) => x.some((e) => e.textContent.includes("Kayak staff")));
check(!internalShown, "staff-only courses are hidden on the public site");
await page.screenshot({ path: OUT + "learn-home.png", fullPage: true });

const r404 = await page.request.get(`${BASE}/api/learn/courses/kayak-who-we-are/lessons/l1`);
check(r404.status() === 404, "internal lesson content is not served publicly");

// Sign up
const email = `learner${Date.now()}@example.com`;
await page.click("[data-auth=up]");
await page.fill("#name", "Meera Iyer");
await page.fill("#email", email);
await page.fill("#password", "Correct horse battery 42");
await page.click("[data-a=go]");
await page.waitForSelector("#ae:not([hidden])", { timeout: 4000 }).catch(() => {});
check(await page.isVisible("#ae"), "sign-up refuses without privacy consent");
await page.check("#consent");
await page.click("[data-a=go]");
await page.waitForSelector("a[href='#/certificates']", { timeout: 10000 });
check(true, "sign-up works and signs the learner in");

// Complete a course
const c = CAT.courses.find((x) => x.id === "posh");
await page.goto(`${BASE}/#/course/posh`);
await page.waitForSelector("h1");
await page.screenshot({ path: OUT + "learn-course.png" });
for (const l of c.lessons) {
  await page.goto(`${BASE}/#/course/posh/lesson/${l.id}`);
  await page.waitForSelector("#done");
  if (l.id === "l1") await page.screenshot({ path: OUT + "learn-lesson.png", fullPage: true });
  await page.click("#done");
  await page.waitForTimeout(400);
}
await page.waitForSelector("#qf");
// first a failing attempt
for (let i = 0; i < c.quiz.questions.length; i++) {
  const wrong = (c.quiz.questions[i].answer + 1) % c.quiz.questions[i].options.length;
  await page.check(`input[name=q${i}][value="${wrong}"]`);
}
await page.click("#qf button[type=submit]");
await page.waitForSelector("#res .note");
check((await page.textContent("#res")).includes("Not this time"), "failing the assessment gives no certificate");
await page.goto(`${BASE}/#/course/posh`); await page.goto(`${BASE}/#/course/posh/quiz`);
await page.waitForSelector("#qf");
for (let i = 0; i < c.quiz.questions.length; i++) await page.check(`input[name=q${i}][value="${c.quiz.questions[i].answer}"]`);
await page.click("#qf button[type=submit]");
await page.waitForSelector("#res .note");
const res = await page.textContent("#res");
check(res.includes("You passed") && res.includes("certificate"), "passing issues a certificate");
await page.screenshot({ path: OUT + "learn-quiz.png", fullPage: true });
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#res a.btn")]);
const pdfPath = OUT + "learn-certificate.pdf";
await dl.saveAs(pdfPath);
check(readFileSync(pdfPath).subarray(0, 4).toString() === "%PDF", "certificate downloads as a PDF");

const me = await (await page.request.get(`${BASE}/api/learn/me`)).json();
const certId = me.certificates[0]?.id;
check(/^KSA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(certId || ""), `certificate ID issued (${certId})`);
await page.goto(`${BASE}/verify/${certId}`);
check((await page.textContent("body")).includes("Meera Iyer"), "public verify page confirms the holder");
await page.screenshot({ path: OUT + "learn-verify.png" });
await page.goto(`${BASE}/verify/KSA-0000-0000`);
check((await page.textContent("body")).includes("No certificate"), "unknown ID is reported as not found");

// Byte check
await page.goto(`${BASE}/#/byte/byte-deepfake`);
await page.waitForSelector("[data-o]");
await page.click("[data-o='1']");
await page.waitForSelector("#why:not([hidden])");
check((await page.textContent("#why")).includes("Correct"), "awareness byte check works");

// Export and delete
const exp = await page.request.get(`${BASE}/api/account/export`);
check(exp.ok() && (await exp.json()).certificates.length === 1, "learner can download their data");
await page.goto(`${BASE}/#/account`);
await page.waitForSelector("#del");
await page.screenshot({ path: OUT + "learn-account.png" });
await page.click("#del");
await page.fill("#dp", "Correct horse battery 42");
await page.click("[data-a=yes]");
await page.waitForSelector("[data-auth=up]", { timeout: 10000 });
const gone = await page.request.get(`${BASE}/api/learn/verify/${certId}`);
check(gone.status() === 404, "deleting the account erases the certificate");

// Mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await m.goto(BASE + "/");
await m.waitForSelector(".course-card");
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
check(!overflow, "no sideways scroll on a phone");
await m.screenshot({ path: OUT + "learn-mobile.png" });

check(errors.length === 0, `no browser errors${errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""}`);
await browser.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log("\nAll learn checks passed");
