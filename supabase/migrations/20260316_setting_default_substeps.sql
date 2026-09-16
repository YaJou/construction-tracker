-- Default substage templates for directories (copied into projects on create).
-- Also adds not_required / on_review on project stage_substeps.

create table if not exists public.setting_default_substeps (
  id bigint primary key,
  stage_id bigint not null references public.setting_default_stages(id) on delete cascade,
  name text not null,
  order_index integer not null default 0
);

create index if not exists setting_default_substeps_stage_idx
  on public.setting_default_substeps (stage_id, order_index);

alter table public.setting_default_substeps disable row level security;

grant select, insert, update, delete on public.setting_default_substeps to anon, authenticated;

-- Project substeps: skip from progress + review state
alter table public.stage_substeps
  add column if not exists not_required boolean not null default false;

alter table public.stage_substeps
  add column if not exists skip_reason text;

alter table public.stage_substeps
  add column if not exists on_review boolean not null default false;

notify pgrst, 'reload schema';
