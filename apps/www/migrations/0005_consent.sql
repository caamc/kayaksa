-- 16 · Enquiries via Kay: record which notice the visitor agreed to, plus Kay's triage.
ALTER TABLE enquiries ADD COLUMN notice_version TEXT NOT NULL DEFAULT '';
ALTER TABLE enquiries ADD COLUMN purpose TEXT NOT NULL DEFAULT '';
ALTER TABLE enquiries ADD COLUMN summary TEXT NOT NULL DEFAULT '';
ALTER TABLE enquiries ADD COLUMN owner TEXT NOT NULL DEFAULT '';
-- 19 · Behaviour-based consent: one row per decision. The visitor is a random id kept in their
-- browser; no name, email or IP is stored with a decision.
CREATE TABLE consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vid TEXT NOT NULL, purpose TEXT NOT NULL, granted INTEGER NOT NULL,
  trigger TEXT NOT NULL DEFAULT '', notice_version TEXT NOT NULL, page TEXT NOT NULL DEFAULT '', at TEXT NOT NULL
);
CREATE INDEX consents_at ON consents(at);
CREATE INDEX consents_vid ON consents(vid, purpose);
