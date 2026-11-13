# Running Kayak GraphIQ on an agency's own servers

Some agencies cannot send call records to a cloud service. This note says honestly what can run on their own servers today, what needs adaptation, and what is planned. It is a guide for a licensing discussion, not a packaged product.

## What GraphIQ is made of

| Part | Where it lives | Platform ties |
|---|---|---|
| Analysis engine: parsing (CSV, TXT, XLSX, JSON, XML, HTML, PDF text items), standardisation, analytics, graph metrics, filters, reports, KML, exhibit charts, encrypted case bundles | `packages/graphiq-engine` | **None.** Pure TypeScript using only standard JavaScript and Web Crypto. Runs in Node 20+, in a browser Web Worker, and in a Cloudflare Worker. |
| Browser app | `apps/graphiq/public` | Static files. Works from any web server. Libraries are vendored (Cytoscape.js, Leaflet, pdf.js, jsPDF, svg2pdf.js); no third-party CDN. |
| Server: sign-in, cases, legal gate and approval, records storage, evidence encryption, audit chain | `apps/graphiq/src` | Written for Cloudflare Workers with Hono, D1 (SQLite), R2 (object storage) and Workers AI. |
| Single sign-on | `apps/internal` `/sso/graphiq` | Kayak Internal. An agency would use its own identity provider. |

## Option A: today, with Cloudflare's open-source runtime (Built, needs set-up)

`workerd`, the open-source runtime behind Cloudflare Workers, and `wrangler dev` run the GraphIQ server unchanged on a Linux host, with D1 and R2 emulated locally on disk (SQLite files and a local object store). This is how GraphIQ is developed and tested (`tests/e2e/graphiq.mjs`).

1. Install Node 22 and the repository's dependencies (`npm ci`).
2. Build the browser files: `node scripts/build-graphiq.mjs`.
3. Create `apps/graphiq/wrangler.local.jsonc` from `wrangler.jsonc` without `routes` and `ai`, and `apps/graphiq/.dev.vars` with two random secrets: `GRAPHIQ_SIGNING_KEY` and `GRAPHIQ_DATA_KEY` (32 random bytes each, base64url). Keep `GRAPHIQ_DATA_KEY` backed up separately: without it the evidence files cannot be decrypted.
4. Apply the schema: `npx wrangler d1 migrations apply kayak-graphiq --local -c apps/graphiq/wrangler.local.jsonc`.
5. Run: `npx wrangler dev -c apps/graphiq/wrangler.local.jsonc --port 8705`, behind the agency's HTTPS reverse proxy.

Limits of this option, stated plainly: `wrangler dev` is a development server, not a supported production runtime; the local stores have no replication; sign-in tickets must come from an identity bridge that signs them with `GRAPHIQ_SIGNING_KEY` (the ticket format is in `packages/core/src/meettoken.ts`); and there is no Workers AI, so Kayak AI falls back to the rule-based question parser and the template summary (both are labelled).

## Option B: a packaged on-premise server (Planned)

The intended product is a small Node server that keeps the GraphIQ API and replaces the Cloudflare bindings with local equivalents. The adaptation is contained because the routes only use a narrow part of each binding:

| Cloudflare binding | Used for | On-premise replacement |
|---|---|---|
| D1 (`env.DB`) | `prepare().bind().first/all/run`, `batch` | SQLite (better-sqlite3) or PostgreSQL behind a thin adapter. SQL is standard SQLite, including `json_each` for batch inserts. |
| R2 (`env.EVIDENCE`) | `put`, `get`, `delete` of encrypted objects | Local file system or an S3-compatible store (MinIO). Objects are already AES-256-GCM encrypted before storage. |
| Workers AI (`env.AI`) | Optional question-to-filter and summary drafts | An on-premise model server, or off; both features already work without AI. |
| Static assets (`env.ASSETS`) | Serving `public/` | Any static file handler. |
| Cron trigger | Daily retention flagging | System scheduler calling the same function. |

Identity: an OpenID Connect or SAML adapter that issues the same one-time signed ticket, so the agency's own two-factor sign-in is used. Hardware security modules or the agency's key management can hold `GRAPHIQ_DATA_KEY`.

## Big cases and sharding (Partly)

Files are parsed in the analyst's browser, in a Web Worker, so large files do not block the page; records are stored in batches of 2,000 per request. Cloudflare D1 databases are limited to 10 GB each (roughly 20 to 30 million CDR rows at GraphIQ's row size). Each case has a `shard` setting naming the D1 binding that holds its records (`DB` by default); a very large case can be pointed at its own database (`DATA_1`, `DATA_2`, ... bindings in `wrangler.jsonc`). Creating those databases and setting the shard is a manual step today. Analysis in the browser is practical up to about 500,000 records per case; server-side aggregates for larger cases are planned. On-premise PostgreSQL removes the 10 GB limit.

## Security model (the same everywhere)

- Legal basis, reference, authority and supervisor are required to open a case; a different user with the Approver role must approve it before data can be imported.
- People see only cases they are assigned to; roles are Admin, Approver, Analyst and Viewer.
- Evidence: SHA-256 checked in the browser and the server, AES-256-GCM encryption with a per-case key derived by HKDF from `GRAPHIQ_DATA_KEY`, and a chain of custody.
- Every view, search, import and export is written to a SHA-256 hash chain that any user can verify.
- Retention dates and secure deletion keep a tombstone and the audit record.

## Licensing notes

GraphIQ's own code is Kayak Strategic Advisors' work. Third-party libraries and their licences are listed in `apps/graphiq/THIRD_PARTY_NOTICES.md`; all are permissive (MIT, BSD-2-Clause, Apache-2.0) and are used unmodified. OpenStreetMap's public tile servers have a usage policy that does not allow heavy or offline use: an on-premise installation should run its own tile server or use a licensed tile provider, and keep the OpenStreetMap attribution.
