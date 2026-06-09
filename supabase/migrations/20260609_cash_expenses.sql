-- Metadatos profesionales para registrar gastos de caja sobre cash_movements.

alter table public.cash_movements
  add column if not exists category text,
  add column if not exists reference text,
  add column if not exists notes text,
  add column if not exists created_by_staff_id text,
  add column if not exists is_expense boolean not null default false;

create index if not exists idx_cash_movements_expense_lookup
on public.cash_movements(user_id, is_expense, created_at);

create index if not exists idx_cash_movements_expense_session
on public.cash_movements(user_id, session_id, is_expense);

notify pgrst, 'reload schema';
