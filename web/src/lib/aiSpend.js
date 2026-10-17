// Reads this month's AI spend for the Owner's Household. Every function takes the Supabase
// client as its first argument so tests can pass a fake. The spend comes from the
// ai_spend_this_month() SQL function (migration 008), which only the Owner may call.

import { DEFAULT_MONTHLY_CAP_USD } from '../../../supabase/functions/_shared/cap.ts';

export async function loadAiSpend(client) {
  const [spendResult, capResult] = await Promise.all([
    client.rpc('ai_spend_this_month'),
    client.from('household_settings').select('ai_monthly_cap_usd').maybeSingle(),
  ]);
  if (spendResult.error) throw spendResult.error;
  if (capResult.error) throw capResult.error;

  const capUsd =
    capResult.data?.ai_monthly_cap_usd != null
      ? Number(capResult.data.ai_monthly_cap_usd)
      : DEFAULT_MONTHLY_CAP_USD;

  return {
    capUsd,
    rows: (spendResult.data ?? []).map((row) => ({
      provider: row.provider_name,
      spendUsd: Number(row.spend_usd),
    })),
  };
}
