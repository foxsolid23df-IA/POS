-- Fix pgcrypto search path for staff PIN functions.
-- This migration updates validate_staff_pin and set_staff_pin to include 'extensions' in their search_path,
-- allowing them to locate the crypt() and gen_salt() functions in Supabase environments where extensions are installed in the 'extensions' schema.

create or replace function public.validate_staff_pin(p_pin text)
returns table (
  id bigint,
  user_id uuid,
  name text,
  last_name text,
  role text,
  permissions jsonb,
  auth_method text,
  fingerprint_data text,
  active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin is null or length(trim(p_pin)) < 4 or length(trim(p_pin)) > 6 then
    return;
  end if;

  return query
  select
    s.id,
    s.user_id,
    s.name,
    s.last_name,
    s.role,
    s.permissions,
    s.auth_method,
    s.fingerprint_data,
    s.active,
    s.created_at
  from public.staff s
  where s.user_id = auth.uid()
    and s.active = true
    and s.pin_hash = crypt(trim(p_pin), s.pin_hash)
  limit 1;
end;
$$;

create or replace function public.set_staff_pin(p_staff_id bigint, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN invalido';
  end if;

  update public.staff
  set pin_hash = crypt(p_pin, gen_salt('bf')),
      pin = null
  where id = p_staff_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Empleado no encontrado';
  end if;
end;
$$;
