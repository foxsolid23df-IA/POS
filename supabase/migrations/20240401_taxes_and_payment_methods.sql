-- migrations/20240401_taxes_and_payment_methods.sql

-- 1. Create payment_methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Habilitar RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own payment methods"
    ON public.payment_methods FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods"
    ON public.payment_methods FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
    ON public.payment_methods FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods"
    ON public.payment_methods FOR DELETE
    USING (auth.uid() = user_id);

-- 2. Alter profiles for taxes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC DEFAULT 0;

-- 3. Alter sales for taxes and subtotal
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;

-- 4. Alter cash_cuts for dynamic payment methods mapping
ALTER TABLE public.cash_cuts ADD COLUMN IF NOT EXISTS payment_totals JSONB DEFAULT '{}'::jsonb;

-- NOTA: No insertaremos métodos de pago estáticos para cada usuario aquí,
-- la UI del Frontend debería encargarse de insertar: Efectivo, Tarjeta, Transferencia
-- la primera vez que inicia sesión o de listarlos por default si está vacío.
