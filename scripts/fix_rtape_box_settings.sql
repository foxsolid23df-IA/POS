-- Correccion auditada de configuracion de cajas para rtape@cintas.com.
--
-- Ejecutar en Supabase SQL Editor con permisos suficientes.
-- No modifica stock, ventas, historial, precio por pieza ni codigo de pieza.
--
-- Recomendacion: ejecutar primero completo con ROLLBACK al final para revisar
-- los resultados; si todo coincide, cambiar ROLLBACK por COMMIT.

begin;

-- 1) Auditoria inicial: productos candidatos con caja incompleta, paquete C/6
-- o precio de caja que no coincide con precio * piezas por caja.
with target_user as (
  select id
  from auth.users
  where lower(email) = lower('rtape@cintas.com')
),
candidate_products as (
  select
    p.id,
    p.name,
    p.barcode,
    p.price,
    p.stock,
    p.category,
    p.box_units,
    p.box_price,
    p.box_barcode,
    round(coalesce(p.price, 0) * coalesce(p.box_units, 0), 2) as expected_box_price
  from public.products p
  join target_user u on u.id = p.user_id
  where
    p.box_units is null
    or p.box_units <= 1
    or p.box_units = 6
    or p.box_price is null
    or round(coalesce(p.box_price, 0), 2) <> round(coalesce(p.price, 0) * coalesce(p.box_units, 0), 2)
    or upper(coalesce(p.barcode, '')) = 'DPO10'
    or upper(coalesce(p.name, '')) like '%DPO10%'
    or upper(coalesce(p.name, '')) like '%DUCTO POLYFILM%'
    or upper(coalesce(p.name, '')) like '%TUCK 179%'
    or upper(coalesce(p.barcode, '')) like '179CAN%'
)
select 'AUDIT_CANDIDATES' as section, *
from candidate_products
order by name, barcode;

-- 2) Auditoria de posibles choques de codigo caja antes de actualizar.
with target_user as (
  select id
  from auth.users
  where lower(email) = lower('rtape@cintas.com')
),
desired_codes as (
  select
    p.id,
    p.name,
    p.barcode,
    case
      when upper(coalesce(p.barcode, '')) = 'DPO10'
        or upper(coalesce(p.name, '')) like '%DPO10%'
        or upper(coalesce(p.name, '')) like '%DUCTO POLYFILM%48X10%'
        then 'DPO10-CAJA'
      when p.box_units = 6
        and (
          upper(coalesce(p.name, '')) like '%TUCK 179%'
          or upper(coalesce(p.barcode, '')) like '179CAN%'
        )
        and nullif(trim(coalesce(p.barcode, '')), '') is not null
        then p.barcode || '-CAJA'
      else null
    end as desired_box_barcode
  from public.products p
  join target_user u on u.id = p.user_id
)
select
  'AUDIT_BOX_BARCODE_CONFLICTS' as section,
  d.id as target_id,
  d.name as target_name,
  d.barcode as target_barcode,
  d.desired_box_barcode,
  other.id as conflicting_product_id,
  other.user_id as conflicting_user_id,
  other.name as conflicting_name,
  other.barcode as conflicting_barcode
from desired_codes d
join public.products other
  on other.box_barcode = d.desired_box_barcode
 and other.id <> d.id
where d.desired_box_barcode is not null
order by d.name;

-- 3) Corregir DPO10 / DUCTO POLYFILM 48X10.
with target_user as (
  select id
  from auth.users
  where lower(email) = lower('rtape@cintas.com')
),
updated as (
  update public.products p
  set
    box_units = 36,
    box_price = 504,
    box_barcode = case
      when nullif(trim(coalesce(p.box_barcode, '')), '') is null
        and not exists (
          select 1
          from public.products other
          where other.box_barcode = 'DPO10-CAJA'
            and other.id <> p.id
        )
        then 'DPO10-CAJA'
      else p.box_barcode
    end
  from target_user u
  where p.user_id = u.id
    and (
      upper(coalesce(p.barcode, '')) = 'DPO10'
      or upper(coalesce(p.name, '')) like '%DPO10%'
      or upper(coalesce(p.name, '')) like '%DUCTO POLYFILM%48X10%'
      or upper(coalesce(p.name, '')) like '%DUCTO POLYFILM 48X10%'
    )
  returning p.id, p.name, p.barcode, p.price, p.box_units, p.box_price, p.box_barcode
)
select 'UPDATED_DPO10' as section, *
from updated
order by name, barcode;

-- 4) Corregir productos TUCK 179 / 179CAN importados como paquete de 6.
with target_user as (
  select id
  from auth.users
  where lower(email) = lower('rtape@cintas.com')
),
updated as (
  update public.products p
  set
    box_units = 36,
    box_price = round(coalesce(p.price, 0) * 36, 2),
    box_barcode = case
      when nullif(trim(coalesce(p.box_barcode, '')), '') is null
        and nullif(trim(coalesce(p.barcode, '')), '') is not null
        and not exists (
          select 1
          from public.products other
          where other.box_barcode = p.barcode || '-CAJA'
            and other.id <> p.id
        )
        then p.barcode || '-CAJA'
      else p.box_barcode
    end
  from target_user u
  where p.user_id = u.id
    and p.box_units = 6
    and (
      upper(coalesce(p.name, '')) like '%TUCK 179%'
      or upper(coalesce(p.barcode, '')) like '179CAN%'
    )
    and upper(coalesce(p.name, '')) not like '%YASEN%'
  returning p.id, p.name, p.barcode, p.price, p.box_units, p.box_price, p.box_barcode
)
select 'UPDATED_TUCK_179' as section, *
from updated
order by name, barcode;

-- 5) Verificacion final de productos objetivo.
with target_user as (
  select id
  from auth.users
  where lower(email) = lower('rtape@cintas.com')
)
select
  'FINAL_CHECK' as section,
  p.id,
  p.name,
  p.barcode,
  p.price,
  p.stock,
  p.category,
  p.box_units,
  p.box_price,
  p.box_barcode
from public.products p
join target_user u on u.id = p.user_id
where
  upper(coalesce(p.barcode, '')) = 'DPO10'
  or upper(coalesce(p.name, '')) like '%DPO10%'
  or upper(coalesce(p.name, '')) like '%DUCTO POLYFILM%'
  or upper(coalesce(p.name, '')) like '%TUCK 179%'
  or upper(coalesce(p.barcode, '')) like '179CAN%'
order by p.name, p.barcode;

commit;
