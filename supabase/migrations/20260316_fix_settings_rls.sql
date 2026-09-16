-- Fix RLS + ensure settings tables (including default substages).
-- Run ALL of this in Supabase → SQL Editor (one shot).

create table if not exists public.setting_default_stages (
  id bigint primary key,
  name text not null,
  order_index integer not null default 0
);

create table if not exists public.setting_default_substeps (
  id bigint primary key,
  stage_id bigint not null references public.setting_default_stages(id) on delete cascade,
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

alter table public.stage_substeps
  add column if not exists not_required boolean not null default false;
alter table public.stage_substeps
  add column if not exists skip_reason text;
alter table public.stage_substeps
  add column if not exists on_review boolean not null default false;

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
        'setting_default_substeps',
        'setting_managers',
        'setting_object_types',
        'setting_status_labels'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.setting_default_stages disable row level security;
alter table public.setting_default_substeps disable row level security;
alter table public.setting_managers disable row level security;
alter table public.setting_object_types disable row level security;
alter table public.setting_status_labels disable row level security;

grant select, insert, update, delete on public.setting_default_stages to anon, authenticated;
grant select, insert, update, delete on public.setting_default_substeps to anon, authenticated;
grant select, insert, update, delete on public.setting_managers to anon, authenticated;
grant select, insert, update, delete on public.setting_object_types to anon, authenticated;
grant select, insert, update, delete on public.setting_status_labels to anon, authenticated;

notify pgrst, 'reload schema';
