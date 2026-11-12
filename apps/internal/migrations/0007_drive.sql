-- Document Drive storage in the "Kayak Document Drive" Google shared drive. One row: the connection.
-- The refresh token is sealed with the personal-data key; files themselves are encrypted before upload.
CREATE TABLE drive_link (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  account TEXT,
  refresh TEXT NOT NULL,
  drive_id TEXT,
  drive_name TEXT,
  folder_id TEXT,
  connected_by TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  error TEXT
);
