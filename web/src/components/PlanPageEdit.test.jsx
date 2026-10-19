import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanPage from './PlanPage.jsx';
import * as plan from '../lib/plan.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/plan.js', () => ({
  loadPlanWeek: vi.fn(),
  loadSlotMealTimes: vi.fn(),
  loadRecipeChoices: vi.fn(),
  addCook: vi.fn(),
  deleteCook: vi.fn(),
  setPortion: vi.fn(),
  movePortion: vi.fn(),
  removePortion: vi.fn(),
}));

// Today is Saturday 17 October 2026, so the week is Sunday 11 to Saturday 17 October.
const WEEK = '2026-10-11';
const MONDAY = '2026-10-12';

function makePlan(status = 'draft', changed = false) {
  return {
    plan: { id: 1, status, week_start: WEEK, changed_since_approval: changed },
    cooks: [
      {
        id: 10,
        recipeId: 1,
        recipeName: 'Oat bowl',
        cookDate: WEEK,
        servingsMade: 1,
        kcalPerServing: 400,
      },
      {
        id: 11,
        recipeId: 2,
        recipeName: 'Lentil stew',
        cookDate: MONDAY,
        servingsMade: 2,
        kcalPerServing: 600,
      },
    ],
    portions: [
      { id: 1, cookId: 10, memberId: 1, mealTimeId: 100, eatDate: WEEK, servings: 1 },
      { id: 2, cookId: 11, memberId: 1, mealTimeId: 101, eatDate: MONDAY, servings: 1 },
      { id: 3, cookId: 11, memberId: 2, mealTimeId: 101, eatDate: MONDAY, servings: 1 },
    ],
    mealTimes: [
      { id: 100, name: 'Breakfast', time: '07:30', kind: 'planned', memberIds: [1] },
      { id: 101, name: 'Family dinner', time: '18:30', kind: 'planned', memberIds: [1, 2] },
    ],
    members: [
      { id: 1, name: 'Alice', role: 'owner', bandLow: 1800, bandHigh: 2000 },
      { id: 2, name: 'Dana', role: 'member', bandLow: null, bandHigh: null },
    ],
  };
}
const slots = [
  { id: 100, name: 'Breakfast', time: '07:30', kind: 'planned', weekdays: null, memberIds: [1] },
  {
    id: 101,
    name: 'Family dinner',
    time: '18:30',
    kind: 'planned',
    weekdays: null,
    memberIds: [1, 2],
  },
];

function renderPage() {
  render(<PlanPage />, { wrapper: MetricProvider });
}

