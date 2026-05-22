-- =====================================================
-- MIGRACIÓN: Agregar columnas faltantes a customers
-- Fecha: 2026-05-14
-- Problema: La tabla customers existe pero le faltan
--           las columnas rfc y phone (PGRST204 error).
-- =====================================================

-- Agregar columna rfc si no existe
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS rfc text DEFAULT '';

-- Agregar columna phone si no existe
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone text DEFAULT '';

-- Agregar user_id para aislamiento multi-tenant (por si no existe)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users DEFAULT auth.uid();

-- Asegurarse que updated_at existe
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();

-- Confirmar estado final
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'customers'
ORDER BY ordinal_position;
