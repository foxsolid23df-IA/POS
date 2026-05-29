-- Ferreteria operations: formal purchases, returns/cancellations, quotations and backups.
-- Keeps every operational write scoped to auth.uid().

create extension if not exists pgcrypto;

-- =====================================================
-- Hardware-store units and product purchase metadata
-- =====================================================
alter table public.products
  alter column stock type numeric using stock::numeric;

alter table public.products
  add column if not exists merma numeric default 0,
  add column if not exists cost_price numeric default 0,
  add column if not exists margin_percent numeric default 0,
  add column if not exists supplier_id uuid,
  add column if not exists supplier text,
  add column if not exists purchase_invoice text,
  add column if not exists last_purchase_at timestamptz,
  add column if not exists unit_equivalences jsonb default '{}'::jsonb,
  add column if not exists secondary_unit text,
  add column if not exists purchase_unit text default 'PZA';

alter table public.sale_items
  drop constraint if exists sale_items_unit_sold_valid;

alter table public.sale_items
  add constraint sale_items_unit_sold_valid
  check (unit_sold in ('PZA', 'CAJA', 'M', 'MT', 'KG', 'L', 'LT', 'PAQ', 'TRAMO', 'ROLLO', 'JGO', 'KIT'))
  not valid;

-- =====================================================
-- Suppliers and formal purchases
-- =====================================================
create table if not exists public.suppliers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  tax_id text,
  address text,
  payment_terms text,
  balance numeric default 0,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.purchase_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  supplier_id uuid references public.suppliers(id),
  supplier_name text not null,
  invoice_number text,
  purchased_at timestamptz default now(),
  subtotal numeric default 0,
  tax_amount numeric default 0,
  total numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.purchase_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  purchase_id uuid references public.purchase_orders(id) on delete cascade,
  product_id bigint references public.products(id),
  product_name text not null,
  quantity numeric not null,
  unit text not null default 'PZA',
  conversion_factor numeric not null default 1,
  base_quantity numeric not null,
  unit_cost numeric default 0,
  sale_price numeric,
  margin_percent numeric default 0,
  line_total numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.inventory_movements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  product_id bigint references public.products(id),
  movement_type text not null check (movement_type in (
    'purchase',
    'return',
    'sale_cancel',
    'stock_adjustment',
    'waste',
    'backup_export'
  )),
  quantity_delta numeric not null,
  unit text default 'PZA',
  conversion_factor numeric default 1,
  reference_table text,
  reference_id text,
  notes text,
  created_by uuid default auth.uid(),
  staff_name text,
  created_at timestamptz default now()
);

-- =====================================================
-- Returns, cancellations and quotations
-- =====================================================
alter table public.sales
  add column if not exists sale_status text default 'completed',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists refunded_amount numeric default 0,
  add column if not exists quotation_id uuid;

create table if not exists public.sale_returns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  sale_id bigint references public.sales(id),
  terminal_id uuid references public.terminals(id),
  reason text not null,
  refund_amount numeric default 0,
  restock boolean default true,
  status text default 'completed',
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

create table if not exists public.sale_return_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  return_id uuid references public.sale_returns(id) on delete cascade,
  sale_item_id bigint references public.sale_items(id),
  product_id bigint references public.products(id),
  product_name text not null,
  quantity numeric not null,
  unit_sold text not null default 'PZA',
  conversion_factor numeric default 1,
  base_quantity numeric not null,
  refund_amount numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.quotations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  folio text not null,
  customer_id uuid references public.customers(id),
  customer_name text,
  subtotal numeric default 0,
  tax_amount numeric default 0,
  total numeric default 0,
  advance_amount numeric default 0,
  balance numeric default 0,
  status text default 'draft' check (status in ('draft', 'sent', 'accepted', 'converted', 'expired', 'cancelled')),
  expires_at date,
  converted_sale_id bigint references public.sales(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.quotation_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  quotation_id uuid references public.quotations(id) on delete cascade,
  product_id bigint references public.products(id),
  product_name text not null,
  quantity numeric not null,
  price numeric not null,
  total numeric not null,
  unit_sold text default 'PZA',
  conversion_factor numeric default 1,
  base_quantity numeric not null,
  created_at timestamptz default now()
);

create table if not exists public.operation_audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  action text not null,
  entity_table text,
  entity_id text,
  details jsonb default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);

-- =====================================================
-- RLS
-- =====================================================
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.operation_audit_logs enable row level security;

