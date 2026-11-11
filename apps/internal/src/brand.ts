// Kayak Brand Portal: the brand library (files kept in R2) plus uploads by editors.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { str } from "../../../packages/core/src/http";
import { Env, User, atLeast, uid } from "./env";
import manifest from "./generated/brand-manifest.json";

type V = { Bindings: Env; Variables: { user: User } };
export const brand = new Hono<V>();
export const brandFiles = new Hono<V>();

interface Item { id: string; title: string; category: string; description: string; file_key: string; file_name: string; mime: string; size: number; source: "library" | "upload"; created_at?: string }

brand.get("/assets", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, title, category, description, file_key, file_name, mime, size, created_at FROM assets ORDER BY created_at DESC").all<any>();
  const items: Item[] = [
    ...results.map((r: any) => ({ ...r, source: "upload" as const })),
    ...(manifest as any[]).map((m) => ({ ...m, source: "library" as const })),
  ];
  return c.json({ items });
});

const MAX = 95 * 1024 * 1024;
const SAFE_MIME = /^(image\/(png|jpeg|webp|gif|svg\+xml)|application\/(pdf|zip|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-[a-z.]+|postscript|json|x-zip-compressed)|video\/mp4|font\/(ttf|otf|woff2?)|text\/(plain|csv|css))$/;

brand.post("/upload", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "editor")) return c.json({ error: "Editors and administrators can add files." }, 403);
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "Choose a file to upload." }, 400);
  if (file.size > MAX) return c.json({ error: "Files can be up to 95 MB." }, 413);
  const mime = file.type || "application/octet-stream";
  if (!SAFE_MIME.test(mime)) return c.json({ error: `This file type (${mime}) is not accepted in the brand library.` }, 415);
  const title = str(form.get("title"), 140) || file.name;
  const category = str(form.get("category"), 80) || "Uploads";
  const id = uid();
  const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 140);
  const key = `uploads/${id}/${safeName}`;
  await c.env.BRAND.put(key, file.stream(), { httpMetadata: { contentType: mime } });
  await c.env.DB.prepare("INSERT INTO assets (id, title, category, description, file_key, file_name, mime, size, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, title, category, str(form.get("description"), 500), key, safeName, mime, file.size, u.id, new Date().toISOString())
    .run();
  await audit(c, c.env.DB, u.id, "brand.uploaded", { title, key });
  return c.json({ id });
});

brand.delete("/assets/:id", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "editor")) return c.json({ error: "Editors and administrators only." }, 403);
  const row = await c.env.DB.prepare("SELECT * FROM assets WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!row) return c.json({ error: "Only uploaded files can be removed here; library files are managed in the repository." }, 404);
  await c.env.BRAND.delete(row.file_key);
  await c.env.DB.prepare("DELETE FROM assets WHERE id = ?").bind(row.id).run();
  await audit(c, c.env.DB, u.id, "brand.deleted", { title: row.title, key: row.file_key });
  return c.json({ ok: true });
});

const MIME: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", pdf: "application/pdf", mp4: "video/mp4", ttf: "font/ttf", otf: "font/otf", woff2: "font/woff2", woff: "font/woff", zip: "application/zip", txt: "text/plain", ai: "application/postscript", eps: "application/postscript", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

// Streams a library file. Inline viewing is limited to images and PDFs; everything else downloads.
brandFiles.get("/*", async (c) => {
  const key = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/files\/brand\//, ""));
  if (!key || key.includes("..")) return c.text("Not found", 404);
  const known = (manifest as any[]).some((m) => m.file_key === key) || (await c.env.DB.prepare("SELECT 1 FROM assets WHERE file_key = ?").bind(key).first());
  if (!known) return c.text("Not found", 404);
  const range = c.req.header("Range");
  const obj = await c.env.BRAND.get(key, range ? { range: c.req.raw.headers } : undefined);
  if (!obj) return c.text("This file has not been uploaded to storage yet. Run the brand sync in GitHub Actions.", 404);
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("ETag", obj.httpEtag);
  h.set("Cache-Control", "private, max-age=3600");
  h.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  h.set("X-Content-Type-Options", "nosniff");
  const name = key.split("/").pop()!;
  // Older uploads carry no content type in R2, so fall back to the manifest, then the extension.
  let type = h.get("Content-Type") || "";
  if (!type || type === "application/octet-stream") {
    const m = (manifest as any[]).find((x) => x.file_key === key);
    type = m?.mime || MIME[(name.split(".").pop() || "").toLowerCase()] || "application/octet-stream";
    h.set("Content-Type", type);
  }
  const inline = c.req.query("view") === "1" && /^(image\/(png|jpeg|webp|gif|svg\+xml)|application\/pdf|video\/mp4)$/.test(type);
  h.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"`);
  if (range && "range" in obj && obj.range) {
    const r: any = obj.range;
    const start = r.offset ?? 0;
    const end = start + (r.length ?? obj.size - start) - 1;
    h.set("Content-Range", `bytes ${start}-${end}/${obj.size}`);
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set("Accept-Ranges", "bytes");
  return new Response(obj.body, { headers: h });
});
