import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TodayPage from './TodayPage.jsx';
import { useActingMember } from '../lib/actingMember.jsx';
import { loadMealTimes } from '../lib/mealTimes.js';
import { loadTargets } from '../lib/targets.js';
import {
  deleteEntry,
  insertEntry,
  libraryFoodFor,
  loadDay,
  restoreEntry,
  updateEntry,
} from '../lib/today.js';
import { searchFoods } from '../lib/foods.js';
import { addDays, dateKey } from '../lib/todayLogic.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

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
  createdBy: 4,
  sharers: [],
};

const oats = {
  key: 'library:7',
  source: 'library',
  id: 7,
  usdaId: null,
  name: 'Oats',
  brand: null,
  kcalPer100g: 389,
  macros: { protein: 16.8, carbs: 66.4, fat: 6.8, fibre: null, sugars: null, sodium: null },
  servingGrams: null,
  servingLabel: null,
};

// Entries keyed by day, so a test can give today some food and leave tomorrow empty.
let entriesByDay;
const today = dateKey(new Date());
const tomorrow = addDays(today, 1);

function renderPage(actingMemberId = 4) {
  useActingMember.mockReturnValue({ actingMemberId, actingName: 'Alice' });
  return render(<TodayPage />, { wrapper: I18nProvider });
}

