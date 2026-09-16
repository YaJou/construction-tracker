-- Fix profiles RLS + set latest user as owner (run once in SQL Editor)

-- Simple policies without recursive role checks
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_owner_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_owner" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Show who is who
select u.email, p.role, p.full_name, p.id
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;

-- Make the MOST RECENTLY registered user the owner
update public.profiles
set role = 'owner'
where id = (
  select id from auth.users
  order by created_at desc
  limit 1
);

-- Verify
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
order by u.created_at desc;
