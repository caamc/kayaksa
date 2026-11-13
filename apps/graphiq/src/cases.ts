// Cases: creation behind the legal gate, four-eyes approval, members, notes (including manually
// recorded OSINT results the analyst already lawfully holds), bookmarks and evidence tags,
// watchlists, saved filters, mapping templates, retention and secure deletion.
import { Hono } from "hono";
import { readJson, str, HttpError } from "../../../packages/core/src/http";
import { audit } from "./audit";
import { caseFor, isMember, type CaseRow } from "./access";
import { can, LEGAL_BASES, NOTICE_VERSION, now, ROLES, uid, type Role, type V } from "./env";
import { cleanFilter, normaliseMsisdn } from "../../../packages/graphiq-engine/src/index";

export const cases = new Hono<V>();
const deny = (msg = "Your role does not allow this.") => { throw new HttpError(403, msg); };

const pub = (k: CaseRow & Record<string, any>) => ({
  id: k.id, title: k.title, description: k.description, status: k.status, legalBasis: k.legal_basis, legalBasisLabel: (LEGAL_BASES as any)[k.legal_basis], legalText: k.legal_text,
  refNo: k.ref_no, refDate: k.ref_date, authority: k.authority, supervisor: k.supervisor, noticeVersion: k.notice_version, tz: k.tz, cc: k.cc, retainUntil: k.retain_until,
  shard: k.shard, settings: k.settings ? JSON.parse(k.settings) : {}, records: k.record_count, restoredFrom: k.restored_from, createdBy: k.created_by, createdByName: k.created_by_name,
  createdAt: k.created_at, decidedBy: k.decided_by, decidedByName: k.decided_by_name, decidedAt: k.decided_at, decisionNote: k.decision_note,
});

// ------------------------------------------------------------------ me and users

cases.get("/me", async (c) => {
  const u = c.get("user");
  const perms = Object.fromEntries((["createCase", "importData", "export", "annotate", "approve", "manageUsers", "deleteCase", "editTowers"] as const).map((p) => [p, can(u, p)]));
  const pending = can(u, "approve") ? ((await c.env.DB.prepare("SELECT COUNT(*) AS n FROM cases WHERE status = 'pending' AND created_by != ?").bind(u.id).first<{ n: number }>())?.n || 0) : 0;
  return c.json({ user: u, perms, pendingApprovals: pending, ai: !!c.env.AI, notice: NOTICE_VERSION, legalBases: LEGAL_BASES });
});

cases.get("/users", async (c) => {
  const u = c.get("user");
  if (!can(u, "createCase") && !can(u, "manageUsers")) deny();
  const { results } = await c.env.DB.prepare("SELECT id, email, name, role, status, created_at, last_seen FROM users ORDER BY name").all();
  return c.json({ users: results });
});

