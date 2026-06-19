-- Відповіді на тікети (баги/покращення): тред під кожним фідбеком.
-- Запусти в Supabase SQL Editor ПІСЛЯ add-feedback.sql та add-admin-role.sql
-- (потрібні таблиця feedback та is_admin()).
--
-- Модель:
--   • На тікет відповідають ЛИШЕ admin та автор самого тікета (feedback.created_by).
--   • Уся команда ЧИТАЄ відповіді (тред видно всім, хто бачить дошку).
--   • Видаляє відповідь — admin або автор самої відповіді.
--
-- ⚠️ Тримай у синхроні з src/lib/feedback.ts та src/types/index.ts.

-- ─── 1. Таблиця ───────────────────────────────────────────────────────────────

create table if not exists public.feedback_replies (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  body        text not null,
  -- Ім'я автора зрізом на момент створення — щоб показати без джойна в auth.users.
  author_name text,
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_replies_feedback_idx
  on public.feedback_replies (feedback_id, created_at);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

alter table public.feedback_replies enable row level security;

drop policy if exists "feedback_replies authenticated read"        on public.feedback_replies;
drop policy if exists "feedback_replies admin or author insert"    on public.feedback_replies;
drop policy if exists "feedback_replies author or admin delete"    on public.feedback_replies;

-- Читають усі залогінені.
create policy "feedback_replies authenticated read"
on public.feedback_replies
for select
to authenticated
using (true);

-- Пише admin АБО автор батьківського тікета. created_by має бути самим юзером.
create policy "feedback_replies admin or author insert"
on public.feedback_replies
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_admin()
    or exists (
      select 1 from public.feedback f
      where f.id = feedback_id and f.created_by = auth.uid()
    )
  )
);

-- Видаляє admin або автор самої відповіді.
create policy "feedback_replies author or admin delete"
on public.feedback_replies
for delete
to authenticated
using (public.is_admin() or created_by = auth.uid());

-- ─── 3. Гранти ────────────────────────────────────────────────────────────────

revoke all on public.feedback_replies from anon;
grant select, insert, delete on public.feedback_replies to authenticated;

-- ─── 4. Realtime ──────────────────────────────────────────────────────────────

alter table public.feedback_replies replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.feedback_replies;
exception
  when duplicate_object then null;
end $$;
