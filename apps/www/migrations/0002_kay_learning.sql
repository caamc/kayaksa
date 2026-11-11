-- Kay's learning layer: vetted answers (memory), anonymised questions, and cost counters.
CREATE TABLE kay_memory (
  id TEXT PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, voice_answer TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'seed', asked INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  indexed INTEGER NOT NULL DEFAULT 0, hits INTEGER NOT NULL DEFAULT 0, last_hit TEXT,
  created_at TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT
);
CREATE TABLE kay_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, question TEXT NOT NULL, page TEXT NOT NULL DEFAULT '', answered_by TEXT NOT NULL, turn INTEGER NOT NULL DEFAULT 1);
CREATE INDEX kay_questions_at ON kay_questions(at);
CREATE TABLE kay_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, rating INTEGER NOT NULL, question TEXT NOT NULL DEFAULT '', answer TEXT NOT NULL DEFAULT '', comment TEXT NOT NULL DEFAULT '');
ALTER TABLE kay_usage ADD COLUMN tts_cached INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kay_usage ADD COLUMN memory_hits INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kay_usage ADD COLUMN lite INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kay_usage ADD COLUMN claude INTEGER NOT NULL DEFAULT 0;