cases.patch("/users/:id", async (c) => {
  const u = c.get("user");
  if (!can(u, "manageUsers")) deny();
  const b = await readJson<any>(c, 2048);
  const target = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!target) throw new HttpError(404, "No such user.");
  const role = ROLES.includes(b.role) ? (b.role as Role) : target.role;
  const status = b.status === "disabled" || b.status === "active" ? b.status : target.status;
  if (target.id === u.id && (role !== "admin" || status !== "active")) throw new HttpError(400, "You cannot remove your own Admin role or disable yourself. Ask another Admin.");
  if (target.role === "admin" && (role !== "admin" || status !== "active")) {
    const admins = (await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").first<{ n: number }>())?.n || 0;
    if (admins <= 1) throw new HttpError(400, "GraphIQ needs at least one active Admin.");
  }
  await c.env.DB.prepare("UPDATE users SET role = ?, status = ? WHERE id = ?").bind(role, status, target.id).run();
  if (status === "disabled") await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(target.id).run();
  await audit(c, "user.updated", null, { user: target.email, from: { role: target.role, status: target.status }, to: { role, status } });
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ cases

cases.get("/cases", async (c) => {
  const u = c.get("user");
  const { results } = await c.env.DB.prepare(`SELECT k.*, cu.name AS created_by_name, (SELECT COUNT(*) FROM case_members m2 WHERE m2.case_id = k.id) AS members FROM cases k JOIN case_members m ON m.case_id = k.id AND m.user_id = ?
    LEFT JOIN users cu ON cu.id = k.created_by WHERE k.status != 'deleted' ORDER BY k.created_at DESC`).bind(u.id).all<any>();
  await audit(c, "cases.list", null, { count: results.length });
  return c.json({ cases: results.map((k) => ({ ...pub(k), members: k.members })) });
});

cases.post("/cases", async (c) => {
  const u = c.get("user");
  if (!can(u, "createCase")) deny("Only Admins and Analysts can open cases.");
  const b = await readJson<any>(c, 16 * 1024);
  const f = {
    title: str(b.title, 140), description: str(b.description, 2000), legalBasis: str(b.legalBasis, 40), legalText: str(b.legalText, 2000), refNo: str(b.refNo, 120),
    refDate: str(b.refDate, 10), authority: str(b.authority, 200), supervisor: str(b.supervisor, 120), tz: str(b.tz, 40) || "Asia/Kolkata", retainUntil: str(b.retainUntil, 10), restoredFrom: str(b.restoredFrom, 64),
  };
  const missing: string[] = [];
  if (!f.title) missing.push("a case title");
  if (!(f.legalBasis in LEGAL_BASES)) missing.push("the legal basis");
  if (f.legalText.length < 10) missing.push("a description of the legal basis (at least 10 characters)");
  if (!f.refNo) missing.push("the reference number");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.refDate) || Date.parse(f.refDate) > Date.now() + 86_400_000) missing.push("the reference date (not in the future)");
  if (!f.authority) missing.push("the issuing authority");
  if (!f.supervisor) missing.push("the approving supervisor");
  if (b.noticeAccepted !== true) missing.push("your acknowledgement of the lawful-use notice");
  if (b.lawfulConfirmed !== true) missing.push("your confirmation that the data was lawfully obtained");
  if (missing.length) throw new HttpError(400, `Add ${missing.join(", ")}.`);
  try { new Intl.DateTimeFormat("en", { timeZone: f.tz }); } catch { throw new HttpError(400, "Choose a valid time zone."); }
  if (f.retainUntil && !/^\d{4}-\d{2}-\d{2}$/.test(f.retainUntil)) throw new HttpError(400, "The retention date must be a date.");
  const id = uid();
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO cases (id, title, description, status, legal_basis, legal_text, ref_no, ref_date, authority, supervisor, notice_version, tz, retain_until, restored_from, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, f.title, f.description || null, "pending", f.legalBasis, f.legalText, f.refNo, f.refDate, f.authority, f.supervisor, NOTICE_VERSION, f.tz, f.retainUntil || null, f.restoredFrom || null, u.id, now()),
    c.env.DB.prepare("INSERT INTO case_members (case_id, user_id, added_by, added_at) VALUES (?,?,?,?)").bind(id, u.id, u.id, now()),
  ]);
  await audit(c, "case.created", id, { title: f.title, legalBasis: f.legalBasis, refNo: f.refNo, refDate: f.refDate, authority: f.authority, supervisor: f.supervisor, notice: NOTICE_VERSION, restoredFrom: f.restoredFrom || undefined });
  return c.json({ id, status: "pending" });
});

