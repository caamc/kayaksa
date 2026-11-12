-- Kayakers: collaborative whiteboards and team games. Each space's content lives in its own Durable
-- Object (Space); this table lists them.
CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('board','chess','carrom','four')),
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'team',      -- games: 'team' (play colleagues) or 'ai'
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX spaces_kind ON spaces(kind, updated_at);
