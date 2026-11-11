// internal.kayaksa.com — Kayak's staff portal. Everything except the sign-in pages requires a
// password plus TOTP two-factor session.
import { shield, pruneSecurity } from "../../../packages/core/src/shield";
import { Hono } from "hono";
import { securityHeaders, sameOrigin, HttpError } from "../../../packages/core/src/http";
import { learnApi } from "../../../packages/learnkit/src/routes";
import { Env, User } from "./env";
import { auth, loadUser } from "./auth";
import { me, admin } from "./admin";
import { brand, brandFiles } from "./brand";
import { tools, network } from "./directory";
import { ai } from "./assistant";
import { cards, decks } from "./studio";
import { website } from "./website";
import { security } from "./security";
import { learnSales } from "./learnsales";

type V = { Bindings: Env; Variables: { user: User } };
const app = new Hono<V>();

app.use("*", securityHeaders({ noindex: true }));
app.use("*", shield("internal", (e) => e.DB, { allowGoodBots: false }));
app.use("/api/*", sameOrigin());
app.onError((e: any, c) => {
  const status = e instanceof HttpError ? e.status : e?.status || 500;
  if (status >= 500) console.error("internal error", e?.stack || e);
  return c.json({ error: status >= 500 ? "Something went wrong on our side. Try again; if it keeps happening, tell an administrator." : e.message }, status);
});

app.get("/robots.txt", (c) => c.text("User-agent: *\nDisallow: /\n"));
app.get("/healthz", (c) => c.json({ ok: true, site: "internal" }));

app.route("/api/auth", auth);

// Everything below needs a full session.
const guard = async (c: any, next: any) => {
  const u = await loadUser(c);
  if (!u) {
    if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/files/")) return c.json({ error: "Your session has ended. Sign in again." }, 401);
    const back = c.req.path === "/" ? "" : `?next=${encodeURIComponent(c.req.path)}`;
    return c.redirect(`/login${back}`, 302);
  }
  c.set("user", u);
  await next();
  c.res = new Response(c.res.body, c.res);
  if (!c.req.path.startsWith("/files/")) c.res.headers.set("Cache-Control", "private, no-store");
};

app.use("/api/me/*", guard);
app.use("/api/me", guard);
app.use("/api/admin/*", guard);
app.use("/api/brand/*", guard);
app.use("/api/tools/*", guard);
app.use("/api/tools", guard);
app.use("/api/network/*", guard);
app.use("/api/network", guard);
app.use("/api/ai/*", guard);
app.use("/api/cards/*", guard);
app.use("/api/cards", guard);
app.use("/api/decks/*", guard);
app.use("/api/decks", guard);
app.use("/api/learn/*", guard);
app.use("/api/website/*", guard);
app.use("/api/security/*", guard);
app.use("/api/learnsales/*", guard);
app.use("/api/learnsales", guard);
app.use("/files/*", guard);
app.use("/app", guard);
app.use("/app/*", guard);

app.route("/api/me", me);
app.route("/api/admin", admin);
app.route("/api/brand", brand);
app.route("/files/brand", brandFiles);
app.route("/api/tools", tools);
app.route("/api/network", network);
app.route("/api/ai", ai);
app.route("/api/cards", cards);
app.route("/api/decks", decks);
app.route("/api/website", website);
app.route("/api/security", security);
app.route("/api/learnsales", learnSales);
app.route(
  "/api/learn",
  learnApi({
    internal: true,
    learner: async (c) => {
      const u = c.get("user") as User;
      return u ? { id: u.id, name: u.name || u.email } : null;
    },
    verifyBase: (c) => `${(c.env.LEARN_URL || "https://learn.kayaksa.com").replace(/\/$/, "")}/verify/`,
    // Mirror staff certificates into the learn database so learn.kayaksa.com/verify can confirm them.
    onIssued: async (c, l, cert) => {
      const ldb = (c.env as Env).LEARN_DB;
      if (!ldb) return;
      await ldb.prepare("INSERT OR IGNORE INTO certificates (id, user_id, kind, ref_id, holder, title, issued_at) VALUES (?,?,?,?,?,?,?)")
        .bind(cert.id, `staff:${l.id}`, cert.kind, cert.ref, l.name, cert.title, cert.issued_at).run()
        .catch((e: any) => console.error("certificate mirror failed", e?.message));
    },
  }),
);
app.all("/api/*", (c) => c.json({ error: "Not found." }, 404));

// Pages
const page = (c: any, path: string) => c.env.ASSETS.fetch(new Request(new URL(path, c.req.url)));
app.get("/", async (c) => ((await loadUser(c)) ? c.redirect("/app", 302) : c.redirect("/login", 302)));
app.get("/login", (c) => page(c, "/auth.html"));
app.get("/setup", (c) => page(c, "/auth.html"));
app.get("/welcome", (c) => page(c, "/auth.html"));
app.get("/app", (c) => page(c, "/app/index.html"));
app.get("/app/", (c) => page(c, "/app/index.html"));

// Static files. App code and the shared design system are public (they hold no data); /app/* is guarded above.
app.all("*", async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status === 404) return c.text("Not found", 404);
  return res;
});

export default {
  fetch: app.fetch,
  async scheduled(_e: ScheduledEvent, env: Env) {
    await pruneSecurity(env.DB);
    if (env.WWW_DB) await pruneSecurity(env.WWW_DB).catch(() => {});
  },
};
