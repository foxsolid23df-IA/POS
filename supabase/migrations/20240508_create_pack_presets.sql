-- MIGRACIÓN PARA PRESETS DE EMPAQUE AL VUELO
-- Esta tabla permite guardar configuraciones comunes de empaque (piezas y precio) por producto

CREATE TABLE IF NOT EXISTS public.pack_presets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    units numeric NOT NULL,
    price numeric NOT NULL,
    label text,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Un usuario no debería tener presets duplicados (mismas piezas y precio) para el mismo producto
    CONSTRAINT unique_product_preset UNIQUE(product_id, units, price, user_id)
);

-- Habilitar RLS
ALTER TABLE public.pack_presets ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view their own presets"
ON public.pack_presets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presets"
ON public.pack_presets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own presets"
ON public.pack_presets FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_pack_presets_product_id ON public.pack_presets(product_id);
CREATE INDEX IF NOT EXISTS idx_pack_presets_user_id ON public.pack_presets(user_id);
