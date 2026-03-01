-- Add is_main column to terminals table to identify the main register
ALTER TABLE terminals 
ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT false;

-- Add terminal_id to cash_cuts to track which terminal performed the cut
ALTER TABLE cash_cuts 
ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES terminals(id);

-- Optional: Create an index for performance
CREATE INDEX IF NOT EXISTS idx_cash_cuts_terminal ON cash_cuts(terminal_id);

-- Optional: Set the first terminal as main by default if none exists
-- UPDATE terminals SET is_main = true WHERE id = (SELECT id FROM terminals LIMIT 1);
