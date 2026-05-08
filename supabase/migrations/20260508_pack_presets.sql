-- Tabla para guardar configuraciones comunes de empaque (presets)
create table if not exists public.pack_presets (
    id uuid default gen_random_uuid() primary key,
    product_id bigint references public.products(id) on delete cascade,
    units numeric not null,
    price numeric not null,
    label text, -- Opcional: "Caja chica", "Master case", etc.
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users(id)
);

-- RLS
alter table public.pack_presets enable row level security;

create policy "Users can manage their own presets"
    on public.pack_presets
    for all
    using (auth.uid() = user_id);

-- Índices
create index if not exists idx_pack_presets_product_id on public.pack_presets(product_id);
