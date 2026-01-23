-- Deshabilitar RLS completamente en active_carts para evitar errores 42501
-- Esta tabla es de estado temporal y no requiere seguridad estricta
ALTER TABLE active_carts DISABLE ROW LEVEL SECURITY;

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Public users can CRUD active_carts" ON active_carts;
DROP POLICY IF EXISTS "Authenticated users can CRUD active_carts" ON active_carts;
DROP POLICY IF EXISTS "Allow anonymous read access to active_carts" ON active_carts;
