-- Prevent a sale/ticket from having more than one active invoice.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'sale_id'
  ) then
    execute $sql$
      create unique index if not exists idx_invoices_one_active_per_sale
      on public.invoices(sale_id)
      where sale_id is not null
        and coalesce(upper(status), 'ACTIVO') not in ('CANCELADO', 'CANCELLED', 'ANULADO')
    $sql$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'facturama_id'
  ) then
    execute $sql$
      create unique index if not exists idx_invoices_unique_facturama_id
      on public.invoices(facturama_id)
      where facturama_id is not null
        and coalesce(upper(status), 'ACTIVO') not in ('CANCELADO', 'CANCELLED', 'ANULADO')
    $sql$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'uuid_cfdi'
  ) then
    execute $sql$
      create unique index if not exists idx_invoices_unique_uuid_cfdi
      on public.invoices(uuid_cfdi)
      where uuid_cfdi is not null
        and coalesce(upper(status), 'ACTIVO') not in ('CANCELADO', 'CANCELLED', 'ANULADO')
    $sql$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoices'
      and column_name = 'uuid_fiscal'
  ) then
    execute $sql$
      create unique index if not exists idx_invoices_unique_uuid_fiscal
      on public.invoices(uuid_fiscal)
      where uuid_fiscal is not null
        and coalesce(upper(status), 'ACTIVO') not in ('CANCELADO', 'CANCELLED', 'ANULADO')
    $sql$;
  end if;
end $$;
