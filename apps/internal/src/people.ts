// HR & Admin: People Masters (24), Roles & Responsibilities (23) and celebrations (22).
//
// Data protection (Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025):
// - Each register records its purpose and lawful basis (legitimate use for employment under s.7(i),
//   contract, or consent), the notice version given, and a retention date.
// - Sensitive fields (identity numbers, bank details, home address, personal contacts, health) are
//   sealed with AES-GCM under PII_ENCRYPTION_KEY. Lists and searches never return them.
// - Only administrators can reveal a sealed field, they must give a reason, and each reveal is
//   written to the audit log. Everyone else sees masked values.
// - Aadhaar: only the last four digits are kept (Aadhaar Act, 2016 s.29 and the Aadhaar
//   (Data Security) Regulations: no full number without an Aadhaar Data Vault).
// - Celebration emails use the day and month only; the year of birth is never shown or sent.
import { Hono } from "hono";
import { audit } from "../../../packages/core/src/session";
import { readJson, str } from "../../../packages/core/src/http";
import { seal, unseal } from "../../../packages/core/src/crypto";
import { mailEnabled, mailHtml, sendMail } from "../../../packages/core/src/mail";
import { Env, User, atLeast, uid } from "./env";
import { postUpdate } from "./ops";

type V = { Bindings: Env; Variables: { user: User } };
export const people = new Hono<V>();
const now = () => new Date().toISOString();

type F = { k: string; l: string; s?: 1; t?: "date" | "email" | "tel" | "number" | "select" | "textarea"; o?: string[]; req?: 1; hint?: string };
const ENTITIES = ["KSA", "Kayak Innovations", "Kayak Technology Solutions", "Brand Defence & Integrity", "Group"];
const PII_NOTE = "Sealed. Only administrators can reveal it, with a reason, and every reveal is logged.";

