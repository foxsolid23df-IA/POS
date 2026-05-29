-- Tenant isolation cleanup for POS operational data.
-- Removes legacy open customer policy that allowed authenticated stores to see
-- customer and credit data from other stores.

alter table public.customers enable row level security;

drop policy if exists "Enable all for authenticated users on customers" on public.customers;
drop policy if exists "Public users can CRUD customers" on public.customers;
drop policy if exists "Users can CRUD own customers" on public.customers;

create policy "Users can CRUD own customers" on public.customers
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.credit_payments enable row level security;
drop policy if exists "Users can CRUD own credit_payments" on public.credit_payments;
create policy "Users can CRUD own credit_payments" on public.credit_payments
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.suppliers enable row level security;
drop policy if exists "Users can CRUD own suppliers" on public.suppliers;
create policy "Users can CRUD own suppliers" on public.suppliers
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.purchase_orders enable row level security;
drop policy if exists "Users can CRUD own purchase_orders" on public.purchase_orders;
create policy "Users can CRUD own purchase_orders" on public.purchase_orders
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.purchase_items enable row level security;
drop policy if exists "Users can CRUD own purchase_items" on public.purchase_items;
create policy "Users can CRUD own purchase_items" on public.purchase_items
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
