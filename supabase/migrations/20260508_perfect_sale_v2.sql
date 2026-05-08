-- migration: 20260508_perfect_sale_v2.sql

-- 1. Create sale_payments table if it doesn't exist
create table if not exists public.sale_payments (
    id uuid default gen_random_uuid() primary key,
    sale_id uuid references public.sales(id) on delete cascade,
    payment_method text not null,
    amount numeric not null,
    amount_received numeric not null,
    change_amount numeric default 0,
    currency text default 'MXN',
    exchange_rate numeric,
    created_at timestamptz default now()
);

-- Habilitar RLS
alter table public.sale_payments enable row level security;

-- Políticas (Solo lectura por el dueño de la venta)
create policy "Users can view their own sale payments"
on public.sale_payments for select
using (
    exists (
        select 1 from public.sales s
        where s.id = sale_payments.sale_id
        and s.user_id = auth.uid()
    )
);

-- 2. Update process_perfect_sale to include atomic stock validation and payment recording
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
  v_payment jsonb;
  v_product_id bigint;
  v_quantity numeric;
  v_price numeric;
  v_total numeric;
  v_unit_sold text;
  v_conversion_factor integer;
  v_base_quantity numeric;
  v_available_stock numeric;
  v_errors jsonb := '[]'::jsonb;
  v_final_user_id uuid;
begin
  v_final_user_id := coalesce(p_user_id, auth.uid());

  -- 1. Atomic Stock Validation
  if p_affect_inventory then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      v_product_id := nullif(v_item->>'product_id', '')::bigint;
      v_conversion_factor := greatest(coalesce(nullif(v_item->>'conversion_factor', '')::integer, 1), 1);
      v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
      v_base_quantity := coalesce(nullif(v_item->>'base_quantity', '')::numeric, v_quantity * v_conversion_factor);
      
      if v_product_id is not null then
        -- Bloquear fila del producto para evitar race conditions
        select stock into v_available_stock from public.products 
        where id = v_product_id 
          and user_id = v_final_user_id
        for update;
        
        if v_available_stock is null then
           v_errors := v_errors || jsonb_build_object(
            'product_name', coalesce(v_item->>'product_name', 'Desconocido'),
            'error', 'Producto no encontrado'
          );
        elsif v_available_stock < v_base_quantity then
          v_errors := v_errors || jsonb_build_object(
            'product_name', coalesce(v_item->>'product_name', 'Producto'),
            'available_stock', v_available_stock,
            'requested_qty', v_base_quantity,
            'missing_qty', v_base_quantity - v_available_stock
          );
        end if;
      end if;
    end loop;
    
    if jsonb_array_length(v_errors) > 0 then
      raise exception 'Stock insuficiente detectado en el servidor: %', v_errors::text;
    end if;
  end if;

  -- 2. Insert Sale
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
    v_final_user_id,
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

  -- 3. Insert Sale Items and Update Inventory
  for v_item in select * from jsonb_array_elements(p_items)
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
      set stock = stock - v_base_quantity
      where id = v_product_id
        and user_id = v_sale.user_id;
    end if;
  end loop;

  -- 4. Insert Payments
  if p_payments is not null and jsonb_array_length(p_payments) > 0 then
    for v_payment in select * from jsonb_array_elements(p_payments)
    loop
      insert into public.sale_payments (
        sale_id,
        payment_method,
        amount,
        amount_received,
        change_amount,
        currency,
        exchange_rate
      )
      values (
        v_sale.id,
        coalesce(v_payment->>'payment_method', 'efectivo'),
        coalesce((v_payment->>'amount')::numeric, 0),
        coalesce((v_payment->>'amount_received')::numeric, 0),
        coalesce((v_payment->>'change_amount')::numeric, 0),
        coalesce(v_payment->>'currency', 'MXN'),
        (v_payment->>'exchange_rate')::numeric
      );
    end loop;
  else
    -- Si no hay array de pagos, insertar el pago principal por compatibilidad
    insert into public.sale_payments (
        sale_id,
        payment_method,
        amount,
        amount_received,
        change_amount,
        currency,
        exchange_rate
    )
    values (
        v_sale.id,
        coalesce(p_payment_method, 'efectivo'),
        p_total,
        p_total,
        0,
        p_currency,
        p_exchange_rate
    );
  end if;

  return v_sale;
end;
$$;

grant execute on function public.process_perfect_sale(
  numeric, numeric, numeric, uuid, text, numeric, numeric, text, uuid, uuid, jsonb, jsonb, boolean
) to authenticated;
