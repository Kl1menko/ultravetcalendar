-- Запусти в Supabase SQL Editor ПІСЛЯ rls-policies.sql (таблиця appointments).
-- Порядок неважливий відносно інших add-* міграцій — це лише індекс.
--
-- Етап 1 оптимізації завантаження: фронт більше не тягне всю історію записів, а
-- лише «робоче вікно» з нижньою межею дати (fetchAppointments({ fromDate }) у
-- src/lib/appointments.ts, дефолт — з 1 січня минулого року у
-- src/hooks/useAppointments.ts). Запит фільтрує по date і сортує по
-- (date, start_time) — цей індекс його покриває, тож із ростом таблиці
-- вибірка не деградує до повного сканування.

create index if not exists appointments_date_start_idx
  on public.appointments (date, start_time);
