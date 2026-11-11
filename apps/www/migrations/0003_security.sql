-- Kayak Shield: security events, 4-hour blocks, and richer audit entries.
CREATE TABLE IF NOT EXISTS security_events (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, site TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, ip TEXT, fp TEXT, ua TEXT, path TEXT, user_id TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS sec_at ON security_events(at);
CREATE TABLE IF NOT EXISTS ip_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, fp TEXT, site TEXT, reason TEXT, created_at TEXT NOT NULL, until INTEGER NOT NULL, lifted_at TEXT, lifted_by TEXT);
CREATE INDEX IF NOT EXISTS blocks_ip ON ip_blocks(ip, until);
CREATE INDEX IF NOT EXISTS blocks_fp ON ip_blocks(fp, until);
ALTER TABLE audit_log ADD COLUMN ua TEXT;
ALTER TABLE audit_log ADD COLUMN fp TEXT;
