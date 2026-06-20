-- Запусти в Supabase SQL Editor ПІСЛЯ add-appointment-reminder.sql і ПІСЛЯ
-- деплою Edge Function send-reminders (supabase functions deploy send-reminders).
--
-- Налаштовує pg_cron, що ЩОХВИЛИНИ викликає Edge Function send-reminders.
-- Функція сама знаходить прийоми, які почнуться за ≤5 хв, і шле push лікарю.
--
-- ⚠️ ПЕРЕД запуском підстав свої значення у блоці vault нижче:
--    • project_url — https://<project-ref>.supabase.co
--    • service_role_key — Settings → API → service_role (secret!)
--    Зберігаємо їх у Vault, щоб не світити ключ у визначенні cron-джоба.

-- ─── 1. Розширення ───────────────────────────────────────────────────────────

create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- ─── 2. Секрети у Vault ──────────────────────────────────────────────────────
--
-- Кладемо URL проєкту та service_role ключ у Vault (idempotent: оновлюємо,
-- якщо вже є). Cron-джоб читає їх звідти, а не з тексту запиту.

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'project_url',
  'Базовий URL Supabase-проєкту для виклику Edge Functions'
) where not exists (select 1 from vault.secrets where name = 'project_url');

select vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY',
  'service_role_key',
  'service_role ключ для авторизації виклику Edge Function із cron'
) where not exists (select 1 from vault.secrets where name = 'service_role_key');

-- Якщо секрети вже існували — онови їх значення вручну (підстав свої):
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'project_url'),
--   'https://YOUR_PROJECT_REF.supabase.co');
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'service_role_key'),
--   'YOUR_SERVICE_ROLE_KEY');

-- ─── 3. Cron-джоб: щохвилини POST на send-reminders ──────────────────────────
--
-- Знімаємо попередній джоб (idempotent перезапуск), потім ставимо новий.

select cron.unschedule('send-appointment-reminders')
where exists (select 1 from cron.job where jobname = 'send-appointment-reminders');

select cron.schedule(
  'send-appointment-reminders',
  '* * * * *',   -- щохвилини
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);

-- ─── Перевірка / діагностика ─────────────────────────────────────────────────
-- Список джобів:        select * from cron.job;
-- Останні запуски:      select * from cron.job_run_details order by start_time desc limit 20;
-- Зняти джоб:           select cron.unschedule('send-appointment-reminders');
