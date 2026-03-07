-- Agrega columnas para configurar la visibilidad de elementos en el ticket de cierre (Corte de Caja)

ALTER TABLE ticket_settings
ADD COLUMN IF NOT EXISTS cc_show_initial_fund BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cc_show_card_sales BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cc_show_transfer_sales BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cc_show_withdrawals BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cc_show_sales_count BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cc_show_expected_cash BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cc_show_counted_cash BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cc_show_differences BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cc_show_operator_name BOOLEAN DEFAULT true;

-- Asegurar que los comentarios expliquen el propósito de las columnas
COMMENT ON COLUMN ticket_settings.cc_show_initial_fund IS 'Mostrar fondo inicial en ticket de cierre';
COMMENT ON COLUMN ticket_settings.cc_show_card_sales IS 'Mostrar ventas con tarjeta en ticket de cierre';
COMMENT ON COLUMN ticket_settings.cc_show_transfer_sales IS 'Mostrar ventas con transferencia en ticket de cierre';
COMMENT ON COLUMN ticket_settings.cc_show_withdrawals IS 'Mostrar retiros/depósitos en ticket de cierre';
COMMENT ON COLUMN ticket_settings.cc_show_sales_count IS 'Mostrar conteo de ventas en ticket de cierre';
COMMENT ON COLUMN ticket_settings.cc_show_expected_cash IS 'Mostrar efectivo esperado en ticket de cierre';
COMMENT ON COLUMN ticket_settings.cc_show_counted_cash IS 'Mostrar efectivo contado en ticket de cierre';
COMMENT ON COLUMN ticket_settings.cc_show_differences IS 'Mostrar diferencias (sobrante/faltante) en ticket de cierre';
COMMENT ON COLUMN ticket_settings.cc_show_operator_name IS 'Mostrar nombre del operador en ticket de cierre';
