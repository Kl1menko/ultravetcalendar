-- Відкриває суму (price) у записах для ВСІХ залогінених користувачів.
-- Запусти в Supabase SQL Editor (або як міграцію) ПІСЛЯ rls-policies.sql.
--
-- Контекст: раніше price був прихований від усіх, крім головного лікаря —
-- view appointments_public не містив price, а суми доливались head-у через
-- security-definer RPC appointment_prices(). Тепер бізнес-вимога змінилась:
-- суми на тікетах/у деталях записів мають бачити ВСІ користувачі.
-- Доступ до сторінки «Аналітика» при цьому лишається лише в head — це
-- контролюється на боці UI (canSeePrices) і цього файлу не стосується.
--
-- ⚠️ Тримай у синхроні з src/lib/doctors.ts (canSeeAppointmentPrices = всі).

-- ─── 1. price знову доступний authenticated напряму ──────────────────────────
--
-- У rls-policies.sql column-GRANT на price було відкликано. Повертаємо select
-- на price для authenticated, щоб view нижче (security_invoker) міг його читати.
-- anon, як і раніше, не має доступу до записів узагалі.

grant select (price) on public.appointments to authenticated;

-- ─── 2. appointments_public тепер містить price ──────────────────────────────
--
-- View читають усі в коді (fetchAppointments). Додаємо price у вибірку, тож
-- суми приходять кожному authenticated без RPC.
--
-- ⚠️ create or replace не вміє додавати колонку в СЕРЕДИНУ списку наявного view
-- (Postgres сприймає це як перейменування колонок → ERROR 42P16). Тому спершу
-- видаляємо view, потім створюємо заново з price.

drop view if exists public.appointments_public;

create view public.appointments_public
with (security_invoker = true)
as
select
  id, date, start_time, end_time, client, phone, pet, animal,
  service, doctor, comment, price, created_by, created_at, updated_at
from public.appointments;

revoke all on public.appointments_public from anon;
grant select on public.appointments_public to authenticated;

-- ─── 3. appointment_prices() RPC лишається для зворотної сумісності ───────────
--
-- Тепер суми вже є у view, тож фронт може брати їх звідти напряму. RPC більше
-- не обов'язковий, але лишаємо як є, щоб нічого не зламати. За потреби прибрати:
--   drop function if exists public.appointment_prices();
