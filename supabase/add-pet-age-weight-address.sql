-- Додає три необов'язкові поля до записів:
--   age     — вік тварини (текст: «3 міс», «1.5 року»)
--   weight  — вага тварини (текст: «4.2 кг») — необов'язкове
--   address — адреса клієнта (текст) — необов'язкове
--
-- Усі три як text — вводяться вільним форматом (одиниці, дроби тощо).
-- Запусти в Supabase SQL editor ПІСЛЯ rls-policies.sql.

-- ─── 1. Колонки ──────────────────────────────────────────────────────────────

alter table public.appointments add column if not exists age     text;
alter table public.appointments add column if not exists weight  text;
alter table public.appointments add column if not exists address text;

-- ─── 2. GRANT-и (дублюють поколонкову модель з rls-policies.sql) ─────────────
--
-- Нові колонки не містять сум, тож доступні нарівні з рештою «публічних» полів.

grant select (age, weight, address) on public.appointments to authenticated;
grant insert (age, weight, address) on public.appointments to authenticated;
grant update (age, weight, address) on public.appointments to authenticated;

-- ─── 3. View appointments_public — додаємо нові колонки ──────────────────────

create or replace view public.appointments_public
with (security_invoker = true)
as
select
  id, date, start_time, end_time, client, phone, pet, animal,
  age, weight, address,
  service, doctor, comment, created_by, created_at, updated_at
from public.appointments;

revoke all on public.appointments_public from anon;
grant select on public.appointments_public to authenticated;
