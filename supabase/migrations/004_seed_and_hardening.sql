

-- Pin search paths flagged by the Supabase security advisor
alter function public.usda_kcal(jsonb) set search_path = public;
alter function public.store_section_for(text) set search_path = public;
alter function public.usda_hit(jsonb) set search_path = public;

-- USDA key in Vault (DEMO_KEY to start) and the http extension
--   create extension if not exists http with schema extensions;
--   select vault.create_secret('DEMO_KEY', 'usda_api_key', 'USDA FoodData Central API key');

-- Starter Meal Times from Sergio's stated habits (edit on the Times tab)
--   Breakfast 7:30 Planned 250-450 every day; Lunch 12:00 Planned 400-700 (not Tue);
--   Work lunch (free) 12:00 Set 900 Tue; Work snack 15:00 If room 80-120 Mon-Fri;
--   Dinner 18:30 Planned 500-900 every day; Evening snack 20:30 If room 150-250 every day.

-- usda_get with retries: the first DNS lookup from the database can time out
create or replace function public.usda_get(p_path text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  k text;
  resp extensions.http_response;
  tries int := 0;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'usda_api_key';
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '8000');
  loop
    tries := tries + 1;
    begin
      resp := extensions.http_get('https://api.nal.usda.gov/fdc/v1/' || p_path
              || case when p_path like '%?%' then '&' else '?' end || 'api_key=' || coalesce(k, 'DEMO_KEY'));
      exit;
    exception when others then
      if tries >= 3 then raise exception 'Could not reach USDA (%). Try again in a moment.', sqlerrm; end if;
      perform pg_sleep(0.5);
    end;
  end loop;
  if resp.status = 429 then
    raise exception 'USDA rate limit reached; try again later (or add a free data.gov key)';
  elsif resp.status <> 200 then
    raise exception 'USDA returned status %', resp.status;
  end if;
  return resp.content::jsonb;
end $$;
revoke all on function public.usda_get(text) from public, anon, authenticated;
