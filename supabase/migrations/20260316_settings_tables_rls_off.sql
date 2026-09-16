-- Settings directories are managed via server API with the anon key.
-- RLS with no policies makes writes appear to succeed (0 rows) and order never changes.
-- Run once in Supabase SQL Editor if stage reorder / manager saves fail.

alter table if exists public.setting_default_stages disable row level security;
alter table if exists public.setting_managers disable row level security;
alter table if exists public.setting_object_types disable row level security;
alter table if exists public.setting_status_labels disable row level security;
