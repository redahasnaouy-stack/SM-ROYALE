CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (collection, key)
);
