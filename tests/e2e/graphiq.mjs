// End-to-end check of Kayak GraphIQ against `wrangler dev` (default http://127.0.0.1:8705):
//   cd apps/graphiq && npx wrangler d1 migrations apply kayak-graphiq --local -c wrangler.local.jsonc
//   npx wrangler dev -c wrangler.local.jsonc --port 8705      (wrangler.local.jsonc = wrangler.jsonc without routes and ai)
//   node tests/e2e/graphiq.mjs [screenshot folder]
// .dev.vars in apps/graphiq holds GRAPHIQ_SIGNING_KEY and GRAPHIQ_DATA_KEY (random, local only).
// Covers: sign-in (single sign-on tickets, replay and forgery refused), the legal gate, four-eyes
// approval, mixed multi-format import with auto-mapping, dashboard, analytics, exhibits, link chart,
// map, search with the question parser, report export (PDF, XLSX), evidence integrity, audit-chain
// verification (and detection of tampering), and the screens in light, dark and narrow layouts.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.GRAPHIQ_URL || "http://127.0.0.1:8705";
const SHOTS = process.argv[2] || new URL("./out/graphiq/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const APP = new URL("../../apps/graphiq/", import.meta.url).pathname;
const FX = new URL("../fixtures/graphiq/", import.meta.url).pathname;
const KEY = readFileSync(APP + ".dev.vars", "utf8").match(/GRAPHIQ_SIGNING_KEY=(.*)/)[1].trim();
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const sql = (q) => execSync(`npx wrangler d1 execute kayak-graphiq --local -c wrangler.local.jsonc --json --command ${JSON.stringify(q)}`, { cwd: APP, stdio: ["ignore", "pipe", "ignore"] }).toString();
const b64u = (b) => Buffer.from(b).toString("base64url");
const ticket = (n, e, extra = {}) => { const body = b64u(JSON.stringify({ r: "graphiq", role: "member", n, e, x: Date.now() + 60000, j: crypto.randomUUID(), ...extra })); return `${body}.${b64u(crypto.createHmac("sha256", KEY).update(body).digest())}`; };

let pass = 0; const fails = [];
const ok = (c, msg) => { if (c) { pass++; console.log("  PASS", msg); } else { fails.push(msg); console.log("  FAIL", msg); } };
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false });

// Kayak Shield blocks scripted clients; start from a clean slate for this run. This wipes the
// LOCAL development database only (wrangler --local), so the first sign-in becomes Admin again.
sql("DELETE FROM rate_limits; DELETE FROM ip_blocks; DELETE FROM users; DELETE FROM sessions; DELETE FROM sso_used; DELETE FROM audit_chain; DELETE FROM case_members; DELETE FROM cases; DELETE FROM records; DELETE FROM imports; DELETE FROM evidence; DELETE FROM custody; DELETE FROM notes; DELETE FROM bookmarks; DELETE FROM watchlist; DELETE FROM saved_filters; DELETE FROM templates; DELETE FROM towers;");

const browser = await chromium.launch();
const errors = [];
const ctxFor = async (opts = {}) => {
  const c = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
  await c.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
  return c;
};
const watch = (p, who) => { p.on("pageerror", (e) => errors.push(`${who} pageerror: ${e.message}`)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|401|403|409/.test(m.text())) errors.push(`${who} console: ${m.text()}`); }); };
const call = (page, path, method = "GET", body) => page.evaluate(async ([path, method, body]) => { const r = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; }, [path, method, body]);