drop policy if exists "Users can CRUD own suppliers" on public.suppliers;
create policy "Users can CRUD own suppliers" on public.suppliers
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own purchase_orders" on public.purchase_orders;
create policy "Users can CRUD own purchase_orders" on public.purchase_orders
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own purchase_items" on public.purchase_items;
create policy "Users can CRUD own purchase_items" on public.purchase_items
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own inventory_movements" on public.inventory_movements;
create policy "Users can CRUD own inventory_movements" on public.inventory_movements
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own sale_returns" on public.sale_returns;
create policy "Users can CRUD own sale_returns" on public.sale_returns
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own sale_return_items" on public.sale_return_items;
create policy "Users can CRUD own sale_return_items" on public.sale_return_items
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own quotations" on public.quotations;
create policy "Users can CRUD own quotations" on public.quotations
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can CRUD own quotation_items" on public.quotation_items;
create policy "Users can CRUD own quotation_items" on public.quotation_items
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can read own operation_audit_logs" on public.operation_audit_logs;
create policy "Users can read own operation_audit_logs" on public.operation_audit_logs
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own operation_audit_logs" on public.operation_audit_logs;
create policy "Users can insert own operation_audit_logs" on public.operation_audit_logs
for insert to authenticated with check (auth.uid() = user_id);

create index if not exists idx_suppliers_user_name on public.suppliers(user_id, name);
create index if not exists idx_purchase_orders_user_date on public.purchase_orders(user_id, purchased_at desc);
create index if not exists idx_purchase_items_purchase on public.purchase_items(purchase_id);
create index if not exists idx_inventory_movements_user_product on public.inventory_movements(user_id, product_id, created_at desc);
create index if not exists idx_sale_returns_user_sale on public.sale_returns(user_id, sale_id);
create index if not exists idx_quotations_user_status on public.quotations(user_id, status, expires_at);

