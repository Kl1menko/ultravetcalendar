-- Run this in the Supabase SQL editor or as a migration.
-- Replace the email below if NEXT_PUBLIC_HEAD_DOCTOR_EMAIL changes.

alter table public.appointments enable row level security;
alter table public.notices enable row level security;

drop policy if exists "appointments authenticated read" on public.appointments;
drop policy if exists "appointments authenticated insert" on public.appointments;
drop policy if exists "appointments authenticated update" on public.appointments;
drop policy if exists "appointments authenticated delete" on public.appointments;

create policy "appointments authenticated read"
on public.appointments
for select
to authenticated
using (true);

create policy "appointments authenticated insert"
on public.appointments
for insert
to authenticated
with check (true);

create policy "appointments authenticated update"
on public.appointments
for update
to authenticated
using (true)
with check (true);

create policy "appointments authenticated delete"
on public.appointments
for delete
to authenticated
using (true);

drop policy if exists "notices authenticated read" on public.notices;
drop policy if exists "notices head doctor insert" on public.notices;
drop policy if exists "notices head doctor delete" on public.notices;

create policy "notices authenticated read"
on public.notices
for select
to authenticated
using (true);

create policy "notices head doctor insert"
on public.notices
for insert
to authenticated
with check (
  created_by = auth.uid()
  and auth.jwt() ->> 'email' = 'head@clinic.com'
);

create policy "notices head doctor delete"
on public.notices
for delete
to authenticated
using (auth.jwt() ->> 'email' = 'head@clinic.com');
