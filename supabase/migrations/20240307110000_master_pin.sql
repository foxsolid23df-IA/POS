-- Añadir PIN maestro al perfil del propietario
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS master_pin TEXT DEFAULT NULL;

COMMENT ON COLUMN profiles.master_pin IS 'PIN maestro de 6 dígitos para acceso administrativo sin apertura de caja.';
