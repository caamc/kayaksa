-- Confluence issues drafted in the internal portal. Only rows with status 'released' are public.
CREATE TABLE editions (
  id TEXT PRIMARY KEY,                 -- e.g. 2026-12
  status TEXT NOT NULL DEFAULT 'drafting', -- drafting | draft | submitted | released | withdrawn
  data TEXT,                           -- the edition as JSON (see apps/www/content/editions)
  pipeline TEXT,                       -- drafting progress and research notes
  spotlight_tool TEXT,
  preview_token TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  submitted_by TEXT, submitted_at TEXT,
  approved_by TEXT, approved_at TEXT, released_at TEXT,
  emailed_at TEXT, emailed_count INTEGER,
  history TEXT                         -- JSON list of {at, by, action, note}
);
