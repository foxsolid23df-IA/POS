-- Agregar columna show_taxes para controlar visibilidad de impuestos en pantalla del cliente
ALTER TABLE public.active_carts
  ADD COLUMN IF NOT EXISTS show_taxes boolean DEFAULT false;
