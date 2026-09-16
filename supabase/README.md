# P0 migrations (Supabase)

## 1. Основная миграция
1. Open Supabase → SQL Editor.
2. Paste and run `supabase/migrations/20260316_p0_auth_profiles_foreman.sql`.
3. Enable Email auth in Authentication → Providers.

## 2. Если статусы в «Справочниках» не сохраняются
1. Open SQL Editor → New query.
2. Paste and run `supabase/migrations/20260316_fix_status_labels_access.sql`.
3. Refresh `/settings` and edit a status label again (e.g. `Планирование1`).

## 3. Demo cards (optional, local only)
Set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local`. Do not enable on Vercel production.

Until RLS is fully wired in API routes, the app still uses the anon key and allows open access. Auth UI at `/login` is ready; enforce session + RLS after the SQL migration and service-role/API auth pass.