-- =====================================================
-- RPC: formal purchase entry
-- =====================================================
create or replace function public.register_purchase(
  p_supplier_name text,
  p_invoice_number text default null,
  p_purchased_at timestamptz default now(),
  p_items jsonb default '[]'::jsonb,
  p_notes text default null,
  p_supplier_id uuid default null,
  p_tax_amount numeric default 0
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_purchase public.purchase_orders%rowtype;
  v_item jsonb;
  v_product_id bigint;
  v_product_name text;
  v_quantity numeric;
  v_unit text;
  v_conversion_factor numeric;
  v_base_quantity numeric;
  v_unit_cost numeric;
  v_sale_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_margin numeric;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if coalesce(trim(p_supplier_name), '') = '' then
    raise exception 'Proveedor requerido';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La compra no tiene partidas';
  end if;

  insert into public.purchase_orders (
    user_id, supplier_id, supplier_name, invoice_number, purchased_at, tax_amount, notes
  )
  values (
    v_user_id, p_supplier_id, trim(p_supplier_name), nullif(trim(coalesce(p_invoice_number, '')), ''), coalesce(p_purchased_at, now()), coalesce(p_tax_amount, 0), p_notes
  )
  returning * into v_purchase;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::bigint;
    v_quantity := greatest(coalesce(nullif(v_item->>'quantity', '')::numeric, 0), 0);
    v_unit := upper(coalesce(nullif(v_item->>'unit', ''), 'PZA'));
    v_conversion_factor := greatest(coalesce(nullif(v_item->>'conversion_factor', '')::numeric, 1), 1);
    v_base_quantity := coalesce(nullif(v_item->>'base_quantity', '')::numeric, v_quantity * v_conversion_factor);
    v_unit_cost := coalesce(nullif(v_item->>'unit_cost', '')::numeric, 0);
    v_sale_price := nullif(v_item->>'sale_price', '')::numeric;
    v_margin := coalesce(nullif(v_item->>'margin_percent', '')::numeric, 0);
    v_line_total := coalesce(nullif(v_item->>'line_total', '')::numeric, v_quantity * v_unit_cost);

    if v_product_id is null then
      raise exception 'Producto requerido en partida de compra';
    end if;

    select name into v_product_name
    from public.products
    where id = v_product_id and user_id = v_user_id
    for update;

    if v_product_name is null then
      raise exception 'Producto no encontrado o no pertenece a la tienda: %', v_product_id;
    end if;

    insert into public.purchase_items (
      user_id, purchase_id, product_id, product_name, quantity, unit,
      conversion_factor, base_quantity, unit_cost, sale_price, margin_percent, line_total
    )
    values (
      v_user_id, v_purchase.id, v_product_id, v_product_name, v_quantity, v_unit,
      v_conversion_factor, v_base_quantity, v_unit_cost, v_sale_price, v_margin, v_line_total
    );

    update public.products
    set stock = coalesce(stock, 0) + v_base_quantity,
        cost_price = case when v_unit_cost > 0 then v_unit_cost else cost_price end,
        price = coalesce(v_sale_price, price),
        margin_percent = case when v_margin > 0 then v_margin else margin_percent end,
        supplier_id = coalesce(p_supplier_id, supplier_id),
        supplier = trim(p_supplier_name),
        purchase_invoice = nullif(trim(coalesce(p_invoice_number, '')), ''),
        last_purchase_at = coalesce(p_purchased_at, now()),
        purchase_unit = v_unit
    where id = v_product_id and user_id = v_user_id;

    insert into public.inventory_movements (
      user_id, product_id, movement_type, quantity_delta, unit, conversion_factor,
      reference_table, reference_id, notes
    )
    values (
      v_user_id, v_product_id, 'purchase', v_base_quantity, v_unit, v_conversion_factor,
      'purchase_orders', v_purchase.id::text, p_notes
    );

    v_subtotal := v_subtotal + v_line_total;
  end loop;

  update public.purchase_orders
  set subtotal = v_subtotal,
      total = v_subtotal + coalesce(p_tax_amount, 0)
  where id = v_purchase.id
  returning * into v_purchase;

  insert into public.operation_audit_logs(user_id, action, entity_table, entity_id, details)
  values (
    v_user_id, 'register_purchase', 'purchase_orders', v_purchase.id::text,
    jsonb_build_object('supplier_name', p_supplier_name, 'invoice_number', p_invoice_number, 'total', v_purchase.total)
  );

  return v_purchase;
end;
$$;

grant execute on function public.register_purchase(text, text, timestamptz, jsonb, text, uuid, numeric) to authenticated;

-- =====================================================
-- RPC: cancel sale and optionally restock/refund cash
-- =====================================================
create or replace function public.cancel_sale_with_restock(
  p_sale_id bigint,
  p_reason text,
  p_refund_amount numeric default null,
  p_restock boolean default true
)
returns public.sale_returns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_return public.sale_returns%rowtype;
  v_item public.sale_items%rowtype;
  v_refund numeric;
  v_session_id bigint;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id and user_id = v_user_id
  for update;

  if v_sale.id is null then
    raise exception 'Venta no encontrada';
  end if;

  if coalesce(v_sale.sale_status, 'completed') in ('cancelled', 'returned') then
    raise exception 'La venta ya fue cancelada o devuelta';
  end if;

  v_refund := coalesce(p_refund_amount, v_sale.paid_amount, v_sale.total, 0);

  insert into public.sale_returns (
    user_id, sale_id, terminal_id, reason, refund_amount, restock
  )
  values (
    v_user_id, v_sale.id, v_sale.terminal_id, coalesce(nullif(trim(p_reason), ''), 'Cancelacion de venta'), v_refund, coalesce(p_restock, true)
  )
  returning * into v_return;

  for v_item in
    select * from public.sale_items where sale_id = v_sale.id and user_id = v_user_id
  loop
    insert into public.sale_return_items (
      user_id, return_id, sale_item_id, product_id, product_name, quantity,
      unit_sold, conversion_factor, base_quantity, refund_amount
    )
    values (
      v_user_id, v_return.id, v_item.id, v_item.product_id, v_item.product_name,
      v_item.quantity, v_item.unit_sold, v_item.conversion_factor, v_item.base_quantity,
      case when coalesce(v_sale.total, 0) > 0 then (v_item.total / v_sale.total) * v_refund else 0 end
    );

    if coalesce(p_restock, true) and v_item.product_id is not null then
      update public.products
      set stock = coalesce(stock, 0) + coalesce(v_item.base_quantity, 0)
      where id = v_item.product_id and user_id = v_user_id;

      insert into public.inventory_movements (
        user_id, product_id, movement_type, quantity_delta, unit, conversion_factor,
        reference_table, reference_id, notes
      )
      values (
        v_user_id, v_item.product_id, 'sale_cancel', coalesce(v_item.base_quantity, 0),
        v_item.unit_sold, v_item.conversion_factor, 'sale_returns', v_return.id::text, p_reason
      );
    end if;
  end loop;

  update public.sales
  set sale_status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = p_reason,
      refunded_amount = v_refund,
      balance = 0,
      credit_status = case when sale_type = 'credit' then 'cancelled' else credit_status end
  where id = v_sale.id and user_id = v_user_id;

  if v_sale.sale_type = 'credit' and v_sale.customer_id is not null then
    update public.customers
    set credit_balance = greatest(coalesce(credit_balance, 0) - coalesce(v_sale.balance, 0), 0)
    where id = v_sale.customer_id and user_id = v_user_id;
  end if;

  if v_refund > 0 then
    select id into v_session_id
    from public.cash_sessions
    where user_id = v_user_id
      and status = 'open'
      and (v_sale.terminal_id is null or terminal_id = v_sale.terminal_id)
    order by opened_at desc
    limit 1;

    if v_session_id is not null then
      insert into public.cash_movements (
        user_id, session_id, movement_type, amount, concept, staff_name
      )
      values (
        v_user_id, v_session_id, 'salida', v_refund,
        'Devolucion/cancelacion venta #' || v_sale.id,
        'Sistema'
      );
    end if;
  end if;

  insert into public.operation_audit_logs(user_id, action, entity_table, entity_id, details)
  values (
    v_user_id, 'cancel_sale_with_restock', 'sales', v_sale.id::text,
    jsonb_build_object('reason', p_reason, 'refund_amount', v_refund, 'restock', p_restock, 'return_id', v_return.id)
  );

  return v_return;
end;
$$;

grant execute on function public.cancel_sale_with_restock(bigint, text, numeric, boolean) to authenticated;

-- =====================================================
-- RPC: quotations
-- =====================================================
create or replace function public.create_quotation(
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_expires_at date default null,
  p_items jsonb default '[]'::jsonb,
  p_notes text default null,
  p_advance_amount numeric default 0,
  p_tax_amount numeric default 0
)
returns public.quotations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quote public.quotations%rowtype;
  v_item jsonb;
  v_product_id bigint;
  v_product_name text;
  v_quantity numeric;
  v_price numeric;
  v_total numeric;
  v_unit_sold text;
  v_conversion_factor numeric;
  v_base_quantity numeric;
  v_subtotal numeric := 0;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and user_id = v_user_id
  ) then
    raise exception 'Cliente no encontrado para esta tienda';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La cotizacion no tiene partidas';
  end if;

  insert into public.quotations (
    user_id, folio, customer_id, customer_name, expires_at, notes, advance_amount
  )
  values (
    v_user_id,
    'COT-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5)),
    p_customer_id,
    nullif(trim(coalesce(p_customer_name, '')), ''),
    coalesce(p_expires_at, (now() + interval '7 days')::date),
    p_notes,
    coalesce(p_advance_amount, 0)
  )
  returning * into v_quote;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::bigint;
    v_product_name := coalesce(v_item->>'product_name', v_item->>'name', 'Producto');
    v_quantity := greatest(coalesce(nullif(v_item->>'quantity', '')::numeric, 0), 0);
    v_price := coalesce(nullif(v_item->>'price', '')::numeric, 0);
    v_total := coalesce(nullif(v_item->>'total', '')::numeric, v_quantity * v_price);
    v_unit_sold := upper(coalesce(nullif(v_item->>'unit_sold', ''), 'PZA'));
    v_conversion_factor := greatest(coalesce(nullif(v_item->>'conversion_factor', '')::numeric, 1), 1);
    v_base_quantity := coalesce(nullif(v_item->>'base_quantity', '')::numeric, v_quantity * v_conversion_factor);

    if v_product_id is not null and not exists (
      select 1 from public.products where id = v_product_id and user_id = v_user_id
    ) then
      raise exception 'Producto no encontrado para esta tienda: %', v_product_id;
    end if;

    insert into public.quotation_items (
      user_id, quotation_id, product_id, product_name, quantity, price, total,
      unit_sold, conversion_factor, base_quantity
    )
    values (
      v_user_id, v_quote.id, v_product_id, v_product_name, v_quantity, v_price, v_total,
      v_unit_sold, v_conversion_factor, v_base_quantity
    );

    v_subtotal := v_subtotal + v_total;
  end loop;

  update public.quotations
  set subtotal = v_subtotal,
      tax_amount = coalesce(p_tax_amount, 0),
      total = v_subtotal + coalesce(p_tax_amount, 0),
      balance = greatest((v_subtotal + coalesce(p_tax_amount, 0)) - coalesce(p_advance_amount, 0), 0),
      status = 'sent',
      updated_at = now()
  where id = v_quote.id
  returning * into v_quote;

  insert into public.operation_audit_logs(user_id, action, entity_table, entity_id, details)
  values (
    v_user_id, 'create_quotation', 'quotations', v_quote.id::text,
    jsonb_build_object('folio', v_quote.folio, 'total', v_quote.total, 'expires_at', v_quote.expires_at)
  );

  return v_quote;
