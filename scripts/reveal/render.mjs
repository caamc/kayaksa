// Renders a Kayak Group logo reveal to MP4: node scripts/reveal/render.mjs <ksa|ki|kts> <out.mp4> [width]
import { createRequire } from "node:module"; import { spawn } from "node:child_process"; import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const [e, out, W = "1920"] = process.argv.slice(2);
const FPS = 30, DUR = 5000;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto("file://" + path.resolve(path.dirname(new URL(import.meta.url).pathname), "reveal.html") + "?e=" + e);
await p.evaluate(() => document.fonts.ready);
const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-vf", `scale=${W}:-2:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-movflags", "+faststart", "-an", out + ".tmp.mp4"], { stdio: ["pipe", "inherit", "inherit"] });
for (let f = 0; f < (DUR / 1000) * FPS; f++) {
  await p.evaluate((t) => seek(t), (f * 1000) / FPS);
  ff.stdin.write(await p.screenshot({ type: "jpeg", quality: 94 }));
}
ff.stdin.end(); await new Promise((r) => ff.on("close", r));
await p.evaluate(() => seek(5000)); await p.screenshot({ path: out.replace(/\.mp4$/, ".jpg"), type: "jpeg", quality: 88 });
await b.close();
(await import("node:fs")).renameSync(out + ".tmp.mp4", out);
console.log("wrote", out);
