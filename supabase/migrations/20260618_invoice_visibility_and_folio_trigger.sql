-- Keep stamped invoices visible to their owner and make folio usage follow invoice inserts.

do $$
begin
  if to_regclass('public.invoices') is not null then
    alter table public.invoices enable row level security;

    drop policy if exists "Users can view own invoices" on public.invoices;
    create policy "Users can view own invoices"
      on public.invoices
      for select
      using (auth.uid() = user_id);

    drop policy if exists "Users can insert own invoices" on public.invoices;
    create policy "Users can insert own invoices"
      on public.invoices
      for insert
      with check (auth.uid() = user_id);

    drop policy if exists "Users can update own invoices" on public.invoices;
    create policy "Users can update own invoices"
      on public.invoices
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.increment_invitation_consumed_folios()
returns trigger as $$
begin
  update public.invitation_codes
  set consumed_folios = consumed_folios + 1
  where used_by = new.user_id;

  return new;
end;
$$ language plpgsql security definer;

do $$
begin
  if to_regclass('public.invoices') is not null then
    drop trigger if exists tr_increment_consumed_folios on public.invoices;
    create trigger tr_increment_consumed_folios
      after insert on public.invoices
      for each row
      execute function public.increment_invitation_consumed_folios();
  end if;
end $$;
