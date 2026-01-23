-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can CRUD own active_carts" ON active_carts;

-- Create a more permissive policy for authenticated users
-- This allows staff members to update carts causing RLS conflicts when sharing terminals/sessions
-- In a perfect SaaS world we'd link this to an Organization ID, but for now this unblocks the operation.
CREATE POLICY "Authenticated users can CRUD active_carts"
ON active_carts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
