import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import AiSpendPanel from './AiSpendPanel.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

// A mocked Supabase client: rpc returns this month's spend, and the from() chain returns the cap.
function mockClient({ spend, cap, rpcError = null, capError = null }) {
  const single = vi.fn().mockResolvedValue({
    data: cap === undefined ? null : { ai_monthly_cap_usd: cap },
    error: capError,
  });
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: spend, error: rpcError }),
    from: vi.fn(() => ({
      select: vi.fn(() => ({ maybeSingle: single })),
    })),
  };
  return client;
}

describe('AiSpendPanel', () => {
  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  it('shows each provider spend against the cap and calls the spend function', async () => {
    const client = mockClient({
      spend: [
        { provider_name: 'anthropic', spend_usd: 0.42 },
        { provider_name: 'typesafe', spend_usd: 0.01 },
      ],
      cap: 5,
    });

    render(<AiSpendPanel client={client} />, { wrapper: I18nProvider });

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(client.rpc).toHaveBeenCalledWith('ai_spend_this_month');
    expect(client.from).toHaveBeenCalledWith('household_settings');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Anthropic (Claude)');
    expect(rows[0]).toHaveTextContent('$0.42');
    expect(rows[0]).toHaveTextContent('$5.00');
    expect(rows[0]).toHaveTextContent('Under the cap');
    expect(rows[1]).toHaveTextContent('TypeSafe (Jev)');
  });

  it('marks a provider at the cap as limit reached', async () => {
    const client = mockClient({
      spend: [{ provider_name: 'anthropic', spend_usd: 5 }],
      cap: 5,
    });

    render(<AiSpendPanel client={client} />, { wrapper: I18nProvider });

    const row = (await screen.findAllByRole('row'))[1];
    expect(row).toHaveTextContent('AI limit reached this month');
    expect(row).not.toHaveTextContent('Under the cap');
  });

  it('uses the $5 default when no cap row exists', async () => {
    const client = mockClient({
      spend: [{ provider_name: 'anthropic', spend_usd: 1 }],
      cap: undefined,
    });

    render(<AiSpendPanel client={client} />, { wrapper: I18nProvider });

    expect((await screen.findAllByRole('row'))[1]).toHaveTextContent('$5.00');
  });

  it('says so when there is no spend this month', async () => {
    const client = mockClient({ spend: [], cap: 5 });

    render(<AiSpendPanel client={client} />, { wrapper: I18nProvider });

    expect(await screen.findByText('No AI calls this month yet.')).toBeInTheDocument();
  });

  it('shows the Owner-only message when the spend function refuses the caller', async () => {
    const client = mockClient({
      spend: null,
      cap: 5,
      rpcError: { code: '42501', message: 'Only the Owner can see AI spend' },
    });

    render(<AiSpendPanel client={client} />, { wrapper: I18nProvider });

    expect(
      await screen.findByText('Could not load AI spend. Only the Owner can see it.')
    ).toBeInTheDocument();
  });
});
