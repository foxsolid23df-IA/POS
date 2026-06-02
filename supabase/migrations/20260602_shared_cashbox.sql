-- Shared cashbox mode for shops that use multiple PCs with one physical drawer.
-- Keeps the existing per-terminal mode as the default.

alter table public.profiles
  add column if not exists cashbox_mode text default 'terminal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_cashbox_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_cashbox_mode_check
      check (cashbox_mode in ('terminal', 'shared_cashbox'));
  end if;
end $$;

alter table public.cash_sessions
  add column if not exists session_scope text default 'terminal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_sessions_session_scope_check'
  ) then
    alter table public.cash_sessions
      add constraint cash_sessions_session_scope_check
      check (session_scope in ('terminal', 'shared_cashbox'));
  end if;
end $$;

create unique index if not exists idx_cash_sessions_one_open_shared_cashbox
on public.cash_sessions(user_id)
where status = 'open' and session_scope = 'shared_cashbox';

create index if not exists idx_cash_sessions_user_scope_status
on public.cash_sessions(user_id, session_scope, status);

alter table public.active_carts
  add column if not exists terminal_id uuid references public.terminals(id);

drop index if exists active_carts_session_id_idx;
alter table public.active_carts
  drop constraint if exists active_carts_session_id_key;

create unique index if not exists active_carts_session_terminal_idx
on public.active_carts(session_id, terminal_id);

create index if not exists idx_active_carts_user_session_terminal
on public.active_carts(user_id, session_id, terminal_id);

alter table public.cash_movements
  add column if not exists terminal_id uuid references public.terminals(id);

create index if not exists idx_cash_movements_user_session_terminal
on public.cash_movements(user_id, session_id, terminal_id);

alter table public.cash_cuts
  add column if not exists terminal_breakdown jsonb default '[]'::jsonb;
