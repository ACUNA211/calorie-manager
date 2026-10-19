import { describe, expect, it, vi } from 'vitest';
import { loadPlanWeek, normalizePlanWeek } from './plan.js';

describe('normalizePlanWeek', () => {
  it('turns the raw rows into plain data', () => {
    const data = normalizePlanWeek({
      plan: { id: 1, status: 'draft', week_start: '2026-10-18' },
      cooks: [
        {
          id: 2,
          recipe_id: 3,
          recipe_name: 'Stew',
          cook_date: '2026-10-19',
          servings_made: '2',
          kcal_per_serving: 400.4,
        },
      ],
      portions: [
        {
          id: 5,
          cook_id: 2,
          member_id: 7,
          meal_time_id: 9,
          eat_date: '2026-10-19',
          servings: '1.5',
        },
      ],
      meal_times: [
        { id: 9, name: 'Dinner', time_of_day: '18:30:00', kind: 'planned', member_ids: [7] },
      ],
      members: [{ id: 7, display_name: 'Alice', role: 'owner', band_low: 1800, band_high: null }],
    });
    expect(data.cooks[0]).toMatchObject({
      recipeName: 'Stew',
      servingsMade: 2,
      kcalPerServing: 400.4,
    });
    expect(data.portions[0]).toMatchObject({ cookId: 2, memberId: 7, servings: 1.5 });
    expect(data.mealTimes[0].time).toBe('18:30');
    expect(data.members[0]).toMatchObject({ name: 'Alice', bandLow: 1800, bandHigh: null });
  });

  it('copes with a week that has no plan', () => {
    expect(normalizePlanWeek({ plan: null })).toEqual({
      plan: null,
      cooks: [],
      portions: [],
      mealTimes: [],
      members: [],
    });
    expect(normalizePlanWeek(null).cooks).toEqual([]);
  });
});

describe('loadPlanWeek', () => {
  it('calls plan_week with the Sunday', async () => {
    const rpc = vi.fn(async () => ({ data: { plan: null }, error: null }));
    await loadPlanWeek({ rpc }, '2026-10-18');
    expect(rpc).toHaveBeenCalledWith('plan_week', { p_week_start: '2026-10-18' });
  });

  it('throws the database error', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: new Error('nope') }));
    await expect(loadPlanWeek({ rpc }, '2026-10-18')).rejects.toThrow('nope');
  });
});
