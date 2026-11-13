// Kayak AI assist (Workers AI). Two uses only, both labelled "AI-assisted, verify before use":
//  1. A plain-English question becomes a search filter. The model may only return a filter; it is
//     validated by the engine, shown to the analyst, and run as an ordinary audited search. When AI
//     is unavailable the rule-based parser in the engine answers instead.
//  2. A draft case summary written from statistics the engine computed (never from raw records,
//     and the model is told not to add facts). When AI is unavailable a template draft is returned.
import { Hono } from "hono";
import { readJson, str, HttpError, rateLimit } from "../../../packages/core/src/http";
import { audit } from "./audit";
import { caseFor, dataDb } from "./access";
import type { V } from "./env";
import { analyseAll, cleanFilter, describeFilter, displayMsisdn, fmtDuration, localDate, parseQuestion, type CdrRecord } from "../../../packages/graphiq-engine/src/index";

export const ai = new Hono<V>();
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const AI_LABEL = "AI-assisted, verify before use";

ai.post("/cases/:id/ai/query", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  if (!(await rateLimit(c.env.DB, `aiq:${c.get("user").id}`, 40, 600))) throw new HttpError(429, "Too many questions. Wait a few minutes.");
  const b = await readJson<any>(c, 4096);
  const q = str(b.q, 500);
  if (!q) throw new HttpError(400, "Ask a question first.");
  const rules = parseQuestion(q, { tz: k.tz, cc: k.cc, year: new Date().getUTCFullYear() });
  let filter = rules.filter, source = "rules", note = "";
  if (c.env.AI && b.useAi !== false) {
    const sys = `You turn an analyst's question about call detail records into a JSON search filter. Reply with JSON only, no prose.
Allowed keys: numbers (array of phone numbers as written), side ("a"|"b"|"any"), from and to (ISO 8601 dates, time zone ${k.tz}), timeFrom and timeTo ("HH:MM", 24-hour, local time), durMin and durMax (seconds), types (array of "MO","MT","SMS-MO","SMS-MT","MISSED","DATA"), imei, imsi, cell (strings), weekdays (array of 0-6, Sunday = 0).
MO = outgoing call, MT = incoming call. Omit keys the question does not mention. Never invent numbers or dates. Today is ${new Date().toISOString().slice(0, 10)}.`;
    const r: any = await c.env.AI.run(MODEL as any, { messages: [{ role: "system", content: sys }, { role: "user", content: q }], max_tokens: 300, temperature: 0 } as any).catch(() => null);
    const text = String(r?.response ?? "").trim();
    const m = /\{[\s\S]*\}/.exec(text);
    if (m) {
      try {
        const f = cleanFilter(JSON.parse(m[0]), k.cc);
        // Keep only numbers the analyst actually typed (the model must not add any).
        if (f.numbers) f.numbers = f.numbers.filter((n) => q.replace(/\D/g, "").includes(n.replace(/\D/g, "").slice(-10)));
        if (!f.numbers?.length) delete f.numbers;
        if (Object.keys(f).length) { filter = f; source = "ai"; }
      } catch { note = "Kayak AI's answer could not be read; the built-in rules were used."; }
    } else if (r) note = "Kayak AI did not return a filter; the built-in rules were used.";
  } else if (!c.env.AI) note = "Kayak AI is not available here; the built-in rules were used.";
  await audit(c, "ai.query", k.id, { q, source, filter });
  return c.json({ filter, described: describeFilter(filter, k.tz), source, label: source === "ai" ? AI_LABEL : "Rule-based reading of your question - check before use", note, understood: rules.understood });
});