console.log("Sign-in");
const A = await ctxFor(); const ap = await A.newPage(); watch(ap, "admin");
await ap.goto(BASE + "/app");
ok(ap.url().includes("/login"), "signed-out people are sent to sign-in");
await ap.waitForSelector("#sso");
ok((await ap.getAttribute("#sso", "href")).includes("/sso/graphiq"), "sign-in hands over to Kayak Internal single sign-on");
await shot(ap, "01-login");
const r401 = await ap.request.get(BASE + "/api/me");
ok(r401.status() === 401, "the API refuses requests without a session");
const xs = await ap.request.post(BASE + "/api/cases", { data: {}, headers: { Origin: "https://evil.example" } });
ok(xs.status() === 403, "cross-site POST is refused");
const t1 = ticket("Anuj Choudhary", "anuj@kayaksa.com", { ir: "superadmin" });
await ap.goto(`${BASE}/auth/sso?t=${encodeURIComponent(t1)}`);
await ap.waitForSelector(".rail");
ok(ap.url().includes("/app"), "single sign-on opens GraphIQ");
const replay = await (await fetch(`${BASE}/auth/sso?t=${encodeURIComponent(t1)}`, { redirect: "manual", headers: { "User-Agent": UA } })).headers.get("location");
ok(/\/login\?e=sso/.test(replay || ""), "a ticket cannot be used twice");
const forged = await (await fetch(`${BASE}/auth/sso?t=${encodeURIComponent(t1.slice(0, -4) + "AAAA")}`, { redirect: "manual", headers: { "User-Agent": UA } })).headers.get("location");
ok(/\/login\?e=sso/.test(forged || ""), "a forged ticket is refused");
const me = (await call(ap, "/api/me")).json;
ok(me.user.role === "admin", "the first user (Internal superadmin) is Admin");

const R = await ctxFor(); const rp = await R.newPage(); watch(rp, "approver");
await rp.goto(`${BASE}/auth/sso?t=${encodeURIComponent(ticket("Ria Mehta", "ria@kayaksa.com"))}`);
await rp.waitForSelector(".rail");
ok((await call(rp, "/api/me")).json.user.role === "viewer", "new people start as Viewer");
ok((await call(rp, "/api/cases", "POST", { title: "x" })).status === 403, "a Viewer cannot open cases");
const users = (await call(ap, "/api/users")).json.users;
const ria = users.find((u) => u.email === "ria@kayaksa.com");
await ap.goto(BASE + "/app#/users");
await ap.waitForSelector(`[data-role="${ria.id}"]`);
await ap.selectOption(`[data-role="${ria.id}"]`, "approver");
await ap.waitForTimeout(600);
ok((await call(rp, "/api/me")).json.user.role === "approver", "the Admin gives Ria the Approver role");
await shot(ap, "02-users");

