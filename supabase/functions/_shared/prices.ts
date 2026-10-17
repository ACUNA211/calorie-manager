// AI prices, one place for every provider and model. Values are US dollars per one million
// tokens, from .scratch/restart/research/costs.md. Change a price here and nowhere else.
//
// status: 'primary' = read on the provider's own pricing page (costs.md, 2026-10);
//         'secondary' = from an aggregator or price file; 'unverified' = blog reports only.
// Prices are read from this file at call time, so a changed price applies to the next call.

export type PriceStatus = 'primary' | 'secondary' | 'unverified';

export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
  status: PriceStatus;
  note?: string;
}

// provider -> model -> price
export const PRICES: Record<string, Record<string, ModelPrice>> = {
  anthropic: {
    // Meal Plan drafting and Recipe parsing (ADR 0002). The 1.3x tokenizer factor is already
    // in the token counts the API returns, so it is not applied again here.
    'claude-haiku-5-5': {
      inputPerMTok: 0.1,
      outputPerMTok: 0.5,
      status: 'primary',
      note: 'Cache reads and Batch discount not used yet',
    },
  },
  typesafe: {
    // Jev, the Rebalance and Voice decision model (ADR 0002). Output is free.
    jev: {
      inputPerMTok: 0.042,
      outputPerMTok: 0,
      status: 'unverified',
      note: 'Blog reports only; output free',
    },
  },
  google: {
    // Translation or fallback candidate (costs.md).
    'gemini-3.1-flash-lite': {
      inputPerMTok: 0.25,
      outputPerMTok: 1.5,
      status: 'primary',
    },
  },
  openai: {
    // Fallback if Jev goes away (ADR 0002 names gpt-6-luna).
    'gpt-6-luna': {
      inputPerMTok: 0.1,
      outputPerMTok: 0.5,
      status: 'secondary',
      note: 'From LiteLLM price file',
    },
  },
};

// Looks up a model's price. Throws for an unknown provider or model, so a call is never
// made without a known price (an unpriced call would escape the cap).
export function priceFor(provider: string, model: string): ModelPrice {
  const price = PRICES[provider]?.[model];
  if (!price) {
    throw new Error(`No price configured for ${provider}/${model}`);
  }
  return price;
}
