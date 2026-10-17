import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TodayPage from './TodayPage.jsx';
import { useActingMember } from '../lib/actingMember.jsx';
import { loadMealTimes } from '../lib/mealTimes.js';
import { loadTargets } from '../lib/targets.js';
import { insertEntry, insertQueuedEntry, libraryFoodFor, loadDay } from '../lib/today.js';
import { searchFoods } from '../lib/foods.js';
import { FOOD_CACHE_KEY, QUEUE_KEY } from '../lib/offlineQueue.js';
import { dateKey } from '../lib/todayLogic.js';
import { MetricProvider } from '../test/metricUnits.jsx';

// Offline logging on the Today screen (ticket #34). The database is a fake: loadDay returns
// what is saved, insertEntry is the online save, and insertQueuedEntry is the resend.

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/actingMember.jsx', () => ({ useActingMember: vi.fn() }));
vi.mock('../lib/mealTimes.js', () => ({ loadMealTimes: vi.fn() }));
vi.mock('../lib/targets.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadTargets: vi.fn(),
}));
vi.mock('../lib/foods.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchFoods: vi.fn(),
}));
vi.mock('../lib/today.js', () => ({
  loadDay: vi.fn(),
  insertEntry: vi.fn(),
  insertQueuedEntry: vi.fn(),
  libraryFoodFor: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  restoreEntry: vi.fn(),
}));

const breakfast = {
  id: 1,
  name: 'Breakfast',
  time_of_day: '07:30:00',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  kind: 'planned',
  cal_min: 300,
  cal_max: 450,
  set_calories: null,
};

const APPLE = {
  key: 'library:7',
  source: 'library',
  id: 7,
  usdaId: null,
  name: 'Apples, raw',
  nameEs: null,
  nameEsEdited: false,
  brand: null,
  kcalPer100g: 52,
  macros: { protein: 0.3, carbs: 14, fat: 0.2, fibre: null, sugars: null, sodium: null },
  servingGrams: null,
  servingLabel: null,
};

const today = dateKey(new Date());

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

function renderPage() {
  useActingMember.mockReturnValue({ actingMemberId: 4, actingName: 'Alice' });
  return render(<TodayPage />, { wrapper: MetricProvider });
}

function storedQueue() {
  return JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]');
}

