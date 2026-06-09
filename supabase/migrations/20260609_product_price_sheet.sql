-- Campos para ficha de precios tipo inventario profesional.

alter table public.products
  add column if not exists special_price_2 numeric default 0,
  add column if not exists wholesale_from_qty numeric,
  add column if not exists special_from_qty numeric;

alter table public.products
  drop constraint if exists products_special_price_2_non_negative,
  drop constraint if exists products_wholesale_from_qty_non_negative,
  drop constraint if exists products_special_from_qty_non_negative;

alter table public.products
  add constraint products_special_price_2_non_negative
    check (special_price_2 is null or special_price_2 >= 0) not valid,
  add constraint products_wholesale_from_qty_non_negative
    check (wholesale_from_qty is null or wholesale_from_qty >= 0) not valid,
  add constraint products_special_from_qty_non_negative
    check (special_from_qty is null or special_from_qty >= 0) not valid;

notify pgrst, 'reload schema';