export const REGISTERS: Record<string, { label: string; one: string; basis: string; purpose: string; retain: string; fields: F[] }> = {
  employee: {
    label: "Employees", one: "employee", basis: "Legitimate use: employment (DPDP Act s.7(i))",
    purpose: "Employment, payroll, statutory filings (PF, ESI, TDS, professional tax), access to Kayak systems, safety and emergencies.",
    retain: "8 years after exit (Income-tax Act and Companies Act record-keeping)",
    fields: [
      { k: "code", l: "Employee code", req: 1 }, { k: "preferred", l: "Preferred name" }, { k: "designation", l: "Designation", req: 1 }, { k: "department", l: "Department" },
      { k: "manager", l: "Reports to" }, { k: "type", l: "Employment type", t: "select", o: ["Full-time", "Part-time", "Fixed-term", "Consultant", "Intern"] },
      { k: "location", l: "Base office", t: "select", o: ["Mumbai", "Thane", "Remote"] },
      { k: "joined_on", l: "Date of joining", t: "date", req: 1 }, { k: "probation_end", l: "Probation ends", t: "date" }, { k: "notice_days", l: "Notice period (days)", t: "number" },
      { k: "dob", l: "Date of birth", t: "date", s: 1, hint: "Only the day and month are used for birthday wishes." },
      { k: "gender", l: "Gender", t: "select", o: ["Woman", "Man", "Non-binary", "Prefer not to say"] },
      { k: "work_email", l: "Work email", t: "email", req: 1 }, { k: "work_phone", l: "Work phone", t: "tel" },
      { k: "personal_email", l: "Personal email", t: "email", s: 1 }, { k: "mobile", l: "Personal mobile", t: "tel", s: 1 },
      { k: "address", l: "Residential address", t: "textarea", s: 1 }, { k: "emergency", l: "Emergency contact (name, relation, phone)", s: 1 },
      { k: "pan", l: "PAN", s: 1 }, { k: "aadhaar_last4", l: "Aadhaar (last 4 digits only)", hint: "Never store the full Aadhaar number." },
      { k: "uan", l: "UAN (EPF)", s: 1 }, { k: "esic", l: "ESIC number", s: 1 },
      { k: "bank_account", l: "Bank account number", s: 1 }, { k: "ifsc", l: "IFSC" }, { k: "bank_name", l: "Bank" },
      { k: "blood_group", l: "Blood group", s: 1, hint: "Optional, for emergencies only, with the employee's agreement." },
      { k: "qualifications", l: "Qualifications", t: "textarea" }, { k: "memberships", l: "Professional memberships (ICAI, ICSI, Bar Council…)" },
      { k: "nationality", l: "Nationality" }, { k: "exit_on", l: "Exit date", t: "date" }, { k: "exit_reason", l: "Exit reason" },
    ],
  },
  partner: {
    label: "Business Partners", one: "business partner", basis: "Contract, and legitimate business interest in vendor due diligence",
    purpose: "Onboarding, due diligence and conflict checks, contracts and NDAs, payments and TDS, GST compliance.",
    retain: "8 years after the relationship ends",
    fields: [
      { k: "category", l: "Category", t: "select", o: ["Consulting partner", "Vendor", "Technology partner", "Law firm", "Investigation partner", "Other"], req: 1 },
      { k: "constitution", l: "Constitution", t: "select", o: ["Private limited", "Public limited", "LLP", "Partnership", "Proprietorship", "Individual", "Foreign entity"] },
      { k: "cin", l: "CIN / LLPIN" }, { k: "gstin", l: "GSTIN" }, { k: "pan", l: "PAN", s: 1 }, { k: "udyam", l: "Udyam (MSME) number", hint: "MSME suppliers must be paid within 45 days (MSMED Act s.15)." },
      { k: "address", l: "Registered address", t: "textarea" }, { k: "contact", l: "Contact person" }, { k: "email", l: "Email", t: "email" }, { k: "phone", l: "Phone", t: "tel" },
      { k: "bank_account", l: "Bank account number", s: 1 }, { k: "ifsc", l: "IFSC" },
      { k: "tds", l: "TDS section", t: "select", o: ["194C", "194J", "194H", "194I", "195", "Not applicable"] },
      { k: "nda_until", l: "NDA valid until", t: "date" }, { k: "agreement_until", l: "Agreement valid until", t: "date" },
      { k: "dd_status", l: "Due diligence", t: "select", o: ["Not started", "In progress", "Cleared", "Cleared with conditions", "Not cleared"] },
      { k: "conflict", l: "Conflict check", t: "select", o: ["Not run", "Clear", "Potential conflict: escalated"] }, { k: "notes", l: "Notes", t: "textarea" },
    ],
  },
  director: {
    label: "Co-Directors and Shareholders", one: "director or shareholder", basis: "Legal obligation (Companies Act, 2013 registers; DPDP Act s.7(c))",
    purpose: "Statutory registers of directors, KMP and members, ROC filings, DIN KYC, disclosure of interest and beneficial ownership.",
    retain: "Permanently, as the Companies Act registers require",
    fields: [
      { k: "role", l: "Role", t: "select", o: ["Director", "Managing Director", "Whole-time Director", "Independent Director", "Shareholder", "Director and shareholder", "Nominee"], req: 1 },
      { k: "din", l: "DIN" }, { k: "appointed_on", l: "Date of appointment", t: "date" }, { k: "ceased_on", l: "Date of cessation", t: "date" },
      { k: "shares", l: "Number of shares", t: "number" }, { k: "holding_pct", l: "Holding (%)", t: "number" }, { k: "folio", l: "Folio number" }, { k: "share_class", l: "Class of shares" },
      { k: "dob", l: "Date of birth", t: "date", s: 1 }, { k: "pan", l: "PAN", s: 1 }, { k: "aadhaar_last4", l: "Aadhaar (last 4 digits only)" }, { k: "passport", l: "Passport number", s: 1 },
      { k: "nationality", l: "Nationality" }, { k: "residency", l: "Resident in India (182 days)", t: "select", o: ["Yes", "No"] },
      { k: "address", l: "Residential address", t: "textarea", s: 1 }, { k: "email", l: "Email", t: "email" }, { k: "mobile", l: "Mobile", t: "tel", s: 1 },
      { k: "kyc_done", l: "DIR-3 KYC filed on", t: "date" }, { k: "mbp1", l: "MBP-1 (interests) received on", t: "date" }, { k: "dir8", l: "DIR-8 received on", t: "date" },
      { k: "sbo", l: "Significant beneficial owner (BEN-1)", t: "select", o: ["No", "Yes: declared"] }, { k: "notes", l: "Notes", t: "textarea" },
    ],
  },
  client: {
    label: "Clients", one: "client", basis: "Contract, and legal obligation for KYC and independence checks",
    purpose: "Engagement letters, conflict and independence checks, billing and GST, client communications.",
    retain: "8 years after the last engagement ends",
    fields: [
      { k: "constitution", l: "Constitution", t: "select", o: ["Private limited", "Listed company", "LLP", "Partnership", "Trust", "Family office", "Individual", "Foreign entity", "Government body"] },
      { k: "group", l: "Group" }, { k: "sector", l: "Sector" }, { k: "cin", l: "CIN / LLPIN" }, { k: "gstin", l: "GSTIN" }, { k: "pan", l: "PAN", s: 1 },
      { k: "address", l: "Registered address", t: "textarea" }, { k: "billing", l: "Billing address", t: "textarea" },
      { k: "contact", l: "Key contact (name, role)" }, { k: "email", l: "Contact email", t: "email" }, { k: "phone", l: "Contact phone", t: "tel" },
      { k: "partner", l: "Relationship lead at Kayak" }, { k: "onboarded_on", l: "Onboarded on", t: "date" },
      { k: "kyc", l: "KYC", t: "select", o: ["Pending", "Done", "Enhanced due diligence"] }, { k: "risk", l: "Risk rating", t: "select", o: ["Low", "Medium", "High"] },
      { k: "conflict", l: "Conflict check", t: "select", o: ["Not run", "Clear", "Potential conflict: escalated"] },
      { k: "engagements", l: "Engagement letters (reference, date)", t: "textarea" }, { k: "notes", l: "Notes", t: "textarea" },
    ],
  },
  distributor: {
    label: "Distributors", one: "distributor", basis: "Contract",
    purpose: "Distribution agreements for Kayak Solutions, territories, commissions, payments and GST.",
    retain: "8 years after the agreement ends",
    fields: [
      { k: "products", l: "Products", hint: "For example NexaPair, SayUsNow, DocuVow" }, { k: "territory", l: "Territory" },
      { k: "constitution", l: "Constitution", t: "select", o: ["Private limited", "LLP", "Partnership", "Proprietorship", "Foreign entity"] },
      { k: "gstin", l: "GSTIN" }, { k: "pan", l: "PAN", s: 1 }, { k: "address", l: "Registered address", t: "textarea" },
      { k: "contact", l: "Contact person" }, { k: "email", l: "Email", t: "email" }, { k: "phone", l: "Phone", t: "tel" },
      { k: "agreement_from", l: "Agreement from", t: "date" }, { k: "agreement_until", l: "Agreement until", t: "date" },
      { k: "commission", l: "Commission (%)", t: "number" }, { k: "exclusive", l: "Exclusive", t: "select", o: ["No", "Yes"] },
      { k: "bank_account", l: "Bank account number", s: 1 }, { k: "ifsc", l: "IFSC" },
      { k: "kyc", l: "KYC", t: "select", o: ["Pending", "Done"] }, { k: "notes", l: "Notes", t: "textarea" },
    ],
  },
};
const NOTICE = "KSA-PN-2026-11";
const key = (env: Env) => {
  if (!env.PII_ENCRYPTION_KEY) throw Object.assign(new Error("The personal-data key is not set yet. It is created on the next deploy."), { status: 503 });
  return env.PII_ENCRYPTION_KEY;
};
const mask = (v: string) => (!v ? "" : v.length <= 4 ? "••••" : "•".repeat(Math.min(8, v.length - 4)) + v.slice(-4));

