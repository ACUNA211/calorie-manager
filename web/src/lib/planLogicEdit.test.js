import { describe, expect, it } from 'vitest';
import {
  buildPlanGrid,
  planMove,
  planPlacement,
  servingsMadeFor,
  sizePortion,
  stepServings,
} from './planLogic.js';

describe('sizePortion', () => {
  it('fits the remaining band calories in quarter servings, rounding down', () => {
    expect(sizePortion({ kcalPerServing: 400, remainingKcal: 1000 })).toBe(2.5);
    expect(sizePortion({ kcalPerServing: 400, remainingKcal: 1099 })).toBe(2.5);
    expect(sizePortion({ kcalPerServing: 400, remainingKcal: 1100 })).toBe(2.75);
  });

  it('splits the room between the Planned Meal Times still empty', () => {
    expect(sizePortion({ kcalPerServing: 500, remainingKcal: 1500, slotsLeft: 3 })).toBe(1);
    expect(sizePortion({ kcalPerServing: 500, remainingKcal: 1500, slotsLeft: 0 })).toBe(3);
  });

  it('never goes below a quarter or above four servings', () => {
    expect(sizePortion({ kcalPerServing: 500, remainingKcal: 0 })).toBe(0.25);
    expect(sizePortion({ kcalPerServing: 500, remainingKcal: -300 })).toBe(0.25);
    expect(sizePortion({ kcalPerServing: 100, remainingKcal: 5000 })).toBe(4);
  });

  it('gives one serving when there is no band or no calories to size by', () => {
    expect(sizePortion({ kcalPerServing: 400, remainingKcal: null })).toBe(1);
    expect(sizePortion({ kcalPerServing: 0, remainingKcal: 800 })).toBe(1);
  });
});

describe('servingsMadeFor and stepServings', () => {
  it('grows servings made to cover the Portions and never shrinks it', () => {
    expect(servingsMadeFor(2, [1, 1.5])).toBe(2.5);
    expect(servingsMadeFor(4, [1, 1])).toBe(4);
    expect(servingsMadeFor(2, [])).toBe(2);
  });

  it('steps a Portion by a quarter, never below a quarter', () => {
    expect(stepServings(1, 1)).toBe(1.25);
    expect(stepServings(1, -1)).toBe(0.75);
    expect(stepServings(0.25, -1)).toBe(0.25);
    expect(stepServings(20, 1)).toBe(20);
  });
});

// Alice (band 1800 to 2000) and Dana (no band). Alice has Breakfast, Lunch and a Snack of her
// own; both share Family dinner, which is not served on Sundays. Alice already has the 400 kcal
// Oat bowl at breakfast on Sunday.
const START = '2026-10-18'; // a Sunday
const MONDAY = '2026-10-19';
const editData = {
  plan: { id: 1, status: 'approved', week_start: START, changed_since_approval: true },
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
      cookDate: MONDAY,
      servingsMade: 3,
      kcalPerServing: 600,
    },
  ],
  portions: [{ id: 1, cookId: 10, memberId: 1, mealTimeId: 100, eatDate: START, servings: 1 }],
  mealTimes: [{ id: 100, name: 'Breakfast', time: '07:30', kind: 'planned', memberIds: [1] }],
  members: [
    { id: 1, name: 'Alice', role: 'owner', bandLow: 1800, bandHigh: 2000 },
    { id: 2, name: 'Dana', role: 'member', bandLow: null, bandHigh: null },
  ],
  slots: [
    { id: 100, name: 'Breakfast', time: '07:30', kind: 'planned', weekdays: null, memberIds: [1] },
    { id: 102, name: 'Lunch', time: '12:30', kind: 'planned', weekdays: null, memberIds: [1] },
    {
      id: 101,
      name: 'Family dinner',
      time: '18:30',
      kind: 'planned',
      weekdays: [1, 2, 3, 4, 5, 6],
      memberIds: [1, 2],
    },
    { id: 103, name: 'Snack', time: '15:00', kind: 'if_room', weekdays: null, memberIds: [1] },
  ],
};
const [breakfast, lunch, dinner, snack] = [
  editData.slots[0],
  editData.slots[1],
  editData.slots[2],
  editData.slots[3],
];

describe('buildPlanGrid for editing', () => {
  it('lists every Meal Time as a row and says which days can be added to', () => {
    const grid = buildPlanGrid(editData, START);
    expect(grid.rows.map((row) => row.name)).toEqual([
      'Breakfast',
      'Lunch',
      'Snack',
      'Family dinner',
    ]);
    expect(grid.changedSinceApproval).toBe(true);
    const dinnerRow = grid.rows.find((row) => row.name === 'Family dinner');
    expect(dinnerRow.addable).toEqual([false, true, true, true, true, true, true]);
    // Alice already has breakfast on Sunday; Monday is free
    expect(grid.rows[0].addable[0]).toBe(false);
    expect(grid.rows[0].addable[1]).toBe(true);
  });

  it("shows only the filtered Member's Meal Times", () => {
    const grid = buildPlanGrid(editData, START, 2);
    expect(grid.rows.map((row) => row.name)).toEqual(['Family dinner']);
  });

  it('offers nothing to add while the week has no Cook', () => {
    const grid = buildPlanGrid({ ...editData, cooks: [], portions: [] }, START);
    expect(grid.rows.every((row) => row.addable.every((flag) => !flag))).toBe(true);
  });

  it('is unchanged without slots: only Meal Times with a Portion', () => {
    const readOnly = { ...editData, slots: undefined };
    expect(buildPlanGrid(readOnly, START).rows.map((row) => row.name)).toEqual(['Breakfast']);
  });
});

