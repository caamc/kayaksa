// Records: imports in batches (parsed and normalised in the analyst's browser, stored here per case),
// paging for analysis, SQL search with the shared filter, search across all of a user's cases,
// the tower master, the audit views, the export bundle and secure deletion.
import { Hono } from "hono";
import { readJson, str, HttpError, rateLimit } from "../../../packages/core/src/http";
import { audit, verifyChain } from "./audit";
import { caseFor, dataDb, needApproved, tzOffsetMinutes } from "./access";
import { can, now, uid, type V } from "./env";
import { CALL_TYPES, cleanFilter, describeFilter, filterToSql } from "../../../packages/graphiq-engine/src/index";

export const data = new Hono<V>();
const COLS = "id, a, b, ts, dur, type, imei, imsi, cell, last_cell, lac, lat, lon, roam, op, src, src_row";
const rowOut = (r: any) => [r.id, r.a, r.b, r.ts, r.dur, r.type, r.imei, r.imsi, r.cell, r.last_cell, r.lac, r.lat, r.lon, r.roam, r.op, r.src, r.src_row];
export const ROW_FIELDS = ["id", "a", "b", "ts", "dur", "type", "imei", "imsi", "cell", "lastCell", "lac", "lat", "lon", "roam", "op", "src", "row"];

// ------------------------------------------------------------------ imports

data.post("/cases/:id/imports", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "importData");
  needApproved(k);
  const b = await readJson<any>(c, 64 * 1024);
  const id = uid();
  const fileName = str(b.fileName, 200) || "upload";
  await c.env.DB.prepare("INSERT INTO imports (id, case_id, file_name, format, layout, sha256, size, evidence_id, mapping, validation, status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, k.id, fileName, str(b.format, 20), str(b.layout, 120), /^[0-9a-f]{64}$/.test(b.sha256) ? b.sha256 : null, Number(b.size) || 0, str(b.evidenceId, 64) || null, JSON.stringify(b.mapping || {}).slice(0, 8000), JSON.stringify(b.validation || {}).slice(0, 20000), "open", c.get("user").id, now()).run();
  await audit(c, "import.started", k.id, { import: id, file: fileName, sha256: b.sha256, layout: str(b.layout, 120), evidence: b.evidenceId || null });
  return c.json({ id });
});

const t = (v: unknown, n: number) => (v == null || v === "" ? null : String(v).slice(0, n));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Up to 2,000 normalised records per request, stored with one statement (json_each). */
data.post("/cases/:id/imports/:iid/rows", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "importData");
  needApproved(k);
  const imp = await c.env.DB.prepare("SELECT * FROM imports WHERE id = ? AND case_id = ?").bind(c.req.param("iid"), k.id).first<any>();
  if (!imp || imp.status !== "open") throw new HttpError(409, "This import is not open.");
  const b = await readJson<{ rows: any[] }>(c, 1_800_000);
  if (!Array.isArray(b.rows) || b.rows.length > 2000) throw new HttpError(400, "Send between 1 and 2,000 records at a time.");
  const clean: unknown[][] = [];
  for (const r of b.rows) {
    if (!r || typeof r.a !== "string" || !Number.isFinite(r.ts) || !CALL_TYPES.includes(r.type)) throw new HttpError(400, "A record is not in the expected format.");
    clean.push([t(r.a, 24), t(r.b, 24), Math.round(r.ts), Math.max(0, Math.round(Number(r.dur) || 0)), r.type, t(r.imei, 20), t(r.imsi, 20), t(r.cell, 40), t(r.lastCell, 40), t(r.lac, 12), num(r.lat), num(r.lon), t(r.roam, 60), t(r.op, 40), t(r.src, 200), Number.isInteger(r.row) ? r.row : null]);
  }
  const db = dataDb(c.env, k);
  const json = JSON.stringify(clean);
  const sel = clean.length ? Array.from({ length: 16 }, (_, i) => `json_extract(value, '$[${i}]')`).join(", ") : "";
  await db.prepare(`INSERT INTO records (case_id, import_id, a, b, ts, dur, type, imei, imsi, cell, last_cell, lac, lat, lon, roam, op, src, src_row) SELECT ?1, ?2, ${sel} FROM json_each(?3)`).bind(k.id, imp.id, json).run();
  await c.env.DB.prepare("UPDATE imports SET records = records + ? WHERE id = ?").bind(clean.length, imp.id).run();
  return c.json({ ok: true, stored: clean.length });
});

