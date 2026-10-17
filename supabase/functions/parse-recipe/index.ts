// Edge Function: parse a pasted Recipe (ticket #30). Thin wrapper: the handler, the AI cap
// and the reply check live in ../_shared/parse-recipe.ts and are tested from the web app.
//
// Secrets: ANTHROPIC_API_KEY (set by the Owner with `supabase secrets set`). The Supabase
// URL and keys are provided to every Edge Function by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { handleParseRequest } from '../_shared/parse-recipe.ts';

Deno.serve((req: Request) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // The caller's own client: row-level security decides which Members the handler can see.
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

  return handleParseRequest(req, {
    userClient,
    serviceClient,
    apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    fetchFn: fetch,
  });
});
