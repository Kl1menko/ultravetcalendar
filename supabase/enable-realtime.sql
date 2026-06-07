-- Вмикає Supabase Realtime для записів і сповіщень.
-- Запусти в Supabase SQL Editor.
--
-- Навіщо: фронт уже підписаний на postgres_changes (src/hooks/useAppointments.ts
-- та src/app/(app)/layout.tsx → notices), але Postgres не шле події, поки таблицю
-- не додано до publication supabase_realtime. Після цього SQL нові записи від
-- інших лікарів з'являтимуться в усіх відкритих клієнтів без ручного оновлення.
--
-- Альтернатива через UI: Dashboard → Database → Replication → supabase_realtime →
-- увімкнути appointments і notices. Цей SQL робить те саме.

-- ─── 1. REPLICA IDENTITY FULL ────────────────────────────────────────────────
--
-- Щоб події UPDATE/DELETE несли повний старий рядок (інакше приходять лише
-- ключі). Для INSERT не обов'язково, але підписка слухає '*', тож вмикаємо для
-- надійного спрацювання на всі типи змін.

alter table public.appointments replica identity full;
alter table public.notices      replica identity full;

-- ─── 2. Додаємо таблиці до publication ───────────────────────────────────────
--
-- add table падає з помилкою, якщо таблиця вже в publication, тож обгортаємо в
-- безпечну перевірку.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notices'
  ) then
    alter publication supabase_realtime add table public.notices;
  end if;
end $$;
