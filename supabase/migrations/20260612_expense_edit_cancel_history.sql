-- Historial para editar y cancelar gastos de caja sin borrar registros.

alter table public.cash_movements
  add column if not exists expense_status text not null default 'active',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by_staff_name text,
  add column if not exists cancellation_reason text,
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by_staff_name text,
  add column if not exists edit_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_expense_status_check'
      and conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_expense_status_check
      check (expense_status in ('active', 'cancelled'));
  end if;
end $$;

update public.cash_movements
set expense_status = 'active'
where expense_status is null;

create index if not exists idx_cash_movements_expense_status
on public.cash_movements(user_id, is_expense, expense_status, created_at);

notify pgrst, 'reload schema';
