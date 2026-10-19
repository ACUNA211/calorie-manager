import { describe, expect, it, vi } from 'vitest';
import {
  addCook,
  deleteCook,
  loadRecipeChoices,
  loadSlotMealTimes,
  movePortion,
  removePortion,
  setPortion,
} from './plan.js';

const ok = (data = null) => vi.fn(async () => ({ data, error: null }));

describe('plan slots and writes', () => {
  it('reads every Meal Time of the Household', async () => {
    const rpc = ok([
      {
        id: 1,
        name: 'Lunch',
        time_of_day: '12:30:00',
        kind: 'planned',
        weekdays: [1],
        member_ids: [3],
      },
    ]);
    const slots = await loadSlotMealTimes({ rpc });
    expect(rpc).toHaveBeenCalledWith('plan_meal_times');
    expect(slots).toEqual([
      { id: 1, name: 'Lunch', time: '12:30', kind: 'planned', weekdays: [1], memberIds: [3] },
    ]);
  });

  it('calls the write functions with their named arguments', async () => {
    const rpc = ok(5);
    const client = { rpc };
    await addCook(client, '2026-10-18', 2, '2026-10-19');
    expect(rpc).toHaveBeenLastCalledWith('plan_add_cook', {
      p_week_start: '2026-10-18',
      p_recipe_id: 2,
      p_cook_date: '2026-10-19',
    });
    await setPortion(client, {
      cookId: 1,
      memberId: 2,
      mealTimeId: 3,
      eatDate: '2026-10-20',
      servings: 1.25,
    });
    expect(rpc).toHaveBeenLastCalledWith('plan_set_portion', {
      p_cook_id: 1,
      p_member_id: 2,
      p_meal_time_id: 3,
      p_eat_date: '2026-10-20',
      p_servings: 1.25,
    });
    await movePortion(client, 7, 3, '2026-10-21');
    expect(rpc).toHaveBeenLastCalledWith('plan_move_portion', {
      p_portion_id: 7,
      p_meal_time_id: 3,
      p_eat_date: '2026-10-21',
    });
    await removePortion(client, 7);
    expect(rpc).toHaveBeenLastCalledWith('plan_remove_portion', { p_portion_id: 7 });
    await deleteCook(client, 1);
    expect(rpc).toHaveBeenLastCalledWith('plan_delete_cook', { p_cook_id: 1 });
  });

  it('throws the database error from a write', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: new Error('refused') }));
    await expect(removePortion({ rpc }, 1)).rejects.toThrow('refused');
  });

  it('lists the Recipes to cook, starred first', async () => {
    const query = {
      select: vi.fn(() => query),
      order: vi
        .fn()
        .mockImplementationOnce(() => query)
        .mockImplementationOnce(async () => ({
          data: [{ id: 1, name: 'Stew', starred: true }],
          error: null,
        })),
    };
    const recipes = await loadRecipeChoices({ from: vi.fn(() => query) });
    expect(recipes).toEqual([{ id: 1, name: 'Stew' }]);
  });
});
