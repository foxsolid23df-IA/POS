-- Add licensing fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_type text DEFAULT 'monocaja';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_registers int DEFAULT 1;

-- Add licensing fields to invitation_codes
ALTER TABLE public.invitation_codes ADD COLUMN IF NOT EXISTS license_type text DEFAULT 'monocaja';
ALTER TABLE public.invitation_codes ADD COLUMN IF NOT EXISTS max_registers int DEFAULT 1;

-- Refresh schema cache if needed
NOTIFY pgrst, 'reload schema';
