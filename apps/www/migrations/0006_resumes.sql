-- Careers: a résumé (PDF or Word, up to 2 MB) attached to an application, kept in the private kayaksa-careers bucket.
ALTER TABLE enquiries ADD COLUMN resume_key TEXT;
ALTER TABLE enquiries ADD COLUMN resume_name TEXT;
ALTER TABLE enquiries ADD COLUMN resume_size INTEGER;