describe('PlanPage editing', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00'));
    for (const fn of Object.values(plan)) fn.mockReset();
    vi.mocked(plan.loadPlanWeek).mockResolvedValue(makePlan());
    vi.mocked(plan.loadSlotMealTimes).mockResolvedValue(slots);
    vi.mocked(plan.loadRecipeChoices).mockResolvedValue([
      { id: 5, name: 'Pasta bake' },
      { id: 6, name: 'Chili' },
    ]);
    for (const name of ['addCook', 'deleteCook', 'setPortion', 'movePortion', 'removePortion']) {
      vi.mocked(plan[name]).mockResolvedValue(1);
    }
  });

  it('adds a Cook of a Recipe on a day and reads the week again', async () => {
    renderPage();
    await screen.findByText('Oat bowl');
    await userEvent.selectOptions(await screen.findByLabelText('Recipe'), 'Chili');
    await userEvent.selectOptions(screen.getByLabelText('Cook day'), MONDAY);
    await userEvent.click(screen.getByRole('button', { name: 'Add Cook' }));
    await waitFor(() => expect(plan.addCook).toHaveBeenCalledWith({}, WEEK, 6, MONDAY));
    await waitFor(() => expect(plan.loadPlanWeek).toHaveBeenCalledTimes(2));
  });

  it('places a Cook at an empty Meal Time, sized from what the Member has left', async () => {
    renderPage();
    await screen.findByText('Oat bowl');
    // Breakfast on Monday is empty. Alice has 600 kcal of stew that day, 2000 - 600 = 1400 left
    // and breakfast is her only empty Planned slot: 1400 / 600 = 2.33, so 2.25 servings.
    const adds = screen.getAllByRole('button', { name: /Add a Cook to Breakfast/ });
    await userEvent.click(adds[0]);
    await userEvent.selectOptions(screen.getByLabelText('Cook to place'), '11');
    await userEvent.click(screen.getByRole('button', { name: 'Place' }));
    await waitFor(() =>
      expect(plan.setPortion).toHaveBeenCalledWith(
        {},
        { cookId: 11, eatDate: MONDAY, memberId: 1, mealTimeId: 100, servings: 2.25 }
      )
    );
    expect(plan.setPortion).toHaveBeenCalledTimes(1);
  });

  it('places a Portion for each Member who shares the Meal Time', async () => {
    renderPage();
    await screen.findByText('Oat bowl');
    // Family dinner on Sunday is empty for both Members
    const adds = screen.getAllByRole('button', { name: /Add a Cook to Family dinner/ });
    await userEvent.click(adds[0]);
    await userEvent.selectOptions(screen.getByLabelText('Cook to place'), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Place' }));
    await waitFor(() => expect(plan.setPortion).toHaveBeenCalledTimes(2));
    const members = vi.mocked(plan.setPortion).mock.calls.map((call) => call[1].memberId);
    expect(members).toEqual([1, 2]);
    expect(vi.mocked(plan.setPortion).mock.calls[0][1]).toMatchObject({
      cookId: 10,
      eatDate: WEEK,
      mealTimeId: 101,
    });
  });

  it('changes a Portion by a quarter serving', async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Bigger Portion of Oat bowl for Alice' })
    );
    await waitFor(() =>
      expect(plan.setPortion).toHaveBeenCalledWith(
        {},
        { cookId: 10, memberId: 1, mealTimeId: 100, eatDate: WEEK, servings: 1.25 }
      )
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Smaller Portion of Oat bowl for Alice' })
    );
    await waitFor(() =>
      expect(plan.setPortion).toHaveBeenLastCalledWith(
        {},
        { cookId: 10, memberId: 1, mealTimeId: 100, eatDate: WEEK, servings: 0.75 }
      )
    );
  });

  it('removes a Portion', async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove the Portion of Oat bowl for Alice' })
    );
    await waitFor(() => expect(plan.removePortion).toHaveBeenCalledWith({}, 1));
  });

  it('moves a Cook to another day, every Portion with it', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Move Lentil stew' }));
    await userEvent.selectOptions(screen.getByLabelText('Move to day'), '2026-10-14');
    await userEvent.click(screen.getByRole('button', { name: 'Move here' }));
    await waitFor(() => expect(plan.movePortion).toHaveBeenCalledTimes(2));
    expect(plan.movePortion).toHaveBeenCalledWith({}, 2, 101, '2026-10-14');
    expect(plan.movePortion).toHaveBeenCalledWith({}, 3, 101, '2026-10-14');
  });

  it('does not move a Cook to a Meal Time a Member does not share', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Move Lentil stew' }));
    await userEvent.selectOptions(screen.getByLabelText('Move to Meal Time'), '07:30|breakfast');
    await userEvent.click(screen.getByRole('button', { name: 'Move here' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('does not share that Meal Time');
    expect(plan.movePortion).not.toHaveBeenCalled();
  });

  it('deletes a Cook after asking, and keeps it when asked to', async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete the Cook of Lentil stew' })
    );
    expect(screen.getByText(/Delete Lentil stew and all its Portions/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(plan.deleteCook).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete the Cook of Lentil stew' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(plan.deleteCook).toHaveBeenCalledWith({}, 11));
  });

  it('shows the servings made against the servings planned', async () => {
    renderPage();
    expect(
      await screen.findByText(/Lentil stew, cooked .*: 2 servings made, 2 planned/)
    ).toBeInTheDocument();
  });

  it('says so when a change cannot be saved', async () => {
    vi.mocked(plan.removePortion).mockRejectedValue(new Error('refused'));
    renderPage();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove the Portion of Oat bowl for Alice' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that change');
  });

  it('marks an approved plan that was changed since approval', async () => {
    vi.mocked(plan.loadPlanWeek).mockResolvedValue(makePlan('approved', true));
    renderPage();
    expect(
      await screen.findByText('This plan was approved and has been changed since.')
    ).toBeInTheDocument();
    expect(screen.getByText('Approved plan')).toBeInTheDocument();
  });

  it('does not mark an approved plan that is untouched', async () => {
    vi.mocked(plan.loadPlanWeek).mockResolvedValue(makePlan('approved', false));
    renderPage();
    await screen.findByText('Approved plan');
    expect(screen.queryByText(/changed since/)).not.toBeInTheDocument();
  });
});
