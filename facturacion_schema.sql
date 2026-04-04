-- ==========================================
-- MIGRACIÓN BASE DE DATOS PARA FACTURACIÓN (FC)
-- ==========================================

-- 1. EXTENSIÓN DE TABLA 'profiles' (Configuración Fiscal de la Tienda)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS emisor_rfc text,
  ADD COLUMN IF NOT EXISTS emisor_id_facturador bigint,
  ADD COLUMN IF NOT EXISTS facturador_api_user text,
  ADD COLUMN IF NOT EXISTS facturador_api_pass_md5 text,
  ADD COLUMN IF NOT EXISTS facturador_client_id text,
  ADD COLUMN IF NOT EXISTS facturador_client_secret text,
  ADD COLUMN IF NOT EXISTS facturador_refresh_token text;

-- 2. EXTENSIÓN DE TABLA 'sales' (Generación de código para Auto-Facturar)
-- Aseguramos que pgcrypto esté activo para gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS ticket_uuid uuid DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS pin_facturacion text,
  ADD COLUMN IF NOT EXISTS facturado boolean DEFAULT false;

-- Trigger para generar un PIN fácil (5 letras/números) al insertar una venta
CREATE OR REPLACE FUNCTION generate_facturacion_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pin_facturacion IS NULL THEN
    -- Generar PIN alfanumérico simple
    NEW.pin_facturacion := upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_facturacion_pin ON public.sales;
CREATE TRIGGER trigger_generate_facturacion_pin
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION generate_facturacion_pin();

-- 3. CREAR TABLA 'clients' (Catálogo de Clientes Fiscales)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(), -- Tienda dueña del cliente
  rfc text NOT NULL,
  razon_social text NOT NULL,
  uso_cfdi text NOT NULL,
  regimen_fiscal text NOT NULL,
  codigo_postal text NOT NULL,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS para clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own clients" ON public.clients
  FOR ALL USING (auth.uid() = user_id);

-- 4. CREAR TABLA 'invoices' (Facturas Emitidas / CFDI 4.0)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id bigint REFERENCES public.sales(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(), -- Tienda
  uuid_cfdi text NOT NULL UNIQUE, -- Folio Fiscal UUID del SAT
  emisor_rfc text NOT NULL,
  cliente_rfc text NOT NULL,
  pdf_url text, -- Storage link
  xml_url text, -- Storage link
  total numeric not null,
  status text DEFAULT 'VIGENTE', -- VIGENTE | CANCELADO
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS para invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own invoices" ON public.invoices
  FOR ALL USING (auth.uid() = user_id);

-- STORAGE (Para XML y PDF)
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false) ON CONFLICT DO NOTHING;
CREATE POLICY "Users can read own folder invoices" ON storage.objects FOR SELECT USING ( bucket_id = 'invoices' AND auth.role() = 'authenticated' );
CREATE POLICY "Users can upload to invoices folder" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'invoices' AND auth.role() = 'authenticated' );
