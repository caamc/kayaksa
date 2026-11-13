-- Kayak GraphIQ: users and roles, cases with their legal basis and four-eyes approval, imported
-- call detail records, evidence with chain of custody, notes, bookmarks, watchlists, saved filters,
-- mapping templates, the tower master and the tamper-evident audit chain.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','approver','analyst','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  last_seen TEXT
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                        -- SHA-256 of the cookie token
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('full','pre')),
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen TEXT NOT NULL, ip TEXT, ua TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE sso_used (j TEXT PRIMARY KEY, at INTEGER NOT NULL);

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','closed','deleted')),
  legal_basis TEXT NOT NULL CHECK (legal_basis IN ('court_order','statutory_notice','own_records','written_consent','other')),
  legal_text TEXT NOT NULL,
  ref_no TEXT NOT NULL,
  ref_date TEXT NOT NULL,
  authority TEXT NOT NULL,
  supervisor TEXT NOT NULL,                   -- the approving supervisor named on the request
  notice_version TEXT NOT NULL,               -- the lawful-use notice acknowledged at creation
  tz TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  cc TEXT NOT NULL DEFAULT '91',
  retain_until TEXT,                          -- date after which the case is due for secure deletion
  shard TEXT NOT NULL DEFAULT 'DB',           -- D1 binding that holds this case's records
  settings TEXT,
  record_count INTEGER NOT NULL DEFAULT 0,
  restored_from TEXT,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  decided_by TEXT, decided_at TEXT, decision_note TEXT,
  deleted_by TEXT, deleted_at TEXT
);
CREATE INDEX cases_status ON cases(status);
CREATE TABLE case_members (case_id TEXT NOT NULL, user_id TEXT NOT NULL, added_by TEXT, added_at TEXT NOT NULL, PRIMARY KEY (case_id, user_id));
CREATE INDEX members_user ON case_members(user_id);

CREATE TABLE imports (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, file_name TEXT NOT NULL, format TEXT, layout TEXT, sha256 TEXT, size INTEGER,
  evidence_id TEXT, mapping TEXT, validation TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','complete','removed')),
  records INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT
);
CREATE INDEX imports_case ON imports(case_id);

CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL, import_id TEXT NOT NULL,
  a TEXT NOT NULL, b TEXT, ts INTEGER NOT NULL, dur INTEGER NOT NULL DEFAULT 0, type TEXT NOT NULL,
  imei TEXT, imsi TEXT, cell TEXT, last_cell TEXT, lac TEXT, lat REAL, lon REAL, roam TEXT, op TEXT,
  src TEXT, src_row INTEGER
);
CREATE INDEX records_case_ts ON records(case_id, ts);
CREATE INDEX records_case_a ON records(case_id, a);
CREATE INDEX records_case_b ON records(case_id, b);
CREATE INDEX records_case_imei ON records(case_id, imei);
CREATE INDEX records_case_cell ON records(case_id, cell);
CREATE INDEX records_import ON records(import_id);

CREATE TABLE evidence (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('source','attachment')),
  file_name TEXT NOT NULL, mime TEXT, size INTEGER NOT NULL, sha256 TEXT NOT NULL, r2_key TEXT NOT NULL,
  note TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX evidence_case ON evidence(case_id);
CREATE TABLE custody (id INTEGER PRIMARY KEY AUTOINCREMENT, evidence_id TEXT NOT NULL, case_id TEXT NOT NULL, at TEXT NOT NULL, user_id TEXT, user_email TEXT, action TEXT NOT NULL, detail TEXT);
CREATE INDEX custody_ev ON custody(evidence_id, id);

CREATE TABLE notes (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('note','osint')), body TEXT NOT NULL, source TEXT, evidence_id TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX notes_case ON notes(case_id);
CREATE TABLE bookmarks (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, record_id INTEGER, number TEXT, tag TEXT NOT NULL, note TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX bookmarks_case ON bookmarks(case_id);
CREATE TABLE watchlist (case_id TEXT NOT NULL, number TEXT NOT NULL, list TEXT NOT NULL CHECK (list IN ('black','white')), label TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (case_id, number));
CREATE TABLE saved_filters (id TEXT PRIMARY KEY, case_id TEXT, user_id TEXT NOT NULL, name TEXT NOT NULL, filter TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, mapping TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE towers (cell TEXT PRIMARY KEY, lat REAL NOT NULL, lon REAL NOT NULL, address TEXT, azimuth REAL, source TEXT, updated_by TEXT, updated_at TEXT NOT NULL);

-- Tamper-evident audit: hash = sha256(prev_hash + canonical entry). Never updated or deleted by the app.
CREATE TABLE audit_chain (
  seq INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id TEXT, user_email TEXT, case_id TEXT, action TEXT NOT NULL, detail TEXT,
  ip TEXT, prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE INDEX audit_chain_case ON audit_chain(case_id, seq);

-- Kayak Shield (packages/core/src/shield.ts) and rate limits
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT, ua TEXT, fp TEXT);
CREATE TABLE security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, site TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, ip TEXT, fp TEXT, ua TEXT, path TEXT, user_id TEXT, detail TEXT);
CREATE INDEX sec_at ON security_events(at);
CREATE TABLE ip_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, fp TEXT, site TEXT, reason TEXT, created_at TEXT NOT NULL, until INTEGER NOT NULL, lifted_at TEXT, lifted_by TEXT);
CREATE INDEX blocks_ip ON ip_blocks(ip, until);
CREATE INDEX blocks_fp ON ip_blocks(fp, until);