data.post("/cases/:id/imports/:iid/complete", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "importData");
  const imp = await c.env.DB.prepare("SELECT * FROM imports WHERE id = ? AND case_id = ?").bind(c.req.param("iid"), k.id).first<any>();
  if (!imp) throw new HttpError(404, "No such import.");
  const n = (await dataDb(c.env, k).prepare("SELECT COUNT(*) AS n FROM records WHERE import_id = ?").bind(imp.id).first<{ n: number }>())?.n || 0;
  const total = (await dataDb(c.env, k).prepare("SELECT COUNT(*) AS n FROM records WHERE case_id = ?").bind(k.id).first<{ n: number }>())?.n || 0;
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE imports SET status = 'complete', records = ?, completed_at = ? WHERE id = ?").bind(n, now(), imp.id),
    c.env.DB.prepare("UPDATE cases SET record_count = ? WHERE id = ?").bind(total, k.id),
  ]);
  await audit(c, "import.completed", k.id, { import: imp.id, file: imp.file_name, records: n, sha256: imp.sha256 });
  return c.json({ ok: true, records: n, caseRecords: total });
});

/** Removing an import deletes its records (the source file stays in evidence). Used to split or redo a load. */
data.delete("/cases/:id/imports/:iid", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "importData");
  const imp = await c.env.DB.prepare("SELECT * FROM imports WHERE id = ? AND case_id = ?").bind(c.req.param("iid"), k.id).first<any>();
  if (!imp) throw new HttpError(404, "No such import.");
  const db = dataDb(c.env, k);
  await db.prepare("DELETE FROM records WHERE import_id = ? AND case_id = ?").bind(imp.id, k.id).run();
  const total = (await db.prepare("SELECT COUNT(*) AS n FROM records WHERE case_id = ?").bind(k.id).first<{ n: number }>())?.n || 0;
  await c.env.DB.batch([c.env.DB.prepare("UPDATE imports SET status = 'removed' WHERE id = ?").bind(imp.id), c.env.DB.prepare("UPDATE cases SET record_count = ? WHERE id = ?").bind(total, k.id)]);
  await audit(c, "import.removed", k.id, { import: imp.id, file: imp.file_name, records: imp.records });
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ reading records

/** Pages of records for in-browser analysis (5,000 per page). */
data.get("/cases/:id/records", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const after = Math.max(0, Number(c.req.query("after")) || 0), limit = Math.min(5000, Math.max(1, Number(c.req.query("limit")) || 5000));
  const { results } = await dataDb(c.env, k).prepare(`SELECT ${COLS} FROM records WHERE case_id = ? AND id > ? ORDER BY id LIMIT ?`).bind(k.id, after, limit).all<any>();
  if (!after) await audit(c, "records.read", k.id, { purpose: str(c.req.query("purpose"), 40) || "analysis", total: k.record_count });
  return c.json({ fields: ROW_FIELDS, rows: results.map(rowOut), next: results.length === limit ? results[results.length - 1].id : null, total: k.record_count });
});

data.post("/cases/:id/search", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const b = await readJson<any>(c, 64 * 1024);
  const f = cleanFilter(b.filter, k.cc);
  const { where, params } = filterToSql(f, tzOffsetMinutes(k.tz));
  const limit = Math.min(1000, Math.max(1, Number(b.limit) || 200)), offset = Math.max(0, Number(b.offset) || 0);
  const db = dataDb(c.env, k);
  const [rows, count] = await Promise.all([
    db.prepare(`SELECT ${COLS} FROM records WHERE case_id = ? AND ${where} ORDER BY ts LIMIT ? OFFSET ?`).bind(k.id, ...params, limit, offset).all<any>(),
    db.prepare(`SELECT COUNT(*) AS n FROM records WHERE case_id = ? AND ${where}`).bind(k.id, ...params).first<{ n: number }>(),
  ]);
  await audit(c, "search", k.id, { filter: f, described: describeFilter(f, k.tz), matches: count?.n || 0, source: str(b.source, 20) || "form" });
  return c.json({ fields: ROW_FIELDS, rows: rows.results.map(rowOut), total: count?.n || 0, filter: f, described: describeFilter(f, k.tz) });
});

