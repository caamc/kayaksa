-- Cloudflare Realtime usage per billing period, for the monthly limits in src/usage.ts.
CREATE TABLE usage (period TEXT NOT NULL, metric TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, PRIMARY KEY (period, metric));
CREATE TABLE usage_alerts (period TEXT NOT NULL, metric TEXT NOT NULL, level INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (period, metric, level));
