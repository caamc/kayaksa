-- Cookieless page statistics (no cookies, no identifiers), read by the internal dashboards.
CREATE TABLE IF NOT EXISTS stat_views (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path));
CREATE TABLE IF NOT EXISTS stat_dims (day TEXT NOT NULL, dim TEXT NOT NULL, value TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, dim, value));
CREATE TABLE IF NOT EXISTS stat_vitals (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, path TEXT NOT NULL, lcp INTEGER, cls REAL, inp INTEGER, ttfb INTEGER);
