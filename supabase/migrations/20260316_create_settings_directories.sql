-- Create directories tables used by /api/settings (may be missing on older projects).
-- Run in Supabase → SQL Editor, then reload the schema if needed (Dashboard → refresh).

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

alter table public.setting_default_stages disable row level security;
alter table public.setting_managers disable row level security;
alter table public.setting_object_types disable row level security;
alter table public.setting_status_labels disable row level security;

-- Seed default stages only when the table is empty
insert into public.setting_default_stages (id, name, order_index)
select * from (values
  (1::bigint, 'Подготовка участка', 0),
  (2::bigint, 'Фундамент', 1),
  (3::bigint, 'Стены', 2),
  (4::bigint, 'Крыша', 3),
  (5::bigint, 'Окна и двери', 4),
  (6::bigint, 'Инженерные системы', 5),
  (7::bigint, 'Внутренняя отделка', 6),
  (8::bigint, 'Фасад', 7),
  (9::bigint, 'Благоустройство', 8),
  (10::bigint, 'Сдача и приёмка', 9)
) as v(id, name, order_index)
where not exists (select 1 from public.setting_default_stages limit 1);

-- Seed object types only when empty
insert into public.setting_object_types (id, name)
select * from (values
  (1::bigint, 'Коттедж'),
  (2::bigint, 'ЖК'),
  (3::bigint, 'Таунхаусы'),
  (4::bigint, 'Коммерческое здание'),
  (5::bigint, 'Реконструкция')
) as v(id, name)
where not exists (select 1 from public.setting_object_types limit 1);

notify pgrst, 'reload schema';