/** Bulk multi-number search across every case the user is assigned to (common numbers across cases). */
data.post("/search/global", async (c) => {
  const u = c.get("user");
  if (!(await rateLimit(c.env.DB, `gsearch:${u.id}`, 30, 300))) throw new HttpError(429, "Too many searches. Wait a few minutes.");
  const b = await readJson<any>(c, 64 * 1024);
  const f = cleanFilter({ numbers: b.numbers });
  if (!f.numbers?.length) throw new HttpError(400, "Enter one or more numbers.");
  const { results: mine } = await c.env.DB.prepare("SELECT k.id, k.title, k.shard FROM cases k JOIN case_members m ON m.case_id = k.id AND m.user_id = ? WHERE k.status IN ('approved','closed')").bind(u.id).all<any>();
  const ph = f.numbers.map(() => "?").join(",");
  const hits: any[] = [];
  for (const k of mine.slice(0, 200)) {
    const { results } = await dataDb(c.env, k).prepare(`SELECT n, SUM(cnt) AS records, MIN(first) AS first, MAX(last) AS last FROM (
      SELECT a AS n, COUNT(*) AS cnt, MIN(ts) AS first, MAX(ts) AS last FROM records WHERE case_id = ? AND a IN (${ph}) GROUP BY a
      UNION ALL SELECT b AS n, COUNT(*) AS cnt, MIN(ts) AS first, MAX(ts) AS last FROM records WHERE case_id = ? AND b IN (${ph}) GROUP BY b) GROUP BY n`).bind(k.id, ...f.numbers, k.id, ...f.numbers).all<any>();
    for (const r of results) hits.push({ caseId: k.id, caseTitle: k.title, number: r.n, records: r.records, first: r.first, last: r.last });
  }
  const byNumber: Record<string, { cases: number; records: number }> = {};
  for (const h of hits) { const e = (byNumber[h.number] ||= { cases: 0, records: 0 }); e.cases++; e.records += h.records; }
  await audit(c, "search.global", null, { numbers: f.numbers.length, casesSearched: mine.length, hits: hits.length });
  return c.json({ hits, byNumber, casesSearched: mine.length });
});

// ------------------------------------------------------------------ client-side events (exports and views happen in the browser)

