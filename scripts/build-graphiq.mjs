// Builds Kayak GraphIQ's browser files: the shared Kayak design system, the analysis engine bundled
// for the browser (packages/graphiq-engine -> public/vendor/graphiq-engine.mjs) and the browser
// libraries, served from graphiq.kayaksa.com itself (no third-party CDNs). Run before `wrangler dev`
// or deploy. Output folders (public/_shared, public/vendor) are not committed.
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";

const root = new URL("..", import.meta.url).pathname;
const pub = join(root, "apps/graphiq/public");
const brand = join(root, "packages/brand");

const shared = join(pub, "_shared");
rmSync(shared, { recursive: true, force: true });
mkdirSync(shared, { recursive: true });
for (const d of ["css", "fonts", "logos", "js"]) cpSync(join(brand, d), join(shared, d), { recursive: true });
cpSync(join(brand, "icons.svg"), join(shared, "icons.svg"));

const vendor = join(pub, "vendor");
rmSync(vendor, { recursive: true, force: true });
mkdirSync(vendor, { recursive: true });
const nm = (p) => join(root, "node_modules", p);
const files = {
  "cytoscape.esm.min.mjs": "cytoscape/dist/cytoscape.esm.min.mjs",
  "leaflet.js": "leaflet/dist/leaflet.js",
  "leaflet.css": "leaflet/dist/leaflet.css",
  "pdf.min.mjs": "pdfjs-dist/build/pdf.min.mjs",
  "pdf.worker.min.mjs": "pdfjs-dist/build/pdf.worker.min.mjs",
  "jspdf.umd.min.js": "jspdf/dist/jspdf.umd.min.js",
  "svg2pdf.umd.min.js": "svg2pdf.js/dist/svg2pdf.umd.min.js",
};
for (const [name, src] of Object.entries(files)) {
  if (!existsSync(nm(src))) throw new Error(`Missing node_modules/${src}; run npm ci`);
  cpSync(nm(src), join(vendor, name));
}
cpSync(nm("leaflet/dist/images"), join(vendor, "images"), { recursive: true });
// Licences travel with the vendored files.
const lic = [["cytoscape", "cytoscape/LICENSE"], ["leaflet", "leaflet/LICENSE"], ["pdfjs-dist", "pdfjs-dist/LICENSE"], ["jspdf", "jspdf/LICENSE"], ["svg2pdf.js", "svg2pdf.js/LICENSE"]]
  .map(([n, p]) => (existsSync(nm(p)) ? `==== ${n} ====\n${readFileSync(nm(p), "utf8")}\n` : `==== ${n} ====\n(see THIRD_PARTY_NOTICES.md)\n`)).join("\n");
writeFileSync(join(vendor, "LICENSES.txt"), lic);

buildSync({
  entryPoints: [join(root, "packages/graphiq-engine/src/index.ts")],
  bundle: true, format: "esm", platform: "neutral", target: "es2022", minify: true, sourcemap: false,
  outfile: join(vendor, "graphiq-engine.mjs"), legalComments: "none", logLevel: "error",
  banner: { js: "/* Kayak GraphIQ analysis engine. (c) Kayak Strategic Advisors Private Limited. */" },
});
console.log("GraphIQ browser files built");
