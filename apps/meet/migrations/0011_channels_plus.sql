-- Channels: pinned messages, announcements, saved messages and per-channel notification levels.
ALTER TABLE messages ADD COLUMN pinned_by TEXT;
ALTER TABLE messages ADD COLUMN pinned_at TEXT;
CREATE INDEX msg_pinned ON messages(channel_id, pinned_at) WHERE pinned_at IS NOT NULL;
ALTER TABLE channel_members ADD COLUMN notify TEXT NOT NULL DEFAULT 'all';  -- all | mentions (muted = off)
CREATE TABLE saved_messages (member_id TEXT NOT NULL, message_id INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (member_id, message_id));
ALTER TABLE messages ADD COLUMN touched_at TEXT;  -- pin changes, so open screens update without marking the message edited
