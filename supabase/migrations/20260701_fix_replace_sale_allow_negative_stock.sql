-- Fix replace_sale_with_new_sale: add p_allow_negative_stock parameter
-- so it matches the updated process_perfect_sale signature and respects
-- the store's allow_negative_stock setting during replacements.

create or replace function public.replace_sale_with_new_sale(
  p_original_sale_id bigint,
  p_replacement_reason text default 'Reemplazo por nuevo ticket',
  p_refund_amount numeric default null,
  p_restock boolean default true,
  p_total numeric default 0,
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
  v_user_id uuid := auth.uid();
  v_original_sale public.sales%rowtype;
  v_return public.sale_returns%rowtype;
  v_new_sale public.sales%rowtype;
  v_reason text;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  if p_user_id is not null and p_user_id <> v_user_id then
    raise exception 'No se puede reemplazar una venta de otro usuario';
  end if;

  select * into v_original_sale
  from public.sales
  where id = p_original_sale_id
    and user_id = v_user_id
  for update;

  if v_original_sale.id is null then
    raise exception 'Venta original no encontrada';
  end if;

  if coalesce(v_original_sale.sale_status, 'completed') in ('cancelled', 'returned') then
    raise exception 'La venta original ya fue cancelada o devuelta';
  end if;

  if coalesce(v_original_sale.sale_type, 'normal') = 'credit' then
    raise exception 'El reemplazo de tickets a credito no esta disponible en esta version';
  end if;

  v_reason := coalesce(nullif(trim(p_replacement_reason), ''), 'Reemplazo por nuevo ticket');

  v_return := public.cancel_sale_with_restock(
    p_original_sale_id,
    v_reason,
    p_refund_amount,
    coalesce(p_restock, true)
  );

  v_new_sale := public.process_perfect_sale(
    p_total,
    p_subtotal,
    p_tax_amount,
    v_user_id,
    p_currency,
    p_exchange_rate,
    p_amount_usd,
    p_payment_method,
    p_terminal_id,
    p_billing_issuer_id,
    p_items,
    p_payments,
    p_affect_inventory,
    p_allow_negative_stock
  );

  if to_regclass('public.operation_audit_logs') is not null then
    insert into public.operation_audit_logs(user_id, action, entity_table, entity_id, details)
    values (
      v_user_id,
      'replace_sale_with_new_sale',
      'sales',
      v_new_sale.id::text,
      jsonb_build_object(
        'original_sale_id', v_original_sale.id,
        'replacement_sale_id', v_new_sale.id,
        'return_id', v_return.id,
        'reason', v_reason,
        'refund_amount', coalesce(p_refund_amount, v_original_sale.paid_amount, v_original_sale.total, 0),
        'restock', coalesce(p_restock, true),
        'total', v_new_sale.total
      )
    );
  end if;

  return v_new_sale;
end;
$$;

grant execute on function public.replace_sale_with_new_sale(
  bigint,
  text,
  numeric,
  boolean,
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
  boolean,
  boolean
) to authenticated;

notify pgrst, 'reload schema';