end;
$$;

grant execute on function public.create_quotation(uuid, text, date, jsonb, text, numeric, numeric) to authenticated;

create or replace function public.convert_quotation_to_sale(
  p_quotation_id uuid,
  p_terminal_id uuid,
  p_payment_method text default 'efectivo',
  p_payments jsonb default '[]'::jsonb
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quote public.quotations%rowtype;
  v_sale public.sales%rowtype;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  select * into v_quote
  from public.quotations
  where id = p_quotation_id and user_id = v_user_id
  for update;

  if v_quote.id is null then
    raise exception 'Cotizacion no encontrada';
  end if;

  if v_quote.status in ('converted', 'cancelled', 'expired') then
    raise exception 'Cotizacion no convertible: %', v_quote.status;
  end if;

  if v_quote.expires_at is not null and v_quote.expires_at < current_date then
    update public.quotations set status = 'expired', updated_at = now() where id = v_quote.id;
    raise exception 'Cotizacion vencida';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', product_id,
    'product_name', product_name,
    'quantity', quantity,
    'price', price,
    'total', total,
    'unit_sold', unit_sold,
    'conversion_factor', conversion_factor,
    'base_quantity', base_quantity
  )), '[]'::jsonb)
  into v_items
  from public.quotation_items
  where quotation_id = v_quote.id and user_id = v_user_id;

  v_sale := public.process_perfect_sale(
    v_quote.total,
    v_quote.subtotal,
    v_quote.tax_amount,
    v_user_id,
    'MXN',
    null,
    null,
    coalesce(p_payment_method, 'efectivo'),
    p_terminal_id,
    null,
    v_items,
    p_payments,
    true
  );

  update public.sales
  set quotation_id = v_quote.id
  where id = v_sale.id and user_id = v_user_id;

  update public.quotations
  set status = 'converted',
      converted_sale_id = v_sale.id,
      updated_at = now()
  where id = v_quote.id and user_id = v_user_id;

  insert into public.operation_audit_logs(user_id, action, entity_table, entity_id, details)
  values (
    v_user_id, 'convert_quotation_to_sale', 'quotations', v_quote.id::text,
    jsonb_build_object('sale_id', v_sale.id, 'folio', v_quote.folio)
  );

  return v_sale;
