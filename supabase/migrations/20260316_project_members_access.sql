-- Project membership access (run in SQL Editor)

create table if not exists public.project_members (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'foreman', 'client')),
  unique (project_id, user_id)
);

-- API currently uses anon key for DB writes — keep open until service-role migration
alter table public.project_members disable row level security;

-- Authenticated users can read team profiles (member picker)
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_owner_all" on public.profiles;
drop policy if exists "profiles_select_team" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;

create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Backfill: owners/managers get access to all existing projects
insert into public.project_members (project_id, user_id, role)
select pr.id, pf.id, case when pf.role = 'owner' then 'owner' else 'manager' end
from public.projects pr
cross join public.profiles pf
where pf.role in ('owner', 'manager')
  and coalesce(pf.is_active, true) = true
on conflict (project_id, user_id) do nothing;
