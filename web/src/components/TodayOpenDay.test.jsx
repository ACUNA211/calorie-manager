import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TodayPage from './TodayPage.jsx';
import { useActingMember } from '../lib/actingMember.jsx';
import { loadMealTimes } from '../lib/mealTimes.js';
import { loadTargets } from '../lib/targets.js';
import { loadDay } from '../lib/today.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

// The Week view opens a day on Today: App passes { key, n } as the day prop and remounts Today
// (the key rises on every tap). These tests check that Today opens on that day and scrolls into
// view. The rest of Today is covered by TodayPage.test.jsx.

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/actingMember.jsx', () => ({ useActingMember: vi.fn() }));
vi.mock('../lib/mealTimes.js', () => ({ loadMealTimes: vi.fn() }));
vi.mock('../lib/targets.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTargets: vi.fn(),
}));
vi.mock('../lib/today.js', () => ({
  loadDay: vi.fn(),
  insertEntry: vi.fn(),
  libraryFoodFor: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  restoreEntry: vi.fn(),
}));

function renderToday(day, n) {
  return <TodayPage key={n} day={day} />;
}

describe('TodayPage opened from the Week view', () => {
  beforeEach(() => {
    useActingMember.mockReturnValue({ actingMemberId: 4, actingName: 'Alice' });
    loadMealTimes.mockResolvedValue([]);
    loadTargets.mockResolvedValue(null);
    loadDay.mockResolvedValue([]);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    delete Element.prototype.scrollIntoView;
  });

  it('opens on the tapped day and scrolls Today into view', async () => {
    render(renderToday({ key: '2026-10-14' }, 1), { wrapper: I18nProvider });

    await waitFor(() =>
      expect(loadDay).toHaveBeenLastCalledWith(expect.anything(), 4, '2026-10-14')
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('does not scroll when Today opens with no day from the Week view', async () => {
    render(renderToday(null, 0), { wrapper: I18nProvider });

    await waitFor(() => expect(loadDay).toHaveBeenCalled());
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('moves again when the same day is tapped twice, because the key rises on each tap', async () => {
    const { rerender } = render(renderToday({ key: '2026-10-14' }, 1), {
      wrapper: I18nProvider,
    });
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1));

    rerender(renderToday({ key: '2026-10-14' }, 2));

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2));
    expect(loadDay).toHaveBeenLastCalledWith(expect.anything(), 4, '2026-10-14');
  });
});
