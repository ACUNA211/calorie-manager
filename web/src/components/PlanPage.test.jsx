import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlanPage from './PlanPage.jsx';
import * as plan from '../lib/plan.js';
import { MetricProvider } from '../test/metricUnits.jsx';

const { loadPlanWeek } = plan;

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/plan.js', () => ({
  loadPlanWeek: vi.fn(),
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
const NEXT_WEEK = '2026-10-18';

const planData = {
  plan: { id: 1, status: 'draft', week_start: WEEK },
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
      cookDate: '2026-10-12',
      servingsMade: 2,
      kcalPerServing: 600,
    },
  ],
  portions: [
    { id: 1, cookId: 10, memberId: 1, mealTimeId: 100, eatDate: WEEK, servings: 1 },
    { id: 2, cookId: 11, memberId: 1, mealTimeId: 101, eatDate: '2026-10-12', servings: 1 },
    { id: 3, cookId: 11, memberId: 2, mealTimeId: 101, eatDate: '2026-10-12', servings: 1 },
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
const emptyData = { plan: null, cooks: [], portions: [], mealTimes: [], members: planData.members };

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

// Every plan.js function is a mock: reads give the fixtures, writes succeed.
function setupMocks() {
  for (const fn of Object.values(plan)) fn.mockReset();
  vi.mocked(plan.loadSlotMealTimes).mockResolvedValue(slots);
  vi.mocked(plan.loadCanApprove).mockResolvedValue(false);
  vi.mocked(plan.loadRecipeChoices).mockResolvedValue([
    { id: 5, name: 'Pasta bake' },
    { id: 6, name: 'Chili' },
  ]);
  for (const name of ['addCook', 'deleteCook', 'setPortion', 'movePortion', 'removePortion']) {
    vi.mocked(plan[name]).mockResolvedValue(1);
  }
}

function renderPage() {
  render(<PlanPage />, { wrapper: MetricProvider });
}

describe('PlanPage', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T12:00:00'));
    setupMocks();
    vi.mocked(loadPlanWeek).mockReset();
    vi.mocked(loadPlanWeek).mockImplementation(async (_client, start) =>
      start === WEEK ? planData : emptyData
    );
  });

  it('shows the current week from the database', async () => {
    renderPage();
    expect(await screen.findByText('Oat bowl')).toBeInTheDocument();
    expect(loadPlanWeek).toHaveBeenCalledWith({}, WEEK);
    expect(screen.getByRole('rowheader', { name: /Breakfast/ })).toBeInTheDocument();
  });

  it('shows a shared Meal Time as one Cook with a Portion per Member', async () => {
    renderPage();
    await screen.findByText('Lentil stew');
    expect(screen.getAllByText('Lentil stew')).toHaveLength(1);
    expect(screen.getByText(/Alice: 1 serving\(s\), 600 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/Dana: 1 serving\(s\), 600 kcal/)).toBeInTheDocument();
  });

  it("shows each Member's day total against their band", async () => {
    renderPage();
    await screen.findByText('Lentil stew');
    const aliceRow = screen.getByRole('rowheader', { name: /Alice day total/ }).closest('tr');
    expect(within(aliceRow).getAllByText('Under the band')).toHaveLength(2);
    const danaRow = screen.getByRole('rowheader', { name: /Dana day total/ }).closest('tr');
    expect(within(danaRow).getByText('600 kcal')).toBeInTheDocument();
    expect(within(danaRow).queryByText('Under the band')).not.toBeInTheDocument();
  });

  it('filters to one Member', async () => {
    renderPage();
    await screen.findByText('Lentil stew');
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'Dana');
    expect(screen.queryByText('Oat bowl')).not.toBeInTheDocument();
    expect(screen.queryByText(/Alice:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Dana: 1 serving/)).toBeInTheDocument();
  });

  it('moves between weeks and says an empty week has no plan yet', async () => {
    renderPage();
    await screen.findByText('Oat bowl');
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(await screen.findByText('This week has no plan yet.')).toBeInTheDocument();
    expect(loadPlanWeek).toHaveBeenLastCalledWith({}, NEXT_WEEK);
    await userEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(await screen.findByText('Oat bowl')).toBeInTheDocument();
  });

  it('tells the person when the plan cannot be loaded', async () => {
    vi.mocked(loadPlanWeek).mockRejectedValue(new Error('down'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the plan')
    );
  });
});
