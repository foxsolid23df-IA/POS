-- Add auto_add_to_cart feature flag to profiles table
-- When true: products are added directly to cart on scan/search,
-- and +/- keys adjust quantity of selected cart item
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS auto_add_to_cart boolean NOT NULL DEFAULT false;
