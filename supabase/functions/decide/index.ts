// Edge Function: typed decisions for Rebalance and Voice commands (ticket #58). Thin wrapper:
// the handler, the provider fallback and the AI cap live in ../_shared/decide.ts and are
// tested from the web app.
//
// Secrets (set by the Owner with `supabase secrets set`): TYPESAFE_API_KEY (Jev),
// OPENAI_API_KEY (OpenAI Decisions), ANTHROPIC_API_KEY (text-model fallback); a provider
// without a key is skipped. DECISION_PROVIDERS (default "jev,openai,haiku") and the optional
// DECISION_PROVIDERS_EN / DECISION_PROVIDERS_ES set the order. The Supabase URL and keys are
// provided to every Edge Function by the platform.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { handleDecideRequest } from "../_shared/decide.ts";

Deno.serve((req: Request) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // The caller's own client: row-level security decides which Member the handler finds.
  const userClient = createClient(url, anonKey, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // The service-role client writes the AI ledger (ai_usage), which the app cannot.
  const serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return handleDecideRequest(req, {
    userClient,
    serviceClient,
    keys: {
      typesafe: Deno.env.get("TYPESAFE_API_KEY"),
      openai: Deno.env.get("OPENAI_API_KEY"),
      anthropic: Deno.env.get("ANTHROPIC_API_KEY"),
    },
    env: {
      DECISION_PROVIDERS: Deno.env.get("DECISION_PROVIDERS"),
      DECISION_PROVIDERS_EN: Deno.env.get("DECISION_PROVIDERS_EN"),
      DECISION_PROVIDERS_ES: Deno.env.get("DECISION_PROVIDERS_ES"),
    },
    fetchFn: fetch,
  });
});