cases.get("/cases/:id", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const full = await c.env.DB.prepare("SELECT k.*, cu.name AS created_by_name, du.name AS decided_by_name FROM cases k LEFT JOIN users cu ON cu.id = k.created_by LEFT JOIN users du ON du.id = k.decided_by WHERE k.id = ?").bind(k.id).first<any>();
  const [members, imports, counts] = await Promise.all([
    c.env.DB.prepare("SELECT u.id, u.name, u.email, u.role, m.added_at FROM case_members m JOIN users u ON u.id = m.user_id WHERE m.case_id = ? ORDER BY u.name").bind(k.id).all(),
    c.env.DB.prepare("SELECT id, file_name, format, layout, sha256, size, evidence_id, validation, status, records, created_at, completed_at FROM imports WHERE case_id = ? AND status != 'removed' ORDER BY created_at").bind(k.id).all<any>(),
    c.env.DB.batch([
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM evidence WHERE case_id = ? AND deleted_at IS NULL").bind(k.id),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM notes WHERE case_id = ?").bind(k.id),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM bookmarks WHERE case_id = ?").bind(k.id),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM audit_chain WHERE case_id = ? AND action IN ('report.exported','records.exported')").bind(k.id),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM audit_chain WHERE case_id = ? AND action = 'analytics.viewed'").bind(k.id),
    ]),
  ]);
  const n = counts.map((r: any) => r.results?.[0]?.n || 0);
  await audit(c, "case.viewed", k.id);
  return c.json({ case: pub(full), members: members.results, imports: imports.results.map((i) => ({ ...i, validation: i.validation ? JSON.parse(i.validation) : null })), counts: { evidence: n[0], notes: n[1], bookmarks: n[2], exports: n[3], analyses: n[4] }, me: { canImport: can(c.get("user"), "importData"), canExport: can(c.get("user"), "export"), canAnnotate: can(c.get("user"), "annotate") } });
});

cases.patch("/cases/:id", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  const b = await readJson<any>(c, 8192);
  const title = b.title !== undefined ? str(b.title, 140) || k.title : k.title;
  const description = b.description !== undefined ? str(b.description, 2000) : k.description;
  let tz = k.tz;
  if (b.tz) { try { new Intl.DateTimeFormat("en", { timeZone: str(b.tz, 40) }); tz = str(b.tz, 40); } catch { throw new HttpError(400, "Choose a valid time zone."); } }
  const retain = b.retainUntil === null || b.retainUntil === "" ? null : b.retainUntil !== undefined ? (/^\d{4}-\d{2}-\d{2}$/.test(b.retainUntil) ? b.retainUntil : k.retain_until) : k.retain_until;
  const settings = b.settings && typeof b.settings === "object" ? JSON.stringify({ ...(k.settings ? JSON.parse(k.settings) : {}), ...b.settings }).slice(0, 8000) : k.settings;
  await c.env.DB.prepare("UPDATE cases SET title = ?, description = ?, tz = ?, retain_until = ?, settings = ? WHERE id = ?").bind(title, description, tz, retain, settings, k.id).run();
  await audit(c, "case.updated", k.id, { title: title !== k.title ? title : undefined, tz: tz !== k.tz ? tz : undefined, retainUntil: retain !== k.retain_until ? retain : undefined });
  return c.json({ ok: true });
});

