-- Запусти в Supabase SQL Editor ПІСЛЯ add-appointment-reminder.sql.
-- Додає нагадування КЛІЄНТАМ через Telegram-бот за ~2 год до прийому.
--
-- На відміну від send-reminders (push ЛІКАРЮ за 5 хв), тут окремий потік:
--   • telegram_clients      — прив'язка телефону клієнта до Telegram chat_id.
--   • appointments.client_reminded_at — маркер «клієнту вже нагадано» (окремий
--     від reminded_at, що належить push-нагадуванню лікарю).
--
-- Потік прив'язки: клієнт у боті тисне /start → ділиться контактом → Edge
-- Function telegram-bot зберігає (phone → chat_id). Розсилку робить Edge
-- Function send-client-reminders, яку щохвилини викликає pg_cron
-- (див. supabase/add-client-reminders-cron.sql).

-- ─── 1. Таблиця прив'язки телефон → Telegram ─────────────────────────────────
--
-- phone зберігаємо в КАНОНІЧНОМУ вигляді (0XXXXXXXXX, як normalizePhone у
-- src/lib/phone.ts), щоб матч із appointments.phone був точним за рівністю.

create table if not exists public.telegram_clients (
  phone       text        primary key,
  chat_id     bigint      not null,
  name        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- За chat_id теж шукаємо (напр. при /stop або повторному контакті).
create unique index if not exists telegram_clients_chat_id_idx
  on public.telegram_clients (chat_id);

-- Таблицю наповнює лише Edge Function (service_role). Клієнтам застосунку
-- доступ не потрібен — вмикаємо RLS без політик для anon/authenticated.
alter table public.telegram_clients enable row level security;
revoke all on public.telegram_clients from anon, authenticated;

-- ─── 2. Маркер «клієнту нагадано» на прийомі ─────────────────────────────────

alter table public.appointments
  add column if not exists client_reminded_at timestamptz;

-- COLUMN-LEVEL grants (як для reminded_at): фронт може скидати маркер при
-- редагуванні прийому, тож грантуємо authenticated.
grant select (client_reminded_at) on public.appointments to authenticated;
grant insert (client_reminded_at) on public.appointments to authenticated;
grant update (client_reminded_at) on public.appointments to authenticated;

-- Частковий індекс під запит cron-функції: «незавершені нагадування клієнту».
create index if not exists appointments_pending_client_reminders_idx
  on public.appointments (date, start_time)
  where remind = true and client_reminded_at is null;

-- ─── 3. View appointments_public — додаємо client_reminded_at у кінець ────────

drop view if exists public.appointments_public;

create view public.appointments_public
with (security_invoker = true)
as
select
  id, date, start_time, end_time, client, phone, pet, animal,
  age, weight, address,
  service, doctor, comment, price, status, created_by, created_at, updated_at,
  remind, reminded_at, client_reminded_at
from public.appointments;

revoke all on public.appointments_public from anon;
grant select on public.appointments_public to authenticated;
