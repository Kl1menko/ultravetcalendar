-- Запусти в Supabase SQL Editor ПІСЛЯ всіх попередніх міграцій
-- (зокрема add-appointment-status.sql, який востаннє перевизначав view
-- appointments_public). Додає «нагадування про прийом»:
--
--   remind       — чи слати push-нагадування за кілька хвилин до прийому.
--   reminded_at  — коли нагадування вже відправлено (NULL = ще ні). Захист від
--                  повторної розсилки: cron шле лише там, де reminded_at IS NULL.
--
-- Саму розсилку робить Edge Function send-reminders, яку щохвилини викликає
-- pg_cron — див. supabase/add-reminders-cron.sql.

-- ─── 1. Колонки в таблиці ────────────────────────────────────────────────────

alter table public.appointments
  add column if not exists remind      boolean     not null default false,
  add column if not exists reminded_at timestamptz;

-- Частковий індекс під запит cron-функції: «незавершені нагадування».
-- Покриває лише рядки, які реально треба перевіряти (remind=true, ще не слано).
create index if not exists appointments_pending_reminders_idx
  on public.appointments (date, start_time)
  where remind = true and reminded_at is null;

-- ─── 2. View appointments_public — додаємо remind/reminded_at у кінець ────────
--
-- create or replace view не вміє вставляти колонку в середину — лише в кінець.
-- Тому дропаємо й створюємо заново (канонічний вигляд — з add-appointment-status.sql).

drop view if exists public.appointments_public;

create view public.appointments_public
with (security_invoker = true)
as
select
  id, date, start_time, end_time, client, phone, pet, animal,
  age, weight, address,
  service, doctor, comment, price, status, created_by, created_at, updated_at,
  remind, reminded_at
from public.appointments;

revoke all on public.appointments_public from anon;
grant select on public.appointments_public to authenticated;
