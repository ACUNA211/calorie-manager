// Pure AI cap logic. No Deno APIs, no database, no network: the Edge Function helper
// (ai-gate.ts) and the web app's tests both import this file.

import { priceFor } from './prices.ts';

export const DEFAULT_MONTHLY_CAP_USD = 5;
export const AI_LIMIT_MESSAGE = 'AI limit reached this month';

export interface CapDecision {
  allowed: boolean;
  spendUsd: number;
  capUsd: number;
  remainingUsd: number;
}

// A call is refused when this month's spend has reached the cap: spend at or over the cap
// is refused, so a cap of $5 allows calls until spend is $4.999999 and stops at $5.00.
export function decideCap(spendUsd: number, capUsd: number): CapDecision {
  const remainingUsd = roundUsd(capUsd - spendUsd);
  return {
    allowed: spendUsd < capUsd,
    spendUsd: roundUsd(spendUsd),
    capUsd,
    remainingUsd: remainingUsd < 0 ? 0 : remainingUsd,
  };
}

export function isAtOrOverCap(spendUsd: number, capUsd: number): boolean {
  return spendUsd >= capUsd;
}

// Cost of one call in USD, from token counts and the configured price.
export function costUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const price = priceFor(provider, model);
  const raw =
    (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000;
  return roundUsd(raw, 6);
}

// Sum of ledger cost_usd values. PostgREST may return numeric as a string, so each value is
// converted before adding, and the total is rounded to six decimals.
export function sumCostUsd(rows: ReadonlyArray<{ cost_usd: number | string | null }>): number {
  let total = 0;
  for (const row of rows) {
    total += Number(row.cost_usd ?? 0);
  }
  return roundUsd(total, 6);
}

// The first instant of the calendar month that contains `now`, in UTC, as an ISO string.
export function startOfMonthUtc(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function roundUsd(value: number, places = 6): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