end;
$$;

grant execute on function public.convert_quotation_to_sale(uuid, uuid, text, jsonb) to authenticated;

-- Keep the hardened sale RPC but preserve real hardware-store units instead of
-- coercing every non-box sale back to PZA.
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

  if p_affect_inventory then
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
  numeric, numeric, numeric, uuid, text, numeric, numeric, text, uuid, uuid, jsonb, jsonb, boolean
) to authenticated;

-- =====================================================
-- RPC: backup export (JSON payload for restore drills/offline archive)
-- =====================================================
create or replace function public.export_store_backup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  v_payload := jsonb_build_object(
    'exported_at', now(),
    'user_id', v_user_id,
    'products', coalesce((select jsonb_agg(to_jsonb(p)) from public.products p where p.user_id = v_user_id), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(to_jsonb(c)) from public.customers c where c.user_id = v_user_id), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(to_jsonb(s)) from public.sales s where s.user_id = v_user_id), '[]'::jsonb),
    'sale_items', coalesce((select jsonb_agg(to_jsonb(si)) from public.sale_items si where si.user_id = v_user_id), '[]'::jsonb),
    'cash_sessions', coalesce((select jsonb_agg(to_jsonb(cs)) from public.cash_sessions cs where cs.user_id = v_user_id), '[]'::jsonb),
    'cash_movements', coalesce((select jsonb_agg(to_jsonb(cm)) from public.cash_movements cm where cm.user_id = v_user_id), '[]'::jsonb),
    'quotations', coalesce((select jsonb_agg(to_jsonb(q)) from public.quotations q where q.user_id = v_user_id), '[]'::jsonb),
    'quotation_items', coalesce((select jsonb_agg(to_jsonb(qi)) from public.quotation_items qi where qi.user_id = v_user_id), '[]'::jsonb),
    'purchase_orders', coalesce((select jsonb_agg(to_jsonb(po)) from public.purchase_orders po where po.user_id = v_user_id), '[]'::jsonb),
    'purchase_items', coalesce((select jsonb_agg(to_jsonb(pi)) from public.purchase_items pi where pi.user_id = v_user_id), '[]'::jsonb),
    'inventory_movements', coalesce((select jsonb_agg(to_jsonb(im)) from public.inventory_movements im where im.user_id = v_user_id), '[]'::jsonb)
  );

  insert into public.operation_audit_logs(user_id, action, entity_table, entity_id, details)
  values (v_user_id, 'export_store_backup', 'backup', v_user_id::text, jsonb_build_object('exported_at', now()));

  return v_payload;
end;
$$;

grant execute on function public.export_store_backup() to authenticated;