people.get("/meta", (c) => c.json({ registers: REGISTERS, entities: ENTITIES, notice: NOTICE, piiNote: PII_NOTE, keyReady: !!c.env.PII_ENCRYPTION_KEY }));

people.get("/masters/:kind", async (c) => {
  const kind = c.req.param("kind");
  if (!REGISTERS[kind]) return c.json({ error: "Unknown register." }, 404);
  const u = c.get("user");
  // Employees can see the employee directory (work details only); other registers are for editors and above.
  if (kind !== "employee" && !atLeast(u, "editor")) return c.json({ error: "Editors and administrators only." }, 403);
  const { results } = await c.env.DB.prepare("SELECT id, kind, name, entity, status, user_id, data, sealed IS NOT NULL has_sealed, lawful_basis, retention_until, joined_on, updated_at FROM masters WHERE kind = ? ORDER BY name COLLATE NOCASE").bind(kind).all<any>();
  const pub = new Set(["code", "preferred", "designation", "department", "manager", "location", "work_email", "work_phone", "joined_on", "type"]);
  return c.json({ rows: results.map((r: any) => { const d = JSON.parse(r.data || "{}"); return { ...r, data: atLeast(u, "editor") ? d : Object.fromEntries(Object.entries(d).filter(([k]) => pub.has(k))) }; }) });
});

