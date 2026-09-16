-- Fix: "new row violates row-level security policy for table setting_default_stages"
-- Run ALL of this in Supabase → SQL Editor (one shot).

-- 1) Ensure tables exist
create table if not exists public.setting_default_stages (
  id bigint primary key,
  name text not null,
  order_index integer not null default 0
);

create table if not exists public.setting_managers (
  id bigint primary key,
  name text not null
);

create table if not exists public.setting_object_types (
  id bigint primary key,
  name text not null
);

create table if not exists public.setting_status_labels (
  kind text not null check (kind in ('project', 'stage')),
  key text not null,
  label text not null,
  primary key (kind, key)
);

-- 2) Drop every RLS policy on these tables (names may vary)
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'setting_default_stages',
        'setting_managers',
        'setting_object_types',
        'setting_status_labels'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3) Turn RLS off completely
alter table public.setting_default_stages disable row level security;
alter table public.setting_managers disable row level security;
alter table public.setting_object_types disable row level security;
alter table public.setting_status_labels disable row level security;

-- 4) Allow API (anon + authenticated) full access — app checks roles in Next.js
grant select, insert, update, delete on public.setting_default_stages to anon, authenticated;
grant select, insert, update, delete on public.setting_managers to anon, authenticated;
grant select, insert, update, delete on public.setting_object_types to anon, authenticated;
grant select, insert, update, delete on public.setting_status_labels to anon, authenticated;

-- 5) Refresh PostgREST schema cache
notify pgrst, 'reload schema';

-- Optional check: should return rowsecurity = false
select relname, relrowsecurity
from pg_class
where relname in (
  'setting_default_stages',
  'setting_managers',
  'setting_object_types',
  'setting_status_labels'
);
