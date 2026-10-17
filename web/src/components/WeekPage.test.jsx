import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WeekPage from './WeekPage.jsx';
import { useActingMember } from '../lib/actingMember.jsx';
import { loadTargets } from '../lib/targets.js';
import { loadWeek } from '../lib/week.js';
import { loadWeight } from '../lib/weight.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/sharing.js', () => ({
  currentUserId: vi.fn(async () => null),
  loadHouseholdWeeks: vi.fn(async () => []),
  loadOwnSharing: vi.fn(async () => null),
  setShareEverything: vi.fn(),
}));
vi.mock('../lib/actingMember.jsx', () => ({ useActingMember: vi.fn() }));
vi.mock('../lib/targets.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTargets: vi.fn(),
}));
vi.mock('../lib/week.js', () => ({ loadWeek: vi.fn() }));
vi.mock('../lib/weight.js', () => ({
  loadWeight: vi.fn(),
  saveWeight: vi.fn(),
  deleteWeight: vi.fn(),
}));

// Calorie Target 2000 with the default Planning band (1800 to 2000 kcal).
const targetRow = {
  calorie_target: 2000,
  band_low_pct: 90,
  band_high_pct: 100,
  protein_floor_g: 120,
  carb_low_g: 150,
  carb_high_g: 220,
  fat_low_g: 50,
  fat_high_g: 80,
};

// Today is Saturday 17 October 2026, so the week is Sunday 11 to Saturday 17 October.
const SUNDAY_START = '2026-10-11';

function renderPage({ memberId = 4, onOpenDay = vi.fn() } = {}) {
  useActingMember.mockReturnValue({ actingMemberId: memberId, actingName: 'Alice' });
  render(<WeekPage onOpenDay={onOpenDay} />, { wrapper: I18nProvider });
  return { onOpenDay };
}

describe('WeekPage', () => {
  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    // Only the clock is faked, so the page's "today" is fixed and promises still resolve.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 17, 12, 0));
    window.localStorage.clear();
    loadTargets.mockResolvedValue(targetRow);
    loadWeight.mockResolvedValue([]);
    loadWeek.mockResolvedValue([
      { log_date: '2026-10-11', kcal: 1800, protein_g: 130, carbs_g: 200, fat_g: 60 },
      { log_date: '2026-10-14', kcal: 2100, protein_g: 100, carbs_g: 220, fat_g: 70 },
    ]);
  });

  it('loads the acted-as Member week in one query and shows each day against the Targets', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Week' })).toBeInTheDocument();
    expect(loadWeek).toHaveBeenCalledTimes(1);
    expect(loadWeek).toHaveBeenCalledWith({}, 4, SUNDAY_START, '2026-10-17');

    // Sunday is in the band, Wednesday is over the Calorie Target.
    expect(await screen.findByText(/1,800 of 2,000 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/2,100 of 2,000 kcal/)).toBeInTheDocument();
    expect(screen.getByText('In the Planning band')).toBeInTheDocument();
    expect(screen.getByText('Over the Calorie Target')).toBeInTheDocument();
    expect(screen.getByText(/Protein 130 g, carbs 200 g, fat 60 g/)).toBeInTheDocument();
  });

  it('shows empty days as nothing logged, not as zero calories', async () => {
    renderPage();

    await screen.findByText(/1,800 of 2,000 kcal/);
    // Five days have nothing logged (Monday, Tuesday, Thursday, Friday, Saturday).
    expect(screen.getAllByText('Nothing logged')).toHaveLength(5);
    expect(screen.queryByText(/\b0 of 2,000 kcal/)).not.toBeInTheDocument();
  });

  it('counts the logged days under the Calorie Target and averages over logged days only', async () => {
    renderPage();

    expect(
      await screen.findByText('1 of 2 logged days under the Calorie Target')
    ).toBeInTheDocument();
    // (1800 + 2100) / 2. Dividing by seven would give 557.1.
    expect(screen.getByText('Average 1,950 kcal per logged day')).toBeInTheDocument();
  });

  it('opens Today on a day when it is tapped', async () => {
    const { onOpenDay } = renderPage();
    await screen.findByText(/2,100 of 2,000 kcal/);

    await userEvent.click(screen.getByRole('button', { name: /Oct 14/ }));

    expect(onOpenDay).toHaveBeenCalledWith('2026-10-14');
  });

  it('moves the week with the arrows and loads the new week in one query', async () => {
    renderPage();
    await screen.findByText(/1,800 of 2,000 kcal/);

    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    await waitFor(() =>
      expect(loadWeek).toHaveBeenLastCalledWith({}, 4, '2026-10-18', '2026-10-24')
    );

    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    await waitFor(() =>
      expect(loadWeek).toHaveBeenLastCalledWith({}, 4, SUNDAY_START, '2026-10-17')
    );
  });

  it('says so when no Calorie Target is set, and gives no under count', async () => {
    loadTargets.mockResolvedValue(null);
    renderPage();

    expect(
      await screen.findByText(
        'Set a Calorie Target on the Targets page to see which days are under it.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/logged days under/)).not.toBeInTheDocument();
  });

  it('says when nothing is logged this week', async () => {
    loadWeek.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Nothing logged this week yet.')).toBeInTheDocument();
    expect(screen.queryByText(/Average/)).not.toBeInTheDocument();
  });

  it('warns when a logged day has a meal with no macro figures', async () => {
    loadWeek.mockResolvedValue([
      { log_date: '2026-10-11', kcal: 1000, protein_g: null, carbs_g: 100, fat_g: 20 },
    ]);
    renderPage();

    expect(
      await screen.findByText(
        'Macro figures are missing on 1 logged day(s), so their totals may be low.'
      )
    ).toBeInTheDocument();
  });

  it('shows an error when the week cannot be loaded', async () => {
    loadWeek.mockRejectedValue(new Error('offline'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load this week. Try again.'
    );
  });

  it('shows the weight log under the week, with a trend chart over the last 12 weeks', async () => {
    loadWeight.mockResolvedValue([
      { id: 1, log_date: '2026-10-11', kg: 72.5 },
      { id: 2, log_date: '2026-10-14', kg: 72.1 },
    ]);
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Weight' })).toBeInTheDocument();
    // Eighty-four days, from 26 July to 17 October, with the seven days before them fetched too.
    expect(loadWeight).toHaveBeenCalledWith({}, 4, '2026-07-20', '2026-10-17');
    expect(
      await screen.findByRole('img', {
        name: 'Weight over the last 12 weeks, with a 7-day average',
      })
    ).toBeInTheDocument();
    expect(await screen.findByText('Lowest 72.1 kg, highest 72.5 kg')).toBeInTheDocument();
  });

  it('asks for a Member when none is acted for', () => {
    useActingMember.mockReturnValue({ actingMemberId: null, actingName: null });
    render(<WeekPage onOpenDay={vi.fn()} />, { wrapper: I18nProvider });

    expect(
      within(screen.getByRole('region', { name: 'Week' })).getByText(
        'Logging needs a Member. Join or create a Household first.'
      )
    ).toBeInTheDocument();
    expect(loadWeek).not.toHaveBeenCalled();
  });
});