describe('TodayPage', () => {
  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    entriesByDay = {
      [today]: [
        {
          id: 5,
          log_date: today,
          meal_time_id: 1,
          log_time: null,
          food_id: 3,
          description: 'Toast',
          servings: null,
          grams: 60,
          kcal: 500,
          protein_g: 12,
          carbs_g: 60,
          fat_g: 4,
          created_at: '2026-10-17T07:40:00+00:00',
        },
      ],
    };
    loadDay.mockImplementation(async (_client, _memberId, day) => entriesByDay[day] ?? []);
    loadMealTimes.mockResolvedValue([breakfast]);
    loadTargets.mockResolvedValue({
      calorie_target: 2000,
      band_low_pct: 90,
      band_high_pct: 100,
      protein_floor_g: 100,
      carb_low_g: null,
      carb_high_g: null,
      fat_low_g: null,
      fat_high_g: null,
    });
  });

  it('shows the day bar against the Calorie Target and the day Meal Times', async () => {
    renderPage();

    expect(await screen.findByText(/500 of 2,000 kcal eaten/)).toBeInTheDocument();
    expect(screen.getByText(/1,500 kcal left/)).toBeInTheDocument();
    expect(screen.getByText(/Aim 1,800 to 2,000 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/12 g of at least 100 g/)).toBeInTheDocument();

    const meals = screen.getByRole('region', { name: 'Meal Times' });
    expect(within(meals).getByRole('heading', { name: /Breakfast/ })).toBeInTheDocument();
    expect(within(meals).getByText('Toast, 500 kcal')).toBeInTheDocument();
  });

  it('asks the Meal Times and Targets of the acted-as Member', async () => {
    renderPage(9);
    await screen.findByText(/500 of 2,000 kcal eaten/);
    expect(loadMealTimes).toHaveBeenCalledWith(expect.anything(), 9);
    expect(loadTargets).toHaveBeenCalledWith(expect.anything(), 9);
    expect(loadDay).toHaveBeenCalledWith(expect.anything(), 9, today);
  });

  it('says so when there is no Member to act for', () => {
    renderPage(null);
    expect(screen.getByText(/Logging needs a Member/)).toBeInTheDocument();
    expect(loadDay).not.toHaveBeenCalled();
  });

  it('moves between days with the arrows, and a future day is read-only', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/500 of 2,000 kcal eaten/);

    await user.click(screen.getByRole('button', { name: 'Next day' }));

    await waitFor(() => expect(loadDay).toHaveBeenCalledWith(expect.anything(), 4, tomorrow));
    expect(await screen.findByText('0 of 2,000 kcal eaten')).toBeInTheDocument();
    expect(screen.getByText(/This day is in the future, so it is read-only/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log food' })).not.toBeInTheDocument();
  });

  it('goes back to today from a past day', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/500 of 2,000 kcal eaten/);

    await user.click(screen.getByRole('button', { name: 'Previous day' }));
    await user.click(await screen.findByRole('button', { name: 'Back to today' }));

    expect(await screen.findByText(/500 of 2,000 kcal eaten/)).toBeInTheDocument();
  });

  it('logs a food at the nearest Meal Time and updates the day bar at once', async () => {
    const user = userEvent.setup();
    searchFoods.mockResolvedValue({
      results: [oats],
      libraryFailed: false,
      usdaFailed: false,
    });
    insertEntry.mockImplementation(async (_client, row) => ({
      id: 99,
      log_date: row.log_date,
      meal_time_id: row.meal_time_id,
      log_time: row.log_time,
      food_id: row.food_id,
      description: row.description,
      servings: row.servings,
      grams: row.grams,
      kcal: row.kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
    }));
    libraryFoodFor.mockImplementation(async (_client, result) => result);
    renderPage();
    await screen.findByText(/500 of 2,000 kcal eaten/);

    await user.click(screen.getByRole('button', { name: 'Log food' }));
    await user.type(screen.getByLabelText('Search foods'), 'oats');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: 'Pick' }));

    const amount = screen.getByLabelText('Amount');
    await user.clear(amount);
    await user.type(amount, '50');
    expect(screen.getByText('195 kcal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log it' }));

    await waitFor(() => expect(insertEntry).toHaveBeenCalledTimes(1));
    expect(insertEntry.mock.calls[0][1]).toMatchObject({
      member_id: 4,
      log_date: today,
      meal_time_id: 1,
      log_time: null,
      food_id: 7,
      description: 'Oats',
      grams: 50,
      kcal: 194.5,
      protein_g: 8.4,
    });
    expect(libraryFoodFor).toHaveBeenCalledWith(expect.anything(), oats);
    expect(await screen.findByText('695 of 2,000 kcal eaten')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Logged 195 kcal to Breakfast.');
    expect(
      within(screen.getByRole('region', { name: 'Meal Times' })).getByText('Oats, 195 kcal')
    ).toBeInTheDocument();
  });

  it('shows an error when the search fails in one source', async () => {
    const user = userEvent.setup();
    searchFoods.mockResolvedValue({ results: [], libraryFailed: true, usdaFailed: false });
    renderPage();
    await screen.findByText(/500 of 2,000 kcal eaten/);

    await user.click(screen.getByRole('button', { name: 'Log food' }));
    await user.type(screen.getByLabelText('Search foods'), 'rice');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Could not search your Food Library.')).toBeInTheDocument();
  });

  describe('editing, deleting and undo', () => {
    const toastButton = () =>
      within(screen.getByRole('region', { name: 'Meal Times' })).getByRole('button', {
        name: 'Toast, 500 kcal',
      });

    it('saves a new amount from a tapped entry, and Undo puts the old values back', async () => {
      const user = userEvent.setup();
      updateEntry.mockImplementation(async (_client, id, patch) => ({
        ...entriesByDay[today][0],
        ...patch,
        id,
      }));
      renderPage();
      await screen.findByText(/500 of 2,000 kcal eaten/);

      await user.click(toastButton());
      const amount = screen.getByLabelText('Amount');
      await user.clear(amount);
      await user.type(amount, '120');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('1,000 of 2,000 kcal eaten')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Entry changed.');
      expect(screen.queryByRole('heading', { name: 'Edit entry' })).not.toBeInTheDocument();
      expect(updateEntry).toHaveBeenCalledWith(expect.anything(), 5, {
        grams: 120,
        servings: null,
        kcal: 1000,
        protein_g: 24,
        carbs_g: 120,
        fat_g: 8,
        meal_time_id: 1,
        log_time: null,
      });

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(await screen.findByText('500 of 2,000 kcal eaten')).toBeInTheDocument();
      expect(updateEntry).toHaveBeenLastCalledWith(expect.anything(), 5, {
        grams: 60,
        servings: null,
        kcal: 500,
        protein_g: 12,
        carbs_g: 60,
        fat_g: 4,
        meal_time_id: 1,
        log_time: null,
      });
    });

    it('deletes an entry, and Undo puts it back with the same values', async () => {
      const user = userEvent.setup();
      const before = entriesByDay[today][0];
      deleteEntry.mockResolvedValue(undefined);
      restoreEntry.mockImplementation(async (_client, row) => ({ ...row, id: 77 }));
      renderPage();
      await screen.findByText(/500 of 2,000 kcal eaten/);

      await user.click(toastButton());
      await user.click(screen.getByRole('button', { name: 'Delete entry' }));

      expect(await screen.findByText('0 of 2,000 kcal eaten')).toBeInTheDocument();
      expect(deleteEntry).toHaveBeenCalledWith(expect.anything(), 5);
      expect(screen.getByRole('status')).toHaveTextContent('Entry deleted.');

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(await screen.findByText('500 of 2,000 kcal eaten')).toBeInTheDocument();
      expect(restoreEntry).toHaveBeenCalledWith(expect.anything(), {
        member_id: 4,
        log_date: today,
        meal_time_id: 1,
        log_time: null,
        grams: 60,
        servings: null,
        kcal: 500,
        protein_g: 12,
        carbs_g: 60,
        fat_g: 4,
        food_id: 3,
        description: 'Toast',
        created_at: before.created_at,
      });
      expect(toastButton()).toBeInTheDocument();
    });

    it('logs a food, and Undo removes it again', async () => {
      const user = userEvent.setup();
      searchFoods.mockResolvedValue({ results: [oats], libraryFailed: false, usdaFailed: false });
      insertEntry.mockImplementation(async (_client, row) => ({
        id: 99,
        log_date: row.log_date,
        meal_time_id: row.meal_time_id,
        log_time: row.log_time,
        food_id: row.food_id,
        description: row.description,
        servings: row.servings,
        grams: row.grams,
        kcal: row.kcal,
        protein_g: row.protein_g,
        carbs_g: row.carbs_g,
        fat_g: row.fat_g,
      }));
      libraryFoodFor.mockImplementation(async (_client, result) => result);
      renderPage();
      await screen.findByText(/500 of 2,000 kcal eaten/);

      await user.click(screen.getByRole('button', { name: 'Log food' }));
      await user.type(screen.getByLabelText('Search foods'), 'oats');
      await user.click(screen.getByRole('button', { name: 'Search' }));
      await user.click(await screen.findByRole('button', { name: 'Pick' }));
      await user.click(screen.getByRole('button', { name: 'Log it' }));

      expect(await screen.findByText('889 of 2,000 kcal eaten')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(await screen.findByText('500 of 2,000 kcal eaten')).toBeInTheDocument();
      expect(deleteEntry).toHaveBeenCalledWith(expect.anything(), 99);
    });

    it('says so when Undo fails, and leaves the day as it is', async () => {
      const user = userEvent.setup();
      deleteEntry.mockResolvedValue(undefined);
      restoreEntry.mockRejectedValue(new Error('denied'));
      renderPage();
      await screen.findByText(/500 of 2,000 kcal eaten/);

      await user.click(toastButton());
      await user.click(screen.getByRole('button', { name: 'Delete entry' }));
      await user.click(await screen.findByRole('button', { name: 'Undo' }));

      expect(
        await screen.findByText('Could not undo that. Check the day and try again.')
      ).toBeInTheDocument();
      expect(screen.getByText('0 of 2,000 kcal eaten')).toBeInTheDocument();
    });
  });
});
