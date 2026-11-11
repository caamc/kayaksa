-- learn.kayaksa.com schema. Learners sign up for free; staff certificates from the internal
-- portal are mirrored into `certificates` (user_id 'staff:<id>') so that every certificate
-- can be verified publicly at learn.kayaksa.com/verify.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  organisation TEXT NOT NULL DEFAULT '',
  pw_hash TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT NOT NULL,
  failed INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  last_login TEXT
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('full','pre')),
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen TEXT NOT NULL, ip TEXT, ua TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE tokens (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('verify','reset')),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT);
CREATE INDEX audit_at ON audit_log(at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE learn_progress (
  user_id TEXT NOT NULL, course_id TEXT NOT NULL, lesson_id TEXT NOT NULL, done_at TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id, lesson_id)
);
CREATE TABLE quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, course_id TEXT NOT NULL,
  score INTEGER NOT NULL, passed INTEGER NOT NULL, at TEXT NOT NULL
);
CREATE INDEX quiz_user ON quiz_attempts(user_id, course_id);
CREATE TABLE certificates (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('course','path')), ref_id TEXT NOT NULL, holder TEXT NOT NULL, title TEXT NOT NULL, issued_at TEXT NOT NULL,
  UNIQUE (user_id, kind, ref_id)
);
