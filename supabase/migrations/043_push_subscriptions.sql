-- Calorie Manager: Web Push subscriptions (ticket #54)
-- One row per device (browser or installed app) that allowed notifications, owned by the Member
-- who is signed in on it. A Member reads and removes only their own rows. Saving goes through
-- save_push_subscription(), which also moves a device to the new Member when someone else signs in
-- on it (the endpoint is unique, and a Member could not take over another Member's row directly).
-- The server function send-push reads all rows with the service-role key and deletes the ones the
-- push service reports as gone (404/410). Dependents have no device, so only a Member with a login
-- can own a subscription.
--
-- The VAPID private key is never stored here: it lives only in the Edge Function's secrets.
-- Run against a LOCAL stack only; the tests are supabase/tests/push_subscriptions_test.sql.

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 2048),
  p256dh text not null check (length(p256dh) between 1 and 512),
  auth text not null check (length(auth) between 1 and 512),
  user_agent text check (length(user_agent) <= 512),
  created_at timestamptz not null default now()
);
create index push_subscriptions_member_idx on public.push_subscriptions (member_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

create policy push_subscriptions_read on public.push_subscriptions
  for select to authenticated
  using (member_id in (select m.id from public.members m where m.user_id = auth.uid()));

create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (member_id in (select m.id from public.members m where m.user_id = auth.uid()));

-- Saves this device's subscription for the signed-in Member. Allowing again, or another person
-- signing in on the same device, updates the one row for that endpoint.
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_member bigint;
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in before turning on notifications' using errcode = '28000';
  end if;
  select m.id into v_member from public.members m where m.user_id = auth.uid() limit 1;
  if v_member is null then
    raise exception 'No Member for this login' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (member_id, endpoint, p256dh, auth, user_agent)
  values (v_member, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 512))
  on conflict (endpoint) do update
    set member_id = excluded.member_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