const CLIENT_EVENTS = new Set(["report.exported", "records.exported", "analytics.viewed", "chart.exported", "kml.exported", "case.exported", "graph.viewed", "map.viewed"]);
data.post("/cases/:id/events", async (c) => {
  const b = await readJson<any>(c, 8192);
  const action = str(b.action, 40);
  if (!CLIENT_EVENTS.has(action)) throw new HttpError(400, "Unknown event.");
  const k = await caseFor(c, c.req.param("id"), action.endsWith("exported") ? "export" : "analyse");
  await audit(c, action, k.id, typeof b.detail === "object" ? b.detail : null);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ audit

data.get("/cases/:id/audit", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const before = Number(c.req.query("before")) || Number.MAX_SAFE_INTEGER;
  const { results } = await c.env.DB.prepare("SELECT seq, at, user_email, action, detail, ip, hash FROM audit_chain WHERE case_id = ? AND seq < ? ORDER BY seq DESC LIMIT 200").bind(k.id, before).all();
  await audit(c, "audit.viewed", k.id);
  return c.json({ entries: results });
});

data.get("/audit", async (c) => {
  if (!can(c.get("user"), "manageUsers")) throw new HttpError(403, "Only Admins can read the whole audit log.");
  const before = Number(c.req.query("before")) || Number.MAX_SAFE_INTEGER;
  const { results } = await c.env.DB.prepare("SELECT seq, at, user_email, case_id, action, detail, ip, hash FROM audit_chain WHERE seq < ? ORDER BY seq DESC LIMIT 200").bind(before).all();
  return c.json({ entries: results });
});

/** Anyone signed in may check the chain; the answer reveals no entries. */
data.post("/audit/verify", async (c) => {
  if (!(await rateLimit(c.env.DB, `verify:${c.get("user").id}`, 10, 300))) throw new HttpError(429, "Verification was run several times just now. Wait a few minutes.");
  const r = await verifyChain(c.env);
  await audit(c, "audit.verified", str(c.req.query("case"), 64) || null, { ok: r.ok, entries: r.entries, brokenAt: r.brokenAt });
  return c.json(r);
});

// ------------------------------------------------------------------ tower master

data.get("/towers", async (c) => {
  const cells = String(c.req.query("cells") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 2000);
  const res = cells.length
    ? await c.env.DB.prepare(`SELECT cell, lat, lon, address, azimuth FROM towers WHERE cell IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(cells)).all()
    : await c.env.DB.prepare("SELECT cell, lat, lon, address, azimuth FROM towers LIMIT 50000").all();
  const total = (await c.env.DB.prepare("SELECT COUNT(*) AS n FROM towers").first<{ n: number }>())?.n || 0;
  return c.json({ towers: res.results, total });
});

data.post("/towers", async (c) => {
  if (!can(c.get("user"), "editTowers")) throw new HttpError(403, "Your role does not allow this.");
  const b = await readJson<any>(c, 1_800_000);
  if (!Array.isArray(b.rows) || b.rows.length > 5000) throw new HttpError(400, "Send up to 5,000 towers at a time.");
  const rows = b.rows.map((r: any) => [str(r.cell, 40).toUpperCase().replace(/\s+/g, ""), Number(r.lat), Number(r.lon), str(r.address, 200) || null, Number.isFinite(Number(r.azimuth)) && r.azimuth !== "" ? Number(r.azimuth) : null])
    .filter((r: any[]) => r[0] && Math.abs(r[1]) <= 90 && Math.abs(r[2]) <= 180 && (r[1] || r[2]));
  if (rows.length) await c.env.DB.prepare(`INSERT INTO towers (cell, lat, lon, address, azimuth, source, updated_by, updated_at)
    SELECT json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'), json_extract(value,'$[3]'), json_extract(value,'$[4]'), ?1, ?2, ?3 FROM json_each(?4) WHERE true
    ON CONFLICT(cell) DO UPDATE SET lat = excluded.lat, lon = excluded.lon, address = excluded.address, azimuth = excluded.azimuth, source = excluded.source, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(str(b.source, 120) || "import", c.get("user").id, now(), JSON.stringify(rows)).run();
  await audit(c, "towers.imported", null, { rows: rows.length, rejected: b.rows.length - rows.length, source: str(b.source, 120) });
  return c.json({ ok: true, stored: rows.length, rejected: b.rows.length - rows.length });
});

// ------------------------------------------------------------------ export bundle and secure deletion

data.get("/cases/:id/bundle", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "export");
  const db = dataDb(c.env, k);
  const [records, notes, bookmarks, watch, imports, evidence] = await Promise.all([
    db.prepare(`SELECT ${COLS} FROM records WHERE case_id = ? ORDER BY id LIMIT 500000`).bind(k.id).all<any>(),
    c.env.DB.prepare("SELECT kind, body, source, created_at FROM notes WHERE case_id = ?").bind(k.id).all(),
    c.env.DB.prepare("SELECT record_id, number, tag, note, created_at FROM bookmarks WHERE case_id = ?").bind(k.id).all(),
    c.env.DB.prepare("SELECT number, list, label FROM watchlist WHERE case_id = ?").bind(k.id).all(),
    c.env.DB.prepare("SELECT id, file_name, format, layout, sha256, size, records, created_at FROM imports WHERE case_id = ? AND status = 'complete'").bind(k.id).all(),
    c.env.DB.prepare("SELECT id, kind, file_name, size, sha256, created_at FROM evidence WHERE case_id = ? AND deleted_at IS NULL").bind(k.id).all(),
  ]);
  await audit(c, "case.bundle.read", k.id, { records: records.results.length, purpose: "encrypted export or backup" });
  return c.json({ format: "graphiq-case", version: 1, exportedAt: now(), case: { id: k.id, title: k.title, description: k.description, legalBasis: k.legal_basis, legalText: k.legal_text, refNo: k.ref_no, refDate: k.ref_date, authority: k.authority, supervisor: k.supervisor, tz: k.tz, cc: k.cc, retainUntil: k.retain_until },
    fields: ROW_FIELDS, records: records.results.map(rowOut), notes: notes.results, bookmarks: bookmarks.results, watchlist: watch.results, imports: imports.results, evidence: evidence.results });
});

