-- Run this in the Supabase SQL editor or as a migration.
--
-- Модель доступу (тримай у синхроні з src/lib/doctors.ts → DOCTOR_ACCESS):
--   head      — головний лікар (Остап): бачить усе, включно з сумами (price).
--   doctor    — звичайний лікар: бачить записи без price, має доступ до клієнтів.
--   assistant — асистент (Анна, Устим): бачить записи без price, без бази клієнтів (UI).
--
-- Важливо: у Supabase усі залогінені користувачі мають ОДНУ SQL-роль `authenticated`,
-- тож розрізнити head від інших на рівні column-GRANT не можна. Тому price захищаємо так:
--   1) колонка price недоступна напряму нікому (revoke column GRANT);
--   2) усі читають записи з view appointments_public (без price);
--   3) head отримує суми через security-definer RPC appointment_prices(),
--      яка повертає дані лише якщо викликач — головний лікар.

-- ─── Ролі за email ──────────────────────────────────────────────────────────

create or replace function public.current_doctor_role()
returns text
language sql
stable
as $$
  select case lower(coalesce(auth.jwt() ->> 'email', ''))
    when 'head@clinic.com'  then 'head'
    when 'yurii@clinic.com' then 'doctor'
    when 'ivan@clinic.com'  then 'assistant'
    when 'ustym@clinic.com' then 'assistant'
    when 'ania@clinic.com'  then 'assistant'
    else 'assistant'
  end
$$;

create or replace function public.is_head_doctor()
returns boolean
language sql
stable
as $$
  select public.current_doctor_role() = 'head'
$$;

-- ─── appointments: row-level security ────────────────────────────────────────

alter table public.appointments enable row level security;

drop policy if exists "appointments authenticated read" on public.appointments;
drop policy if exists "appointments authenticated insert" on public.appointments;
drop policy if exists "appointments authenticated update" on public.appointments;
drop policy if exists "appointments authenticated delete" on public.appointments;

create policy "appointments authenticated read"
on public.appointments
for select
to authenticated
using (true);

create policy "appointments authenticated insert"
on public.appointments
for insert
to authenticated
with check (true);

create policy "appointments authenticated update"
on public.appointments
for update
to authenticated
using (true)
with check (true);

create policy "appointments authenticated delete"
on public.appointments
for delete
to authenticated
using (true);

-- ─── price: недоступна напряму, лише через RPC ───────────────────────────────
--
-- Відкликаємо ВСІ привілеї на таблицю в anon та authenticated (Supabase за
-- замовчуванням видає обом ролям повний доступ, включно з колонкою price),
-- а потім видаємо поколонково БЕЗ price.
--
-- ⚠️ anon (неавтентифікований ключ) не повинен мати доступу до записів узагалі —
-- тож йому нічого не повертаємо; усі дані доступні лише authenticated.

revoke all on public.appointments from anon;
revoke all on public.appointments from authenticated;

grant select (
  id, date, start_time, end_time, client, phone, pet, animal,
  service, doctor, comment, created_by, created_at, updated_at
) on public.appointments to authenticated;

grant insert (
  date, start_time, end_time, client, phone, pet, animal,
  service, doctor, comment, created_by, price
) on public.appointments to authenticated;

grant update (
  date, start_time, end_time, client, phone, pet, animal,
  service, doctor, comment, created_by, updated_at, price
) on public.appointments to authenticated;

grant delete on public.appointments to authenticated;

-- price читати напряму не можна нікому (немає grant select(price)) — ні anon,
-- ні authenticated. Запис price дозволено authenticated (grant insert/update(price));
-- контроль того, ХТО пише, лишається на боці UI/коду; за потреби обмеж тригером
-- на is_head_doctor().

-- ─── appointments_public: view без price (джерело для всіх у коді) ───────────

create or replace view public.appointments_public
with (security_invoker = true)
as
select
  id, date, start_time, end_time, client, phone, pet, animal,
  service, doctor, comment, created_by, created_at, updated_at
from public.appointments;

revoke all on public.appointments_public from anon;
grant select on public.appointments_public to authenticated;

-- ─── appointment_prices(): суми лише для головного лікаря ────────────────────

create or replace function public.appointment_prices()
returns table (id uuid, price numeric)
language sql
security definer
set search_path = public
as $$
  select a.id, a.price
  from public.appointments a
  where public.is_head_doctor()
$$;

grant execute on function public.appointment_prices() to authenticated;

-- ─── notices: row-level security ─────────────────────────────────────────────

alter table public.notices enable row level security;

drop policy if exists "notices authenticated read" on public.notices;
drop policy if exists "notices head doctor insert" on public.notices;
drop policy if exists "notices head doctor delete" on public.notices;

create policy "notices authenticated read"
on public.notices
for select
to authenticated
using (true);

create policy "notices head doctor insert"
on public.notices
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_head_doctor()
);

create policy "notices head doctor delete"
on public.notices
for delete
to authenticated
using (public.is_head_doctor());
