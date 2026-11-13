// graphiq.kayaksa.com - Kayak GraphIQ, call detail record analysis for lawfully obtained data.
// Designed and developed by Kayak Strategic Advisors. The Worker handles sign-in, cases (legal gate
// and four-eyes approval), storage, evidence encryption and the tamper-evident audit log; parsing
// and analysis run in the analyst's browser with the same engine (packages/graphiq-engine).
import { Hono } from "hono";
import { securityHeaders, sameOrigin, HttpError } from "../../../packages/core/src/http";
import { shield } from "../../../packages/core/src/shield";
import { auth, currentUser, needUser } from "./auth";
import { cases } from "./cases";
import { data, retentionSweep } from "./data";
import { evidence } from "./evidence";
import { ai } from "./ai";
import type { Env, V } from "./env";

const app = new Hono<V>();

app.get("/healthz", (c) => c.json({ ok: true, site: "graphiq" }));
app.get("/robots.txt", (c) => c.text("User-agent: *\nDisallow: /\n"));
// OpenStreetMap tiles for the map view (attribution shown on the map); 'wasm-unsafe-eval' lets
// pdf.js compile its WebAssembly image decoders (it does not allow eval of JavaScript).
app.use("*", securityHeaders({ noindex: true, script: ["'wasm-unsafe-eval'"], img: ["https://tile.openstreetmap.org"], connect: ["https://tile.openstreetmap.org"] }));
// Analysts page through large cases quickly, so allow more requests per minute than the brochure sites.
app.use("*", shield("graphiq", (e: Env) => e.DB, { allowGoodBots: false, burstLimit: 900 }));
app.use("/api/*", sameOrigin());
app.onError((e: any, c) => {
  const status = e instanceof HttpError ? e.status : e?.status || 500;
  if (status >= 500) console.error("graphiq error", e?.stack || e);
  return c.json({ error: status >= 500 && !(e instanceof HttpError) ? "Something went wrong on our side. Try again; if it keeps happening, tell an administrator." : e.message }, status);
});

app.route("/", auth);
app.use("/api/*", needUser);
app.route("/api", cases);
app.route("/api", data);
app.route("/api", evidence);
app.route("/api", ai);
app.all("/api/*", (c) => c.json({ error: "Not found." }, 404));

const page = (c: any, path: string) => c.env.ASSETS.fetch(new Request(new URL(path, c.req.url)));
const noStore = async (res: Response) => { const r = new Response(res.body, res); r.headers.set("Cache-Control", "no-store"); return r; };
app.get("/", async (c) => c.redirect((await currentUser(c)) ? "/app" : "/login", 302));
app.get("/login", async (c) => noStore(await page(c, "/login.html")));
app.get("/app", async (c) => ((await currentUser(c)) ? noStore(await page(c, "/app.html")) : c.redirect("/login?next=/app", 302)));
app.get("/login.html", (c) => c.redirect("/login", 302));
app.get("/app.html", (c) => c.redirect("/app", 302));

app.all("*", async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status === 404) return c.text("Not found", 404);
  return res;
});

export default {
  fetch: app.fetch,
  async scheduled(_e: ScheduledEvent, env: Env) {
    await retentionSweep(env).catch((err) => console.error("retention", err?.message));
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(new Date().toISOString()).run().catch(() => {});
  },
};
