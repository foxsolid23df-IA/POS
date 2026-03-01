-- Remove the partial unique index
DROP INDEX IF EXISTS active_carts_session_id_idx;

-- Add a standard unique constraint on session_id
-- Postgres allows multiple NULL values in a unique column, so this is safe for rows without a session
ALTER TABLE active_carts DROP CONSTRAINT IF EXISTS active_carts_session_id_key;
ALTER TABLE active_carts ADD CONSTRAINT active_carts_session_id_key UNIQUE (session_id);
