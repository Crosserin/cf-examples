-- 0001_init.sql
-- Creates the guestbook table.

CREATE TABLE IF NOT EXISTS entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  country    TEXT,
  created_at INTEGER NOT NULL   -- unix epoch seconds
);

CREATE INDEX IF NOT EXISTS idx_entries_created_at
  ON entries(created_at DESC);
