-- Зворотний канал команда → admin: тікети про баги та покращення.
-- Запусти в Supabase SQL Editor (або як міграцію) ПІСЛЯ rls-policies.sql
-- та add-admin-role.sql (потрібні is_admin() / current_doctor_role()).
--
-- Модель:
--   • Будь-який залогінений член команди СТВОРЮЄ тікет (created_by = він сам).
--   • Уся команда ЧИТАЄ всі тікети (спільна дошка багів).
--   • Тип: 'bug' | 'improvement'. Статус: 'new' | 'in_progress' | 'done'.
--   • Статус міняє лише admin. Видаляє — admin або автор тікета.
--
-- ⚠️ Тримай у синхроні з src/lib/feedback.ts та src/types/index.ts.

-- ─── 1. Enum-типи (ідемпотентно) ─────────────────────────────────────────────

do $$
begin
  create type public.feedback_type as enum ('bug', 'improvement');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.feedback_status as enum ('new', 'in_progress', 'done');
exception
  when duplicate_object then null;
end $$;

-- ─── 2. Таблиця ───────────────────────────────────────────────────────────────

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  type        public.feedback_type   not null default 'bug',
  status      public.feedback_status not null default 'new',
  title       text not null,
  body        text,
  -- Зберігаємо ім'я автора зрізом на момент створення — щоб у списку було видно
  -- хто написав, без джойна в auth.users (туди RLS не пускає клієнт).
  author_name text,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists feedback_status_idx on public.feedback (status);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- updated_at автоматично при апдейті статусу.
create or replace function public.feedback_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.feedback_touch_updated_at();

-- ─── 3. RLS ───────────────────────────────────────────────────────────────────

alter table public.feedback enable row level security;

drop policy if exists "feedback authenticated read"   on public.feedback;
drop policy if exists "feedback authenticated insert"  on public.feedback;
drop policy if exists "feedback admin update"          on public.feedback;
drop policy if exists "feedback author or admin delete" on public.feedback;

-- Читають усі залогінені (спільна дошка).
create policy "feedback authenticated read"
on public.feedback
for select
to authenticated
using (true);

-- Створює будь-хто залогінений, від свого імені.
create policy "feedback authenticated insert"
on public.feedback
for insert
to authenticated
with check (created_by = auth.uid());

-- Статус (та будь-яке поле) міняє лише admin.
create policy "feedback admin update"
on public.feedback
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Видаляє admin або автор тікета.
create policy "feedback author or admin delete"
on public.feedback
for delete
to authenticated
using (public.is_admin() or created_by = auth.uid());

-- ─── 4. Гранти ────────────────────────────────────────────────────────────────

revoke all on public.feedback from anon;
grant select, insert, update, delete on public.feedback to authenticated;

-- ─── 5. Realtime (опційно, для живих оновлень) ────────────────────────────────
-- Додаємо таблицю до публікації realtime, як зроблено для notices/appointments.

do $$
begin
  alter publication supabase_realtime add table public.feedback;
exception
  when duplicate_object then null;
end $$;