ai.post("/cases/:id/ai/summary", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  if (!(await rateLimit(c.env.DB, `ais:${c.get("user").id}`, 10, 600))) throw new HttpError(429, "Too many drafts. Wait a few minutes.");
  // The engine computes the statistics here, in the Worker (up to 50,000 records).
  const { results } = await dataDb(c.env, k).prepare("SELECT a, b, ts, dur, type, imei, imsi, cell, last_cell AS lastCell, roam FROM records WHERE case_id = ? ORDER BY ts LIMIT 50000").bind(k.id).all<any>();
  if (!results.length) throw new HttpError(400, "Import records before drafting a summary.");
  const recs = results as CdrRecord[];
  const an = analyseAll(recs, { tz: k.tz, limit: 10 });
  const t = (ms: number | null) => (ms ? localDate(ms, k.tz) : "");
  const stats = {
    records: an.overview.records, period: `${t(an.overview.from)} to ${t(an.overview.to)}`, byType: an.overview.byType, truncated: k.record_count > recs.length,
    targets: an.summary.slice(0, 6).map((s) => ({ number: displayMsisdn(s.number), records: s.records, callsOut: s.callsOut, callsIn: s.callsIn, sms: s.smsIn + s.smsOut, talkTime: fmtDuration(s.durTotal), uniqueContacts: s.uniqueContacts, top: s.mostContacted.slice(0, 3).map((x) => `${displayMsisdn(x.b)} (${x.n})`) })),
    nightShare: an.overview.records ? Math.round((an.time.night / an.overview.records) * 100) + "%" : "0%",
    peakHours: an.time.peakHours.map((p) => `${p.h}:00 (${p.n})`),
    commonNumbers: an.common.slice(0, 5).map((x) => `${displayMsisdn(x.b)} with ${x.targets.length} targets`),
    targetToTarget: an.targetToTarget.slice(0, 5).map((x) => `${displayMsisdn(x.a)} and ${displayMsisdn(x.b)}: ${x.total}`),
    handsetChanges: an.imei.timeline.filter((x) => x.changes).map((x) => `${displayMsisdn(x.msisdn)}: ${x.changes}`),
    sharedHandsets: an.imei.oneImeiManySims.length,
    possibleMeetings: an.coLocation.slice(0, 5).map((x) => `${displayMsisdn(x.a1)} and ${displayMsisdn(x.a2)} at cell ${x.cell} on ${t(x.t1)}`),
    unusualDays: an.anomalies.days.slice(0, 5).map((d) => `${displayMsisdn(d.a)} on ${d.day}: ${d.n} records (usual ${d.mean})`),
    silentPeriods: an.silent.slice(0, 3).map((s) => `${displayMsisdn(s.a)}: ${s.hours} hours from ${t(s.from)}`),
    international: an.roaming.isd.map((x) => `${x.country}: ${x.n}`),
  };
  let draft = "", source = "template";
  if (c.env.AI) {
    const r: any = await c.env.AI.run(MODEL as any, {
      messages: [
        { role: "system", content: "You draft a short, neutral case summary for an investigator from computed CDR statistics. Use only the facts in the JSON; do not add, infer or guess anything else (no motives, identities or conclusions). Write plain English in short paragraphs with headings: Scope, Activity, Relationships, Devices and locations, Points to verify. Say that every point needs checking against the original records." },
        { role: "user", content: JSON.stringify(stats) },
      ], max_tokens: 900, temperature: 0.2,
    } as any).catch(() => null);
    draft = String(r?.response || "").trim();
    if (draft) source = "ai";
  }
  if (!draft) {
    draft = [`Scope: ${stats.records} records from ${stats.period}${stats.truncated ? " (first 50,000 records)" : ""}.`,
      `Activity: ${stats.targets.map((x) => `${x.number} has ${x.records} records (${x.callsOut} calls out, ${x.callsIn} in, ${x.sms} SMS, talk time ${x.talkTime}, ${x.uniqueContacts} contacts; most contacted ${x.top.join(", ")})`).join(". ")}. Night share ${stats.nightShare}; peak hours ${stats.peakHours.join(", ")}.`,
      `Relationships: ${stats.targetToTarget.length ? `direct contact between targets: ${stats.targetToTarget.join("; ")}` : "no direct contact between targets"}. ${stats.commonNumbers.length ? `Numbers common to several targets: ${stats.commonNumbers.join("; ")}.` : ""}`,
      `Devices and locations: ${stats.handsetChanges.length ? `handset changes ${stats.handsetChanges.join("; ")}` : "no handset changes"}; ${stats.sharedHandsets} handset(s) used with more than one SIM. ${stats.possibleMeetings.length ? `Possible meeting points (same cell within the window): ${stats.possibleMeetings.join("; ")}.` : ""}`,
      `Points to verify: ${[...stats.unusualDays, ...stats.silentPeriods].join("; ") || "none flagged"}. Every point above needs checking against the original operator records.`].join("\n\n");
  }
  await audit(c, "ai.summary", k.id, { source, records: recs.length });
  return c.json({ draft, source, label: source === "ai" ? AI_LABEL : "Template draft from computed statistics - verify before use", stats });
});
