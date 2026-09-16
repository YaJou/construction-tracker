-- P0: profiles, roles, status labels, foreman, storage prep
-- Run in Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

-- 1) Project foreman
alter table public.projects
  add column if not exists foreman text;

-- 2) Persist status label overrides
create table if not exists public.setting_status_labels (
  id bigserial primary key,
  kind text not null check (kind in ('project', 'stage')),
  key text not null,
  label text not null,
  unique (kind, key)
);

-- 3) User profiles (Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'manager'
    check (role in ('owner', 'manager', 'foreman', 'client')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'manager')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Optional project membership for RLS (used when Auth is enforced)
create table if not exists public.project_members (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'foreman', 'client')),
  unique (project_id, user_id)
);

-- Photo assets metadata (Storage URLs). Keep legacy photos.file_path until migration of blobs.
create table if not exists public.photo_assets (
  id bigserial primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  stage_id bigint references public.stages(id) on delete set null,
  storage_path text not null,
  public_url text not null,
  thumbnail_url text,
  mime_type text,
  byte_size integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  comment text,
  created_at timestamptz not null default now()
);

-- Storage bucket (run once; ignore error if exists)
-- insert into storage.buckets (id, name, public) values ('project-photos', 'project-photos', false)
-- on conflict (id) do nothing;

-- Basic RLS scaffolding (enable after Auth is live; currently anon key still used by app)
alter table public.profiles enable row level security;
alter table public.project_members enable row level security;
alter table public.setting_status_labels enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'
  ));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "status_labels_read" on public.setting_status_labels;
create policy "status_labels_read"
  on public.setting_status_labels for select
  using (true);

drop policy if exists "status_labels_write_owner" on public.setting_status_labels;
create policy "status_labels_write_owner"
  on public.setting_status_labels for all
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'
  ));

comment on column public.projects.foreman is 'Project-level foreman display name (temporary until user_id FKs)';
comment on table public.profiles is 'App roles: owner=руководитель, manager, foreman=прораб, client';
