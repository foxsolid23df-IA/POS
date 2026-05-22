-- Crear tabla de clientes para POS
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    rfc text DEFAULT '',
    phone text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
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
    EXECUTE FUNCTION update_updated_at_column();

-- RLS: habilitar seguridad
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
CREATE POLICY "Usuarios autenticados pueden leer clientes"
    ON public.customers
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar clientes"
    ON public.customers
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar clientes"
    ON public.customers
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar clientes"
    ON public.customers
    FOR DELETE
    TO authenticated
    USING (true);
