-- Auth follow-up: profile policies + helper to promote first owner
-- Run in Supabase SQL Editor after P0 migration.

-- Allow user to insert own profile (if trigger missed)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Allow owners to see all profiles (team list later)
drop policy if exists "profiles_select_owner_all" on public.profiles;
create policy "profiles_select_owner_all"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- Owners can update any profile role
drop policy if exists "profiles_update_owner" on public.profiles;
create policy "profiles_update_owner"
  on public.profiles for update
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- Example: make yourself owner (replace email)
-- update public.profiles
-- set role = 'owner'
-- where id = (select id from auth.users where email = 'you@company.ru');
