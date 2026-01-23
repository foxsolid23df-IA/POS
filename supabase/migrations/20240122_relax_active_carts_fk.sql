-- Drop the session_id foreign key constraint from active_carts
-- This allows the Customer Display to work even if the session ID is temporary or offline
ALTER TABLE active_carts DROP CONSTRAINT IF EXISTS active_carts_session_id_fkey;

-- Ensure the index is still there (it should be, but good to be safe)
CREATE UNIQUE INDEX IF NOT EXISTS active_carts_session_id_idx ON active_carts (session_id) WHERE session_id IS NOT NULL;
