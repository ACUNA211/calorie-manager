// The one server helper for every AI, Jev and translation call (ADR 0002, ticket #12).
// It runs inside Supabase Edge Functions with the service-role client, so it can write
// ai_usage, which the app cannot. The pure cap rules live in cap.ts and prices in prices.ts.
//
// Usage:
//   const gate = createAiGate({ client, householdId, memberId });
//   const draft = await gate.withAiCap('anthropic', 'claude-haiku-5-5', async () => {
//     const res = await callModel(...);
//     return { result: res.text, usage: { inputTokens: res.in, outputTokens: res.out } };
//   });
//
// Known limits: check-then-call-then-record is not atomic, so two calls running at the same
// moment can both pass a cap that is one call short. A failed call records nothing, because
// no tokens were used that we can count.

import {
  AI_LIMIT_MESSAGE,
  costUsd,
  decideCap,
  DEFAULT_MONTHLY_CAP_USD,
  type CapDecision,
  startOfMonthUtc,
  sumCostUsd,
} from './cap.ts';
import { priceFor } from './prices.ts';

export class AiLimitError extends Error {
  readonly code = 'AI_LIMIT_REACHED';
  readonly decision: CapDecision;

  constructor(decision: CapDecision) {
    super(AI_LIMIT_MESSAGE);
    this.name = 'AiLimitError';
    this.decision = decision;
  }
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface UsageResult<T> {
  result: T;
  usage: Usage;
}

// The subset of the supabase-js service-role client that this helper uses.
// Kept structural so the helper does not import the client library.
// deno-lint-ignore no-explicit-any
export type GateClient = { from: (table: string) => any };

export interface GateContext {
  client: GateClient;
  householdId: number;
  memberId?: number | null;
  now?: () => Date;
}

export interface AiGate {
  checkCap(provider: string): Promise<CapDecision>;
  recordUsage(args: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<number>;
  withAiCap<T>(
    provider: string,
    model: string,
    fn: () => Promise<UsageResult<T>>
  ): Promise<T>;
}

export function createAiGate(ctx: GateContext): AiGate {
  const now = ctx.now ?? (() => new Date());

  async function capFor(): Promise<number> {
    const { data, error } = await ctx.client
      .from('household_settings')
      .select('ai_monthly_cap_usd')
      .eq('household_id', ctx.householdId)
      .maybeSingle();
    if (error) throw error;
    return data ? Number(data.ai_monthly_cap_usd) : DEFAULT_MONTHLY_CAP_USD;
  }

  async function spendThisMonth(provider: string): Promise<number> {
    const { data, error } = await ctx.client
      .from('ai_usage')
      .select('cost_usd')
      .eq('household_id', ctx.householdId)
      .eq('provider', provider)
      .gte('created_at', startOfMonthUtc(now()));
    if (error) throw error;
    return sumCostUsd(data ?? []);
  }

  async function checkCap(provider: string): Promise<CapDecision> {
    const [capUsd, spendUsd] = await Promise.all([capFor(), spendThisMonth(provider)]);
    const decision = decideCap(spendUsd, capUsd);
    if (!decision.allowed) {
      throw new AiLimitError(decision);
    }
    return decision;
  }

  async function recordUsage(args: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<number> {
    const cost = costUsd(args.provider, args.model, args.inputTokens, args.outputTokens);
    const { error } = await ctx.client.from('ai_usage').insert({
      household_id: ctx.householdId,
      member_id: ctx.memberId ?? null,
      provider: args.provider,
      model: args.model,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      cost_usd: cost,
    });
    if (error) throw error;
    return cost;
  }

  async function withAiCap<T>(
    provider: string,
    model: string,
    fn: () => Promise<UsageResult<T>>
  ): Promise<T> {
    // Throws for an unpriced model before any money is spent
    priceFor(provider, model);
    await checkCap(provider);
    const { result, usage } = await fn();
    await recordUsage({
      provider,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    return result;
  }

  return { checkCap, recordUsage, withAiCap };
}
