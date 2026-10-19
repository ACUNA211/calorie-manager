// Edge Function: send a push notification to a Member's devices (ticket #54). Thin wrapper:
// the handler, the VAPID signing and the encryption live in ../_shared/send-push.ts and
// ../_shared/web-push.ts and are tested from the web app.
//
// Secrets, set by the Owner with `supabase secrets set` (never committed):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (for example mailto:you@example.com).
// The Supabase URL and keys are provided to every Edge Function by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { handleSendPush, vapidFromEnv } from '../_shared/send-push.ts';

Deno.serve((req: Request) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // The caller's own client: row-level security decides which Member they are.
  const userClient = createClient(url, anonKey, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The service-role client reads every device and removes the ones that are gone.
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return handleSendPush(req, {
    userClient,
    serviceClient,
    serviceRoleKey: serviceKey,
    vapid: vapidFromEnv((name) => Deno.env.get(name)),
  });
});
