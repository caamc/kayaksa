// Uploads brand-assets/ to the kayaksa-brand R2 bucket under library/, skipping files already there
// with the same size. Run by the deploy workflow when "sync_brand" is ticked.
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
const MIME = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", pdf: "application/pdf", mp4: "video/mp4", ttf: "font/ttf", otf: "font/otf", woff2: "font/woff2", woff: "font/woff", zip: "application/zip" };
const root = new URL("../brand-assets/", import.meta.url).pathname;
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : !f.startsWith(".") && f !== "README.md" && files.push(p); } };
walk(root);
let n = 0;
for (const p of files) {
  const key = "library/" + relative(root, p).split("\\").join("/");
  execFileSync("npx", ["wrangler", "r2", "object", "put", `kayaksa-brand/${key}`, "--file", p, "--remote", "--content-type", MIME[p.split(".").pop().toLowerCase()] || "application/octet-stream"], { stdio: "ignore" });
  if (++n % 20 === 0) console.log(`${n}/${files.length} uploaded`);
}
console.log(`Brand library uploaded: ${n} files`);
