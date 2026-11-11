-- Live translation to English: the English version of each caption and the language it was spoken in.
ALTER TABLE transcript ADD COLUMN text_en TEXT;
ALTER TABLE transcript ADD COLUMN lang TEXT;
