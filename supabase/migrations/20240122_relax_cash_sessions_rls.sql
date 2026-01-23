DROP POLICY IF EXISTS "Users can CRUD own cash_sessions" ON cash_sessions;
CREATE POLICY "Public users can CRUD cash_sessions" ON cash_sessions FOR ALL TO public USING (true) WITH CHECK (true);
