-- Kayak Meet: meetings, attendance, transcripts, minutes, recordings, feedback and the improvement log.
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'meeting',      -- meeting (internal) | client | webinar
  host_email TEXT NOT NULL,
  host_name TEXT NOT NULL,
  starts_at TEXT,
  duration_min INTEGER NOT NULL DEFAULT 30,
  lobby INTEGER NOT NULL DEFAULT 1,
  invitees TEXT,                              -- JSON list of emails
  status TEXT NOT NULL DEFAULT 'scheduled',   -- scheduled | live | ended | cancelled
  created_by TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  peak INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX meetings_start ON meetings(starts_at);
CREATE TABLE attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, meeting_id TEXT NOT NULL, peer TEXT NOT NULL, name TEXT NOT NULL, email TEXT, role TEXT NOT NULL, joined_at TEXT NOT NULL, left_at TEXT);
CREATE INDEX attendance_m ON attendance(meeting_id);
CREATE TABLE transcript (id INTEGER PRIMARY KEY AUTOINCREMENT, meeting_id TEXT NOT NULL, at TEXT NOT NULL, speaker TEXT NOT NULL, text TEXT NOT NULL);
CREATE INDEX transcript_m ON transcript(meeting_id, id);
CREATE TABLE minutes (meeting_id TEXT PRIMARY KEY, summary TEXT NOT NULL, created_at TEXT NOT NULL, model TEXT);
CREATE TABLE recordings (id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL, r2_key TEXT NOT NULL, upload_id TEXT, parts TEXT, size INTEGER NOT NULL DEFAULT 0, by_name TEXT, started_at TEXT NOT NULL, ended_at TEXT, status TEXT NOT NULL DEFAULT 'recording');
CREATE INDEX recordings_m ON recordings(meeting_id);
CREATE TABLE feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, meeting_id TEXT NOT NULL, name TEXT, role TEXT, overall INTEGER NOT NULL, audio INTEGER, video INTEGER, ease INTEGER, issues TEXT, comment TEXT, stats TEXT, at TEXT NOT NULL);
CREATE INDEX feedback_at ON feedback(at);
CREATE TABLE improvements (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, evidence TEXT, status TEXT NOT NULL DEFAULT 'proposed', decided_by TEXT, decided_at TEXT);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT, ua TEXT, fp TEXT);
CREATE INDEX audit_at ON audit_log(at);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
CREATE TABLE security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, site TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, ip TEXT, fp TEXT, ua TEXT, path TEXT, user_id TEXT, detail TEXT);
CREATE INDEX sec_at ON security_events(at);
CREATE TABLE ip_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, fp TEXT, site TEXT, reason TEXT, created_at TEXT NOT NULL, until INTEGER NOT NULL, lifted_at TEXT, lifted_by TEXT);
CREATE INDEX blocks_ip ON ip_blocks(ip, until);
CREATE INDEX blocks_fp ON ip_blocks(fp, until);
