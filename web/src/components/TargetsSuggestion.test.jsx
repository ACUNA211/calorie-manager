import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TargetsSuggestion from './TargetsSuggestion.jsx';
import { supabase } from '../lib/supabase.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn() } }));

const intake = {
  sex: 'female',
  birth_date: '1990-05-17',
  height_cm: 165,
  work: 'sitting',
  exercise_sessions: null,
  exercise_minutes: null,
  goal: 'maintain',
  pace_kcal: null,
  floor_on: true,
  floor_kcal: null,
};
// At 70 kg: RMR 1,390.25 -> x1.2 = 1,668 kcal (Intake formula), protein 98 g.
const settings = {
  calorie_target: 1668,
  protein_floor_g: 98,
  carb_low_g: 188,
  carb_high_g: 271,
  fat_low_g: 46,
  fat_high_g: 65,
  band_low_pct: 90,
  band_high_pct: 100,
};

function fakeClient({ intakeRow = intake, settingsRow = settings } = {}) {
  const upsert = vi.fn(async () => ({ error: null }));
  supabase.from.mockImplementation((table) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: table === 'member_intake' ? intakeRow : settingsRow,
          error: null,
        }),
      }),
    }),
    upsert: async (payload) => {
      upsert(table, payload);
      return { error: null };
    },
  }));
  return upsert;
}

function renderIt(props = {}) {
  return render(
    <TargetsSuggestion
      memberId={4}
      kg={75}
      isLatest
      isDependent={false}
      todayKey="2026-10-19"
      {...props}
    />,
    { wrapper: MetricProvider }
  );
}

describe('TargetsSuggestion', () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it('asks, and saves the new Targets on yes', async () => {
    const upsert = fakeClient();
    renderIt();
    expect(await screen.findByText('Update your Targets?')).toBeInTheDocument();
    expect(screen.getByText(/Calorie Target \(kcal\): 1,668 → 1,728/)).toBeInTheDocument();
    expect(upsert).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Yes, update my Targets' }));
    expect(await screen.findByText('Targets updated.')).toBeInTheDocument();
    expect(upsert).toHaveBeenCalledTimes(1);
    const [table, payload] = upsert.mock.calls[0];
    expect(table).toBe('member_settings');
    expect(payload).toMatchObject({
      member_id: 4,
      calorie_target: 1728,
      protein_floor_g: 105,
      band_low_pct: 90,
      band_high_pct: 100,
    });
  });

  it('keeps the current Targets on no', async () => {
    const upsert = fakeClient();
    renderIt();
    await userEvent.click(await screen.findByRole('button', { name: 'No, keep my Targets' }));
    expect(screen.getByText('Your Targets stay as they are.')).toBeInTheDocument();
    expect(screen.queryByText('Update your Targets?')).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('shows nothing for a Dependent and does not even load', async () => {
    fakeClient();
    const { container } = renderIt({ isDependent: true });
    await waitFor(() => expect(container.textContent).toBe(''));
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('shows nothing without Intake answers', async () => {
    fakeClient({ intakeRow: null });
    const { container } = renderIt();
    await waitFor(() => expect(supabase.from).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('shows nothing when the Targets would not change', async () => {
    fakeClient();
    const { container } = renderIt({ kg: 70 });
    await waitFor(() => expect(supabase.from).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
