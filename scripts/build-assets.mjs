// Copies the shared brand files and browser libraries into each site's public folder, and
// builds the brand-library manifest from brand-assets/. Run before `wrangler dev` or deploy.
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const brand = join(root, "packages/brand");

for (const app of ["internal", "learn", "www"]) {
  const shared = join(root, "apps", app, "public/_shared");
  rmSync(shared, { recursive: true, force: true });
  mkdirSync(shared, { recursive: true });
  cpSync(join(brand, "css"), join(shared, "css"), { recursive: true });
  cpSync(join(brand, "fonts"), join(shared, "fonts"), { recursive: true });
  cpSync(join(brand, "logos"), join(shared, "logos"), { recursive: true });
  cpSync(join(brand, "js"), join(shared, "js"), { recursive: true });
  cpSync(join(brand, "icons.svg"), join(shared, "icons.svg"));
}

// Browser libraries, served from our own origin (no third-party CDNs).
const vendor = {
  "pptxgen.bundle.js": "node_modules/pptxgenjs/dist/pptxgen.bundle.js",
  "jspdf.umd.min.js": "node_modules/jspdf/dist/jspdf.umd.min.js",
  "svg2pdf.umd.min.js": "node_modules/svg2pdf.js/dist/svg2pdf.umd.min.js",
  "qrcode.js": "node_modules/qrcode-generator/dist/qrcode.js",
  "marked.umd.js": "node_modules/marked/lib/marked.umd.js",
  "purify.min.js": "node_modules/dompurify/dist/purify.min.js",
};
for (const app of ["internal", "learn"]) {
  const dir = join(root, "apps", app, "public/vendor");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [name, src] of Object.entries(vendor)) {
    const from = join(root, src);
    if (!existsSync(from)) {
      const alt = join(root, src.replace("/dist/qrcode.js", "/qrcode.js"));
      if (existsSync(alt)) { cpSync(alt, join(dir, name)); continue; }
      throw new Error(`Missing ${src}; run npm install`);
    }
    cpSync(from, join(dir, name));
  }
  // Static TTFs for vector PDF export (business cards).
  if (app === "internal") cpSync(join(brand, "fonts-ttf"), join(dir, "fonts-ttf"), { recursive: true });
}

// Brand library manifest
const lib = join(root, "brand-assets");
const MIME = { ".pdf": "application/pdf", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".zip": "application/zip", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template", ".potx": "application/vnd.openxmlformats-officedocument.presentationml.template",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".thmx": "application/vnd.ms-officetheme", ".mp4": "video/mp4", ".ttf": "font/ttf",
  ".otf": "font/otf", ".woff2": "font/woff2", ".css": "text/css", ".json": "application/json", ".csv": "text/csv", ".txt": "text/plain", ".md": "text/plain" };
const items = [];
const walk = (d) => {
  if (!existsSync(d)) return;
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (!f.startsWith(".") && f !== "README.md" && MIME[extname(f).toLowerCase()]) {
      const rel = relative(lib, p).split("/");
      const category = rel[0].replace(/^\d+[_ -]*/, "").replace(/_/g, " ");
      const title = basename(f, extname(f)).replace(/^KSA_/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
      items.push({ id: "lib:" + rel.join("/"), title, category, description: rel.length > 2 ? rel.slice(1, -1).join(" › ").replace(/_/g, " ") : "", file_key: "library/" + rel.join("/"), file_name: f, mime: MIME[extname(f).toLowerCase()], size: s.size });
    }
  }
};
walk(lib);
mkdirSync(join(root, "apps/internal/src/generated"), { recursive: true });
writeFileSync(join(root, "apps/internal/src/generated/brand-manifest.json"), JSON.stringify(items, null, 1));
console.log(`Shared files copied; brand library: ${items.length} files`);
