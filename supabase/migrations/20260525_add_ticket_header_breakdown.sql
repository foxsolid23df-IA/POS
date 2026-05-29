-- Agregar columnas para desglose del encabezado del ticket
ALTER TABLE ticket_settings
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS rfc TEXT,
ADD COLUMN IF NOT EXISTS curp TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS show_business_name BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_owner_name BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_rfc BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_curp BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_address BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_footer BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN ticket_settings.owner_name IS 'Nombre del propietario o razón social fiscal';
COMMENT ON COLUMN ticket_settings.rfc IS 'Registro Federal de Contribuyentes (RFC)';
COMMENT ON COLUMN ticket_settings.curp IS 'Clave Única de Registro de Población (CURP)';
COMMENT ON COLUMN ticket_settings.email IS 'Correo electrónico del negocio';
COMMENT ON COLUMN ticket_settings.show_business_name IS 'Mostrar nombre comercial en el ticket';
COMMENT ON COLUMN ticket_settings.show_owner_name IS 'Mostrar nombre del propietario en el ticket';
COMMENT ON COLUMN ticket_settings.show_rfc IS 'Mostrar RFC en el ticket';
COMMENT ON COLUMN ticket_settings.show_curp IS 'Mostrar CURP en el ticket';
COMMENT ON COLUMN ticket_settings.show_email IS 'Mostrar correo electrónico en el ticket';
COMMENT ON COLUMN ticket_settings.show_address IS 'Mostrar dirección en el ticket';
COMMENT ON COLUMN ticket_settings.show_phone IS 'Mostrar teléfono en el ticket';
COMMENT ON COLUMN ticket_settings.show_footer IS 'Mostrar mensaje de pie de página';
