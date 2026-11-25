CREATE TABLE transcripts (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text       TEXT        NOT NULL CHECK (length(btrim(text)) > 0),
  language   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transcripts_created_at_idx ON transcripts (created_at DESC, id DESC);
