-- Виправлення попереджень Supabase Database Linter.
-- Запусти в Supabase SQL Editor (або як міграцію) ПІСЛЯ rls-policies.sql.
--
-- Що робить цей файл:
--   1a. Вмикає RLS на public.services (там є 6 рядків — не видаляємо).
--   1b. Видаляє 5 порожніх таблиць, яких немає в коді (medical_records,
--       documents, vaccinations, payments, push_tokens).
--      Разом це прибирає "RLS Disabled in Public" (CRITICAL) та
--      "Auth RLS Initialization Plan".
--   2. Фіксить "Function Search Path Mutable" для current_doctor_role та
--      is_head_doctor (додає set search_path = public).
--   3. Прибирає "Multiple Permissive Policies" на appointments (нічого
--      дублюючого тут не створюється — інструкція нижче, якщо лишилось старе).
--
-- Код звертається лише до: appointments, appointments_public, notices.
-- Список послуг у коді захардкоджено в src/lib/services.ts, таблиця services
-- ніде не читається — але дані в ній є, тож лишаємо її під захистом RLS.

-- ─── 1a. RLS на services (таблиця лишається) ─────────────────────────────────
--
-- Таблиця не використовується кодом, але містить дані. Вмикаємо RLS і закриваємо
-- доступ для anon. Читання дозволяємо лише authenticated; запис нікому з клієнта
-- (лишається тільки під service_role / SQL Editor). Якщо колись під'єднаєш
-- services до коду — додай потрібні insert/update/delete політики.

alter table public.services enable row level security;

revoke all on public.services from anon;
revoke all on public.services from authenticated;
grant select on public.services to authenticated;

drop policy if exists "services authenticated read" on public.services;

create policy "services authenticated read"
on public.services
for select
to authenticated
using (true);

-- ─── 1b. Видалення 5 порожніх таблиць ────────────────────────────────────────
--
-- Перевірено: усі 5 порожні (count = 0) і відсутні в коді. cascade прибирає
-- залежні політики/в'юхи.

drop table if exists public.medical_records cascade;
drop table if exists public.documents      cascade;
drop table if exists public.vaccinations   cascade;
drop table if exists public.payments       cascade;
drop table if exists public.push_tokens    cascade;

-- ─── 2. Function Search Path Mutable ─────────────────────────────────────────
--
-- Без фіксованого search_path функцію можна "обдурити", підсунувши об'єкт з
-- іншої схеми. Закріплюємо search_path = public (як уже зроблено в
-- appointment_prices). Тіло функцій лишається тим самим, що в rls-policies.sql.

create or replace function public.current_doctor_role()
returns text
language sql
stable
set search_path = public
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
set search_path = public
as $$
  select public.current_doctor_role() = 'head'
$$;

-- ─── 3. Auth RLS Initialization Plan (performance) ───────────────────────────
--
-- У політиках виклик auth.uid() обчислюється на КОЖЕН рядок. Обгортання у
-- (select auth.uid()) дозволяє Postgres обчислити його один раз на запит.
-- Стосується notices (insert-політика). Перестворюємо її.

drop policy if exists "notices head doctor insert" on public.notices;

create policy "notices head doctor insert"
on public.notices
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.is_head_doctor()
);

-- ─── 4. Multiple Permissive Policies на appointments ─────────────────────────
--
-- Попередження виникає, коли на одну дію (напр. SELECT) існує >1 permissive
-- політики — Postgres перевіряє їх усі. У rls-policies.sql на кожну дію
-- створюється рівно одна політика, тож після drop+create дублів бути не має.
-- Якщо лінтер усе ще скаржиться — значить лишились СТАРІ політики з іншою
-- назвою. Подивитись усі політики таблиці:
--
--   select policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'appointments';
--
-- і видалити зайві:  drop policy "<стара назва>" on public.appointments;
