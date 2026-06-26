-- Fix: create exchange_rates table with proper RLS if it doesn't exist,
-- and clean up redundant/conflicting sale_payments policies that cause 500 errors.
--
-- ROOT CAUSE ANALYSIS:
-- 1. exchange_rates → 406 error: .single() when no rows exist
--    Fixed in frontend: changed to .maybeSingle()
-- 2. sales join 500 error: "Users can CRUD own sale payments" ALL policy
--    using user_id conflicted with the 2 SELECT/INSERT policies via FK join.
--    PostgREST fails with 500 (not 403) on policy conflicts during FK embedding.
-- 3. Large dataset: R.tape has 6,600+ sales. getSalesSince had no LIMIT.
--    Fixed in frontend: getSalesSince now paginates in 1,000-row chunks.

-- =====================================================
-- exchange_rates: create table + RLS (idempotent)
-- =====================================================
create table if not exists public.exchange_rates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  currency_code text not null default 'USD',
  rate numeric not null default 0,
  is_active boolean not null default false,
  created_at timestamptz default now()
);

alter table public.exchange_rates enable row level security;

drop policy if exists "Users can CRUD own exchange rates" on public.exchange_rates;
drop policy if exists "Users can CRUD own exchange_rates" on public.exchange_rates;

create policy "Users can CRUD own exchange rates"
on public.exchange_rates
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_exchange_rates_user_active
on public.exchange_rates(user_id, is_active);

-- =====================================================
-- sale_payments: remove conflicting ALL policy and
-- replace with correct SELECT/INSERT/UPDATE policies.
-- The ALL policy with user_id caused 500 errors because
-- PostgREST FK embedding (sales → sale_payments) failed
-- when the ALL policy conflicted with the SELECT policy.
-- =====================================================
drop policy if exists "Users can CRUD own sale payments" on public.sale_payments;
drop policy if exists "Users can view their own sale payments" on public.sale_payments;
drop policy if exists "Users can insert own sale payments" on public.sale_payments;

create policy "Users can view their own sale payments"
on public.sale_payments
for select
to authenticated
using (
  coalesce(user_id, (
    select s.user_id from public.sales s where s.id = sale_payments.sale_id
  )) = auth.uid()
);

create policy "Users can insert own sale payments"
on public.sale_payments
for insert
to authenticated
with check (
  coalesce(user_id, (
    select s.user_id from public.sales s where s.id = sale_payments.sale_id
  )) = auth.uid()
);

create policy "Users can update own sale payments"
on public.sale_payments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
