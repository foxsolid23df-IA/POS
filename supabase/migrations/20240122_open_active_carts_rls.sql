DROP POLICY IF EXISTS "Authenticated users can CRUD active_carts" ON active_carts;
DROP POLICY IF EXISTS "Allow anonymous read access to active_carts" ON active_carts;
CREATE POLICY "Public users can CRUD active_carts" ON active_carts FOR ALL TO public USING (true) WITH CHECK (true);
