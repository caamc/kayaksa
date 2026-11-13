# Kayak on Cloudflare - capacity and the retail launch

Short answer: Cloudflare won't crash under retail load. Each request runs in whichever of Cloudflare's
300+ data centres is closest to the person, and capacity grows by itself. What *will* stop Kayak at
scale is the **account plan's limits**, which work like a daily quota. They are set by the plan, not
by the code.

## What would actually stop working today

Kayak's Cloudflare account is on the **free Workers plan**. On 13 November 2026 a deploy failed because
the account had reached the free plan's limit on scheduled jobs. The free plan's limits are:

| Limit (free plan) | What happens when it's reached | Rough capacity for Meet |
|---|---|---|
| 100,000 Worker requests a day, across all Kayak sites | Every site answers with an error until midnight UTC | About 100-200 person-hours of Meet use a day, for everyone combined |
| 100,000 database row writes a day | Saving messages, tasks and sign-ins fails | Thousands of messages a day; fine for now |
| 10 ms CPU per request | Heavy requests are cut off | Fine for Kayak's code today |
| A handful of scheduled jobs per account | Deploys that add one fail | Already reached |

Meet checks for new messages while it's open. Since 13 November 2026 that's every 4 seconds while someone is
using it, slowing to 8-15 seconds when they're idle or Meet is in the background. That is the main
request cost.

## What to do before a retail launch

1. **Move the account to Workers Paid** (Cloudflare dashboard → Workers & Pages → Plans). It costs
   US$5 a month and includes 10 million requests (then US$0.30 per million), 30 million CPU-ms,
   25 billion database reads and 50 million database writes a month. It also removes the daily caps.
   As a guide, 1,000 people using Meet for 8 hours on 22 working days come to about 120-160 million
   requests a month, or roughly US$35-50 on top of the base fee. Video and audio are billed separately,
   under the Realtime limits Meet already enforces (950 GB and 9,500 minutes a month).
2. **Turn on billing alerts** (Cloudflare dashboard → Billing → Notifications) at amounts you choose.
3. **Keep the Realtime guardrails on**. They're in `apps/meet/src/usage.ts` and stop each service just
   before its included allowance.

## Built so far to keep load and cost proportional to use

- Adaptive live updates in Meet (4 s active, 8-15 s idle or in the background), with an immediate
  check when someone returns.
- "Last seen" is written at most once a minute per person instead of on every check.
- Meeting audio and video go directly between browsers for meetings of up to 12 people; only town
  halls use Cloudflare's media servers.
- Kayak's shield blocks floods and scrapers before they reach the database.

## The next steps as Kayak grows

| When | Step | Why |
|---|---|---|
| Before launch | Workers Paid + billing alerts | Removes daily caps |
| More than ~2,000 daily Meet users | Replace polling with one live connection per person through a Durable Object that sleeps between messages | Cuts requests for live updates by around 90% |
| Any one database nearing 8 GB (each D1 database can hold 10 GB) | Move messages older than 12 months to encrypted archive files in R2, and/or split Meet's data into one database per organisation | Keeps every database well under its size limit |
| Load testing | Run `k6` or `autocannon` against a staging copy (never production) at 2× the expected peak | Confirms the numbers above before launch |

## "Everything is Kayak's"

Visitors never see Cloudflare: every site runs on Kayak's own domains (kayaksa.com, meet.kayaksa.com,
learn.kayaksa.com and others), with Kayak's branding, Kayak's own code, and the data in Kayak's
Cloudflare account. Cloudflare is the infrastructure underneath, as AWS or Azure would be.
Moving to Kayak-run servers would mean running data centres or cloud machines around the clock,
and would make outages more likely, not less.

Sources: Cloudflare Workers pricing (developers.cloudflare.com/workers/platform/pricing) and
limits (developers.cloudflare.com/workers/platform/limits), checked 13 November 2026.
