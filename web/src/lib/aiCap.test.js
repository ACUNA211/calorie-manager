import { describe, it, expect } from 'vitest';
import {
  decideCap,
  isAtOrOverCap,
  costUsd,
  sumCostUsd,
  startOfMonthUtc,
  DEFAULT_MONTHLY_CAP_USD,
} from '../../../supabase/functions/_shared/cap.ts';
import { PRICES, priceFor } from '../../../supabase/functions/_shared/prices.ts';

describe('decideCap', () => {
  it('allows a call when spend is under the cap', () => {
    const decision = decideCap(4.5, 5);
    expect(decision.allowed).toBe(true);
    expect(decision.remainingUsd).toBe(0.5);
  });

  it('refuses a call when spend is exactly at the cap', () => {
    const decision = decideCap(5, 5);
    expect(decision.allowed).toBe(false);
    expect(decision.remainingUsd).toBe(0);
  });

  it('refuses a call when spend is over the cap, with no negative remainder', () => {
    const decision = decideCap(5.25, 5);
    expect(decision.allowed).toBe(false);
    expect(decision.remainingUsd).toBe(0);
  });

  it('uses $5 as the default monthly cap', () => {
    expect(DEFAULT_MONTHLY_CAP_USD).toBe(5);
  });
});

describe('isAtOrOverCap', () => {
  it('is false under the cap, true at the cap and true over it', () => {
    expect(isAtOrOverCap(4.99, 5)).toBe(false);
    expect(isAtOrOverCap(5, 5)).toBe(true);
    expect(isAtOrOverCap(5.01, 5)).toBe(true);
  });
});

describe('costUsd', () => {
  it('prices Haiku 5.5 at $0.10 input and $0.50 output per million tokens', () => {
    // 1,000,000 input tokens and 1,000,000 output tokens
    expect(costUsd('anthropic', 'claude-haiku-5-5', 1_000_000, 1_000_000)).toBe(0.6);
  });

  it('charges nothing for Jev output', () => {
    expect(costUsd('typesafe', 'jev', 1_000_000, 5_000_000)).toBe(0.042);
  });

  it('throws for an unknown provider or model, so an unpriced call cannot run', () => {
    expect(() => costUsd('nobody', 'x', 1, 1)).toThrow(/No price configured/);
    expect(() => priceFor('anthropic', 'claude-unknown')).toThrow(/No price configured/);
  });

  it('has a price for every configured model', () => {
    for (const [provider, models] of Object.entries(PRICES)) {
      for (const model of Object.keys(models)) {
        expect(costUsd(provider, model, 1000, 1000)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('sumCostUsd', () => {
  it('adds ledger rows, including numeric values returned as strings', () => {
    expect(sumCostUsd([{ cost_usd: '0.1' }, { cost_usd: 0.2 }, { cost_usd: null }])).toBe(0.3);
  });

  it('is zero for no rows', () => {
    expect(sumCostUsd([])).toBe(0);
  });
});

describe('startOfMonthUtc', () => {
  it('returns midnight UTC on the first day of the month', () => {
    expect(startOfMonthUtc(new Date('2026-10-17T15:30:00Z'))).toBe('2026-10-01T00:00:00.000Z');
  });
});
