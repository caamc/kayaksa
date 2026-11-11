// Renders the "Why Kayak" film: node scripts/film/render.mjs <out.mp4> [scenes.json] [imageDir]
import { createRequire } from "node:module"; import { spawn } from "node:child_process"; import path from "node:path"; import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const [out, scenesFile, dir] = process.argv.slice(2);
const FPS = 30;
const q = new URLSearchParams(); if (scenesFile) q.set("scenes", fs.readFileSync(scenesFile, "utf8")); if (dir) q.set("dir", dir);
const b = await chromium.launch();
const URL_ = "file://" + path.resolve(path.dirname(new URL(import.meta.url).pathname), "film.html") + "?" + q;
// A fresh page every few seconds of film keeps the renderer's memory flat.
async function fresh(old) { await old?.close().catch(() => {}); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); p.on("pageerror", (e) => console.error(e.message)); await p.goto(URL_); await p.evaluate(() => window.ready); return p; }
let p = await fresh();
const D = await p.evaluate(() => window.DURATION);
const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-movflags", "+faststart", "-an", out + ".tmp.mp4"], { stdio: ["pipe", "inherit", "inherit"] });
const N = Math.round((D / 1000) * FPS);
for (let f = 0; f < N; f++) {
  if (f && f % 120 === 0) p = await fresh(p);
  await p.evaluate((t) => seek(t), (f * 1000) / FPS);
  const buf = await p.screenshot({ type: "jpeg", quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 150 === 0) console.log(`frame ${f}/${N}`);
}
ff.stdin.end(); await new Promise((r) => ff.on("close", r));
await p.evaluate((t) => seek(t), 4000); await p.screenshot({ path: out.replace(/\.mp4$/, "-poster.jpg"), type: "jpeg", quality: 86 });
await b.close();
fs.renameSync(out + ".tmp.mp4", out);
console.log("wrote", out, D / 1000, "s");
