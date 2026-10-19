// Edge Function: read a Nutrition Facts label from a photo (ticket #66). Thin wrapper: the
// handler, the AI cap and the reply check live in ../_shared/read-label.ts and are tested
// from the web app.
//
// Secrets: ANTHROPIC_API_KEY (set by the Owner with `supabase secrets set`, the same key
// parse-recipe uses). The Supabase URL and keys are provided to every Edge Function by the
// platform.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { handleReadLabelRequest } from '../_shared/read-label.ts';

Deno.serve((req: Request) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // The caller's own client: row-level security decides which photos and Members it sees.
  const userClient = createClient(url, anonKey, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The service-role client writes the AI ledger (ai_usage), which the app cannot.
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return handleReadLabelRequest(req, {
    userClient,
    serviceClient,
    apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    fetchFn: fetch,
  });
});
