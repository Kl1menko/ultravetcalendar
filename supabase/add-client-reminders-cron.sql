-- Запусти в Supabase SQL Editor ПІСЛЯ add-telegram-client-reminders.sql і ПІСЛЯ
-- деплою Edge Function send-client-reminders
-- (supabase functions deploy send-client-reminders).
--
-- Налаштовує pg_cron, що ЩОХВИЛИНИ викликає Edge Function
-- send-client-reminders. Функція знаходить прийоми, які почнуться за ~2 год,
-- і шле клієнту нагадування в Telegram.
--
-- Передумова: project_url і service_role_key вже у Vault (їх кладе
-- add-reminders-cron.sql). Якщо ще ні — спочатку запусти його блок №2.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Перезапуск idempotent: знімаємо попередній джоб, ставимо новий.
select cron.unschedule('send-client-reminders')
where exists (select 1 from cron.job where jobname = 'send-client-reminders');

select cron.schedule(
  'send-client-reminders',
  '* * * * *',   -- щохвилини
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/send-client-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);

-- Перевірка: select * from cron.job;
-- Зняти:     select cron.unschedule('send-client-reminders');
