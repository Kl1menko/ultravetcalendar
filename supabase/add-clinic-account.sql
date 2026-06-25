-- Запусти в Supabase SQL Editor ПІСЛЯ add-roles-tables.sql (#13 у MIGRATIONS.md).
--
-- Додає робочий (спільний) акаунт клініки `clinic@clinic.com` з тими самими
-- правами, що мають Устим/Іван/Анна — роль `doctor`:
--   • бачить календар і базу клієнтів,
--   • НЕ бачить аналітику цін (canSeePrices) і адмінку (canSeeAdmin),
--   • не прив'язаний до окремого лікаря (doctor_id = null) — це спільне робоче
--     місце, а не персональний акаунт лікаря.
--
-- ПЕРЕДУМОВА: спершу створи auth-користувача clinic@clinic.com у Supabase
-- (Authentication → Users → Add user, з паролем). Цей SQL лише заводить йому
-- рядок у profiles. Якщо юзера в auth.users ще немає — join нічого не вставить;
-- створи його й перезапусти цей файл (він idempotent).

insert into public.profiles (id, email, role, doctor_id)
select u.id, lower(u.email), 'doctor', null
from auth.users u
where lower(u.email) = 'clinic@clinic.com'
on conflict (id) do update
  set role = 'doctor', doctor_id = null, email = excluded.email;
