-- Migration: Add Folio Limits and Auto-increment Trigger
-- Adds columns to track billing folios per client and creates a trigger to automatically update consumption.

-- 1. Add columns to public.invitation_codes
ALTER TABLE public.invitation_codes 
ADD COLUMN IF NOT EXISTS allocated_folios INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consumed_folios INTEGER NOT NULL DEFAULT 0;

-- 2. Create function to increment consumed_folios
CREATE OR REPLACE FUNCTION public.increment_invitation_consumed_folios()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.invitation_codes
    SET consumed_folios = consumed_folios + 1
    WHERE used_by = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger on invoices table
DROP TRIGGER IF EXISTS tr_increment_consumed_folios ON public.invoices;
CREATE TRIGGER tr_increment_consumed_folios
AFTER INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.increment_invitation_consumed_folios();
