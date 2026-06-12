-- Fix ambiguous PostgREST RPC resolution for credit sales.
-- `create or replace function` does not remove old overloads, so drop both
-- known signatures and recreate only the canonical date-based signature.

drop function if exists public.process_credit_sale(
  numeric,
  numeric,
  numeric,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  boolean,
  uuid,
  numeric,
  numeric,
  date
);

drop function if exists public.process_credit_sale(
  numeric,
  numeric,
  numeric,
  uuid,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  boolean,
  uuid,
  numeric,
  numeric,
  timestamp with time zone
);

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
    p_affect_inventory
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
  uuid,
  numeric,
  numeric,
  date
) to authenticated;

notify pgrst, 'reload schema';
