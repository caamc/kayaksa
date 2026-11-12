-- Document Drive: encrypted identity, address, KYC, KYB and KYV documents with OCR and maker-checker QC.
CREATE TABLE vault_docs (
  id TEXT PRIMARY KEY,
  master_kind TEXT, master_id TEXT REFERENCES masters(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL, file_name TEXT NOT NULL DEFAULT '', mime TEXT NOT NULL DEFAULT '', size INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL, r2_key TEXT, stored INTEGER NOT NULL DEFAULT 0, -- 0 when the law says the file may not be kept
  ocr TEXT NOT NULL DEFAULT '', -- sealed JSON of the extracted fields
  qc TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'qc' CHECK (status IN ('qc','approved','rejected','erased')), note TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT, approved_by TEXT, approved_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX vault_docs_master ON vault_docs(master_id, created_at);
CREATE INDEX vault_docs_status ON vault_docs(status);
CREATE UNIQUE INDEX vault_docs_sha ON vault_docs(sha256);
CREATE TABLE vault_access (id INTEGER PRIMARY KEY AUTOINCREMENT, doc_id TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', at TEXT NOT NULL);
CREATE INDEX vault_access_doc ON vault_access(doc_id, id);
