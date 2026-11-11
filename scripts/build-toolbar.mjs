// Builds apps/toolbar/public and apps/toolbar/src/proxy from the KSA Toolbar release zip in brand-assets.
// Sets the hosting address in the three manifests, points the Assistant at this site's proxy by default,
// and leaves out the server, tools and Teams build folders (they are not served).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ZIP = join(ROOT, "brand-assets/07_Office_Templates_and_Toolbar/KSA_Toolbar_v1.0.0.zip");
const BASE = process.env.TOOLBAR_BASE || "https://toolbar.kayaksa.com";
const OUT = join(ROOT, "apps/toolbar/public"), PROXY = join(ROOT, "apps/toolbar/src/proxy");
const tmp = mkdtempSync(join(tmpdir(), "ksa-toolbar-"));
execFileSync("unzip", ["-q", ZIP, "-d", tmp]);
const T = join(tmp, "ksa-toolbar");
execFileSync("python3", [join(T, "tools/set-base-url.py"), BASE], { cwd: T, stdio: "inherit" });
try { execFileSync("python3", [join(T, "teams/build-package.py")], { cwd: T, stdio: "inherit" }); } catch { console.warn("Teams package not rebuilt"); }
// Default the Assistant to this site's proxy; staff only add the access token in Settings.
const hostJs = join(T, "src/modules/host.js");
const h = readFileSync(hostJs, "utf8");
const patched = h.replace('export function getSettings() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }',
  `const DEFAULTS = { assistantUrl: "${BASE}/api/assistant" };\nexport function getSettings() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; } }`);
if (patched === h) throw new Error("host.js changed; update build-toolbar.mjs");
writeFileSync(hostJs, patched);
rmSync(OUT, { recursive: true, force: true }); rmSync(PROXY, { recursive: true, force: true });
for (const d of readdirSync(T)) if (!["server", "tools", ".git", "node_modules"].includes(d)) cpSync(join(T, d), join(OUT, d), { recursive: true });
cpSync(join(T, "server/cloudflare-worker/src"), PROXY, { recursive: true });
rmSync(tmp, { recursive: true, force: true });
console.log(`Built the KSA Toolbar for ${BASE}: ${existsSync(join(OUT, "assets/library.json")) ? "library present" : "LIBRARY MISSING"}`);
