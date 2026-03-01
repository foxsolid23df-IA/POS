-- Drop the unique constraint on user_id to allow multiple carts per user (multicaja support)
ALTER TABLE active_carts DROP CONSTRAINT IF EXISTS active_carts_user_id_key;

-- Add a unique constraint on session_id to ensure one active cart per cash session
-- We only enforce this where session_id is NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS active_carts_session_id_idx ON active_carts (session_id) WHERE session_id IS NOT NULL;