console.log("Legal gate");
await ap.goto(BASE + "/app#/new");
await ap.waitForSelector("#f");
await ap.fill("#title", "Synthetic case - Operation Kingfisher");
await ap.click("#f [type=submit]");
await ap.waitForSelector("#err:not([hidden])");
ok(/legal basis/.test(await ap.textContent("#err")), "a case cannot be opened without its legal basis");
await ap.selectOption("#legalBasis", "court_order");
await ap.fill("#legalText", "Production order of the Chief Judicial Magistrate (synthetic) for CDRs of six numbers, 1 Feb to 31 Mar 2026.");
await ap.fill("#refNo", "CJM/SYN/2026/014");
await ap.fill("#refDate", "2026-04-02");
await ap.fill("#authority", "Chief Judicial Magistrate, Synthetic District");
await ap.fill("#supervisor", "Inspector A. Rao (synthetic)");
await ap.fill("#retainUntil", "2027-12-31");
await ap.check("#lawful");
await shot(ap, "03-new-case");
await ap.click("#f [type=submit]");
await ap.waitForSelector("#err:not([hidden])");
ok(/notice/.test(await ap.textContent("#err")), "the lawful-use notice must be acknowledged");
await ap.check("#notice");
await ap.click("#f [type=submit]");
await ap.waitForURL(/#\/case\//);
const caseId = ap.url().split("#/case/")[1].split("/")[0];
await ap.waitForSelector(".legal-strip");
ok(/Awaiting approval/.test(await ap.textContent(".legal-strip")), "a new case waits for approval");
ok((await call(ap, `/api/cases/${caseId}/imports`, "POST", { fileName: "x.csv" })).status === 409, "import is blocked before approval");
ok((await call(ap, `/api/cases/${caseId}/decision`, "POST", { decision: "approve", checked: true })).status === 403, "the creator (not an Approver) cannot approve");
ok((await call(rp, `/api/cases/${caseId}`)).status === 403, "an Approver who is not on the case cannot read its data");

console.log("Four-eyes approval");
await rp.goto(BASE + "/app#/approvals");
await rp.waitForSelector(`[data-dec="approve"][data-id="${caseId}"]`);
await shot(rp, "04-approvals");
await rp.click(`[data-dec="approve"][data-id="${caseId}"]`);
await rp.waitForSelector(".toast");
ok(/check/i.test(await rp.textContent(".toast")), "approval requires confirming the legal basis was checked");
await rp.check(`[data-chk="${caseId}"]`);
await rp.click(`[data-dec="approve"][data-id="${caseId}"]`);
await rp.waitForFunction(() => /approved/.test(document.querySelector(".toasts")?.textContent || ""));
const kc = (await call(ap, `/api/cases/${caseId}`)).json.case;
ok(kc.status === "approved" && kc.decidedByName === "Ria Mehta", "a second user with the Approver role approves the case");

console.log("Tower master");
await ap.goto(BASE + "/app#/reference");
await ap.waitForSelector("#tfile", { state: "attached" });
await ap.setInputFiles("#tfile", FX + "SYNTHETIC_tower_master.csv");
await ap.waitForSelector("#tout .note");
ok(/towers stored/.test(await ap.textContent("#tout")), "the tower master is imported with auto-detected columns");

console.log("Mixed import with auto-mapping");
await ap.goto(`${BASE}/app#/case/${caseId}/import`);
await ap.waitForSelector("#fi", { state: "attached" });
const names = ["SYNTHETIC_airtel_style_T1.csv", "SYNTHETIC_jio_style_T2.csv", "SYNTHETIC_vi_style_T3.txt", "SYNTHETIC_bsnl_style_T4.xlsx", "SYNTHETIC_generic_T5.json", "SYNTHETIC_generic_T6.xml", "SYNTHETIC_tower_dump.html"];
await ap.setInputFiles("#fi", names.map((n) => FX + n));
await ap.waitForFunction((n) => document.querySelectorAll(".file-card .vsum").length === n, names.length, { timeout: 60000 });
const badges = await ap.$$eval(".file-card .hd .badge", (b) => b.map((x) => x.textContent));
for (const l of ["Airtel-style", "Jio-style", "Vi-style", "BSNL-style"]) ok(badges.some((b) => b.includes(l)), `${l} layout recognised`);
const vs = await ap.$$eval(".file-card .vsum", (v) => v.map((x) => x.textContent));
ok(/Rejected 3/.test(vs[0]) && /Duplicates removed 5/.test(vs[0]), "validation reports rejected rows and duplicates before import");
ok(vs.some((t) => /Duplicates removed [1-9]/.test(t) && t.includes("98000 00105")), "duplicates across files are found");
ok(/Ready to import 0/.test(vs[6]), "a tower dump that repeats records already loaded adds nothing");
await shot(ap, "05-import-mapping");
await ap.click("#imp");
await ap.waitForSelector("#prog .note.ok", { timeout: 120000 });
const k2 = (await call(ap, `/api/cases/${caseId}`)).json;
// The tower dump only repeats records already in the operator files, so it has nothing new to import.
ok(k2.case.records > 1500 && k2.imports.length === 6, `records stored: ${k2.case.records} from 6 files (the tower dump was all duplicates)`);
ok(k2.counts.evidence === 6, "each imported source file is sealed as evidence");

console.log("Dashboard and analytics");
await ap.goto(`${BASE}/app#/case/${caseId}/overview`);
await ap.waitForSelector("#exs .exhibit svg", { timeout: 60000 });
ok((await ap.$$("#kpis .gq-card")).length === 8, "eight KPI cards on the dashboard");
ok((await ap.$$("#exs .exhibit")).length >= 8, "dashboard exhibits render");
const headline = await ap.textContent("#exs");
ok(/Exhibit \d+ - Top contacts/i.test(headline), "exhibits carry Kayak eyebrows");
await shot(ap, "06-dashboard-light");
await ap.goto(`${BASE}/app#/case/${caseId}/analytics`);
await ap.waitForSelector("#s-location table", { timeout: 60000 });
const loc = await ap.textContent("#s-location");
ok(loc.includes("+91 98000 00101") && loc.includes("+91 98000 00105"), "possible meeting point between T1 and T5 found");
ok(/site 28\.63/.test(loc), "cross-operator meeting by mast found with the tower master");
ok((await ap.textContent("#s-devices")).includes("+91 94150 00104"), "one IMEI with two SIMs found");
ok(/>/.test(await ap.textContent("#s-relations")), "circular chain listed");
ok((await ap.$$("#exs .exhibit")).length >= 25, "the exhibit library renders for the case");
await shot(ap, "07-analytics");
await ap.$eval("#s-exhibits", (e) => e.scrollIntoView());
await shot(ap, "08-exhibits-light");
// Drill-down from a chart mark to the records behind it
await ap.click("#exs .exhibit .gq-mark[data-drill]");
await ap.waitForURL(/\/search$/);
await ap.waitForSelector("#res table", { timeout: 20000 });
ok(/records match/.test(await ap.textContent("#res")), "clicking a chart mark drills down to the matching records");

console.log("Link chart and map");
await ap.goto(`${BASE}/app#/case/${caseId}/graph`);
await ap.waitForFunction(() => /numbers, \d+ links/.test(document.querySelector("#gsum")?.textContent || ""), null, { timeout: 30000 });
ok((await ap.$$("#cy canvas")).length > 0, "the link chart draws");
ok(/communities/.test(await ap.textContent("#gsum")), "communities are detected");
await shot(ap, "09-link-chart");
await ap.goto(`${BASE}/app#/case/${caseId}/map`);
await ap.waitForSelector("#map .leaflet-interactive", { timeout: 20000 });
ok(/OpenStreetMap/.test(await ap.textContent("#map")), "the map shows OpenStreetMap attribution");
ok((await ap.$$("#tl .gq-mark")).length > 50, "the timeline draws");
await shot(ap, "10-timeline-map");

console.log("Search");
await ap.goto(`${BASE}/app#/case/${caseId}/search`);
await ap.waitForSelector("#q");
await ap.fill("#q", "outgoing calls from 9800000101 in February 2026 longer than 2 minutes");
await ap.click("#askb");
await ap.waitForFunction(() => /Proposed filter/.test(document.querySelector("#qnote").textContent));
ok((await ap.inputValue("#numbers")).includes("+919800000101") && (await ap.inputValue("#durMin")) === "120", "the question becomes a visible filter");
await ap.click("#ff [type=submit]");
await ap.waitForSelector("#res table");
const resText = await ap.textContent("#res p");
ok(/^\s*\d+\s+records match/.test(resText) && !/^\s*0 records/.test(resText), `search runs: ${resText.trim().slice(0, 60)}`);
await shot(ap, "11-search");

console.log("Reports");
await ap.goto(`${BASE}/app#/case/${caseId}/reports`);
await ap.waitForSelector('[data-rep="meeting"][data-fmt="pdf"]');
for (const [kind, fmt, sig] of [["meeting", "pdf", "%PDF"], ["summary", "xlsx", "PK"], ["imei", "csv", "IMEI"], ["tower", "html", "<!doctype"]]) {
  const [dl] = await Promise.all([ap.waitForEvent("download", { timeout: 60000 }), ap.click(`[data-rep="${kind}"][data-fmt="${fmt}"]`)]);
  const p = await dl.path();
  const head = readFileSync(p).subarray(0, 400).toString("latin1");
  ok(head.startsWith(sig) || head.includes(sig), `${kind} report exported as ${fmt.toUpperCase()} (${statSync(p).size} bytes)`);
  if (fmt === "html") ok(readFileSync(p, "utf8").includes("Requires human verification"), "the HTML report states it needs human verification");
  if (fmt === "pdf") ok(statSync(p).size > 20000, "the PDF report includes tables and charts");
}
await ap.click("#draft");
await ap.waitForSelector("#draftout .ai-label");
ok(/verify before use/i.test(await ap.textContent("#draftout")), "the drafted summary is labelled for verification");
await shot(ap, "12-reports");

console.log("Evidence and audit");
await ap.goto(`${BASE}/app#/case/${caseId}/evidence`);
await ap.waitForSelector("[data-ver]");
await ap.click("[data-ver]");
await ap.waitForFunction(() => /Integrity verified/.test(document.querySelector(".toasts")?.textContent || ""));
ok(true, "evidence integrity verified after decryption");
await ap.click("[data-cus]");
await ap.waitForSelector("#cus table");
ok(/received and sealed/.test(await ap.textContent("#cus")), "chain of custody recorded");
await shot(ap, "13-evidence");
await ap.goto(`${BASE}/app#/case/${caseId}/audit`);
await ap.waitForSelector("#ver");
const acts = await ap.textContent("table");
for (const a of ["case.created", "case.approved", "import.completed", "records.read", "search", "report.exported"]) ok(acts.includes(a), `audit records ${a}`);
await ap.click("#ver");
await ap.waitForSelector("#vres .note");
ok(/Chain intact/.test(await ap.textContent("#vres")), "the audit chain verifies");
await shot(ap, "14-audit");
const row = JSON.parse(sql("SELECT seq, detail FROM audit_chain WHERE action = 'case.approved'"))[0].results[0];
sql(`UPDATE audit_chain SET detail = '{"note":"tampered"}' WHERE seq = ${row.seq}`);
await ap.click("#ver");
await ap.waitForFunction(() => /broken/.test(document.querySelector("#vres").textContent));
ok((await ap.textContent("#vres")).includes(`entry ${row.seq}`), "tampering with an audit entry is detected at that entry");
sql(`UPDATE audit_chain SET detail = ${row.detail === null ? "NULL" : `'${String(row.detail).replace(/'/g, "''")}'`} WHERE seq = ${row.seq}`);
await ap.click("#ver");
await ap.waitForFunction(() => /intact/.test(document.querySelector("#vres").textContent));
ok(true, "restoring the entry makes the chain verify again");