people.get("/masters/:kind/:id", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "editor")) return c.json({ error: "Editors and administrators only." }, 403);
  const r = await c.env.DB.prepare("SELECT * FROM masters WHERE id = ? AND kind = ?").bind(c.req.param("id"), c.req.param("kind")).first<any>();
  if (!r) return c.json({ error: "Not found." }, 404);
  const sealed: Record<string, string> = r.sealed ? JSON.parse(await unseal(r.sealed, key(c.env))) : {};
  return c.json({ ...r, sealed: undefined, data: JSON.parse(r.data || "{}"), masked: Object.fromEntries(Object.entries(sealed).map(([k, v]) => [k, mask(String(v))])) });
});

people.post("/masters/:kind/:id/reveal", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "admin")) return c.json({ error: "Only administrators can reveal sealed personal data." }, 403);
  const b = await readJson<any>(c, 1024);
  const reason = str(b.reason, 200);
  if (reason.length < 8) return c.json({ error: "Give the reason for viewing this data (for the audit log)." }, 400);
  const r = await c.env.DB.prepare("SELECT id, name, sealed FROM masters WHERE id = ? AND kind = ?").bind(c.req.param("id"), c.req.param("kind")).first<any>();
  if (!r?.sealed) return c.json({ fields: {} });
  const all = JSON.parse(await unseal(r.sealed, key(c.env)));
  const f = str(b.field, 40);
  const fields = f ? { [f]: all[f] ?? "" } : all;
  await audit(c, c.env.DB, u.id, "pii.revealed", { register: c.req.param("kind"), id: r.id, fields: Object.keys(fields), reason });
  return c.json({ fields });
});

