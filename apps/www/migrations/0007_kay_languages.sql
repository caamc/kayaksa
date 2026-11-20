-- 20 · Kay in many languages. What Kay hears is kept (sealed) for validation and for training Kayak's AI,
-- only after the visitor accepts the voice notice. The audio is in R2 (kayaksa-kay-voice), sealed with
-- KAY_VOICE_KEY; the transcript is sealed here. No name, email or IP: the visitor is a random browser id,
-- and ip_hash is a salted, per-day hash used only to stop abuse.
CREATE TABLE kay_recordings (
  id TEXT PRIMARY KEY, at TEXT NOT NULL, vid TEXT NOT NULL, mode TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'auto',
  heard_lang TEXT NOT NULL DEFAULT '', duration_ms INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0,
  mime TEXT NOT NULL, r2_key TEXT NOT NULL, transcript TEXT NOT NULL DEFAULT '', engine TEXT NOT NULL DEFAULT '',
  notice_version TEXT NOT NULL, page TEXT NOT NULL DEFAULT '', ip_hash TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'kept' CHECK (status IN ('kept','validated','training','rejected','legal_hold','released','deleted')),
  corrected TEXT NOT NULL DEFAULT '', review_note TEXT NOT NULL DEFAULT '', reviewed_by TEXT, reviewed_at TEXT,
  retain_until TEXT NOT NULL, hold_reason TEXT NOT NULL DEFAULT '',
  released_at TEXT, released_by TEXT, release_basis TEXT, release_ref TEXT, release_to TEXT,
  deleted_at TEXT, deleted_reason TEXT
);
CREATE INDEX kay_recordings_at ON kay_recordings(at);
CREATE INDEX kay_recordings_vid ON kay_recordings(vid);
CREATE INDEX kay_recordings_status ON kay_recordings(status, retain_until);
ALTER TABLE kay_usage ADD COLUMN voice_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kay_usage ADD COLUMN translations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kay_usage ADD COLUMN kayak_ai INTEGER NOT NULL DEFAULT 0;
