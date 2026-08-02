-- Migration 004: Video call sessions (LiveKit).
-- Run in Supabase SQL Editor after migration_001, 002, and 003.
--
-- Note: we log call metadata only (who/when/how long) for safety/audit
-- purposes (Safety Center can show "recent calls" if a user reports someone
-- after a bad video call). We never store call content — LiveKit media is
-- not recorded or persisted anywhere by this app.

CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing', -- ringing, accepted, declined, missed, ended
  started_at TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_match ON call_sessions(match_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON call_sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_callee ON call_sessions(callee_id);
