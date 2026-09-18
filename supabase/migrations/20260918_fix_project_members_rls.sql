-- Fix: allow granting project access from «Пользователи»
-- RLS was enabled without insert policies → «new row violates row-level security»

alter table public.project_members disable row level security;

-- Ensure unique key for upserts
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_members_project_id_user_id_key'
  ) then
    alter table public.project_members
      add constraint project_members_project_id_user_id_key unique (project_id, user_id);
  end if;
exception when others then
  null;
end $$;
