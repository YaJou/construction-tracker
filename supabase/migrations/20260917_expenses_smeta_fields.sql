-- Extend expenses to work as estimate (смета) lines:
-- category = раздел (Фундамент…), subcategory = позиция (Бетон…),
-- quantity × unit_price = amount.

alter table public.expenses
  add column if not exists subcategory text,
  add column if not exists quantity numeric,
  add column if not exists unit_price numeric,
  add column if not exists unit text,
  add column if not exists kind text;

-- Optional: keep RLS off if you use anon API writes (same pattern as elsewhere)
-- alter table public.expenses disable row level security;
