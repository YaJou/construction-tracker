-- Profiles: store email for admin user directory + access management
alter table public.profiles
  add column if not exists email text;

-- Keep email in sync on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'manager')
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

-- Backfill emails from auth.users (run as postgres / SQL editor)
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');