people.post("/masters/:kind", async (c) => {
  const u = c.get("user"), kind = c.req.param("kind"), reg = REGISTERS[kind];
  if (!reg) return c.json({ error: "Unknown register." }, 404);
  if (!atLeast(u, "admin")) return c.json({ error: "Administrators maintain the People Masters." }, 403);
  const b = await readJson<any>(c, 64_000);
  const name = str(b.name, 160);
  if (!name) return c.json({ error: "Enter the full legal name." }, 400);
  const id = b.id ? str(b.id, 60) : uid();
  const prev = b.id ? await c.env.DB.prepare("SELECT sealed FROM masters WHERE id = ? AND kind = ?").bind(id, kind).first<any>() : null;
  const sealedPrev: Record<string, string> = prev?.sealed ? JSON.parse(await unseal(prev.sealed, key(c.env))) : {};
  const data: Record<string, string> = {}, sealed: Record<string, string> = { ...sealedPrev };
  const missing: string[] = [];
  for (const f of reg.fields) {
    if (f.s && b.data?.[f.k] === "__keep__") { if (f.req && !sealed[f.k]) missing.push(f.l); continue; } // unchanged sealed value
    let v = str(b.data?.[f.k], f.t === "textarea" ? 2000 : 200);
    if (f.k === "aadhaar_last4") { v = v.replace(/\D/g, ""); if (v.length > 4) return c.json({ error: "Keep only the last four digits of the Aadhaar number." }, 400); }
    if (f.k === "pan" && v && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.toUpperCase())) return c.json({ error: "The PAN does not look right (five letters, four digits, one letter)." }, 400);
    if (f.k === "gstin" && v && !/^[0-9]{2}[A-Z0-9]{13}$/.test(v.toUpperCase())) return c.json({ error: "The GSTIN does not look right (15 characters)." }, 400);
    if (f.k === "ifsc" && v && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase())) return c.json({ error: "The IFSC does not look right (for example HDFC0001234)." }, 400);
    if (["pan", "gstin", "ifsc"].includes(f.k)) v = v.toUpperCase();
    if (f.s) { if (b.data?.[f.k] !== undefined && b.data[f.k] !== "__keep__") { if (v) sealed[f.k] = v; else delete sealed[f.k]; } }
    else if (v) data[f.k] = v;
    if (f.req && !(f.s ? sealed[f.k] : data[f.k])) missing.push(f.l);
  }
  if (missing.length) return c.json({ error: `Still needed: ${missing.join(", ")}.` }, 400);
  const dob = sealed.dob || "";
  const joined = data.joined_on || data.appointed_on || data.onboarded_on || null;
  const t = now();
  const sealedText = Object.keys(sealed).length ? await seal(JSON.stringify(sealed), key(c.env)) : null;
  const linked = kind === "employee" && data.work_email ? await c.env.DB.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").bind(data.work_email).first<any>() : null;
  await c.env.DB.prepare(`INSERT INTO masters (id, kind, name, entity, status, user_id, data, sealed, lawful_basis, purpose, notice_version, consent_at, retention_until, dob_md, joined_on, wishes, created_by, created_at, updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?18)
    ON CONFLICT(id) DO UPDATE SET name=?3, entity=?4, status=?5, user_id=?6, data=?7, sealed=?8, lawful_basis=?9, purpose=?10, notice_version=?11, consent_at=COALESCE(?12, consent_at), retention_until=?13, dob_md=?14, joined_on=?15, wishes=?16, updated_at=?18`)
    .bind(id, kind, name, ENTITIES.includes(b.entity) ? b.entity : "KSA", ["active", "inactive", "exited"].includes(b.status) ? b.status : "active", linked?.id || null,
      JSON.stringify(data), sealedText, reg.basis, reg.purpose, NOTICE, b.notice_given ? t : null, str(b.retention_until, 10) || null,
      /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob.slice(5) : null, joined, b.wishes === false ? 0 : 1, u.id, t).run();
  await audit(c, c.env.DB, u.id, "pii.saved", { register: kind, id, sealedFields: Object.keys(sealed).length });
  return c.json({ id });
});

