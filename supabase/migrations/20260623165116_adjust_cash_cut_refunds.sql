-- Make sale cancellation refunds affect cash only for the cash-paid portion.

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
  v_total_refund numeric;
  v_cash_paid numeric := 0;
  v_cash_refund numeric := 0;
  v_payment_count integer := 0;
  v_session_id bigint;
  v_payment_method text;
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

  v_total_refund := coalesce(p_refund_amount, v_sale.paid_amount, v_sale.total, 0);

  select count(*), coalesce(sum(
    case
      when lower(trim(coalesce(payment_method, ''))) in ('efectivo', 'cash')
        and upper(coalesce(currency, 'MXN')) = 'MXN'
      then coalesce(amount, 0)
      else 0
    end
  ), 0)
  into v_payment_count, v_cash_paid
  from public.sale_payments
  where sale_id = v_sale.id;

  if v_payment_count = 0 then
    v_payment_method := lower(trim(coalesce(v_sale.payment_method, 'efectivo')));
    if v_payment_method in ('efectivo', 'cash') then
      v_cash_paid := v_total_refund;
    end if;
  end if;

  v_cash_refund := least(greatest(coalesce(v_total_refund, 0), 0), greatest(coalesce(v_cash_paid, 0), 0));

  insert into public.sale_returns (
    user_id, sale_id, terminal_id, reason, refund_amount, restock
  )
  values (
    v_user_id, v_sale.id, v_sale.terminal_id, coalesce(nullif(trim(p_reason), ''), 'Cancelacion de venta'), v_total_refund, coalesce(p_restock, true)
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
      case when coalesce(v_sale.total, 0) > 0 then (v_item.total / v_sale.total) * v_total_refund else 0 end
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
      refunded_amount = v_total_refund,
      balance = 0,
      credit_status = case when sale_type = 'credit' then 'cancelled' else credit_status end
  where id = v_sale.id and user_id = v_user_id;

  if v_sale.sale_type = 'credit' and v_sale.customer_id is not null then
    update public.customers
    set credit_balance = greatest(coalesce(credit_balance, 0) - coalesce(v_sale.balance, 0), 0)
    where id = v_sale.customer_id and user_id = v_user_id;
  end if;

  if v_cash_refund > 0 then
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
        v_user_id, v_session_id, 'salida', v_cash_refund,
        'Devolucion/cancelacion venta #' || v_sale.id,
        'Sistema'
      );
    end if;
  end if;

  insert into public.operation_audit_logs(user_id, action, entity_table, entity_id, details)
  values (
    v_user_id, 'cancel_sale_with_restock', 'sales', v_sale.id::text,
    jsonb_build_object(
      'reason', p_reason,
      'refund_amount', v_total_refund,
      'cash_refund_amount', v_cash_refund,
      'restock', p_restock,
      'return_id', v_return.id
    )
  );

  return v_return;
end;
$$;

grant execute on function public.cancel_sale_with_restock(bigint, text, numeric, boolean) to authenticated;
