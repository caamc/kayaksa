// Kayak's monthly Cloudflare Realtime limits: town halls and the relay stop at the limit.
// Needs: meet worker on :8704 with CF_REALTIME_APP_ID/SECRET set (any value) in .dev.vars, and
// town hall tow-nhal-lxx in local D1. Writes to the local usage table.
import { createRequire } from "node:module";
import fs from "node:fs"; import crypto from "node:crypto"; import { execSync } from "node:child_process";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = "http://localhost:8704", R = "tow-nhal-lxx";
const KEY = fs.readFileSync(new URL("../../apps/meet/.dev.vars", import.meta.url), "utf8").match(/MEET_SIGNING_KEY=(.*)/)[1].trim().replace(/^"|"$/g, "");
const b64u = (b) => Buffer.from(b).toString("base64url");
const tok = (c) => { const body = b64u(JSON.stringify(c)); return body + "." + crypto.createHmac("sha256", KEY).update(body).digest("base64url"); };
const sql = (q) => execSync(`npx wrangler d1 execute kayaksa-meet --local -c wrangler.local.jsonc --json --command "${q}"`, { cwd: new URL("../../apps/meet/", import.meta.url).pathname, stdio: ["ignore", "pipe", "ignore"] }).toString();
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
const host = tok({ r: R, role: "host", n: "Anuj", e: "anuj@kayaksa.com", x: Date.now() + 3600e3 });
const post = (path) => fetch(BASE + path, { method: "POST", headers: { "X-Meet-Token": host, "Content-Type": "application/json", "User-Agent": UA, Origin: BASE }, body: "{}" });
const period = () => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`; };

sql("DELETE FROM usage; DELETE FROM usage_alerts; DELETE FROM rate_limits; DELETE FROM ip_blocks;");
let r = await post(`/api/sfu/${R}/session`);
ok(r.status !== 429, `under the limits, a town hall may open a Realtime session (got ${r.status}; no network to Cloudflare here)`);

// 1 GB short of the 950 GB limit: inside the 3 GB reserve, so it must stop.
sql(`INSERT INTO usage (period, metric, amount) VALUES ('${period()}', 'bytes', 949e9)`);
r = await post(`/api/sfu/${R}/session`);
ok(r.status === 429 && (await r.json()).capped, "at 949 GB the town hall proxy refuses new Realtime sessions");
const ice = await (await fetch(`${BASE}/api/ice/${R}`, { headers: { "X-Meet-Token": host, "User-Agent": UA } })).json();
ok(ice.relay === false, "at the data limit, no TURN relay credentials are handed out");
const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const p = await (await browser.newContext({ userAgent: UA, permissions: ["camera", "microphone"] })).newPage();
await p.goto(`${BASE}/${R}?t=${host}`); await p.click("#join");
await p.waitForSelector("h1", { timeout: 15000 });
await p.waitForFunction(() => /paused for the rest of the month/.test(document.body.textContent), null, { timeout: 15000 }).catch(() => {});
ok(/paused for the rest of the month/.test(await p.textContent("body")), "people can't join a town hall past the limit, and are told why");

// Participant minutes: 9,450 audio+video minutes used (inside the 60-minute reserve).
sql(`DELETE FROM usage; INSERT INTO usage (period, metric, amount) VALUES ('${period()}', 'av_min', 9450)`);
r = await post(`/api/sfu/${R}/session`);
ok(r.status === 429, "at 9,450 audio+video participant minutes, town halls stop");
sql(`DELETE FROM usage; INSERT INTO usage (period, metric, amount) VALUES ('${period()}', 'audio_min', 9441)`);
r = await post(`/api/sfu/${R}/session`);
ok(r.status === 429, "at 9,441 audio-only participant minutes, town halls stop");
const alerts = sql("SELECT count(*) n FROM audit_log WHERE action = 'meet.usage.threshold'");
sql("DELETE FROM usage;");
// Minutes are timed on the server while someone is in a town hall.
sql("DELETE FROM usage;");
const q = await (await browser.newContext({ userAgent: UA, permissions: ["camera", "microphone"] })).newPage();
await q.goto(`${BASE}/${R}?t=${host}`); await q.click("#join"); await q.waitForSelector("#grid .tile", { timeout: 15000 }).catch(() => {});
await q.waitForTimeout(3000); await q.close(); await new Promise((res) => setTimeout(res, 2500));
const mins = JSON.parse(sql("SELECT metric, amount FROM usage"))[0].results;
ok(mins.some((m) => /_min$/.test(m.metric) && m.amount > 0) && mins.some((m) => m.metric === "bytes" && m.amount > 0), "participant minutes and an at-least estimate of data are recorded on the server: " + JSON.stringify(mins));
sql("DELETE FROM usage;");
await browser.close();
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
