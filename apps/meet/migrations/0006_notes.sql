-- Notes.AI: how sure the speech model was of the language it detected, and which breakout room a line came from.
ALTER TABLE transcript ADD COLUMN conf REAL;
ALTER TABLE transcript ADD COLUMN room TEXT;
