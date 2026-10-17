-- Calorie Manager: a client id on the Calorie Log (ticket #34, Offline logging)
-- A phone that logs with no signal queues the entry and sends it later. It sends the same
-- client_id every time, so a retried send that the server already stored is refused by the
-- unique index instead of logging the food twice. The app treats that refusal (23505) as
-- "already saved". Existing rows keep NULL, which the unique index allows any number of times.
-- Run against a LOCAL stack only; the tests are ticket #69.

alter table public.calorie_log
  add column client_id uuid unique;

comment on column public.calorie_log.client_id is 'Id the phone made for an entry logged offline. Unique, so a resent entry is stored once. NULL for entries logged online before this column existed.';
