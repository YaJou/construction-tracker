# P0 migrations (Supabase)

1. Open Supabase → SQL Editor.
2. Paste and run `supabase/migrations/20260316_p0_auth_profiles_foreman.sql`.
3. Enable Email auth in Authentication → Providers.
4. (Optional for local demo only) set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local`.

Until RLS is fully wired in API routes, the app still uses the anon key and allows open access. Auth UI at `/login` is ready; enforce session + RLS after the SQL migration and service-role/API auth pass.
