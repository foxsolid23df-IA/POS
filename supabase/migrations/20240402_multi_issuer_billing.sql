-- Migration: Multi-Issuer Billing Scheme
-- Creates tables for issuer data, portal configuration, and associates terminals to portals

CREATE TABLE IF NOT EXISTS public.billing_issuers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rfc VARCHAR(13) NOT NULL,
    razon_social VARCHAR(255) NOT NULL,
    regimen_fiscal VARCHAR(10) NOT NULL,
    codigo_postal VARCHAR(10) NOT NULL,
    is_csd_loaded BOOLEAN DEFAULT FALSE,
    sucursal_nombre VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.billing_issuers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own billing issuers"
    ON public.billing_issuers
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.billing_portals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    billing_issuer_id UUID REFERENCES public.billing_issuers(id) ON DELETE SET NULL,
    nombre_marca VARCHAR(150) NOT NULL DEFAULT 'Mi Marca',
    email_contacto VARCHAR(255),
    telefono_contacto VARCHAR(20),
    logo_url TEXT,
    brand_color VARCHAR(20) DEFAULT '#000000',
    limite_tipo VARCHAR(50) DEFAULT 'ninguno', -- 'mes_consumo', 'dias', 'ninguno'
    limite_dias INTEGER DEFAULT 0,
    agrupar_conceptos BOOLEAN DEFAULT FALSE,
    clave_servicio_agrupada VARCHAR(20) DEFAULT '01010101',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.billing_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own billing portals"
    ON public.billing_portals
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Associate terminals directly to a billing portal (and thus, an issuer)
ALTER TABLE public.terminals 
ADD COLUMN IF NOT EXISTS billing_portal_id UUID REFERENCES public.billing_portals(id) ON DELETE SET NULL;

-- Associate sales directly to an issuer (for manual selection upon checkout)
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS billing_issuer_id UUID REFERENCES public.billing_issuers(id) ON DELETE SET NULL;
