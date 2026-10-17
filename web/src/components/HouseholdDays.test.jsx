import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HouseholdDays from './HouseholdDays.jsx';
import { loadHouseholdWeeks, currentUserId } from '../lib/sharing.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/sharing.js', () => ({
  currentUserId: vi.fn(),
  loadHouseholdWeeks: vi.fn(),
}));

const SUNDAY_START = '2026-10-11';
const TODAY = '2026-10-17';

// Carl does not share: flags only. Dan shares everything: calories per day as well.
const adults = [
  {
    id: 2,
    name: 'Carl',
    shared: false,
    days: [
      { key: '2026-10-11', status: 'onTrack', kcal: null },
      { key: '2026-10-12', status: 'nothing', kcal: null },
      { key: '2026-10-13', status: 'nothing', kcal: null },
      { key: '2026-10-14', status: 'over', kcal: null },
      { key: '2026-10-15', status: 'nothing', kcal: null },
      { key: '2026-10-16', status: 'nothing', kcal: null },
      { key: '2026-10-17', status: 'nothing', kcal: null },
    ],
  },
  {
    id: 3,
    name: 'Dan',
    shared: true,
    days: [
      { key: '2026-10-11', status: 'onTrack', kcal: 1800 },
      { key: '2026-10-12', status: 'nothing', kcal: null },
      { key: '2026-10-13', status: 'nothing', kcal: null },
      { key: '2026-10-14', status: 'over', kcal: 2100 },
      { key: '2026-10-15', status: 'nothing', kcal: null },
      { key: '2026-10-16', status: 'nothing', kcal: null },
      { key: '2026-10-17', status: 'nothing', kcal: null },
    ],
  },
];

function renderDays() {
  render(<HouseholdDays start={SUNDAY_START} todayKey={TODAY} />, { wrapper: I18nProvider });
}

describe('HouseholdDays', () => {
  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId.mockResolvedValue('alice');
  });

  it('shows each other adult day by day, with the flag only unless they share everything', async () => {
    loadHouseholdWeeks.mockResolvedValue(adults);
    renderDays();

    expect(
      await screen.findByRole('heading', { name: 'Other Members this week' })
    ).toBeInTheDocument();
    expect(loadHouseholdWeeks).toHaveBeenCalledWith({}, 'alice', SUNDAY_START, TODAY);
    expect(screen.getByText('Carl')).toBeInTheDocument();
    expect(screen.getByText('Dan')).toBeInTheDocument();
    expect(screen.getByText('(Sharing everything)')).toBeInTheDocument();

    // Carl: one on track day and one over day, no calories. Dan's days show their calories.
    expect(screen.getAllByText('On track')).toHaveLength(2);
    expect(screen.getAllByText('Over')).toHaveLength(2);
    expect(screen.getByText(/1,800 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/2,100 kcal/)).toBeInTheDocument();
    expect(screen.getAllByText('Nothing logged')).toHaveLength(10);
  });

  it('says so when there are no other adults', async () => {
    loadHouseholdWeeks.mockResolvedValue([]);
    renderDays();
    expect(
      await screen.findByText('No other adult Members in your Household yet.')
    ).toBeInTheDocument();
  });

  it('shows an error and no days when the week cannot load', async () => {
    loadHouseholdWeeks.mockRejectedValue(new Error('offline'));
    renderDays();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Could not load the other Members' days"
    );
    expect(screen.queryByText('Carl')).not.toBeInTheDocument();
  });
});
