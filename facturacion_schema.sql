-- ==============================================================================
-- Esquema de Facturación (Versión Final - Autodetectable)
-- ==============================================================================

-- 0. Limpiar tablas existentes para asegurar que se creen con el tipo correcto
DROP TABLE IF EXISTS public.invoices;

-- 1. Crear tabla de clientes (UUID)
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rfc text NOT NULL UNIQUE,
    razon_social text NOT NULL,
    regimen_fiscal text NOT NULL, 
    codigo_postal text NOT NULL,
    email text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Detección automática del tipo de ID de la tabla de ventas
DO $$ 
DECLARE
    sales_id_type text;
BEGIN
    SELECT data_type INTO sales_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'id' AND table_schema = 'public';

    IF sales_id_type IS NULL THEN
        RAISE EXCEPTION 'La tabla sales no existe en este proyecto.';
    END IF;

    -- Creamos la tabla invoices con el tipo de dato que detectamos en 'sales'
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.invoices (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        sale_id %s REFERENCES public.sales(id),
        client_id uuid REFERENCES public.clients(id),
        facturama_id text,
        folio text,
        serie text,
        uuid_fiscal text,
        xml_url text,
        pdf_url text,
        status text DEFAULT ''ACTIVO'',
        total numeric,
        created_at timestamptz DEFAULT now()
    )', sales_id_type);
END $$;

-- 3. Inyectar columnas de facturación a la tabla de VENTAS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='ticket_uuid') THEN
        ALTER TABLE public.sales ADD COLUMN ticket_uuid uuid DEFAULT gen_random_uuid();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='pin_facturacion') THEN
        ALTER TABLE public.sales ADD COLUMN pin_facturacion text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='facturado') THEN
        ALTER TABLE public.sales ADD COLUMN facturado boolean DEFAULT false;
    END IF;
END $$;

-- 4. Función y Trigger para el PIN
CREATE OR REPLACE FUNCTION generate_billing_pin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pin_facturacion IS NULL THEN
        NEW.pin_facturacion := LPAD(floor(random() * 10000)::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_billing_pin ON public.sales;
CREATE TRIGGER trigger_generate_billing_pin
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION generate_billing_pin();