people.post("/masters/:kind/:id/delete", async (c) => {
  const u = c.get("user");
  if (!atLeast(u, "superadmin")) return c.json({ error: "Only a SuperAdmin can erase a master record." }, 403);
  const b = await readJson<any>(c, 1024);
  if (str(b.reason, 200).length < 8) return c.json({ error: "Record why this is being erased (for example, retention period ended or erasure request)." }, 400);
  await c.env.DB.prepare("DELETE FROM masters WHERE id = ? AND kind = ?").bind(c.req.param("id"), c.req.param("kind")).run();
  await audit(c, c.env.DB, u.id, "pii.erased", { register: c.req.param("kind"), id: c.req.param("id"), reason: str(b.reason, 200) });
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ 22 · celebrations
people.get("/celebrations", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name, entity, dob_md, joined_on, wishes, data FROM masters WHERE kind = 'employee' AND status = 'active'").all<any>();
  const today = new Date(Date.now() + 5.5 * 3600_000);
  const upcoming: any[] = [];
  for (let i = 0; i < 45; i++) {
    const d = new Date(today.getTime() + i * 86400_000), md = d.toISOString().slice(5, 10), y = d.getUTCFullYear();
    for (const r of results) {
      const nm = JSON.parse(r.data || "{}").preferred || r.name;
      if (r.dob_md === md) upcoming.push({ on: d.toISOString().slice(0, 10), kind: "Birthday", name: nm, wishes: !!r.wishes });
      if (r.joined_on && r.joined_on.slice(5, 10) === md && y > +r.joined_on.slice(0, 4)) upcoming.push({ on: d.toISOString().slice(0, 10), kind: `${y - +r.joined_on.slice(0, 4)} year${y - +r.joined_on.slice(0, 4) > 1 ? "s" : ""} with Kayak`, name: nm, wishes: !!r.wishes });
    }
  }
  return c.json({ upcoming, mail: mailEnabled(c.env) });
});

/** Daily at 07:00 IST: birthday, work-anniversary and service-milestone emails, and a Kayakers Update post. */
export async function runCelebrations(env: Env) {
  const ist = new Date(Date.now() + 5.5 * 3600_000), md = ist.toISOString().slice(5, 10), y = ist.getUTCFullYear();
  const { results } = await env.DB.prepare("SELECT id, name, data, dob_md, joined_on FROM masters WHERE kind = 'employee' AND status = 'active' AND wishes = 1 AND (dob_md = ?1 OR substr(joined_on, 6, 5) = ?1)").bind(md).all<any>();
  for (const r of results) {
    const d = JSON.parse(r.data || "{}"), first = (d.preferred || r.name).split(" ")[0];
    const events: [string, string, string, string][] = [];
    if (r.dob_md === md) events.push(["birthday", `Happy birthday, ${first}`, `Everyone at Kayak wishes you a very happy birthday, ${first}. Thank you for everything you bring to the crew. Have a wonderful day.`, `Happy birthday, ${first}!`]);
    if (r.joined_on && r.joined_on.slice(5, 10) === md) {
      const n = y - +r.joined_on.slice(0, 4);
      if (n >= 1) {
        const milestone = [1, 3, 5, 10, 15, 20, 25].includes(n);
        events.push(["anniversary", `${n} year${n > 1 ? "s" : ""} with Kayak`, `${first}, today marks ${n} year${n > 1 ? "s" : ""} since you joined Kayak.${milestone ? " It is a milestone, and we are proud to have paddled it with you." : ""} Thank you for your steady stroke on every crossing.`, `${first} completes ${n} year${n > 1 ? "s" : ""} with Kayak today${milestone ? ": a service milestone" : ""}.`]);
      }
    }
    for (const [kind, subject, msg, post] of events) {
      const done = await env.DB.prepare("INSERT OR IGNORE INTO celebrations_sent (master_id, kind, year, at) VALUES (?,?,?,?)").bind(r.id, kind, y, new Date().toISOString()).run();
      if (!done.meta.changes) continue;
      if (mailEnabled(env) && d.work_email) await sendMail(env, d.work_email, subject, mailHtml({ site: "KAYAKERS", title: subject, intro: msg, outro: "With warm wishes from the whole Kayak crew." })).catch(() => {});
      await postUpdate(env.DB, "people", post, kind === "birthday" ? "Send your wishes below." : "Join us in congratulating them.").catch(() => {});
    }
  }
}

// ------------------------------------------------------------------ 23 · roles and responsibilities
const SEED_ROLES = [
  { id: "md", title: "Managing Director", reports_to: null, statutory: 1, purpose: "Leads Kayak: strategy, client relationships, quality and risk, and the Kayak Group.", responsibilities: ["Set strategy and annual plan", "Lead key client relationships and sign engagement letters", "Approve releases of Confluence and public content", "Chair risk, independence and conflict decisions", "Represent the company before regulators and the board"], kpis: ["Revenue and margin", "Client satisfaction", "Zero unresolved conflicts"], authorities: ["Signs contracts and engagement letters", "Approves spend above ₹5 lakh", "Approves hiring and exits"] },
  { id: "cto", title: "Chief Technology Officer (Group)", reports_to: "md", purpose: "Owns Kayak's technology, Kayak Solutions and information security.", responsibilities: ["Product roadmap for NexaPair, SayUsNow, SeeCounter and DocuVow", "Platform reliability, security and backups", "Approve production releases", "Vendor and cloud cost management"], kpis: ["Uptime 99.9%", "Security incidents resolved within SLA", "Release on plan"], authorities: ["Approves technology spend up to ₹5 lakh", "Grants and revokes system access"] },
  { id: "cs", title: "Company Secretary and Compliance Officer", reports_to: "md", statutory: 1, purpose: "Keeps the company compliant with the Companies Act, 2013 and other statutes.", responsibilities: ["Board and general meetings, minutes and resolutions", "Statutory registers and ROC filings", "DIN KYC, MBP-1, DIR-8 and BEN-1 tracking", "Compliance calendar and certificates"], kpis: ["Zero late filings", "Registers current"], authorities: ["Signs ROC filings as authorised"] },
  { id: "dpo", title: "Data Protection and Grievance Officer", reports_to: "md", statutory: 1, purpose: "Answers for personal data under the DPDP Act, 2023 and the IT Act, 2000.", responsibilities: ["Maintain privacy notices and consent records", "Handle data-principal requests (access, correction, erasure, grievance) within 90 days", "Report personal-data breaches to the Data Protection Board and affected people", "Review People Masters access and reveal logs monthly", "Train staff on data protection"], kpis: ["Requests closed within the statutory time", "Monthly access review done"], authorities: ["Can suspend access to personal data", "Approves erasure at end of retention"] },
  { id: "engagement-lead", title: "Engagement Lead", reports_to: "md", purpose: "Delivers client engagements to Kayak's standard.", responsibilities: ["Scope, plan and staff engagements", "Run conflict and independence checks before acceptance", "Quality review of every deliverable", "Bill and collect on time"], kpis: ["Engagements on time and budget", "Realisation above 90%"], authorities: ["Approves engagement expenses up to ₹50,000"] },
  { id: "brand-editor", title: "Brand and Content Editor", reports_to: "md", purpose: "Keeps every Kayak output on brand and on voice.", responsibilities: ["Edit Confluence and insights before approval", "Maintain the brand portal and templates", "Run the website and social channels", "Check that every AI-generated asset is labelled"], kpis: ["On-time Confluence", "Brand audit pass rate"], authorities: ["Publishes approved content"] },
  { id: "finance", title: "Finance and Accounts", reports_to: "md", statutory: 1, purpose: "Runs accounts, tax and payments.", responsibilities: ["Books of account, GST returns and TDS", "Pay MSME suppliers within 45 days", "Payroll inputs, PF, ESI and professional tax", "Monthly MIS for the MD"], kpis: ["Returns filed on time", "Books closed by day 7"], authorities: ["Releases approved payments"] },
  { id: "hr-admin", title: "HR and Administration", reports_to: "md", purpose: "Looks after Kayak's people and offices.", responsibilities: ["Hiring, onboarding and exits", "People Masters accuracy", "POSH Internal Committee support (POSH Act, 2013)", "Leave, attendance and policies", "Office administration in Mumbai and Thane"], kpis: ["Onboarding complete on day 1", "Masters complete"], authorities: ["Issues letters on MD approval"] },
  { id: "it-security", title: "IT and Security Administrator", reports_to: "cto", purpose: "Keeps devices, accounts and systems secure.", responsibilities: ["Joiner-mover-leaver access changes the same day", "Two-factor sign-in for every account", "Patching, backups and CERT-In incident reporting within 6 hours", "Keep system logs for 180 days (CERT-In directions, 2022)"], kpis: ["Access changes same day", "Patch compliance 95%"], authorities: ["Locks accounts during incidents"] },
];
people.get("/roles", async (c) => {
  let { results } = await c.env.DB.prepare("SELECT * FROM roles ORDER BY sort, title").all<any>();
  if (!results.length) {
    const t = now();
    await c.env.DB.batch(SEED_ROLES.map((r, i) => c.env.DB.prepare("INSERT OR IGNORE INTO roles (id, title, entity, reports_to, purpose, responsibilities, kpis, authorities, statutory, sort, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(r.id, r.title, "KSA", r.reports_to, r.purpose, JSON.stringify(r.responsibilities), JSON.stringify(r.kpis), JSON.stringify(r.authorities), r.statutory ? 1 : 0, i, t, t)));
    results = (await c.env.DB.prepare("SELECT * FROM roles ORDER BY sort, title").all<any>()).results;
  }
  const { results: holders } = await c.env.DB.prepare("SELECT h.role_id, h.since, h.primary_holder, u.id user_id, u.name, u.email, u.title FROM role_holders h JOIN users u ON u.id = h.user_id").all<any>();
  const { results: users } = await c.env.DB.prepare("SELECT id, name, email FROM users WHERE status != 'disabled' ORDER BY name").all<any>();
  return c.json({
    roles: results.map((r: any) => ({ ...r, responsibilities: JSON.parse(r.responsibilities), kpis: JSON.parse(r.kpis), authorities: JSON.parse(r.authorities), holders: holders.filter((h: any) => h.role_id === r.id) })),
    users,
  });
});
people.post("/roles", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  const b = await readJson<any>(c, 32_000);
  const title = str(b.title, 120);
  if (!title) return c.json({ error: "Give the role a title." }, 400);
  const id = b.id ? str(b.id, 60) : title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const list = (v: any) => JSON.stringify((Array.isArray(v) ? v : String(v || "").split("\n")).map((x: any) => str(x, 300)).filter(Boolean).slice(0, 30));
  const t = now();
  await c.env.DB.prepare(`INSERT INTO roles (id, title, entity, reports_to, purpose, responsibilities, kpis, authorities, statutory, sort, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)
    ON CONFLICT(id) DO UPDATE SET title=?2, entity=?3, reports_to=?4, purpose=?5, responsibilities=?6, kpis=?7, authorities=?8, statutory=?9, updated_at=?11`)
    .bind(id, title, ENTITIES.includes(b.entity) ? b.entity : "KSA", str(b.reports_to, 60) || null, str(b.purpose, 600), list(b.responsibilities), list(b.kpis), list(b.authorities), b.statutory ? 1 : 0, Number(b.sort) || 100, t).run();
  await c.env.DB.prepare("DELETE FROM role_holders WHERE role_id = ?").bind(id).run();
  for (const h of (Array.isArray(b.holders) ? b.holders : []).slice(0, 10)) await c.env.DB.prepare("INSERT OR IGNORE INTO role_holders (role_id, user_id, since, primary_holder) VALUES (?,?,?,1)").bind(id, str(h, 60), t.slice(0, 10)).run();
  await audit(c, c.env.DB, c.get("user").id, "roles.saved", { id });
  return c.json({ id });
});
people.post("/roles/:id/delete", async (c) => {
  if (!atLeast(c.get("user"), "admin")) return c.json({ error: "Administrators only." }, 403);
  await c.env.DB.prepare("DELETE FROM roles WHERE id = ?").bind(c.req.param("id")).run();
  await audit(c, c.env.DB, c.get("user").id, "roles.deleted", { id: c.req.param("id") });
  return c.json({ ok: true });
});
