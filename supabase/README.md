# P0 migrations (Supabase)

## 1. Основная миграция
1. Open Supabase → SQL Editor.
2. Paste and run `supabase/migrations/20260316_p0_auth_profiles_foreman.sql`.
3. Enable Email auth in Authentication → Providers.

## 2. Справочники (этапы / ответственные / типы / статусы)
1. Open SQL Editor → New query.
2. Paste and run `supabase/migrations/20260316_create_settings_directories.sql`
   (создаёт таблицы, если их ещё нет, отключает RLS, сидирует этапы).
3. Если таблицы уже были и сохранение всё равно «откатывается», дополнительно:
   `supabase/migrations/20260316_settings_tables_rls_off.sql`
4. Для статусов при необходимости: `20260316_fix_status_labels_access.sql`.

## 3. Auth (обязательный вход)
См. подробности: [AUTH.md](./AUTH.md)

1. Run `20260316_auth_profile_policies.sql`
2. Register via `/login`
3. Promote yourself to owner (SQL in AUTH.md)

## 4. Demo cards (optional, local only)
Set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local`. Do not enable on Vercel production.
