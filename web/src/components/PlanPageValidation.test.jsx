import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanPage from './PlanPage.jsx';
import * as plan from '../lib/plan.js';
import { MetricProvider } from '../test/metricUnits.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/plan.js', () => ({
  loadPlanWeek: vi.fn(),
  loadPlanValidation: vi.fn(),
  loadSlotMealTimes: vi.fn(),
  loadRecipeChoices: vi.fn(),
  loadCanApprove: vi.fn(),
  approvePlan: vi.fn(),
  addCook: vi.fn(),
  deleteCook: vi.fn(),
  setPortion: vi.fn(),
  movePortion: vi.fn(),
  removePortion: vi.fn(),
}));

// Today is Saturday 17 October 2026, so the week is Sunday 11 to Saturday 17 October.
const WEEK = '2026-10-11';
const MONDAY = '2026-10-12';

const slots = [
  { id: 100, name: 'Breakfast', time: '07:30', kind: 'planned', weekdays: [1], memberIds: [1] },
  {
    id: 101,
    name: 'Family dinner',
    time: '18:30',
    kind: 'planned',
    weekdays: [1],
    memberIds: [1, 2],
  },
];

// Monday only. Alice's breakfast is empty (Planned, must be filled). The family dinner is
// Lentil stew at 600 kcal a serving: Dana's Portion breaks her nut rule, and Alice's 1.5
// servings (900) is over her range of 500 to 700.
function makeWeek() {
  return {
    plan: { id: 1, status: 'draft', week_start: WEEK },
    cooks: [
      {
        id: 11,
        recipeId: 2,
        recipeName: 'Lentil stew',
        cookDate: MONDAY,
        servingsMade: 3,
        kcalPerServing: 600,
      },
    ],
    portions: [
      { id: 2, cookId: 11, memberId: 1, mealTimeId: 101, eatDate: MONDAY, servings: 1.5 },
      { id: 3, cookId: 11, memberId: 2, mealTimeId: 101, eatDate: MONDAY, servings: 1 },
    ],
    mealTimes: [slots[1]],
    members: [
      { id: 1, name: 'Alice', role: 'owner', bandLow: 1800, bandHigh: 2000 },
      { id: 2, name: 'Dana', role: 'member', bandLow: null, bandHigh: null },
    ],
  };
}

const validation = {
  ranges: [
    { mealTimeId: 100, memberId: 1, calMin: 300, calMax: 500, setCalories: null },
    { mealTimeId: 101, memberId: 1, calMin: 500, calMax: 700, setCalories: null },
    { mealTimeId: 101, memberId: 2, calMin: 400, calMax: 800, setCalories: null },
  ],
  breaks: [{ recipeId: 2, memberId: 2, ruleKind: 'group', rule: 'nuts', foodName: 'Almond' }],
  recipeIds: [2],
};

function renderPage() {
  render(<PlanPage />, { wrapper: MetricProvider });
}

describe('PlanPage plan check', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00'));
    for (const fn of Object.values(plan)) fn.mockReset();
    vi.mocked(plan.loadPlanWeek).mockResolvedValue(makeWeek());
    vi.mocked(plan.loadSlotMealTimes).mockResolvedValue(slots);
    vi.mocked(plan.loadCanApprove).mockResolvedValue(false);
    vi.mocked(plan.loadRecipeChoices).mockResolvedValue([]);
    vi.mocked(plan.loadPlanValidation).mockResolvedValue(validation);
  });

  it('shows each failure as a warning on its slot and day', async () => {
    renderPage();
    await screen.findByText('Lentil stew');

    const dinnerRow = screen.getByRole('row', { name: /Family dinner/ });
    const dinner = within(dinnerRow);
    expect(
      dinner.getByText(/Dana cannot eat Lentil stew: Almond breaks the rule "nuts"/)
    ).toBeInTheDocument();
    expect(
      dinner.getByText(
        /Alice: Lentil stew at Family dinner is 900 kcal, over the range of 500 to 700/
      )
    ).toBeInTheDocument();

    const breakfast = within(screen.getByRole('row', { name: /Breakfast/ }));
    expect(
      breakfast.getByText(/Alice has nothing planned at Breakfast \(aim 300 to 500 kcal\)/)
    ).toBeInTheDocument();

    const totals = within(screen.getByRole('row', { name: /Alice day total/i }));
    expect(
      totals.getByText(/Alice's day is 900 kcal, under the band of 1,800 to 2,000/)
    ).toBeInTheDocument();

    expect(screen.getByRole('status')).toHaveTextContent('Plan check: 4 to look at.');
  });

  it('says nothing is wrong when the plan passes, and shows no warnings', async () => {
    vi.mocked(plan.loadPlanValidation).mockResolvedValue({
      ranges: [
        { mealTimeId: 101, memberId: 1, calMin: 500, calMax: 700, setCalories: null },
        { mealTimeId: 101, memberId: 2, calMin: 400, calMax: 800, setCalories: null },
      ],
      breaks: [],
      recipeIds: [2],
    });
    vi.mocked(plan.loadSlotMealTimes).mockResolvedValue([slots[1]]);
    vi.mocked(plan.loadPlanWeek).mockResolvedValue({
      ...makeWeek(),
      portions: [
        { id: 2, cookId: 11, memberId: 1, mealTimeId: 101, eatDate: MONDAY, servings: 1 },
        { id: 3, cookId: 11, memberId: 2, mealTimeId: 101, eatDate: MONDAY, servings: 1 },
      ],
      members: [
        { id: 1, name: 'Alice', role: 'owner', bandLow: null, bandHigh: null },
        { id: 2, name: 'Dana', role: 'member', bandLow: null, bandHigh: null },
      ],
    });
    renderPage();
    await screen.findByText('Plan check: no problems found.');
    expect(screen.queryByText(/to look at/)).not.toBeInTheDocument();
  });

  it('still shows the grid when the check cannot be loaded', async () => {
    vi.mocked(plan.loadPlanValidation).mockRejectedValue(new Error('down'));
    renderPage();
    await screen.findByText('Lentil stew');
    expect(screen.queryByText(/Plan check/)).not.toBeInTheDocument();
  });
});
