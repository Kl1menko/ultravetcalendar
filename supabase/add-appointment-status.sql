-- Додає статус запису:
--   Заплановано  — створено, попереду (default)
--   Очікує       — клієнт у клініці, чекає на прийом
--   В кабінеті    — прийом триває
--   Завершено    — прийом завершено
--   Скасовано    — запис скасовано
--
-- Статус використовується для mini-summary дня (завершено / очікує) і кольорових
-- pill-бейджів у деталях запису. Тримай значення enum у синхроні з
-- src/lib/status.ts (STATUSES) та src/types/index.ts (AppointmentStatus).
--
-- Запусти в Supabase SQL editor ПІСЛЯ rls-policies.sql та
-- appointment-prices-for-all.sql (бо нижче перевизначаємо appointments_public).

-- ─── 1. Enum-тип (ідемпотентно) ──────────────────────────────────────────────

do $$
begin
  create type public.appointment_status as enum (
    'Заплановано', 'Очікує', 'В кабінеті', 'Завершено', 'Скасовано'
  );
exception
  when duplicate_object then null;
end $$;

-- ─── 2. Колонка status ───────────────────────────────────────────────────────
--
-- Можливі три ситуації:
--   (a) колонки немає      → створюємо enum-колонку з default;
--   (b) колонка вже є text  → нормалізуємо англ. значення в укр. і кастимо в enum;
--   (c) колонка вже enum    → нічого не робимо.
-- Старі дані могли містити англомовні статуси (SCHEDULED, WAITING, COMPLETED…),
-- тож зводимо їх до канонічних укр. значень перед кастом у enum.

do $$
declare
  col_type text;
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'appointments' and column_name = 'status';

  if col_type is null then
    -- (a) Колонки немає — створюємо одразу enum
    alter table public.appointments
      add column status public.appointment_status not null default 'Заплановано';

  elsif col_type <> 'USER-DEFINED' then
    -- (b) Колонка є, але не enum (text/varchar) — нормалізуємо й кастимо.
    -- Спершу прибираємо старий default, щоб не заважав зміні типу.
    alter table public.appointments alter column status drop default;

    update public.appointments set status =
      case lower(coalesce(nullif(trim(status), ''), 'заплановано'))
        when 'scheduled'   then 'Заплановано'
        when 'planned'     then 'Заплановано'
        when 'заплановано' then 'Заплановано'
        when 'waiting'     then 'Очікує'
        when 'pending'     then 'Очікує'
        when 'очікує'      then 'Очікує'
        when 'in_progress' then 'В кабінеті'
        when 'in-progress' then 'В кабінеті'
        when 'in_office'   then 'В кабінеті'
        when 'в кабінеті'  then 'В кабінеті'
        when 'completed'   then 'Завершено'
        when 'done'        then 'Завершено'
        when 'finished'    then 'Завершено'
        when 'завершено'   then 'Завершено'
        when 'cancelled'   then 'Скасовано'
        when 'canceled'    then 'Скасовано'
        when 'скасовано'   then 'Скасовано'
        else 'Заплановано'
      end;

    alter table public.appointments
      alter column status type public.appointment_status
      using status::public.appointment_status;

    alter table public.appointments
      alter column status set default 'Заплановано';

    alter table public.appointments
      alter column status set not null;
  end if;
  -- (c) col_type = 'USER-DEFINED' (вже enum) — пропускаємо.
end $$;

-- ─── 3. GRANT-и (за поколонковою моделлю з rls-policies.sql) ─────────────────
--
-- status не містить сум, тож доступний нарівні з рештою «публічних» полів.

grant select (status) on public.appointments to authenticated;
grant insert (status) on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;

-- ─── 4. appointments_public — додаємо status у кінець вибірки ────────────────
--
-- ⚠️ create or replace view не вміє вставляти колонку в середину — лише
-- дописувати в кінець. Тому дропаємо й створюємо заново. Канонічний актуальний
-- вигляд view (з price) — з appointment-prices-for-all.sql; додаємо status.

drop view if exists public.appointments_public;

create view public.appointments_public
with (security_invoker = true)
as
select
  id, date, start_time, end_time, client, phone, pet, animal,
  age, weight, address,
  service, doctor, comment, price, status, created_by, created_at, updated_at
from public.appointments;

revoke all on public.appointments_public from anon;
grant select on public.appointments_public to authenticated;
