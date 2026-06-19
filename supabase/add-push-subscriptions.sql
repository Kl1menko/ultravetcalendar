-- Web Push підписки (PWA-сповіщення). Кожен пристрій лікаря, що дозволив
-- сповіщення, зберігає тут свою subscription. Розсилку робить окрема
-- Supabase Edge Function (service_role) — вона читає цю таблицю.
--
-- Запусти в Supabase SQL Editor ПІСЛЯ add-admin-role.sql (потрібен is_admin()
-- лише якщо колись захочеш адмінські політики; тут не використовується).
--
-- ⚠️ Тримай у синхроні з src/lib/push.ts.

-- ─── 1. Таблиця ───────────────────────────────────────────────────────────────

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Унікальний URL push-сервісу браузера для цього пристрою.
  endpoint    text not null,
  -- Ключі шифрування (p256dh, auth) з PushSubscription.toJSON().keys.
  p256dh      text not null,
  auth        text not null,
  -- Ім'я/роль власника зрізом — щоб Edge Function адресувала розсилку
  -- (напр. «оголошення → усім, крім автора»; «відповідь → автору тікета»).
  author_name text,
  created_at  timestamptz not null default now()
);

-- Один пристрій (endpoint) = один рядок; повторна підписка оновлює ключі.
create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions owner read"   on public.push_subscriptions;
drop policy if exists "push_subscriptions owner insert" on public.push_subscriptions;
drop policy if exists "push_subscriptions owner update" on public.push_subscriptions;
drop policy if exists "push_subscriptions owner delete" on public.push_subscriptions;

-- Кожен бачить/керує лише своїми підписками. (Розсилка йде через service_role
-- в Edge Function — вона RLS обходить, тож тут лише власник.)
create policy "push_subscriptions owner read"
on public.push_subscriptions
for select to authenticated
using (user_id = auth.uid());

create policy "push_subscriptions owner insert"
on public.push_subscriptions
for insert to authenticated
with check (user_id = auth.uid());

create policy "push_subscriptions owner update"
on public.push_subscriptions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_subscriptions owner delete"
on public.push_subscriptions
for delete to authenticated
using (user_id = auth.uid());

-- ─── 3. Гранти ────────────────────────────────────────────────────────────────

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
