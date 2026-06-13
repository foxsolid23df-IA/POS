-- Precio especial configurable por cantidad de cajas.

alter table public.products
  add column if not exists box_special_price numeric,
  add column if not exists box_special_from_qty numeric;

alter table public.products
  drop constraint if exists products_box_special_price_non_negative,
  drop constraint if exists products_box_special_from_qty_non_negative;

alter table public.products
  add constraint products_box_special_price_non_negative
    check (box_special_price is null or box_special_price >= 0) not valid,
  add constraint products_box_special_from_qty_non_negative
    check (box_special_from_qty is null or box_special_from_qty >= 0) not valid;

notify pgrst, 'reload schema';