console.log("Screens: dark, narrow, gallery, about");
await ap.goto(`${BASE}/app#/gallery`);
await ap.waitForSelector("#gx .exhibit svg");
ok((await ap.$$("#gx .exhibit")).length >= 30 && (await ap.$$("#gk .gq-card")).length === 8, "chart gallery shows every chart type and the eight card styles");
await shot(ap, "15-gallery-dark-exhibits");
await ap.click('[data-t="light"]');
await shot(ap, "16-gallery-light-exhibits");
await ap.goto(`${BASE}/app#/about`);
await ap.waitForSelector(".feat");
ok((await ap.$$(".st.planned")).length > 5 && (await ap.$$(".st.built")).length > 50, "About lists Built, Partly and Planned features");
await shot(ap, "17-about");
const D = await ctxFor({ colorScheme: "dark" }); const dp = await D.newPage(); watch(dp, "dark");
await dp.goto(`${BASE}/auth/sso?t=${encodeURIComponent(ticket("Anuj Choudhary", "anuj@kayaksa.com"))}`);
await dp.goto(`${BASE}/app#/case/${caseId}/overview`);
await dp.waitForSelector("#exs .exhibit svg", { timeout: 60000 });
ok((await dp.$eval("#exs svg.gq-chart", (s) => s.dataset.theme)) === "dark", "exhibits follow the dark theme");
await shot(dp, "18-dashboard-dark");
await dp.goto(`${BASE}/app#/case/${caseId}/analytics`);
await dp.waitForSelector("#s-summary table", { timeout: 60000 });
await shot(dp, "19-analytics-dark");
const N = await ctxFor({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const np = await N.newPage(); watch(np, "narrow");
await np.goto(`${BASE}/auth/sso?t=${encodeURIComponent(ticket("Anuj Choudhary", "anuj@kayaksa.com"))}`);
await np.goto(`${BASE}/app#/case/${caseId}/overview`);
await np.waitForSelector("#exs .exhibit svg", { timeout: 60000 });
const overflow = await np.evaluate(() => document.documentElement.scrollWidth - innerWidth);
ok(overflow <= 1, `no horizontal page scroll on a narrow screen (${overflow}px)`);
await shot(np, "20-narrow-dashboard");
await np.click("#menu");
await shot(np, "21-narrow-menu");

console.log("Secure deletion");
ok((await call(rp, `/api/cases/${caseId}/delete`, "POST", { confirm: "x", reason: "x" })).status === 403, "only Admins can delete a case");

await browser.close();
if (errors.length) { console.log("Browser errors:\n  " + errors.join("\n  ")); }
ok(errors.length === 0, "no browser errors");
console.log(`\n${pass} passed, ${fails.length} failed${fails.length ? ":\n  " + fails.join("\n  ") : ""}\nScreenshots: ${SHOTS}`);
process.exit(fails.length ? 1 : 0);
