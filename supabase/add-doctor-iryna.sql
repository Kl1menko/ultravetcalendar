-- Додає лікаря Ірину (iryna@clinic.com) з правами як у Юрія (роль 'doctor').
-- Запусти в Supabase SQL Editor.
--
-- ⚠️ Тримай у синхроні з src/lib/doctors.ts → DOCTOR_ACCESS.
-- Роль 'doctor': бачить суми у записах і має доступ до клієнтів, але БЕЗ аналітики.
--
-- Окрім цього SQL, створи користувача в Supabase Auth:
--   Dashboard → Authentication → Users → Add user
--     Email:    iryna@clinic.com
--     Password: (згенерований нижче — або свій)
--   та увімкни «Auto Confirm User», щоб вона могла одразу залогінитись.

-- ─── Оновлюємо мапінг email → роль ───────────────────────────────────────────
--
-- Функція використовується в RLS-політиках і RPC. Додаємо гілку для Ірини.

create or replace function public.current_doctor_role()
returns text
language sql
stable
set search_path = public
as $$
  select case lower(coalesce(auth.jwt() ->> 'email', ''))
    when 'head@clinic.com'  then 'head'
    when 'yurii@clinic.com' then 'doctor'
    when 'iryna@clinic.com' then 'doctor'
    when 'ivan@clinic.com'  then 'assistant'
    when 'ustym@clinic.com' then 'assistant'
    when 'ania@clinic.com'  then 'assistant'
    else 'assistant'
  end
$$;
