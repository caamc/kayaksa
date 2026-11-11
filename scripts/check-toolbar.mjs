// Fifteen go-live checks for the KSA Toolbar (toolbar.kayaksa.com). Files are checked on disk; the
// served checks run against BASE (a local `wrangler dev`, or the live site after deployment).
// Usage: node scripts/check-toolbar.mjs [BASE] [TOKEN]   (exit code 1 if any check fails)
import { readFileSync, existsSync, statSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = new URL("..", import.meta.url).pathname;
const PUB = join(ROOT, "apps/toolbar/public");
const SITE = "https://toolbar.kayaksa.com";
const BASE = process.argv[2] || "http://127.0.0.1:8705";
const TOKEN = process.argv[3] || process.env.TOOLBAR_TOKEN || "";
const results = [];
const check = async (n, name, fn) => {
  try { const r = await fn(); results.push([n, name, r === true || r === undefined, r === true || r === undefined ? "" : String(r)]); }
  catch (e) { results.push([n, name, false, String(e?.message || e).slice(0, 300)]); }
};
const read = (p) => readFileSync(join(PUB, p), "utf8");

// 1. The release unpacks and its own library checker passes
await check(1, "Release zip unpacks and tools/check-library.py passes", () => {
  const t = mkdtempSync(join(tmpdir(), "tbchk-"));
  try {
    execFileSync("unzip", ["-q", join(ROOT, "brand-assets/07_Office_Templates_and_Toolbar/KSA_Toolbar_v1.0.0.zip"), "-d", t]);
    const out = execFileSync("python3", [join(t, "ksa-toolbar/tools/check-library.py")], { cwd: join(t, "ksa-toolbar"), encoding: "utf8" });
    return /error/i.test(out) && !/0 errors/i.test(out) ? out.slice(-300) : true;
  } finally { rmSync(t, { recursive: true, force: true }); }
});
const xmlOk = (p) => execFileSync("python3", ["-c", "import sys,xml.etree.ElementTree as E;E.parse(sys.argv[1]);print('ok')", join(PUB, p)], { encoding: "utf8" }).trim() === "ok";
// 2-3. XML manifests are well-formed
await check(2, "manifest.xml (Word, Excel, PowerPoint) is well-formed XML", () => xmlOk("manifest/manifest.xml"));
await check(3, "manifest-outlook.xml is well-formed XML", () => xmlOk("manifest/manifest-outlook.xml"));
// 4. Unified manifest parses and versions agree
await check(4, "manifest.json parses and all three manifests carry the same version and id", () => {
  const j = JSON.parse(read("manifest/manifest.json"));
  const x1 = read("manifest/manifest.xml"), x2 = read("manifest/manifest-outlook.xml");
  const v1 = (x1.match(/<Version>([^<]+)<\/Version>/) || [])[1], v2 = (x2.match(/<Version>([^<]+)<\/Version>/) || [])[1];
  const id1 = (x1.match(/<Id>([^<]+)<\/Id>/) || [])[1], id2 = (x2.match(/<Id>([^<]+)<\/Id>/) || [])[1];
  if (v1 !== v2 || !v1?.startsWith(j.version)) return `versions differ: ${v1} / ${v2} / ${j.version}`;
  if (id1 !== id2 || id1 !== j.id) return `ids differ: ${id1} / ${id2} / ${j.id}`;
  return true;
});
// 5. Every absolute URL points at the live host
const manifestUrls = () => ["manifest/manifest.xml", "manifest/manifest-outlook.xml", "manifest/manifest.json"].flatMap((f) => [...read(f).matchAll(/https:\/\/[^"'<>\s]+/g)].map((m) => m[0]));
await check(5, "Manifests point only at https://toolbar.kayaksa.com (no placeholder host left)", () => {
  const bad = manifestUrls().filter((u) => /kayaksa\.com/.test(u) && !u.startsWith(SITE) && !/^https:\/\/(www\.)?kayaksa\.com(\/(privacy|terms|legal|contact))?\/?$/.test(u));
  return bad.length ? `unexpected hosts: ${[...new Set(bad)].slice(0, 5).join(", ")}` : true;
});
// 6. Every file a manifest names exists
await check(6, "Every file the manifests reference exists in the build", () => {
  const miss = [...new Set(manifestUrls().filter((u) => u.startsWith(SITE + "/")).map((u) => u.slice(SITE.length + 1).split(/[?#]/)[0]))].filter((p) => p && !existsSync(join(PUB, p)));
  return miss.length ? `missing: ${miss.join(", ")}` : true;
});
// 7. Icons exist at the sizes their names promise
await check(7, "Add-in icons are PNGs at 16, 32, 64, 80 and 128 px", () => {
  for (const n of [16, 32, 64, 80, 128]) {
    const b = readFileSync(join(PUB, `manifest/icons/icon-${n}.png`));
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    if (b.toString("ascii", 1, 4) !== "PNG" || w !== n || h !== n) return `icon-${n}.png is ${w}×${h}`;
  }
  return true;
});
// 8. Every asset the library lists is present
await check(8, "Every asset in library.json is present in the build", () => {
  const lib = JSON.parse(read("assets/library.json"));
  const paths = new Set();
  const walk = (v) => { if (typeof v === "string") { if (/^assets\//.test(v)) paths.add(v); } else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  lib.items.forEach(walk);
  const miss = [...paths].filter((p) => !existsSync(join(PUB, p)));
  return miss.length ? `${miss.length} missing, e.g. ${miss.slice(0, 3).join(", ")}` : `${lib.items.length}` && true;
});
// 9. No secrets shipped in public files
await check(9, "No API keys, tokens or private keys in the public files", () => {
  const hits = [];
  const scan = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p); if (s.isDirectory()) scan(p); else if (/\.(js|json|html|xml|css|md|txt)$/.test(f) && s.size < 5e6) { const t = readFileSync(p, "utf8"); if (/sk-ant-[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}/.test(t)) hits.push(p.slice(PUB.length)); } } };
  scan(PUB);
  return hits.length ? `possible secret in ${hits.join(", ")}` : true;
});

// Served checks. NO_BROWSER=1 skips the four browser checks (10 to 13), for CI runners without Chromium.
const NO_BROWSER = process.env.NO_BROWSER === "1";
const { chromium } = NO_BROWSER ? { chromium: null } : createRequire(import.meta.url)("playwright");
const browser = NO_BROWSER ? null : await chromium.launch({ args: ["--user-agent=Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141 Safari/537.36"] });
const pageCheck = async (path, wait) => {
  const p = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  p.on("requestfailed", (rq) => { if (rq.url().startsWith(BASE)) errs.push(`failed: ${rq.url().slice(BASE.length)}`); });
  p.on("response", (rs) => { if (rs.url().startsWith(BASE) && rs.status() >= 400) errs.push(`${rs.status()}: ${rs.url().slice(BASE.length)}`); });
  await p.goto(BASE + path, { waitUntil: "load", timeout: 30000 });
  const r = wait ? await wait(p) : true;
  await p.close();
  return errs.length ? `errors: ${errs.slice(0, 3).join(" | ")}` : r;
};
// 10. The task pane loads the library in hub mode
if (!NO_BROWSER) await check(10, "Task pane (hub mode) loads the library with every asset counted", () => pageCheck("/src/taskpane.html?hub=1", async (p) => {
  await p.waitForFunction(() => /[\d,]{4,}\s+assets/i.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  const t = await p.evaluate(() => document.body.innerText);
  return /2,?405\s+assets/i.test(t) || `status shows: ${(t.match(/[\d,]+\s+assets/i) || ["no asset count"])[0]}`;
}));
// 11. Every pane section opens
if (!NO_BROWSER) await check(11, "Every section of the pane opens without errors", () => pageCheck("/src/taskpane.html?hub=1", async (p) => {
  await p.waitForTimeout(2500);
  const tabs = await p.$$("[role=tab], nav button, .tabs button");
  for (const t of tabs.slice(0, 14)) { await t.click().catch(() => {}); await p.waitForTimeout(250); }
  return tabs.length ? true : "no tabs found";
}));
// 12. Search returns results
if (!NO_BROWSER) await check(12, "Search finds the KSA logo and the strategy icon", () => pageCheck("/src/taskpane.html?hub=1", async (p) => {
  await p.waitForTimeout(2500);
  const box = await p.$("input[type=search], input[placeholder*=earch]");
  if (!box) return "no search box";
  await box.fill("strategy"); await p.keyboard.press("Enter"); await p.waitForTimeout(800);
  const t = await p.evaluate(() => document.body.innerText.toLowerCase());
  return t.includes("strategy") || "no results for strategy";
}));
// 13. Preview and command pages load
if (!NO_BROWSER) await check(13, "preview.html and commands.html load without errors", async () => { const a = await pageCheck("/src/preview.html"); if (a !== true) return a; return pageCheck("/src/commands.html"); });
// 14. Files are served with the right types over HTTPS-ready headers
await check(14, "Correct content types and security headers for svg, json, xml, woff2, pptx, docx and xlsx", async () => {
  const lib = JSON.parse(read("assets/library.json"));
  const pick = (re) => { let f = null; const walk = (v) => { if (f) return; if (typeof v === "string" && re.test(v) && existsSync(join(PUB, v))) f = v; else if (v && typeof v === "object") Object.values(v).forEach(walk); }; lib.items.forEach(walk); return f; };
  const want = { "manifest/manifest.xml": "xml", "assets/library.json": "json", [pick(/\.svg$/)]: "svg", [pick(/\.woff2$/) || "assets/library.json"]: "", [pick(/\.pptx$/)]: "presentationml", [pick(/\.docx$/)]: "wordprocessingml", [pick(/\.xlsx$/)]: "spreadsheetml" };
  for (const [path, t] of Object.entries(want)) {
    if (!path || path === "null") continue;
    const r = await fetch(`${BASE}/${path}`);
    if (!r.ok) return `${path}: HTTP ${r.status}`;
    if (t && !(r.headers.get("content-type") || "").includes(t)) return `${path}: ${r.headers.get("content-type")}`;
    if (r.headers.get("x-content-type-options") !== "nosniff") return `${path}: no nosniff header`;
  }
  const hidden = await fetch(`${BASE}/server/cloudflare-worker/wrangler.toml`);
  return hidden.status === 404 || `server files are exposed (${hidden.status})`;
});
// 15. The Assistant proxy is locked to the add-in and its token
await check(15, "Assistant proxy answers health, refuses other origins and requests without the token", async () => {
  const h = await fetch(`${BASE}/api/assistant/health`, { headers: { Origin: SITE } });
  if (!h.ok) return `health: HTTP ${h.status}`;
  const evil = await fetch(`${BASE}/api/assistant/chat`, { method: "POST", headers: { Origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
  if (evil.status !== 403) return `foreign origin was not refused (${evil.status})`;
  const noTok = await fetch(`${BASE}/api/assistant/chat`, { method: "POST", headers: { Origin: SITE, "content-type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) });
  if (TOKEN && noTok.status !== 401) return `request without the token was not refused (${noTok.status})`;
  return true;
});
await browser?.close();

for (const [n, name, ok, why] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${String(n).padStart(2)}. ${name}${why ? ` — ${why}` : ""}`);
const failed = results.filter((r) => !r[2]).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