cases.post("/cases/:id/close", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  if (k.created_by !== c.get("user").id && !can(c.get("user"), "manageCase")) deny("Only the case creator or an Admin can close a case.");
  await c.env.DB.prepare("UPDATE cases SET status = 'closed' WHERE id = ?").bind(k.id).run();
  await audit(c, "case.closed", k.id);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ approvals (four-eyes)

cases.get("/approvals", async (c) => {
  const u = c.get("user");
  if (!can(u, "approve")) deny("Only Approvers can see the approval queue.");
  const { results } = await c.env.DB.prepare("SELECT k.*, cu.name AS created_by_name FROM cases k LEFT JOIN users cu ON cu.id = k.created_by WHERE k.status = 'pending' ORDER BY k.created_at").all<any>();
  await audit(c, "approvals.viewed", null, { count: results.length });
  return c.json({ cases: results.map((k) => ({ ...pub(k), own: k.created_by === u.id })) });
});

cases.post("/cases/:id/decision", async (c) => {
  const u = c.get("user");
  if (!can(u, "approve")) deny("Only a user with the Approver role can approve a case.");
  const k = await c.env.DB.prepare("SELECT * FROM cases WHERE id = ?").bind(c.req.param("id")).first<CaseRow>();
  if (!k || k.status === "deleted") throw new HttpError(404, "No such case.");
  if (k.status !== "pending") throw new HttpError(409, "This case has already been decided.");
  if (k.created_by === u.id) throw new HttpError(403, "Four-eyes rule: the person who opened a case cannot approve it.");
  const b = await readJson<any>(c, 4096);
  const decision = b.decision === "approve" ? "approved" : b.decision === "reject" ? "rejected" : "";
  if (!decision) throw new HttpError(400, "Choose approve or reject.");
  const note = str(b.note, 1000);
  if (decision === "rejected" && !note) throw new HttpError(400, "Say why the case is rejected.");
  if (b.checked !== true) throw new HttpError(400, "Confirm that you have checked the legal basis and reference.");
  await c.env.DB.prepare("UPDATE cases SET status = ?, decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ? AND status = 'pending'").bind(decision, u.id, now(), note || null, k.id).run();
  await audit(c, decision === "approved" ? "case.approved" : "case.rejected", k.id, { note, legalBasis: k.legal_basis, refNo: k.ref_no });
  return c.json({ ok: true, status: decision });
});

// ------------------------------------------------------------------ members

cases.post("/cases/:id/members", async (c) => {
  const u = c.get("user");
  const k = await c.env.DB.prepare("SELECT * FROM cases WHERE id = ?").bind(c.req.param("id")).first<CaseRow>();
  if (!k || k.status === "deleted") throw new HttpError(404, "No such case.");
  const isOwner = k.created_by === u.id && (await isMember(c.env, k.id, u.id));
  if (!isOwner && !can(u, "manageCase")) deny("Only the case creator or an Admin can assign people.");
  const b = await readJson<any>(c, 2048);
  const who = await c.env.DB.prepare("SELECT id, email, name, role, status FROM users WHERE id = ?").bind(str(b.userId, 64)).first<any>();
  if (!who || who.status !== "active") throw new HttpError(404, "No such active user.");
  await c.env.DB.prepare("INSERT INTO case_members (case_id, user_id, added_by, added_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING").bind(k.id, who.id, u.id, now()).run();
  await audit(c, "case.member.added", k.id, { user: who.email, role: who.role });
  return c.json({ ok: true });
});

cases.delete("/cases/:id/members/:uid", async (c) => {
  const u = c.get("user");
  const k = await c.env.DB.prepare("SELECT * FROM cases WHERE id = ?").bind(c.req.param("id")).first<CaseRow>();
  if (!k) throw new HttpError(404, "No such case.");
  if (!(k.created_by === u.id || can(u, "manageCase"))) deny();
  if (c.req.param("uid") === k.created_by && !can(u, "manageCase")) throw new HttpError(400, "The case creator stays on the case.");
  await c.env.DB.prepare("DELETE FROM case_members WHERE case_id = ? AND user_id = ?").bind(k.id, c.req.param("uid")).run();
  await audit(c, "case.member.removed", k.id, { user: c.req.param("uid") });
  return c.json({ ok: true });
});

// Admin's register of all cases (metadata only, for assignment and retention). No case data.
cases.get("/admin/cases", async (c) => {
  if (!can(c.get("user"), "manageCase")) deny();
  const { results } = await c.env.DB.prepare("SELECT k.id, k.title, k.status, k.ref_no, k.legal_basis, k.retain_until, k.record_count, k.created_at, k.deleted_at, cu.name AS created_by_name, (SELECT COUNT(*) FROM case_members m WHERE m.case_id = k.id) AS members FROM cases k LEFT JOIN users cu ON cu.id = k.created_by ORDER BY k.created_at DESC").all();
  await audit(c, "admin.register.viewed", null, { count: results.length });
  return c.json({ cases: results });
});

// ------------------------------------------------------------------ notes, OSINT notes, bookmarks, watchlist, filters, templates

cases.get("/cases/:id/notes", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const [notes, bms] = await Promise.all([
    c.env.DB.prepare("SELECT n.*, u.name AS by_name FROM notes n LEFT JOIN users u ON u.id = n.created_by WHERE case_id = ? ORDER BY created_at DESC").bind(k.id).all(),
    c.env.DB.prepare("SELECT b.*, u.name AS by_name, r.a, r.b AS bparty, r.ts, r.type, r.dur, r.cell FROM bookmarks b LEFT JOIN users u ON u.id = b.created_by LEFT JOIN records r ON r.id = b.record_id WHERE b.case_id = ? ORDER BY b.created_at DESC").bind(k.id).all(),
  ]);
  await audit(c, "notes.viewed", k.id);
  return c.json({ notes: notes.results, bookmarks: bms.results });
});

