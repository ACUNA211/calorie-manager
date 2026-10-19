import { describe, expect, it } from 'vitest';
import { bandState, buildPlanGrid, portionKcal } from './planLogic.js';

const START = '2026-10-18'; // a Sunday

// Alice and Dana share Family dinner; Alice also has her own Breakfast. Two Cooks.
const data = {
  plan: { id: 1, status: 'draft', week_start: START },
  cooks: [
    {
      id: 10,
      recipeId: 1,
      recipeName: 'Oat bowl',
      cookDate: START,
      servingsMade: 1,
      kcalPerServing: 400,
    },
    {
      id: 11,
      recipeId: 2,
      recipeName: 'Stew',
      cookDate: '2026-10-19',
      servingsMade: 3,
      kcalPerServing: 600,
    },
  ],
  portions: [
    { id: 1, cookId: 10, memberId: 1, mealTimeId: 100, eatDate: START, servings: 1 },
    { id: 2, cookId: 11, memberId: 1, mealTimeId: 101, eatDate: '2026-10-19', servings: 1.5 },
    { id: 3, cookId: 11, memberId: 2, mealTimeId: 101, eatDate: '2026-10-19', servings: 1 },
    { id: 4, cookId: 11, memberId: 1, mealTimeId: 101, eatDate: '2026-11-30', servings: 1 },
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

describe('portionKcal', () => {
  it('multiplies servings by calories per serving and rounds', () => {
    expect(portionKcal({ servings: 1.5 }, { kcalPerServing: 333 })).toBe(500);
    expect(portionKcal({ servings: 1 }, undefined)).toBe(0);
  });
});

describe('bandState', () => {
  it('places a total against the band', () => {
    expect(bandState(1000, 1800, 2000)).toBe('under');
    expect(bandState(1900, 1800, 2000)).toBe('in');
    expect(bandState(2100, 1800, 2000)).toBe('over');
    expect(bandState(0, 1800, 2000)).toBe('none');
    expect(bandState(500, null, null)).toBe('noBand');
  });
});

describe('buildPlanGrid', () => {
  it('has Meal Times as rows in time order and seven days Sunday first', () => {
    const grid = buildPlanGrid(data, START);
    expect(grid.days[0]).toBe(START);
    expect(grid.days).toHaveLength(7);
    expect(grid.rows.map((row) => row.name)).toEqual(['Breakfast', 'Family dinner']);
    expect(grid.status).toBe('draft');
    expect(grid.empty).toBe(false);
  });

  it('shows a shared Meal Time as one Cook with a Portion per Member', () => {
    const dinner = buildPlanGrid(data, START).rows[1];
    expect(dinner.shared).toBe(true);
    const monday = dinner.cells[1];
    expect(monday).toHaveLength(1);
    expect(monday[0].recipeName).toBe('Stew');
    expect(monday[0].portions.map((p) => [p.memberName, p.kcal])).toEqual([
      ['Alice', 900],
      ['Dana', 600],
    ]);
  });

  it('colours each Cook differently and ignores Portions outside the week', () => {
    const grid = buildPlanGrid(data, START);
    expect(grid.rows[0].cells[0][0].colour).toBe(0);
    expect(grid.rows[1].cells[1][0].colour).toBe(1);
    const all = grid.rows.flatMap((row) => row.cells.flat().flatMap((c) => c.portions));
    expect(all).toHaveLength(3);
  });

  it('totals each Member per day against their band', () => {
    const [alice, dana] = buildPlanGrid(data, START).totals;
    expect(alice.days[0]).toMatchObject({ kcal: 400, state: 'under' });
    expect(alice.days[1]).toMatchObject({ kcal: 900, state: 'under' });
    expect(alice.days[2]).toMatchObject({ kcal: 0, state: 'none' });
    expect(dana.days[1]).toMatchObject({ kcal: 600, state: 'noBand' });
  });

  it('filters to one Member', () => {
    const grid = buildPlanGrid(data, START, 2);
    expect(grid.rows.map((row) => row.name)).toEqual(['Family dinner']);
    expect(grid.rows[0].cells[1][0].portions.map((p) => p.memberName)).toEqual(['Dana']);
    expect(grid.totals.map((t) => t.name)).toEqual(['Dana']);
  });

  it('reports an empty week', () => {
    const empty = { ...data, plan: null, cooks: [], portions: [], mealTimes: [] };
    const grid = buildPlanGrid(empty, START);
    expect(grid.empty).toBe(true);
    expect(grid.rows).toEqual([]);
    expect(grid.status).toBeNull();
  });

  it('merges same-named Meal Times of different Members into one row', () => {
    const merged = {
      ...data,
      portions: [
        { id: 1, cookId: 10, memberId: 1, mealTimeId: 100, eatDate: START, servings: 1 },
        { id: 2, cookId: 10, memberId: 2, mealTimeId: 102, eatDate: START, servings: 1 },
      ],
      mealTimes: [
        { id: 100, name: 'Breakfast', time: '07:30', kind: 'planned', memberIds: [1] },
        { id: 102, name: 'breakfast ', time: '07:30', kind: 'planned', memberIds: [2] },
      ],
    };
    const grid = buildPlanGrid(merged, START);
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0].cells[0][0].portions).toHaveLength(2);
  });
});
