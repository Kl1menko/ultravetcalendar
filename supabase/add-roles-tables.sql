-- Запусти в Supabase SQL Editor (або як міграцію) ПІСЛЯ всіх попередніх файлів
-- (див. supabase/MIGRATIONS.md). Цей файл робить таблицю `profiles` ЄДИНИМ
-- джерелом ролей та прав і замінює рольову частину rls-policies.sql / add-admin-role.sql.
--
-- Раніше роль визначалася у ДВОХ місцях, які треба було синхронізувати вручну:
--   • фронт  — src/lib/doctors.ts → DOCTOR_ACCESS (hardcoded email → role)
--   • БД      — current_doctor_role() через case lower(auth.jwt()->>'email')
-- Тепер роль зберігається в profiles; current_doctor_role()/is_head_doctor()
-- читають її звідти, а фронт отримує її через RPC current_user_profile().
--
-- Модель доступу (значення ролей не змінюються — лише джерело):
--   admin     — адміністратор системи: бачить і може все; на рівні БД = head.
--   head      — головний лікар (Остап): бачить усе, включно з сумами (price).
--   doctor    — звичайний лікар: записи без price, доступ до клієнтів.
--   assistant — асистент: записи без price, без бази клієнтів (UI).

-- ─── 1. roles: lookup фіксованих ролей ───────────────────────────────────────

create table if not exists public.roles (
  key   text primary key,
  label text not null,
  rank  int  not null
);

insert into public.roles (key, label, rank) values
  ('admin',     'Адмін системи',  100),
  ('head',      'Головний лікар',  80),
  ('doctor',    'Лікар',           50),
  ('assistant', 'Асистент',        20)
on conflict (key) do update
  set label = excluded.label, rank = excluded.rank;

-- ─── 2. doctors: довідник лікарів ────────────────────────────────────────────
--
-- name = ключ прив'язки записів (= appointments.doctor). НЕ змінювати значення —
-- вони мають збігатися з тим, що вже лежить у appointments.doctor.

create table if not exists public.doctors (
  id        uuid primary key default gen_random_uuid(),
  name      text unique not null,
  color_idx int,
  active    boolean not null default true
);

-- Порядок color_idx відповідає DOCTOR_COLORS у src/lib/doctors.ts.
insert into public.doctors (name, color_idx) values
  ('Остап (головний лікар)', 0),
  ('Юрій (лікар)',           1),
  ('Ірина (лікар)',          2),
  ('Устим (асистент)',       3),
  ('Іван (асистент)',        4),
  ('Анна (асистент)',        5)
on conflict (name) do update
  set color_idx = excluded.color_idx;

-- ─── 3. profiles: ЄДИНЕ джерело прав ─────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null references public.roles(key) default 'assistant',
  doctor_id  uuid references public.doctors(id),
  created_at timestamptz not null default now()
);

-- ─── 4. Seed профілів для наявних 7 акаунтів ─────────────────────────────────
--
-- Прив'язуємо за email до вже створених auth.users. Мапінг ролей та лікарів
-- відповідає попередньому DOCTOR_ACCESS із src/lib/doctors.ts.
-- Якщо якогось акаунта ще немає в auth.users — рядок просто не вставиться (join
-- нічого не дасть); створи юзера й перезапусти цей блок.

insert into public.profiles (id, email, role, doctor_id)
select u.id,
       lower(u.email),
       m.role,
       d.id
from (values
  ('v.klimenko2014@gmail.com', 'admin',  'Остап (головний лікар)'),
  ('head@clinic.com',          'head',   'Остап (головний лікар)'),
  ('yurii@clinic.com',         'doctor', 'Юрій (лікар)'),
  ('iryna@clinic.com',         'doctor', 'Ірина (лікар)'),
  ('ustym@clinic.com',         'doctor', 'Устим (асистент)'),
  ('ivan@clinic.com',          'doctor', 'Іван (асистент)'),
  ('ania@clinic.com',          'doctor', 'Анна (асистент)')
) as m(email, role, doctor_name)
join auth.users u   on lower(u.email) = m.email
left join public.doctors d on d.name = m.doctor_name
on conflict (id) do update
  set role = excluded.role, doctor_id = excluded.doctor_id, email = excluded.email;

