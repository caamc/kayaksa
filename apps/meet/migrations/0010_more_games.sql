-- Kayakers: seven more games (Snakes & Ladders, Ludo, Tic Tac Toe, Kayak Estates, Kayak Flip,
-- Kayak Wordsmith, Kayak Rows). SQLite can't change a CHECK constraint, so the table is rebuilt.
CREATE TABLE spaces_new (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('board','chess','carrom','four','snakes','ludo','ttt','estates','flip','words','rows')),
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'team',
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
INSERT INTO spaces_new SELECT id, kind, title, mode, created_by, created_by_name, created_at, updated_at, archived FROM spaces;
DROP TABLE spaces;
ALTER TABLE spaces_new RENAME TO spaces;
CREATE INDEX spaces_kind ON spaces(kind, updated_at);