cases.post("/cases/:id/notes", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  const b = await readJson<any>(c, 32 * 1024);
  const kind = b.kind === "osint" ? "osint" : "note";
  const body = str(b.body, 20000), source = str(b.source, 500);
  if (!body) throw new HttpError(400, "Write the note first.");
  if (kind === "osint" && !source) throw new HttpError(400, "Say where this information came from and on what basis you hold it.");
  const id = uid();
  await c.env.DB.prepare("INSERT INTO notes (id, case_id, kind, body, source, evidence_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id, k.id, kind, body, source || null, str(b.evidenceId, 64) || null, c.get("user").id, now()).run();
  await audit(c, kind === "osint" ? "osint.note.added" : "note.added", k.id, { id, chars: body.length, source: source || undefined });
  return c.json({ id });
});

cases.delete("/cases/:id/notes/:nid", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  await c.env.DB.prepare("DELETE FROM notes WHERE id = ? AND case_id = ?").bind(c.req.param("nid"), k.id).run();
  await audit(c, "note.deleted", k.id, { id: c.req.param("nid") });
  return c.json({ ok: true });
});

cases.post("/cases/:id/bookmarks", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  const b = await readJson<any>(c, 8192);
  const tag = str(b.tag, 60) || "Evidence";
  const rid = Number(b.recordId) || null, number = b.number ? normaliseMsisdn(b.number, k.cc).value || str(b.number, 30) : null;
  if (!rid && !number) throw new HttpError(400, "Choose a record or a number to bookmark.");
  const id = uid();
  await c.env.DB.prepare("INSERT INTO bookmarks (id, case_id, record_id, number, tag, note, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id, k.id, rid, number, tag, str(b.note, 2000) || null, c.get("user").id, now()).run();
  await audit(c, "bookmark.added", k.id, { id, recordId: rid, number, tag });
  return c.json({ id });
});

cases.delete("/cases/:id/bookmarks/:bid", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  await c.env.DB.prepare("DELETE FROM bookmarks WHERE id = ? AND case_id = ?").bind(c.req.param("bid"), k.id).run();
  await audit(c, "bookmark.deleted", k.id, { id: c.req.param("bid") });
  return c.json({ ok: true });
});

cases.get("/cases/:id/watchlist", async (c) => {
  const k = await caseFor(c, c.req.param("id"));
  const { results } = await c.env.DB.prepare("SELECT number, list, label, created_at FROM watchlist WHERE case_id = ? ORDER BY list, number").bind(k.id).all();
  return c.json({ entries: results });
});

