    -- Add show_billing_section and qr_code_size columns to ticket_settings table
ALTER TABLE ticket_settings 
ADD COLUMN IF NOT EXISTS show_billing_section BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS qr_code_size TEXT DEFAULT 'medium';

COMMENT ON COLUMN ticket_settings.show_billing_section IS 'Mostrar sección de facturación con código QR en ticket';
COMMENT ON COLUMN ticket_settings.qr_code_size IS 'Tamaño del código QR de facturación';