-- ─── 5. current_doctor_role() / is_head_doctor(): читання з profiles ──────────
--
-- Тіла переписано на читання з profiles. Наявні політики й RPC
-- (appointment_prices, notices insert/delete) посилаються на ці функції — тож
-- перемикання на таблицю відбувається без зміни самих політик.

create or replace function public.current_doctor_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'assistant'
  )
$$;

create or replace function public.is_head_doctor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_doctor_role() in ('head', 'admin')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_doctor_role() = 'admin'
$$;

-- has_profile(): чи має поточний користувач рядок у profiles (валідна роль у
-- клініці). Використовується в RLS appointments — щоб писати/змінювати могли
-- лише члени команди, а не будь-який authenticated із валідною сесією.
create or replace function public.has_profile()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;

-- ─── 6. current_user_profile(): роль + ім'я лікаря для фронту ─────────────────
--
-- Повертає роль і ім'я прив'язаного лікаря для поточного auth.uid().
-- Фронт викликає це один раз після логіну й кладе в CalendarContext.

create or replace function public.current_user_profile()
returns table (role text, doctor_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.role, d.name
  from public.profiles p
  left join public.doctors d on d.id = p.doctor_id
  where p.id = auth.uid()
$$;

grant execute on function public.current_user_profile() to authenticated;

-- ─── 7. RLS на нових таблицях ────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.roles    enable row level security;
alter table public.doctors  enable row level security;

-- profiles: кожен читає свій рядок; повний доступ — лише admin.
drop policy if exists "profiles read own"   on public.profiles;
drop policy if exists "profiles admin write" on public.profiles;

create policy "profiles read own"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles admin write"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- roles / doctors: читають усі authenticated; пишуть лише admin.
drop policy if exists "roles read"        on public.roles;
drop policy if exists "roles admin write" on public.roles;

create policy "roles read"
on public.roles
for select
to authenticated
using (true);

create policy "roles admin write"
on public.roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "doctors read"        on public.doctors;
drop policy if exists "doctors admin write" on public.doctors;

create policy "doctors read"
on public.doctors
for select
to authenticated
using (true);

create policy "doctors admin write"
on public.doctors
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ─── 8. Догнати ролі на вже-засіяній БД (idempotent) ─────────────────────────
--
-- Якщо profiles уже заповнено попереднім запуском, цей блок піднімає всіх
-- колишніх assistant до doctor. admin та head не чіпаємо. Безпечно запускати
-- окремо від решти файлу.

update public.profiles
set role = 'doctor'
where role = 'assistant';

-- ─── 9. appointments: посилення RLS ──────────────────────────────────────────
--
-- Раніше всі політики були permissive (using/check = true) — будь-який
-- authenticated міг читати/створювати/змінювати/видаляти БУДЬ-ЩО, навіть без
-- профілю в клініці. Закриваємо так:
--   • SELECT  — лишаємо всім authenticated (спільний календар клініки).
--   • INSERT  — лише члени команди (has_profile()); created_by вільний.
--   • UPDATE  — лише члени команди (has_profile()).
--   • DELETE  — автор запису (created_by = auth.uid()) АБО head/admin.
-- «Видалення клієнта» (масове видалення історії) лишається head/admin: кнопку
-- показуємо лише їм (UI), а RLS усе одно не дасть doctor видалити чужі записи.

drop policy if exists "appointments authenticated read"   on public.appointments;
drop policy if exists "appointments authenticated insert" on public.appointments;
drop policy if exists "appointments authenticated update" on public.appointments;
drop policy if exists "appointments authenticated delete" on public.appointments;

create policy "appointments team read"
on public.appointments
for select
to authenticated
using (true);

create policy "appointments team insert"
on public.appointments
for insert
to authenticated
with check (public.has_profile());

create policy "appointments team update"
on public.appointments
for update
to authenticated
using (public.has_profile())
with check (public.has_profile());

create policy "appointments author or head delete"
on public.appointments
for delete
to authenticated
using (created_by = auth.uid() or public.is_head_doctor());
