-- Migration: Add cc_enable_day_cut column to ticket_settings table to allow toggling Day Cut functionality
--
ALTER TABLE public.ticket_settings 
ADD COLUMN IF NOT EXISTS cc_enable_day_cut BOOLEAN DEFAULT TRUE;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