cases.post("/cases/:id/watchlist", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  const b = await readJson<any>(c, 64 * 1024);
  const list = b.list === "white" ? "white" : "black";
  const nums: string[] = (Array.isArray(b.numbers) ? b.numbers : String(b.numbers || "").split(/[\s,;]+/)).slice(0, 1000).map((n: string) => normaliseMsisdn(n, k.cc).value).filter(Boolean);
  if (!nums.length) throw new HttpError(400, "Enter at least one valid number.");
  const label = str(b.label, 120) || null;
  await c.env.DB.batch(nums.map((n) => c.env.DB.prepare("INSERT INTO watchlist (case_id, number, list, label, created_by, created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(case_id, number) DO UPDATE SET list = excluded.list, label = excluded.label").bind(k.id, n, list, label, c.get("user").id, now())));
  await audit(c, "watchlist.updated", k.id, { list, count: nums.length, label });
  return c.json({ ok: true, added: nums.length });
});

cases.delete("/cases/:id/watchlist/:num", async (c) => {
  const k = await caseFor(c, c.req.param("id"), "annotate");
  await c.env.DB.prepare("DELETE FROM watchlist WHERE case_id = ? AND number = ?").bind(k.id, decodeURIComponent(c.req.param("num"))).run();
  await audit(c, "watchlist.removed", k.id, { number: c.req.param("num") });
  return c.json({ ok: true });
});

cases.get("/filters", async (c) => {
  const caseId = c.req.query("case") || null;
  const { results } = await c.env.DB.prepare("SELECT id, case_id, name, filter, created_at FROM saved_filters WHERE user_id = ? AND (case_id IS NULL OR case_id = ?) ORDER BY name").bind(c.get("user").id, caseId).all<any>();
  return c.json({ filters: results.map((f) => ({ ...f, filter: JSON.parse(f.filter) })) });
});
cases.post("/filters", async (c) => {
  const b = await readJson<any>(c, 32 * 1024);
  const name = str(b.name, 80);
  if (!name) throw new HttpError(400, "Name the filter.");
  if (b.caseId) await caseFor(c, str(b.caseId, 64));
  const id = uid();
  await c.env.DB.prepare("INSERT INTO saved_filters (id, case_id, user_id, name, filter, created_at) VALUES (?,?,?,?,?,?)").bind(id, str(b.caseId, 64) || null, c.get("user").id, name, JSON.stringify(cleanFilter(b.filter)), now()).run();
  return c.json({ id });
});
cases.delete("/filters/:fid", async (c) => {
  await c.env.DB.prepare("DELETE FROM saved_filters WHERE id = ? AND user_id = ?").bind(c.req.param("fid"), c.get("user").id).run();
  return c.json({ ok: true });
});

cases.get("/templates", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT t.id, t.name, t.mapping, t.created_at, u.name AS by_name FROM templates t LEFT JOIN users u ON u.id = t.created_by ORDER BY t.name").all<any>();
  return c.json({ templates: results.map((t) => ({ ...t, mapping: JSON.parse(t.mapping) })) });
});
cases.post("/templates", async (c) => {
  if (!can(c.get("user"), "importData")) deny();
  const b = await readJson<any>(c, 16 * 1024);
  const name = str(b.name, 80);
  if (!name || !b.mapping || typeof b.mapping !== "object") throw new HttpError(400, "Name the template.");
  const m = b.mapping;
  const clean = { cols: Object.fromEntries(Object.entries(m.cols || {}).filter(([k, v]) => /^[a-zA-Z]{1,12}$/.test(k) && Number.isInteger(v)).slice(0, 30)), parties: m.parties === "calling-called" ? "calling-called" : "target-other", dateOrder: ["dmy", "mdy", "ymd"].includes(m.dateOrder) ? m.dateOrder : "dmy", tz: str(m.tz, 40) || "Asia/Kolkata", cc: /^\d{1,3}$/.test(m.cc) ? m.cc : "91", headers: Array.isArray(m.headers) ? m.headers.slice(0, 80).map((h: unknown) => str(h, 80)) : [] };
  const id = uid();
  await c.env.DB.prepare("INSERT INTO templates (id, name, mapping, created_by, created_at) VALUES (?,?,?,?,?)").bind(id, name, JSON.stringify(clean), c.get("user").id, now()).run();
  await audit(c, "template.saved", null, { id, name });
  return c.json({ id });
});
