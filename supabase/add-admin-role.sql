-- Додає роль admin на рівні БД. Запусти в Supabase SQL Editor (або як міграцію)
-- ПІСЛЯ rls-policies.sql та appointment-prices-for-all.sql.
--
-- Контекст (тримай у синхроні з src/lib/doctors.ts → DOCTOR_ACCESS):
--   admin     — адміністратор системи (v.klimenko2014@gmail.com): бачить і може все.
--               На рівні БД прирівнюється до головного лікаря (is_head_doctor() = true),
--               тож отримує суми через RPC та право писати/видаляти сповіщення.
--   head      — головний лікар (Остап): як і раніше.
--   doctor / assistant — без змін.
--
-- Замінюємо лише дві функції — політики й гранти з rls-policies.sql уже
-- посилаються на is_head_doctor()/current_doctor_role(), тож їх чіпати не треба.

-- ─── 1. current_doctor_role(): додаємо admin-email ───────────────────────────

create or replace function public.current_doctor_role()
returns text
language sql
stable
as $$
  select case lower(coalesce(auth.jwt() ->> 'email', ''))
    when 'v.klimenko2014@gmail.com' then 'admin'
    when 'head@clinic.com'  then 'head'
    when 'yurii@clinic.com'  then 'doctor'
    when 'iryna@clinic.com'  then 'doctor'
    when 'ivan@clinic.com'   then 'assistant'
    when 'ustym@clinic.com'  then 'assistant'
    when 'ania@clinic.com'   then 'assistant'
    else 'assistant'
  end
$$;

-- ─── 2. Привілейований доступ: admin прирівнюється до head ────────────────────
--
-- is_head_doctor() використовується для:
--   • appointment_prices() RPC (суми) — admin тепер їх бачить;
--   • політик notices insert/delete — admin може писати/видаляти сповіщення.
-- Перейменовувати функцію не варто (на неї посилаються наявні політики), тож
-- просто розширюємо умову: true для head АБО admin.

create or replace function public.is_head_doctor()
returns boolean
language sql
stable
as $$
  select public.current_doctor_role() in ('head', 'admin')
$$;

-- Опційно: семантичний хелпер, якщо колись знадобиться відрізнити суто admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_doctor_role() = 'admin'
$$;