describe('planPlacement', () => {
  it('sizes each Member from their own remaining band calories', () => {
    // Monday: Alice has nothing planned, band top 2000, and three Planned slots are empty
    // (breakfast, lunch, dinner): 2000 / 3 = 666 kcal, Stew is 600 a serving, so 1 serving.
    // Dana has no band, so one serving.
    expect(planPlacement(editData, 11, [dinner], MONDAY)).toEqual([
      { memberId: 1, mealTimeId: 101, servings: 1 },
      { memberId: 2, mealTimeId: 101, servings: 1 },
    ]);
  });

  it('uses what is left after the day already planned', () => {
    const busy = {
      ...editData,
      portions: [
        ...editData.portions,
        { id: 9, cookId: 11, memberId: 1, mealTimeId: 100, eatDate: MONDAY, servings: 2 },
        { id: 10, cookId: 11, memberId: 1, mealTimeId: 102, eatDate: MONDAY, servings: 1 },
      ],
    };
    // 2000 - 1800 = 200 kcal left, one slot (dinner): less than a quarter of a 600 kcal serving
    expect(planPlacement(busy, 11, [dinner], MONDAY, 1)).toEqual([
      { memberId: 1, mealTimeId: 101, servings: 0.25 },
    ]);
    // the same day for a Cook of 100 kcal a serving: 200 / 100 = 2
    const light = {
      ...busy,
      cooks: [...busy.cooks, { id: 12, recipeName: 'Soup', kcalPerServing: 100 }],
    };
    expect(planPlacement(light, 12, [dinner], MONDAY, 1)[0].servings).toBe(2);
  });

  it('gives an If room Meal Time the whole room, not a share', () => {
    // 2000 kcal left, no share taken off: 2000 / 400 = 5, capped at four servings
    expect(planPlacement(editData, 10, [snack], MONDAY)[0].servings).toBe(4);
    // 2000 / 600 = 3.33 -> 3.25
    expect(planPlacement(editData, 11, [snack], MONDAY)[0].servings).toBe(3.25);
  });

  it('skips a Member who already has a Portion there, and unknown Cooks', () => {
    const taken = {
      ...editData,
      portions: [{ id: 5, cookId: 10, memberId: 1, mealTimeId: 101, eatDate: MONDAY, servings: 1 }],
    };
    expect(planPlacement(taken, 11, [dinner], MONDAY).map((p) => p.memberId)).toEqual([2]);
    expect(planPlacement(editData, 999, [dinner], MONDAY)).toEqual([]);
  });

  it('places one Member only when asked', () => {
    expect(planPlacement(editData, 11, [dinner], MONDAY, 2)).toEqual([
      { memberId: 2, mealTimeId: 101, servings: 1 },
    ]);
  });
});

describe('planMove', () => {
  const both = [
    { id: 2, memberId: 1 },
    { id: 3, memberId: 2 },
  ];
  const placed = {
    ...editData,
    portions: [
      { id: 2, cookId: 11, memberId: 1, mealTimeId: 101, eatDate: MONDAY, servings: 1 },
      { id: 3, cookId: 11, memberId: 2, mealTimeId: 101, eatDate: MONDAY, servings: 1 },
    ],
  };

  it('moves every Portion to the Meal Time its Member shares on the new day', () => {
    expect(planMove(placed, both, [dinner], '2026-10-20')).toEqual({
      ok: true,
      moves: [
        { portionId: 2, mealTimeId: 101, eatDate: '2026-10-20' },
        { portionId: 3, mealTimeId: 101, eatDate: '2026-10-20' },
      ],
    });
  });

  it('leaves out a Portion that is already there', () => {
    expect(planMove(placed, both, [dinner], MONDAY)).toEqual({ ok: true, moves: [] });
  });

  it('refuses when a Member does not share the target Meal Time', () => {
    expect(planMove(placed, both, [lunch], MONDAY)).toEqual({ ok: false, reason: 'noSlot' });
  });

  it('refuses when a Member already has a Portion at the target', () => {
    const crowded = {
      ...placed,
      portions: [
        ...placed.portions,
        { id: 8, cookId: 10, memberId: 1, mealTimeId: 101, eatDate: '2026-10-20', servings: 1 },
      ],
    };
    expect(planMove(crowded, both, [dinner], '2026-10-20')).toEqual({
      ok: false,
      reason: 'occupied',
    });
  });

  it('refuses a day the Meal Time is not served', () => {
    expect(planMove(placed, both, [dinner], START)).toEqual({ ok: false, reason: 'noSlot' });
    expect(planMove(placed, [{ id: 1, memberId: 1 }], [breakfast], MONDAY).ok).toBe(true);
  });
});
