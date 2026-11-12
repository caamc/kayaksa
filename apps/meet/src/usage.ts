// Cloudflare Realtime usage guard. Meet by Kayak stops using a paid Cloudflare Realtime service before
// it would go past Kayak's monthly limit, so the bill for these services stays within what is included.
// These are rules in code, checked on every request that would use the service; they are not a model
// that can be talked out of them. Changing a limit means changing this file, which needs a reviewed deploy.
//
//   bytes        950 GB a month across TURN relay and the Realtime SFU (MoQ is not used by Meet)
//   av_min       9,500 audio-and-video participant minutes (town halls on the SFU)
//   audio_min    9,500 audio-only participant minutes (town halls on the SFU)
//   rec_av_min   95 audio-and-video recording or streaming minutes on Cloudflare  (not used by Meet)
//   rec_audio_min 95 audio-only recording or streaming minutes on Cloudflare      (not used by Meet)
//   rtp_min      95 raw RTP export minutes                                         (not used by Meet)
//
// Meet's own recordings are made in the host's browser and stored in Kayak's R2 storage, so they don't
// use Cloudflare's recording or streaming minutes. Those three meters stay at zero; `allow` still blocks
// them if a future feature ever tries to use them.
//
// Each meter stops a little early (the reserve) because usage is measured every 20 seconds and a few
// seconds of a live call can be in flight when the limit is reached.
export const LIMITS = {
  bytes: { limit: 950e9, reserve: 3e9, label: "Data (TURN relay + Realtime SFU)", unit: "GB", scale: 1e9 },
  av_min: { limit: 9_500, reserve: 60, label: "Audio + video participant minutes", unit: "min", scale: 1 },
  audio_min: { limit: 9_500, reserve: 60, label: "Audio-only participant minutes", unit: "min", scale: 1 },
  rec_av_min: { limit: 95, reserve: 2, label: "Audio + video recording / streaming minutes (Cloudflare)", unit: "min", scale: 1 },
  rec_audio_min: { limit: 95, reserve: 2, label: "Audio-only recording / streaming minutes (Cloudflare)", unit: "min", scale: 1 },
  rtp_min: { limit: 95, reserve: 2, label: "Raw RTP export minutes", unit: "min", scale: 1 },
} as const;
export type Metric = keyof typeof LIMITS;
interface UEnv { DB: D1Database; USAGE_CYCLE_DAY?: string }

/** The start of the current billing period (UTC). USAGE_CYCLE_DAY is the day of the month Cloudflare bills on. */
export function period(env: UEnv, at = new Date()): string {
  const day = Math.min(28, Math.max(1, Number(env.USAGE_CYCLE_DAY) || 1));
  let y = at.getUTCFullYear(), m = at.getUTCMonth();
  if (at.getUTCDate() < day) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export async function read(env: UEnv): Promise<Record<Metric, number>> {
  const { results } = await env.DB.prepare("SELECT metric, amount FROM usage WHERE period = ?").bind(period(env)).all<any>();
  const out = Object.fromEntries(Object.keys(LIMITS).map((k) => [k, 0])) as Record<Metric, number>;
  for (const r of results) if (r.metric in out) out[r.metric as Metric] = Number(r.amount) || 0;
  return out;
}
export async function add(env: UEnv, amounts: Partial<Record<Metric, number>>) {
  const p = period(env), stmts: D1PreparedStatement[] = [];
  for (const [k, v] of Object.entries(amounts)) if (k in LIMITS && v && v > 0 && Number.isFinite(v))
    stmts.push(env.DB.prepare("INSERT INTO usage (period, metric, amount) VALUES (?,?,?) ON CONFLICT(period, metric) DO UPDATE SET amount = amount + excluded.amount").bind(p, k, v));
  if (stmts.length) await env.DB.batch(stmts);
  await alerts(env).catch(() => {});
}
/** True while the meter (plus what is about to be used) stays under its limit, less the reserve. */
export async function allow(env: UEnv, metric: Metric, needed = 0, cached?: Record<Metric, number>) {
  const u = cached || (await read(env));
  const L = LIMITS[metric];
  return u[metric] + needed < L.limit - L.reserve;
}
/** Which Realtime services may be used right now. */
export async function gate(env: UEnv) {
  const u = await read(env);
  const ok = (m: Metric) => u[m] < LIMITS[m].limit - LIMITS[m].reserve;
  return { usage: u, turn: ok("bytes"), sfu: ok("bytes") && ok("av_min") && ok("audio_min"), sfuVideo: ok("bytes") && ok("av_min"), recording: ok("rec_av_min") && ok("rec_audio_min"), rtp: ok("rtp_min") };
}
// A record in Kayak's audit log the first time a meter passes 80%, 90% and 100% in a period.
async function alerts(env: UEnv) {
  const u = await read(env), p = period(env);
  for (const [k, L] of Object.entries(LIMITS)) {
    const pct = (u[k as Metric] / L.limit) * 100;
    for (const level of [80, 90, 100]) if (pct >= level) {
      const r = await env.DB.prepare("INSERT OR IGNORE INTO usage_alerts (period, metric, level, at) VALUES (?,?,?,?)").bind(p, k, level, new Date().toISOString()).run();
      if (r.meta.changes) await env.DB.prepare("INSERT INTO audit_log (at, user_id, action, detail) VALUES (?,?,?,?)").bind(new Date().toISOString(), null, "meet.usage.threshold", JSON.stringify({ period: p, metric: k, level, used: u[k as Metric], limit: L.limit })).run();
    }
  }
}
export function view(u: Record<Metric, number>, env: UEnv) {
  return { period: period(env), meters: Object.entries(LIMITS).map(([k, L]) => ({ id: k, label: L.label, unit: L.unit, used: +(u[k as Metric] / L.scale).toFixed(k === "bytes" ? 2 : 0), limit: L.limit / L.scale, stopsAt: (L.limit - L.reserve) / L.scale, pct: Math.min(100, +((u[k as Metric] / L.limit) * 100).toFixed(1)), notUsed: k.startsWith("rec_") || k === "rtp_min" })) };
}
