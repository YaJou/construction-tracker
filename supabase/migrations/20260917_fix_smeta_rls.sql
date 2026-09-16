-- Fix smeta writes if tables exist but inserts fail (RLS / grants).
-- Run in Supabase SQL Editor once.

create table if not exists public.project_smeta_sections (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects (id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.project_smeta_items (
  id bigint generated always as identity primary key,
  section_id bigint not null references public.project_smeta_sections (id) on delete cascade,
  project_id bigint not null references public.projects (id) on delete cascade,
  name text not null,
  unit text not null default 'шт',
  quantity numeric,
  unit_price numeric,
  kind text not null default 'material',
  note text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.project_smeta_sections disable row level security;
alter table public.project_smeta_items disable row level security;

drop policy if exists "project_smeta_sections_all" on public.project_smeta_sections;
drop policy if exists "project_smeta_items_all" on public.project_smeta_items;

grant all on table public.project_smeta_sections to anon, authenticated, service_role;
grant all on table public.project_smeta_items to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
