-- Reset manual para entregar una cuenta en blanco conservando inventario.
-- Cliente objetivo: rtape@cintas.com
--
-- IMPORTANTE:
-- - Ejecutar en Supabase SQL Editor con una cuenta con permisos suficientes.
-- - Conserva public.products, public.profiles e invitation_codes.
-- - Borra ventas/ordenes, auditoria, dashboard, caja, clientes, cotizaciones,
--   devoluciones, compras historicas, movimientos historicos de inventario,
--   empleados, proveedores y configuraciones de ticket/facturacion.
-- - No revierte stock consumido por ventas ya registradas; deja products.stock tal cual esta.

begin;

do $$
declare
  v_email text := 'rtape@cintas.com';
  v_user_id uuid;
  v_products_count bigint := 0;
  v_table text;
  v_count bigint;

  -- Cambia estos flags si quieres conservar alguna configuracion operativa.
  v_reset_terminals boolean := true;
  v_reset_staff boolean := true;
  v_reset_suppliers boolean := true;
  v_reset_configuration boolean := true;
begin
  select id
  into v_user_id
  from auth.users
  where lower(email) = lower(v_email);

  if v_user_id is null then
    raise exception 'No se encontro usuario con email %', v_email;
  end if;

  select count(*)
  into v_products_count
  from public.products
  where user_id = v_user_id;

  raise notice 'Reset iniciado para % / user_id=% / productos preservados=%',
    v_email, v_user_id, v_products_count;

  -- Romper relaciones circulares entre ventas y cotizaciones antes de borrar.
  if to_regclass('public.sales') is not null then
    update public.sales
    set quotation_id = null
    where user_id = v_user_id;
  end if;

  if to_regclass('public.quotations') is not null then
    update public.quotations
    set converted_sale_id = null
    where user_id = v_user_id;
  end if;

  -- Facturacion ligada a ventas del cliente.
  if to_regclass('public.invoices') is not null and to_regclass('public.sales') is not null then
    delete from public.invoices i
    using public.sales s
    where i.sale_id = s.id
      and s.user_id = v_user_id;
  end if;

  -- Devoluciones/cancelaciones antes de sale_items/sales por llaves foraneas.
  if to_regclass('public.sale_return_items') is not null then
    delete from public.sale_return_items
    where user_id = v_user_id;
  end if;

  if to_regclass('public.sale_returns') is not null then
    delete from public.sale_returns
    where user_id = v_user_id;
  end if;

  -- Pagos/creditos.
  if to_regclass('public.sale_payments') is not null and to_regclass('public.sales') is not null then
    delete from public.sale_payments sp
    using public.sales s
    where sp.sale_id = s.id
      and s.user_id = v_user_id;
  end if;

  if to_regclass('public.credit_payments') is not null then
    delete from public.credit_payments
    where user_id = v_user_id;
  end if;

  -- Cotizaciones.
  if to_regclass('public.quotation_items') is not null then
    delete from public.quotation_items
    where user_id = v_user_id;
  end if;

  if to_regclass('public.quotations') is not null then
    delete from public.quotations
    where user_id = v_user_id;
  end if;

  -- Compras historicas y movimientos de inventario. Products queda intacto.
  if to_regclass('public.purchase_items') is not null then
    delete from public.purchase_items
    where user_id = v_user_id;
  end if;

  if to_regclass('public.purchase_orders') is not null then
    delete from public.purchase_orders
    where user_id = v_user_id;
  end if;

  if to_regclass('public.inventory_movements') is not null then
    delete from public.inventory_movements
    where user_id = v_user_id;
  end if;

  -- Ventas/ordenes/auditoria/dashboard.
  if to_regclass('public.sale_items') is not null then
    delete from public.sale_items
    where user_id = v_user_id;
  end if;

  if to_regclass('public.sales') is not null then
    delete from public.sales
    where user_id = v_user_id;
  end if;

  if to_regclass('public.operation_audit_logs') is not null then
    delete from public.operation_audit_logs
    where user_id = v_user_id;
  end if;

  -- Caja y carritos activos.
  if to_regclass('public.active_carts') is not null then
    delete from public.active_carts
    where user_id = v_user_id;
  end if;

  if to_regclass('public.cash_movements') is not null then
    delete from public.cash_movements
    where user_id = v_user_id;
  end if;

  if to_regclass('public.cash_sessions') is not null then
    delete from public.cash_sessions
    where user_id = v_user_id;
  end if;

  if to_regclass('public.cash_cuts') is not null then
    delete from public.cash_cuts
    where user_id = v_user_id;
  end if;

  -- Clientes POS.
  if to_regclass('public.customers') is not null then
    delete from public.customers
    where user_id = v_user_id;
  end if;

  -- Clientes de portal de facturacion, solo si la columna user_id existe.
  if to_regclass('public.clients') is not null and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clients'
      and column_name = 'user_id'
  ) then
    delete from public.clients
    where user_id = v_user_id;
  end if;

  -- Asistencia y empleados de prueba.
  if to_regclass('public.attendance_logs') is not null then
    delete from public.attendance_logs
    where user_id = v_user_id;
  end if;

  if v_reset_staff and to_regclass('public.staff') is not null then
    delete from public.staff
    where user_id = v_user_id;
  end if;

  -- Proveedores. Products conserva supplier/supplier_id tal como esta.
  if v_reset_suppliers and to_regclass('public.suppliers') is not null then
    delete from public.suppliers
    where user_id = v_user_id;
  end if;

  -- Configuracion no relacionada directamente con el inventario.
  if v_reset_configuration and to_regclass('public.ticket_settings') is not null then
    delete from public.ticket_settings
    where user_id = v_user_id;
  end if;

  if v_reset_configuration and to_regclass('public.payment_methods') is not null then
    delete from public.payment_methods
    where user_id = v_user_id;
  end if;

  if v_reset_configuration and to_regclass('public.billing_portals') is not null then
    delete from public.billing_portals
    where user_id = v_user_id;
  end if;

  if v_reset_configuration and to_regclass('public.billing_issuers') is not null then
    delete from public.billing_issuers
    where user_id = v_user_id;
  end if;

  -- Configuracion de terminales/cajas. Al entrar, tendra que configurar la caja de nuevo.
  if v_reset_terminals and to_regclass('public.terminals') is not null then
    delete from public.terminals
    where user_id = v_user_id;
  end if;

  -- Resumen de verificacion. Debe quedar products > 0 y ventas/ordenes en 0.
  raise notice 'Verificacion posterior:';

  foreach v_table in array array[
    'products',
    'sales',
    'sale_items',
    'cash_sessions',
    'cash_cuts',
    'customers',
    'active_carts',
    'operation_audit_logs'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('select count(*) from public.%I where user_id = $1', v_table)
      into v_count
      using v_user_id;

      raise notice '% => %', v_table, v_count;
    end if;
  end loop;
end $$;

commit;