describe('TodayPage offline logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setOnline(true);
    loadDay.mockResolvedValue([]);
    loadMealTimes.mockResolvedValue([breakfast]);
    loadTargets.mockResolvedValue({
      calorie_target: 2000,
      band_low_pct: 90,
      band_high_pct: 100,
      protein_floor_g: null,
      carb_low_g: null,
      carb_high_g: null,
      fat_low_g: null,
      fat_high_g: null,
    });
    insertQueuedEntry.mockResolvedValue(undefined);
    // A Food Library result is already saved, so it is returned as it is (as in today.js).
    libraryFoodFor.mockImplementation(async (_client, result) => result);
  });

  afterEach(() => {
    // Vitest runs without globals, so Testing Library does not unmount between tests.
    cleanup();
    window.localStorage.clear();
    delete window.navigator.onLine;
  });

  async function search(user, text) {
    const field = screen.getByRole('searchbox', { name: 'Search foods' });
    await user.clear(field);
    await user.type(field, text);
    await user.click(screen.getByRole('button', { name: 'Search' }));
  }

  it('logs a cached Food Library food with no signal: it shows as not synced and waits on the phone', async () => {
    const user = userEvent.setup();
    searchFoods.mockResolvedValue({ results: [APPLE], libraryFailed: false, usdaFailed: false });
    renderPage();
    await screen.findByRole('region', { name: 'Meal Times' });

    // Online search first, so the food is kept on the phone.
    await user.click(screen.getByRole('button', { name: 'Log food' }));
    await search(user, 'apple');
    await user.click(await screen.findByRole('button', { name: 'Pick' }));
    expect(JSON.parse(window.localStorage.getItem(FOOD_CACHE_KEY))).toHaveLength(1);

    // The network goes away. A new search reads the phone's copy and says USDA needs a connection.
    act(() => setOnline(false));
    expect(screen.getByText(/No connection/)).toBeInTheDocument();
    await search(user, 'apple');
    expect(searchFoods).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Searching USDA needs a connection/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Pick' }));

    await user.click(screen.getByRole('button', { name: 'Log it' }));

    expect(insertEntry).not.toHaveBeenCalled();
    expect(await screen.findByText(/Apples, raw, 52 kcal/)).toBeInTheDocument();
    expect(screen.getByText('Not synced')).toBeInTheDocument();
    expect(screen.getByText(/Saved on this phone: 52 kcal to Breakfast/)).toBeInTheDocument();
    const queued = storedQueue();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ memberId: 4, logDate: today, status: 'queued' });
    expect(queued[0].row).toMatchObject({ food_id: 7, kcal: 52, client_id: queued[0].clientId });
  });

  it('does not search USDA with no connection, and says so', async () => {
    const user = userEvent.setup();
    setOnline(false);
    renderPage();
    await screen.findByRole('region', { name: 'Meal Times' });

    await user.click(screen.getByRole('button', { name: 'Log food' }));
    await search(user, 'apple');

    expect(searchFoods).not.toHaveBeenCalled();
    expect(screen.getByText(/Searching USDA needs a connection/)).toBeInTheDocument();
    expect(screen.getByText(/No foods match/)).toBeInTheDocument();
  });

  it('does not log a USDA food with no connection, because it must be saved first', async () => {
    const user = userEvent.setup();
    searchFoods.mockResolvedValue({
      results: [
        {
          key: 'usda:5',
          source: 'usda',
          fdcId: 5,
          usdaId: '5',
          name: 'Pear, raw',
          nameEs: null,
          nameEsEdited: false,
          brand: null,
          kcalPer100g: 57,
          macros: null,
          servingGrams: null,
          servingLabel: null,
        },
      ],
      libraryFailed: false,
      usdaFailed: false,
    });
    renderPage();
    await screen.findByRole('region', { name: 'Meal Times' });
    await user.click(screen.getByRole('button', { name: 'Log food' }));
    await search(user, 'pear');
    await user.click(await screen.findByRole('button', { name: 'Pick' }));

    act(() => setOnline(false));
    await user.click(screen.getByRole('button', { name: 'Log it' }));

    expect(libraryFoodFor).not.toHaveBeenCalled();
    expect(insertEntry).not.toHaveBeenCalled();
    expect(screen.getByText(/A USDA food needs a connection to be added/)).toBeInTheDocument();
    expect(storedQueue()).toEqual([]);
  });

  it('shows a queued entry that failed to sync with an error, Try again and Discard', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        {
          clientId: 'c-9',
          memberId: 4,
          logDate: today,
          queuedAt: '2026-10-17T08:00:00.000Z',
          row: {
            member_id: 4,
            log_date: today,
            meal_time_id: 1,
            log_time: null,
            food_id: 9,
            description: 'Pear',
            servings: null,
            grams: 100,
            kcal: 57,
            protein_g: 0.4,
            carbs_g: 15,
            fat_g: 0.1,
            client_id: 'c-9',
          },
          status: 'failed',
          error: 'row-level security',
        },
      ])
    );
    renderPage();

    const meals = await screen.findByRole('region', { name: 'Meal Times' });
    expect(within(meals).getByText('Pear, 57 kcal')).toBeInTheDocument();
    expect(within(meals).getByRole('alert')).toHaveTextContent(/refused this entry/);
    expect(insertQueuedEntry).not.toHaveBeenCalled();

    await user.click(within(meals).getByRole('button', { name: 'Discard' }));

    expect(within(meals).queryByText('Pear, 57 kcal')).not.toBeInTheDocument();
    expect(storedQueue()).toEqual([]);
  });

  it('sends a queued entry when the phone comes back online, and then it is no longer marked', async () => {
    setOnline(false);
    window.localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        {
          clientId: 'c-4',
          memberId: 4,
          logDate: today,
          queuedAt: '2026-10-17T08:00:00.000Z',
          row: {
            member_id: 4,
            log_date: today,
            meal_time_id: 1,
            log_time: null,
            food_id: 9,
            description: 'Pear',
            servings: null,
            grams: 100,
            kcal: 57,
            protein_g: 0.4,
            carbs_g: 15,
            fat_g: 0.1,
            client_id: 'c-4',
          },
          status: 'queued',
          error: null,
        },
      ])
    );
    renderPage();
    const meals = await screen.findByRole('region', { name: 'Meal Times' });
    expect(within(meals).getByText('Not synced')).toBeInTheDocument();
    expect(insertQueuedEntry).not.toHaveBeenCalled();

    setOnline(true);

    await waitFor(() => expect(insertQueuedEntry).toHaveBeenCalledTimes(1));
    expect(insertQueuedEntry.mock.calls[0][1]).toMatchObject({ client_id: 'c-4' });
    await waitFor(() => expect(within(meals).queryByText('Not synced')).not.toBeInTheDocument());
    expect(storedQueue()).toEqual([]);
    // The day is read again, so the server's copy takes the place of the queued one.
    await waitFor(() => expect(loadDay.mock.calls.length).toBeGreaterThan(1));
  });
});