/** Secure deletion: records, notes, evidence objects and rows go; the case row stays as a tombstone with the audit trail. */
data.post("/cases/:id/delete", async (c) => {
  const u = c.get("user");
  if (!can(u, "deleteCase")) throw new HttpError(403, "Only Admins can delete a case.");
  const k = await c.env.DB.prepare("SELECT * FROM cases WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!k || k.status === "deleted") throw new HttpError(404, "No such case.");
  const b = await readJson<any>(c, 4096);
  if (str(b.confirm, 200) !== k.title) throw new HttpError(400, "Type the case title exactly to confirm.");
  const reason = str(b.reason, 500);
  if (!reason) throw new HttpError(400, "Record why the case is being deleted (for example, retention period ended).");
  const { results: ev } = await c.env.DB.prepare("SELECT id, r2_key, sha256, file_name FROM evidence WHERE case_id = ?").bind(k.id).all<any>();
  for (let i = 0; i < ev.length; i += 500) await c.env.EVIDENCE.delete(ev.slice(i, i + 500).map((e) => e.r2_key));
  const db = dataDb(c.env, k);
  const recs = (await db.prepare("SELECT COUNT(*) AS n FROM records WHERE case_id = ?").bind(k.id).first<{ n: number }>())?.n || 0;
  // D1 deletes in chunks to stay inside statement limits on very large cases.
  for (let i = 0; i < 1000; i++) { const r = await db.prepare("DELETE FROM records WHERE id IN (SELECT id FROM records WHERE case_id = ? LIMIT 20000)").bind(k.id).run(); if (!r.meta.changes) break; }
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM notes WHERE case_id = ?").bind(k.id),
    c.env.DB.prepare("DELETE FROM bookmarks WHERE case_id = ?").bind(k.id),
    c.env.DB.prepare("DELETE FROM watchlist WHERE case_id = ?").bind(k.id),
    c.env.DB.prepare("DELETE FROM saved_filters WHERE case_id = ?").bind(k.id),
    c.env.DB.prepare("DELETE FROM imports WHERE case_id = ?").bind(k.id),
    c.env.DB.prepare("DELETE FROM evidence WHERE case_id = ?").bind(k.id),
    c.env.DB.prepare("DELETE FROM case_members WHERE case_id = ?").bind(k.id),
    c.env.DB.prepare("UPDATE cases SET status = 'deleted', description = NULL, legal_text = '[deleted]', settings = NULL, record_count = 0, deleted_by = ?, deleted_at = ? WHERE id = ?").bind(u.id, now(), k.id),
  ]);
  // Custody entries are kept (they hold no case data) so the deletion itself is on the record.
  for (const e of ev) await c.env.DB.prepare("INSERT INTO custody (evidence_id, case_id, at, user_id, user_email, action, detail) VALUES (?,?,?,?,?,?,?)").bind(e.id, k.id, now(), u.id, u.email, "securely deleted", JSON.stringify({ reason })).run();
  await audit(c, "case.deleted", k.id, { title: k.title, refNo: k.ref_no, reason, records: recs, evidence: ev.map((e) => ({ file: e.file_name, sha256: e.sha256 })) });
  return c.json({ ok: true, records: recs, evidence: ev.length });
});

/** Daily: flag cases past their retention date (deletion itself stays a deliberate Admin action). */
export async function retentionSweep(env: any) {
  const today = new Date().toISOString().slice(0, 10);
  const { results } = await env.DB.prepare("SELECT id, title, settings FROM cases WHERE status != 'deleted' AND retain_until IS NOT NULL AND retain_until < ?").bind(today).all();
  const { appendAudit } = await import("./audit");
  for (const k of results as any[]) {
    const s = k.settings ? JSON.parse(k.settings) : {};
    if (s.retentionDue) continue;
    s.retentionDue = today;
    await env.DB.prepare("UPDATE cases SET settings = ? WHERE id = ?").bind(JSON.stringify(s), k.id).run();
    await appendAudit(env, { caseId: k.id, action: "retention.due", detail: { title: k.title, since: today } });
  }
}
