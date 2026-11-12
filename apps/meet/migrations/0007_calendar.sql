-- Two-way calendar sync (Outlook and Google). Tokens are stored encrypted (AES-GCM).
CREATE TABLE cal_links (
  member_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('microsoft','google')),
  account TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  cache TEXT,
  error TEXT,
  PRIMARY KEY (member_id, provider)
);
-- Which calendar event belongs to which Meet meeting, per person and calendar.
CREATE TABLE cal_events (
  meeting_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  start_at TEXT,
  PRIMARY KEY (meeting_id, member_id, provider)
);
CREATE INDEX cal_events_member ON cal_events(member_id, provider);
