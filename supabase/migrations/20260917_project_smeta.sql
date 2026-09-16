-- Project estimate (смета): sections with materials/labor line items.
-- Apply in Supabase SQL Editor. RLS off so anon API writes work (same pattern as settings).

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

create index if not exists project_smeta_sections_project_idx
  on public.project_smeta_sections (project_id, order_index);

create index if not exists project_smeta_items_section_idx
  on public.project_smeta_items (section_id, order_index);

create index if not exists project_smeta_items_project_idx
  on public.project_smeta_items (project_id);

alter table public.project_smeta_sections disable row level security;
alter table public.project_smeta_items disable row level security;

grant all on public.project_smeta_sections to anon, authenticated, service_role;
grant all on public.project_smeta_items to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
