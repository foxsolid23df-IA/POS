-- Flujo SIAN CAJA: venta por pieza/caja con inventario base en piezas.

alter table public.products
add column if not exists box_units integer,
add column if not exists box_price numeric,
add column if not exists box_barcode text;

alter table public.products
add constraint products_box_units_positive
check (box_units is null or box_units > 1) not valid;

alter table public.products
add constraint products_box_price_non_negative
check (box_price is null or box_price >= 0) not valid;

create unique index if not exists products_box_barcode_unique
on public.products (box_barcode)
where box_barcode is not null and box_barcode <> '';

alter table public.sale_items
add column if not exists product_id bigint,
add column if not exists unit_sold text not null default 'PZA',
add column if not exists conversion_factor integer not null default 1,
add column if not exists base_quantity numeric;

-- Inicializar base_quantity con el valor de quantity para registros existentes
update public.sale_items 
set base_quantity = quantity 
where base_quantity is null;

-- Ahora aplicar el constraint NOT NULL
alter table public.sale_items 
alter column base_quantity set not null;

alter table public.sale_items
alter column quantity type numeric using quantity::numeric;

alter table public.sale_items
add constraint sale_items_unit_sold_valid
check (unit_sold in ('PZA', 'CAJA')) not valid;

alter table public.sale_items
add constraint sale_items_conversion_factor_positive
check (conversion_factor >= 1) not valid;

alter table public.sales
add column if not exists subtotal numeric default 0,
add column if not exists tax_amount numeric default 0,
add column if not exists currency text default 'MXN',
add column if not exists exchange_rate numeric,
add column if not exists amount_usd numeric,
add column if not exists payment_method text default 'efectivo',
add column if not exists terminal_id uuid,
add column if not exists billing_issuer_id uuid,
add column if not exists pin_facturacion text;

create or replace function public.process_perfect_sale(
  p_total numeric,
  p_subtotal numeric default 0,
  p_tax_amount numeric default 0,
  p_user_id uuid default auth.uid(),
  p_currency text default 'MXN',
  p_exchange_rate numeric default null,
  p_amount_usd numeric default null,
  p_payment_method text default 'efectivo',
  p_terminal_id uuid default null,
  p_billing_issuer_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_payments jsonb default '[]'::jsonb,
  p_affect_inventory boolean default true
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_item jsonb;
  v_product_id bigint;
  v_quantity numeric;
  v_price numeric;
  v_total numeric;
  v_unit_sold text;
  v_conversion_factor integer;
  v_base_quantity numeric;
begin
  insert into public.sales (
    user_id,
    total,
    subtotal,
    tax_amount,
    currency,
    exchange_rate,
    amount_usd,
    payment_method,
    terminal_id,
    billing_issuer_id,
    pin_facturacion
  )
  values (
    coalesce(p_user_id, auth.uid()),
    p_total,
    coalesce(p_subtotal, 0),
    coalesce(p_tax_amount, 0),
    coalesce(p_currency, 'MXN'),
    p_exchange_rate,
    p_amount_usd,
    coalesce(p_payment_method, 'efectivo'),
    p_terminal_id,
    p_billing_issuer_id,
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_product_id := nullif(v_item->>'product_id', '')::bigint;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    v_price := coalesce(nullif(v_item->>'price', '')::numeric, 0);
    v_total := coalesce(nullif(v_item->>'total', '')::numeric, v_price * v_quantity);
    v_unit_sold := case when v_item->>'unit_sold' = 'CAJA' then 'CAJA' else 'PZA' end;
    v_conversion_factor := greatest(coalesce(nullif(v_item->>'conversion_factor', '')::integer, 1), 1);
    v_base_quantity := coalesce(nullif(v_item->>'base_quantity', '')::numeric, v_quantity * v_conversion_factor);

    insert into public.sale_items (
      sale_id,
      user_id,
      product_id,
      product_name,
      quantity,
      price,
      total,
      unit_sold,
      conversion_factor,
      base_quantity
    )
    values (
      v_sale.id,
      v_sale.user_id,
      v_product_id,
      coalesce(v_item->>'product_name', 'Producto'),
      v_quantity,
      v_price,
      v_total,
      v_unit_sold,
      v_conversion_factor,
      v_base_quantity
    );

    if p_affect_inventory and v_product_id is not null then
      update public.products
      set stock = stock - v_base_quantity::integer
      where id = v_product_id
        and user_id = v_sale.user_id;
    end if;
  end loop;

  return v_sale;
end;
$$;

grant execute on function public.process_perfect_sale(
  numeric,
  numeric,
  numeric,
  uuid,
  text,
  numeric,
  numeric,
  text,
  uuid,
  uuid,
  jsonb,
  jsonb,
  boolean
) to authenticated;
