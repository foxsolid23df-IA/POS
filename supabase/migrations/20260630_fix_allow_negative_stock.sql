-- Fix allow_negative_stock: update RPCs to accept and respect p_allow_negative_stock
-- When p_allow_negative_stock is true, server-side stock validation is skipped
-- so that clients with allow_negative_stock enabled can sell products with 0 stock.

-- ============================================
-- 1. validate_sale_stock — add p_allow_negative_stock
-- ============================================
create or replace function public.validate_sale_stock(
  p_items jsonb,
  p_allow_negative_stock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_available numeric;
  v_errors jsonb := '[]'::jsonb;
  v_error jsonb;
begin
  if p_allow_negative_stock then
    return v_errors;
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_items)
      as x(product_id bigint, requested_base_qty numeric, name text)
  loop
    select stock into v_available
    from public.products
    where id = v_item.product_id
      and user_id = auth.uid();

    if v_available is null then
      v_error := jsonb_build_object(
        'product_id', v_item.product_id,
        'product_name', v_item.name,
        'error', 'Producto no encontrado',
        'available_stock', 0,
        'missing_qty', v_item.requested_base_qty
      );
      v_errors := v_errors || v_error;
    elsif v_available < v_item.requested_base_qty then
      v_error := jsonb_build_object(
        'product_id', v_item.product_id,
        'product_name', v_item.name,
        'available_stock', v_available,
        'requested_qty', v_item.requested_base_qty,
        'missing_qty', (v_item.requested_base_qty - v_available)
      );
      v_errors := v_errors || v_error;
    end if;
  end loop;

  return v_errors;
end;
$$;

grant execute on function public.validate_sale_stock(jsonb, boolean) to authenticated;

-- ============================================
-- 2. process_perfect_sale — add p_allow_negative_stock
-- ============================================
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
  p_affect_inventory boolean default true,
  p_allow_negative_stock boolean default false
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
  v_final_user_id := auth.uid();

  if v_final_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_terminal_id is not null and not exists (
    select 1 from public.terminals
    where id = p_terminal_id
      and user_id = v_final_user_id
      and coalesce(is_active, true) = true
  ) then
    raise exception 'Terminal no valida para esta tienda';
  end if;

  if p_affect_inventory and not p_allow_negative_stock then
    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    loop
      v_product_id := nullif(v_item->>'product_id', '')::bigint;
      v_conversion_factor := greatest(coalesce(nullif(v_item->>'conversion_factor', '')::integer, 1), 1);
      v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
      v_base_quantity := coalesce(nullif(v_item->>'base_quantity', '')::numeric, v_quantity * v_conversion_factor);

      if v_product_id is not null then
        select stock into v_available_stock
        from public.products
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

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_product_id := nullif(v_item->>'product_id', '')::bigint;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    v_price := coalesce(nullif(v_item->>'price', '')::numeric, 0);
    v_total := coalesce(nullif(v_item->>'total', '')::numeric, v_price * v_quantity);
    v_unit_sold := upper(coalesce(nullif(v_item->>'unit_sold', ''), 'PZA'));
    if v_unit_sold not in ('PZA', 'CAJA', 'M', 'MT', 'KG', 'L', 'LT', 'PAQ', 'TRAMO', 'ROLLO', 'JGO', 'KIT') then
      v_unit_sold := 'PZA';
    end if;
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
        nullif(v_payment->>'exchange_rate', '')::numeric
      );
    end loop;
  else
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
  numeric, numeric, numeric, uuid, text, numeric, numeric, text, uuid, uuid, jsonb, jsonb, boolean, boolean
) to authenticated;

-- ============================================
-- 3. process_credit_sale — add p_allow_negative_stock
-- ============================================
create or replace function public.process_credit_sale(
  p_total numeric,
  p_subtotal numeric default 0,
  p_tax_amount numeric default 0,
  p_currency text default 'MXN',
  p_payment_method text default 'credito',
  p_terminal_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_payments jsonb default '[]'::jsonb,
  p_affect_inventory boolean default true,
  p_allow_negative_stock boolean default false,
  p_customer_id uuid default null,
  p_paid_amount numeric default 0,
  p_balance numeric default 0,
  p_due_date date default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_user_id uuid := auth.uid();
  v_balance numeric := greatest(coalesce(p_balance, p_total - coalesce(p_paid_amount, 0)), 0);
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_customer_id is null then
    raise exception 'Cliente requerido para venta a credito';
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_customer_id
      and user_id = v_user_id
      and coalesce(credit_hold, false) = false
  ) then
    raise exception 'Cliente no valido o con credito bloqueado';
  end if;

  v_sale := public.process_perfect_sale(
    p_total,
    p_subtotal,
    p_tax_amount,
    null,
    p_currency,
    null,
    null,
    p_payment_method,
    p_terminal_id,
    null,
    p_items,
    p_payments,
    p_affect_inventory,
    p_allow_negative_stock
  );

  v_status := case
    when v_balance <= 0 then 'pagado'
    when coalesce(p_paid_amount, 0) > 0 then 'parcial'
    else 'pendiente'
  end;

  update public.sales
  set customer_id = p_customer_id,
      sale_type = 'credito',
      paid_amount = coalesce(p_paid_amount, 0),
      balance = v_balance,
      due_date = p_due_date,
      credit_status = v_status
  where id = v_sale.id
    and user_id = v_user_id
  returning * into v_sale;

  update public.customers
  set credit_balance = coalesce(credit_balance, 0) + v_balance
  where id = p_customer_id
    and user_id = v_user_id;

  if coalesce(p_paid_amount, 0) > 0 then
    insert into public.credit_payments (
      user_id,
      customer_id,
      sale_id,
      amount,
      payment_method,
      notes
    )
    values (
      v_user_id,
      p_customer_id,
      v_sale.id,
      p_paid_amount,
      p_payment_method,
      'Anticipo registrado al crear la venta'
    );
  end if;

  return v_sale;
end;
$$;

grant execute on function public.process_credit_sale(
  numeric,
  numeric,
  numeric,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  boolean,
  boolean,
  uuid,
  numeric,
  numeric,
  date
) to authenticated;

notify pgrst, 'reload schema';
