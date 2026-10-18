import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MealTimesPage from './MealTimesPage.jsx';
import {
  deleteMealTime,
  loadMealTimes,
  loadMemberId,
  loadMembers,
  loadTargets,
  saveMealTime,
  setWeekdays,
} from '../lib/mealTimes.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/mealTimes.js', () => ({
  loadMemberId: vi.fn(),
  loadMembers: vi.fn(),
  loadMealTimes: vi.fn(),
  loadTargets: vi.fn(),
  saveMealTime: vi.fn(),
  setWeekdays: vi.fn(),
  deleteMealTime: vi.fn(),
}));

const user = { id: 'user-1' };

const alice = { id: 4, display_name: 'Alice', role: 'owner' };
const kid = { id: 9, display_name: 'Kid', role: 'dependent' };

const lunch = {
  id: 1,
  name: 'Lunch',
  time_of_day: '12:30',
  weekdays: [1, 2, 3],
  kind: 'planned',
  cal_min: 400,
  cal_max: 600,
  set_calories: null,
  createdBy: 4,
  sharers: [{ id: 4, name: 'Alice' }],
};
const snack = {
  id: 2,
  name: 'Snack',
  time_of_day: '12:30',
  weekdays: [2, 5],
  kind: 'if_room',
  cal_min: null,
  cal_max: 200,
  set_calories: null,
  createdBy: 4,
  sharers: [{ id: 4, name: 'Alice' }],
};

function setUpData(meals = [lunch, snack]) {
  loadMemberId.mockResolvedValue(4);
  loadMembers.mockResolvedValue([alice, kid]);
  loadMealTimes.mockResolvedValue(meals);
  loadTargets.mockResolvedValue({ calorie_target: 2000, band_low_pct: 90, band_high_pct: 100 });
  setWeekdays.mockResolvedValue();
  saveMealTime.mockResolvedValue(10);
  deleteMealTime.mockResolvedValue();
}

function renderPage(props = {}) {
  return render(<MealTimesPage user={user} {...props} />, { wrapper: I18nProvider });
}

