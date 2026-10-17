import { describe, it, expect, vi } from 'vitest';
import { createAiGate, AiLimitError } from '../../../supabase/functions/_shared/ai-gate.ts';

// A fake service-role client. ai_usage rows are kept in memory, so the gate's inserts
// count toward the next check, the way they do in the database.
function fakeClient({ cap = 5, spendRows = [] } = {}) {
  const usage = [...spendRows];
  const inserted = [];
  const from = vi.fn((table) => {
    if (table === 'household_settings') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { ai_monthly_cap_usd: cap }, error: null }),
          }),
        }),
      };
    }
    if (table === 'ai_usage') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: async () => ({
                data: usage.map((r) => ({ cost_usd: r.cost_usd })),
                error: null,
              }),
            }),
          }),
        }),
        insert: async (row) => {
          inserted.push(row);
          usage.push({ cost_usd: row.cost_usd });
          return { error: null };
        },
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { client: { from }, inserted };
}

const haikuCall = (inputTokens, outputTokens) => async () => ({
  result: 'draft',
  usage: { inputTokens, outputTokens },
});

describe('createAiGate.withAiCap', () => {
  it('runs the call and records its cost when spend is under the cap', async () => {
    const { client, inserted } = fakeClient({ spendRows: [{ cost_usd: 4 }] });
    const gate = createAiGate({ client, householdId: 7, memberId: 2 });
    const fn = vi.fn(haikuCall(1000, 1000));

    await expect(gate.withAiCap('anthropic', 'claude-haiku-5-5', fn)).resolves.toBe('draft');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      household_id: 7,
      member_id: 2,
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      input_tokens: 1000,
      output_tokens: 1000,
    });
  });

  it('runs the call when spend is exactly one call under the cap', async () => {
    const { client } = fakeClient({ spendRows: [{ cost_usd: 4.99 }] });
    const gate = createAiGate({ client, householdId: 7 });
    await expect(
      gate.withAiCap('anthropic', 'claude-haiku-5-5', haikuCall(1000, 1000))
    ).resolves.toBe('draft');
  });

  it('refuses with AI_LIMIT_REACHED when spend is exactly at the cap, without calling the model', async () => {
    const { client, inserted } = fakeClient({ spendRows: [{ cost_usd: 5 }] });
    const gate = createAiGate({ client, householdId: 7 });
    const fn = vi.fn(haikuCall(1000, 1000));

    const error = await gate.withAiCap('anthropic', 'claude-haiku-5-5', fn).catch((e) => e);
    expect(error).toBeInstanceOf(AiLimitError);
    expect(error.code).toBe('AI_LIMIT_REACHED');
    expect(error.message).toBe('AI limit reached this month');
    expect(fn).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it('refuses when spend is over the cap', async () => {
    const { client } = fakeClient({ spendRows: [{ cost_usd: 6 }] });
    const gate = createAiGate({ client, householdId: 7 });
    const fn = vi.fn(haikuCall(1000, 1000));

    await expect(gate.withAiCap('anthropic', 'claude-haiku-5-5', fn)).rejects.toMatchObject({
      code: 'AI_LIMIT_REACHED',
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('uses the $5 default when the Household has no settings row', async () => {
    const { client } = fakeClient({ spendRows: [{ cost_usd: 5 }] });
    client.from = vi.fn((table) =>
      table === 'household_settings'
        ? {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }
        : fakeClient({ spendRows: [{ cost_usd: 5 }] }).client.from(table)
    );
    const gate = createAiGate({ client, householdId: 7 });

    await expect(
      gate.withAiCap('anthropic', 'claude-haiku-5-5', haikuCall(1, 1))
    ).rejects.toBeInstanceOf(AiLimitError);
  });

  it('refuses an unpriced model before reading spend', async () => {
    const { client } = fakeClient();
    const gate = createAiGate({ client, householdId: 7 });

    await expect(gate.withAiCap('anthropic', 'no-such-model', haikuCall(1, 1))).rejects.toThrow(
      /No price configured/
    );
    expect(client.from).not.toHaveBeenCalled();
  });
});
