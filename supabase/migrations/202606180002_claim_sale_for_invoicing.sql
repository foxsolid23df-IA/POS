-- Atomic reservation used by the timbrar Edge Function.
-- It prevents two requests from stamping the same sale at the same time.

update public.sales
set facturado = false
where facturado is null;

alter table public.sales
alter column facturado set default false;

create or replace function public.claim_sale_for_invoicing(p_sale_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sales
  set facturado = true
  where id = p_sale_id
    and coalesce(facturado, false) = false;

  return found;
end;
$$;

grant execute on function public.claim_sale_for_invoicing(bigint) to anon, authenticated, service_role;
