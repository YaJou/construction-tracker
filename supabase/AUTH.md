# Авторизация СтройУчёт

## Что уже в коде
- Middleware: без входа нельзя открыть `/dashboard`, `/projects`, `/reports`, `/settings` и `/api/*`
- `/login` — вход, регистрация, сброс пароля
- В сайдбаре — имя, роль, «Выйти»
- API проверяет сессию; клиент не может менять данные (только просмотр)
- Справочники (PATCH) — только роли `owner` и `manager`

## Шаги в Supabase

### 1. Миграции (если ещё не делали)
1. `20260316_p0_auth_profiles_foreman.sql`
2. `20260316_fix_status_labels_access.sql`
3. `20260316_auth_profile_policies.sql`

### 2. Email Auth
Authentication → Providers → Email → Enabled.  
Для теста можно выключить **Confirm email**.

### 3. Первый руководитель
После регистрации выполните (подставьте свой email):

```sql
update public.profiles
set role = 'owner'
where id = (select id from auth.users where email = 'you@company.ru');
```

Роли: `owner` (руководитель), `manager`, `foreman`, `client`.

### 4. Проверка
1. Откройте сайт → «Открыть приложение» → должен быть редирект на `/login`
2. Зарегистрируйтесь / войдите → дашборд
3. В сайдбаре — ваше имя и роль
4. «Выйти» → снова `/login`
