// toolbar.kayaksa.com: hosts the KSA Toolbar Office add-in (Word, Excel, PowerPoint, Outlook, Teams)
// and its Assistant proxy. The add-in files are public by design (Office fetches them without
// cookies); nothing confidential is in them. The proxy holds the Anthropic key, answers only the
// add-in's own origin, and requires the shared access token.
import proxy from "./proxy/index.js";

const SEC = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
const TYPES = { ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".woff2": "font/woff2", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template", ".potx": "application/vnd.openxmlformats-officedocument.presentationml.template" };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return Response.json({ ok: true, site: "toolbar", assistant: !!env.ANTHROPIC_API_KEY, token: !!env.ASSISTANT_TOKEN });
    if (url.pathname.startsWith("/api/assistant")) {
      const inner = new URL(request.url); inner.pathname = url.pathname.replace(/^\/api\/assistant/, "") || "/";
      const res = await proxy.fetch(new Request(inner, request), env, ctx);
      const r = new Response(res.body, res); Object.entries(SEC).forEach(([k, v]) => r.headers.set(k, v)); return r;
    }
    if (url.pathname === "/") return Response.redirect(`${url.origin}/src/preview.html`, 302);
    if (/(^|\/)\.|\/server\/|\/tools\//.test(url.pathname)) return new Response("Not found", { status: 404 });
    const res = await env.ASSETS.fetch(request);
    if (res.status === 404) return new Response("Not found", { status: 404, headers: SEC });
    const r = new Response(res.body, res);
    Object.entries(SEC).forEach(([k, v]) => r.headers.set(k, v));
    const ext = (url.pathname.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();
    if (TYPES[ext]) r.headers.set("Content-Type", TYPES[ext]);
    r.headers.set("Cache-Control", /\.(html|js|css|xml)$/.test(url.pathname) || url.pathname.endsWith("library.json") ? "public, max-age=300" : "public, max-age=86400");
    return r;
  },
};
