-- Settings directories are managed via server API with the anon key.
-- Prefer 20260316_create_settings_directories.sql (creates tables + disables RLS).
-- Use this only if tables already exist and writes are blocked by RLS.

alter table if exists public.setting_default_stages disable row level security;
alter table if exists public.setting_managers disable row level security;
alter table if exists public.setting_object_types disable row level security;
alter table if exists public.setting_status_labels disable row level security;
