-- Fix: allow status label saves while app still uses anon key (before full Auth).
-- Run this in Supabase SQL Editor if status labels don't save.

create table if not exists public.setting_status_labels (
  id bigserial primary key,
  kind text not null check (kind in ('project', 'stage')),
  key text not null,
  label text not null,
  unique (kind, key)
);

-- App currently writes with anon key — open this table until Auth/RLS is enforced on APIs
alter table public.setting_status_labels disable row level security;

grant select, insert, update, delete on public.setting_status_labels to anon, authenticated;
grant usage, select on sequence public.setting_status_labels_id_seq to anon, authenticated;