describe('MealTimesPage', () => {
  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the week grid for the signed-in Member with the Target and day totals', async () => {
    setUpData();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Meal Times' })).toBeInTheDocument();
    expect(loadMemberId).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(loadMealTimes).toHaveBeenCalledWith(expect.anything(), 4);
    expect(screen.getByText(/Calorie Target 2,000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lunch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lunch on Monday' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Snack on Monday' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    // Monday has only Lunch: floor 400, ceiling 600.
    expect(screen.getAllByText('400–600').length).toBeGreaterThan(0);
  });

  it('uses the Member passed in as a prop and skips the login lookup', async () => {
    setUpData();
    renderPage({ memberId: 7 });

    await screen.findByRole('button', { name: 'Lunch' });
    expect(loadMemberId).not.toHaveBeenCalled();
    expect(loadMealTimes).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it('says so when the person has no Member yet', async () => {
    loadMemberId.mockResolvedValue(null);
    renderPage();
    expect(
      await screen.findByText('Meal Times belong to a Member. Join or create a Household first.')
    ).toBeInTheDocument();
  });

  it('marks a Meal Time shared with other Members, with their names', async () => {
    setUpData([
      {
        ...lunch,
        sharers: [
          { id: 4, name: 'Alice' },
          { id: 9, name: 'Kid' },
        ],
      },
      snack,
    ]);
    renderPage();

    expect(await screen.findByText('Shared with Kid')).toBeInTheDocument();
    expect(screen.getAllByText(/^Shared with/)).toHaveLength(1);
  });

  it('says a row needs calories when its own numbers do not fit its kind', async () => {
    setUpData([{ ...lunch, id: 3, name: 'Cake', kind: 'set', set_calories: null }, snack]);
    renderPage();

    expect(await screen.findByText(/Needs calories for this kind/)).toBeInTheDocument();
  });

  it('turns a day off at once, saving the Meal Time without that day', async () => {
    setUpData();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Lunch on Tuesday' }));

    await waitFor(() => expect(setWeekdays).toHaveBeenCalledWith(expect.anything(), 4, 1, [1, 3]));
  });

  it('turns a day on without a clash straight away', async () => {
    setUpData();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Lunch on Thursday' }));

    await waitFor(() =>
      expect(setWeekdays).toHaveBeenCalledWith(expect.anything(), 4, 1, [1, 2, 3, 4])
    );
  });

  it('asks before turning on a day that clashes, and keeps both when asked', async () => {
    setUpData();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Snack on Monday' }));

    expect(
      await screen.findByText(
        'Snack is at the same time as Lunch on Monday. Take Monday off Lunch?'
      )
    ).toBeInTheDocument();
    expect(setWeekdays).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Keep both' }));
    await waitFor(() =>
      expect(setWeekdays).toHaveBeenCalledWith(expect.anything(), 4, 2, [2, 5, 1])
    );
    expect(setWeekdays).toHaveBeenCalledTimes(1);
  });

  it('takes the day off the other Meal Time when asked to replace', async () => {
    setUpData();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Snack on Monday' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, replace there' }));

    await waitFor(() => expect(setWeekdays).toHaveBeenCalledTimes(2));
    expect(setWeekdays).toHaveBeenCalledWith(expect.anything(), 4, 2, [2, 5, 1]);
    expect(setWeekdays).toHaveBeenCalledWith(expect.anything(), 4, 1, [2, 3]);
  });

  it('asks for one calorie number when a Set Meal Time is saved without one', async () => {
    setUpData();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a Meal Time' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Cake');
    await userEvent.click(screen.getByRole('radio', { name: 'Set' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('A Set Meal Time needs one calorie number.')
    ).toBeInTheDocument();
    expect(saveMealTime).not.toHaveBeenCalled();
  });

  it('saves a new Planned Meal Time with its range, shared with the creator only', async () => {
    setUpData();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a Meal Time' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Dinner');
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '19:00' } });
    await userEvent.type(screen.getByLabelText('Min calories'), '500');
    await userEvent.type(screen.getByLabelText('Max calories'), '700');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saveMealTime).toHaveBeenCalled());
    expect(saveMealTime.mock.calls[0][1]).toBe(4);
    expect(saveMealTime.mock.calls[0][2]).toMatchObject({
      id: null,
      name: 'Dinner',
      kind: 'planned',
      calMin: '500',
      calMax: '700',
      createdBy: 4,
      sharerIds: [4],
    });
  });

  it('lets the editor add another Member to share a Meal Time, with their own range', async () => {
    setUpData([lunch]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Lunch' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Kid' }));
    await userEvent.type(screen.getByLabelText("Kid's min calories"), '300');
    await userEvent.type(screen.getByLabelText("Kid's max calories"), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saveMealTime).toHaveBeenCalled());
    expect(saveMealTime.mock.calls[0][2]).toMatchObject({
      id: 1,
      sharerIds: [4, 9],
      sharerRanges: { 9: { calMin: '300', calMax: '500' } },
    });
  });

  it('shows an empty range for a Member added as a sharer, and blocks Save until it is filled', async () => {
    setUpData([lunch]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Lunch' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Kid' }));

    expect(screen.getByLabelText("Kid's min calories")).toHaveValue(null);
    expect(screen.getByLabelText("Kid's max calories")).toHaveValue(null);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Give Kid their own calorie range for this Meal Time.')
    ).toBeInTheDocument();
    expect(saveMealTime).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Kid's min calories"), '300');
    await userEvent.type(screen.getByLabelText("Kid's max calories"), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saveMealTime).toHaveBeenCalled());
  });

  it('asks a new If room sharer for a maximum, and a new Set sharer for one number', async () => {
    setUpData([snack]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Snack' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Kid' }));
    expect(screen.getByLabelText("Kid's max calories")).toBeInTheDocument();
    expect(screen.getByLabelText("Kid's min calories")).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Set' }));
    expect(screen.getByLabelText("Kid's calories")).toHaveValue(null);
    expect(screen.queryByLabelText("Kid's max calories")).not.toBeInTheDocument();
  });

  it('does not ask for a range from Members who already share the Meal Time', async () => {
    setUpData([
      {
        ...lunch,
        createdBy: 9,
        sharers: [
          { id: 9, name: 'Kid' },
          { id: 4, name: 'Alice' },
        ],
      },
      snack,
    ]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Lunch' }));
    expect(screen.queryByLabelText("Kid's min calories")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Alice's min calories")).not.toBeInTheDocument();
  });

  it('shows an If room Meal Time with no minimum as Up to its maximum', async () => {
    setUpData([snack]);
    renderPage();
    expect(await screen.findByText(/Up to 200 kcal/)).toBeInTheDocument();
    expect(screen.queryByText(/0–200 kcal/)).not.toBeInTheDocument();
  });

  it('locks the creator and the editing Member in the sharing picker', async () => {
    setUpData([
      {
        ...lunch,
        createdBy: 9,
        sharers: [
          { id: 9, name: 'Kid' },
          { id: 4, name: 'Alice' },
        ],
      },
      snack,
    ]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Lunch' }));

    const aliceBox = screen.getByRole('checkbox', { name: 'Alice' });
    expect(aliceBox).toBeChecked();
    expect(aliceBox).toBeDisabled();
    const kidBox = screen.getByRole('checkbox', { name: 'Kid' });
    expect(kidBox).toBeChecked();
    expect(kidBox).toBeDisabled();
  });

  it('a Member who is not the creator only stops sharing the Meal Time', async () => {
    setUpData([
      {
        ...lunch,
        createdBy: 9,
        sharers: [
          { id: 9, name: 'Kid' },
          { id: 4, name: 'Alice' },
        ],
      },
      snack,
    ]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Lunch' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, stop sharing' }));

    await waitFor(() => expect(deleteMealTime).toHaveBeenCalledWith(expect.anything(), 4, 1, 9));
  });

  it('deletes only after a second tap', async () => {
    setUpData();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Lunch' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteMealTime).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(deleteMealTime).toHaveBeenCalledWith(expect.anything(), 4, 1, 4));
  });
});
