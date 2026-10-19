-- Calorie Manager: Intake form (ticket #64)
-- What a Member answered on the Intake form, and their suggestion floor (ticket #70).
--
-- member_intake: one row per Member (CONTEXT.md, Intake form). Sex as the formula uses it, date
--   of birth, height in cm, work, planned exercise, goal and pace, and the suggestion floor:
--   on by default, kcal null meaning "the default for the Member's sex" (1,200 women /
--   1,500 men), or a number the Member chose. Weight is not kept here: it lives in the weight
--   log. Pregnancy and breastfeeding are asked on the screen but never stored.
-- Kept apart from member_settings on purpose: member_settings is readable by Members who share
--   with this Member (032); body measurements are not. Only the Member, or an adult of the
--   Household for a Dependent, reads and writes this row (private.my_member_ids, 007).
-- The Targets themselves are saved through member_settings, as Targets by hand (010) are.
--
-- The fixed lists live in the check constraints and in web/src/lib/intakeLogic.js; keep them in
-- step. Run against a LOCAL stack only; the tests are supabase/tests/member_intake_test.sql.

create table public.member_intake (
  member_id bigint primary key references public.members(id) on delete cascade,
  sex text check (sex in ('female', 'male')),
  birth_date date check (birth_date >= date '1900-01-01'),
  height_cm numeric(4, 1) check (height_cm between 50 and 260),
  work text check (work in ('sitting', 'on_feet', 'heavy')),
  exercise_sessions integer check (exercise_sessions between 0 and 21),
  exercise_minutes integer check (exercise_minutes between 0 and 600),
  goal text check (goal in ('lose', 'maintain', 'hand')),
  pace_kcal integer check (pace_kcal in (250, 500, 750)),
  floor_on boolean not null default true,
  floor_kcal integer check (floor_kcal between 500 and 5000),
  updated_at timestamptz not null default now()
);

alter table public.member_intake enable row level security;
revoke all on public.member_intake from anon;
grant select, insert, update on public.member_intake to authenticated;

create policy member_intake_read on public.member_intake
  for select to authenticated
  using (member_id in (select private.my_member_ids()));

create policy member_intake_insert on public.member_intake
  for insert to authenticated
  with check (member_id in (select private.my_member_ids()));

create policy member_intake_update on public.member_intake
  for update to authenticated
  using (member_id in (select private.my_member_ids()))
  with check (member_id in (select private.my_member_ids()));
