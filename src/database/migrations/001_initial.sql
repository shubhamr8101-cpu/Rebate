PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  total_invites INTEGER NOT NULL DEFAULT 0 CHECK (total_invites >= 0),
  valid_invites INTEGER NOT NULL DEFAULT 0 CHECK (valid_invites >= 0),
  fake_invites INTEGER NOT NULL DEFAULT 0 CHECK (fake_invites >= 0),
  left_invites INTEGER NOT NULL DEFAULT 0 CHECK (left_invites >= 0),
  bonus_invites INTEGER NOT NULL DEFAULT 0 CHECK (bonus_invites >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS invite_codes (
  guild_id TEXT NOT NULL,
  code TEXT NOT NULL,
  inviter_id TEXT,
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  is_vanity INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, code)
);

CREATE TABLE IF NOT EXISTS invited_members (
  guild_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  inviter_id TEXT,
  invite_code TEXT,
  joined_at TEXT NOT NULL,
  account_created_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('valid', 'fake', 'left', 'rejoined', 'unattributed', 'bot')
  ),
  counted INTEGER NOT NULL DEFAULT 0,
  left_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, member_id)
);

CREATE TABLE IF NOT EXISTS invite_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  member_id TEXT,
  inviter_id TEXT,
  invite_code TEXT,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('join', 'leave', 'rejoin', 'bonus_add', 'bonus_remove', 'reset')
  ),
  status TEXT,
  amount INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invited_members_inviter
  ON invited_members (guild_id, inviter_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_inviter
  ON invite_transactions (guild_id, inviter_id, created_at DESC);