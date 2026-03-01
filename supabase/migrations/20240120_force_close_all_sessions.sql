-- FORCE CLOSE ALL OPEN SESSIONS
-- Use this to reset the testing environment. 
-- It closes all currently 'open' cash sessions, setting them to 'closed' with the current timestamp.

UPDATE cash_sessions 
SET status = 'closed', 
    closed_at = NOW() 
WHERE status = 'open';
