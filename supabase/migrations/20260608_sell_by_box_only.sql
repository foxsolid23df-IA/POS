-- Permite restringir productos para venderse unicamente por caja.

alter table public.products
  add column if not exists sell_by_box_only boolean not null default false;
