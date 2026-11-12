// Renders the Meet by Kayak promo scenes (scenes.html) to looping WebM (VP9) and MP4 (H.264) files
// plus a poster image each, for meet.kayaksa.com. Deterministic: frame n is seek(scene, n / FPS).
// Usage: node scripts/promo/render.mjs [scene ...]
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { renameSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "../../apps/meet/public/assets/video");
mkdirSync(OUT, { recursive: true });
const FPS = 30, W = 1280, H = 720;
const POSTER = { meeting: 5.4, notes: 8.2, workspace: 3.9, languages: 5.2, plan: 3.4 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto("file://" + join(here, "scenes.html"));
await page.evaluate(() => document.fonts.ready);
const scenes = await page.evaluate(() => window.SCENES);
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(scenes);

function encoder(args, file) {
  const tmp = file.replace(/(\.\w+)$/, ".part$1");
  const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", ...args, tmp], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => p.on("close", (c) => (c === 0 ? (renameSync(tmp, file), res()) : rej(new Error(`ffmpeg exited ${c} for ${file}`)))));
  return { stdin: p.stdin, done };
}

for (const name of want) {
  const dur = scenes[name], n = Math.round(dur * FPS);
  const webm = encoder(["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-pix_fmt", "yuv420p", "-an"], join(OUT, `${name}.webm`));
  const mp4 = encoder(["-c:v", "libx264", "-preset", "slow", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"], join(OUT, `${name}.mp4`));
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate(([s, t]) => window.seek(s, t), [name, i / FPS]);
    const jpg = await page.screenshot({ type: "jpeg", quality: 92 });
    for (const e of [webm, mp4]) if (!e.stdin.write(jpg)) await new Promise((r) => e.stdin.once("drain", r));
  }
  webm.stdin.end(); mp4.stdin.end();
  await Promise.all([webm.done, mp4.done]);
  await page.evaluate(([s, t]) => window.seek(s, t), [name, POSTER[name] || dur / 2]);
  await page.screenshot({ path: join(OUT, `${name}-poster.jpg`), type: "jpeg", quality: 84 });
  console.log(`${name}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close();
