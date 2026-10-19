import { describe, expect, it } from 'vitest';
import { failuresForCell, failuresForDay, validatePlan } from './planValidator.js';

// Sunday 11 to Saturday 17 October 2026.
const DAYS = [
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
];
const MON = DAYS[1];

// One Member (Alice, band 1700 to 1800) with Breakfast (Planned 300-500), Dinner (Planned
// 500-900), a Set snack of 200 and an If room dessert (max 150), every day.
// Each day: breakfast 1.25 x 400 = 500, dinner 1.5 x 600 = 900, dessert 1.5 x 100 = 150,
// plus the Set 200 = 1750, inside the band.
function basePlan() {
  const cooks = [
    { id: 1, recipeId: 10, recipeName: 'Oat bowl', kcalPerServing: 400 },
    { id: 2, recipeId: 11, recipeName: 'Lentil stew', kcalPerServing: 600 },
    { id: 3, recipeId: 12, recipeName: 'Fruit', kcalPerServing: 100 },
  ];
  const mealTimes = [
    { id: 1, name: 'Breakfast', time: '07:30', kind: 'planned', weekdays: null, memberIds: [1] },
    { id: 2, name: 'Dinner', time: '18:30', kind: 'planned', weekdays: null, memberIds: [1] },
    { id: 3, name: 'Snack', time: '15:00', kind: 'set', weekdays: null, memberIds: [1] },
    { id: 4, name: 'Dessert', time: '20:00', kind: 'if_room', weekdays: null, memberIds: [1] },
  ];
  const ranges = [
    { mealTimeId: 1, memberId: 1, calMin: 300, calMax: 500, setCalories: null },
    { mealTimeId: 2, memberId: 1, calMin: 500, calMax: 900, setCalories: null },
    { mealTimeId: 3, memberId: 1, calMin: null, calMax: null, setCalories: 200 },
    { mealTimeId: 4, memberId: 1, calMin: null, calMax: 150, setCalories: null },
  ];
  const portions = [];
  let id = 1;
  for (const day of DAYS) {
    const at = (cookId, mealTimeId, servings) =>
      portions.push({ id: id++, cookId, memberId: 1, mealTimeId, eatDate: day, servings });
    at(1, 1, 1.25);
    at(2, 2, 1.5);
    at(3, 4, 1.5);
  }
  return {
    days: DAYS,
    cooks,
    portions,
    mealTimes,
    slots: mealTimes,
    members: [{ id: 1, name: 'Alice', bandLow: 1700, bandHigh: 1800 }],
    ranges,
    breaks: [],
    recipeIds: [10, 11, 12],
  };
}

const codes = (result) => result.failures.map((f) => f.code);
const without = (plan, test) => ({ ...plan, portions: plan.portions.filter((p) => !test(p)) });

describe('validatePlan', () => {
  it('finds nothing wrong with a valid plan', () => {
    const result = validatePlan(basePlan());
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('flags a Planned Meal Time with no Portion, with the slot and its range', () => {
    const plan = without(basePlan(), (p) => p.mealTimeId === 1 && p.eatDate === MON);
    const { failures } = validatePlan(plan);
    const unfilled = failures.filter((f) => f.code === 'unfilled');
    expect(unfilled).toHaveLength(1);
    expect(unfilled[0]).toMatchObject({ day: MON, memberId: 1, mealTimeId: 1 });
    expect(unfilled[0].params).toMatchObject({
      name: 'Alice',
      meal: 'Breakfast',
      min: 300,
      max: 500,
    });
    // That day also lands under the band, reported as a day failure.
    expect(codes({ failures })).toContain('dayUnder');
  });

  it('only expects a Meal Time on the weekdays it applies to', () => {
    const plan = basePlan();
    plan.slots = plan.slots.map((m) => (m.id === 1 ? { ...m, weekdays: [1, 2, 3, 4, 5] } : m));
    plan.mealTimes = plan.slots;
    const weekend = new Set([DAYS[0], DAYS[6]]);
    const noWeekend = without(plan, (p) => p.mealTimeId === 1 && weekend.has(p.eatDate));
    expect(codes(validatePlan(noWeekend))).not.toContain('unfilled');
  });

  it('flags a Portion below and above a Planned range', () => {
    const plan = basePlan();
    plan.portions = plan.portions.map((p) => {
      if (p.mealTimeId === 1 && p.eatDate === DAYS[1]) return { ...p, servings: 0.5 }; // 200 < 300
      if (p.mealTimeId === 1 && p.eatDate === DAYS[2]) return { ...p, servings: 2 }; // 800 > 500
      return p;
    });
    const { failures } = validatePlan(plan);
    expect(failures.find((f) => f.code === 'belowRange')).toMatchObject({
      day: DAYS[1],
      mealTimeId: 1,
      params: { kcal: 200, min: 300, max: 500 },
    });
    expect(failures.find((f) => f.code === 'aboveRange')).toMatchObject({
      day: DAYS[2],
      params: { kcal: 800, max: 500 },
    });
  });

  it('flags an If room Portion over its maximum but never under its minimum', () => {
    const plan = basePlan();
    plan.portions = plan.portions.map((p) =>
      p.mealTimeId === 4 && p.eatDate === MON ? { ...p, servings: 2 } : p
    ); // 200 > 150
    const above = validatePlan(plan).failures.filter((f) => f.code === 'aboveRange');
    expect(above.map((f) => f.mealTimeId)).toEqual([4]);
    plan.ranges = plan.ranges.map((r) => (r.mealTimeId === 4 ? { ...r, calMin: 100 } : r));
    plan.portions = plan.portions.map((p) => (p.mealTimeId === 4 ? { ...p, servings: 0.5 } : p));
    expect(codes(validatePlan(plan))).not.toContain('belowRange');
  });

  it('flags a Portion placed at a Set Meal Time', () => {
    const plan = basePlan();
    plan.portions.push({
      id: 900,
      cookId: 3,
      memberId: 1,
      mealTimeId: 3,
      eatDate: MON,
      servings: 1,
    });
    const { failures } = validatePlan(plan);
    expect(failures.filter((f) => f.code === 'setTouched')).toEqual([
      expect.objectContaining({ day: MON, mealTimeId: 3, portionId: 900 }),
    ]);
    // The Portion does not count toward the day on top of the Set calories.
    expect(codes({ failures })).not.toContain('dayOver');
  });

  it('counts Set calories toward the day against the band', () => {
    const plan = basePlan();
    plan.ranges = plan.ranges.map((r) => (r.mealTimeId === 3 ? { ...r, setCalories: 600 } : r));
    const over = validatePlan(plan).failures.filter((f) => f.code === 'dayOver');
    expect(over).toHaveLength(7);
    expect(over[0].params).toMatchObject({ kcal: 2150, low: 1700, high: 1800 });
  });

  it('flags days under the Planning band, and skips Members with no band', () => {
    const plan = basePlan();
    plan.portions = plan.portions.map((p) =>
      p.mealTimeId === 2 && p.eatDate === MON ? { ...p, servings: 0.9 } : p
    ); // dinner 540, still inside its range; the day is 500 + 540 + 150 + 200 = 1390
    expect(failuresForDay(validatePlan(plan).failures, 1, MON)).toEqual([
      expect.objectContaining({
        code: 'dayUnder',
        params: expect.objectContaining({ kcal: 1390 }),
      }),
    ]);
    const noBand = { ...plan, members: [{ id: 1, name: 'Alice', bandLow: null, bandHigh: null }] };
    expect(codes(validatePlan(noBand))).not.toContain('dayUnder');
  });

  it('flags a Hard-rule break for the Member who eats the Recipe, once per break', () => {
    const plan = basePlan();
    plan.breaks = [
      { recipeId: 11, memberId: 1, ruleKind: 'diet', rule: 'vegetarian', foodName: 'Chicken' },
      { recipeId: 11, memberId: 2, ruleKind: 'group', rule: 'nuts', foodName: 'Almond' }, // not eaten by 2
    ];
    const hard = validatePlan(plan).failures.filter((f) => f.code === 'hardRule');
    expect(hard).toHaveLength(7); // Lentil stew at dinner every day
    expect(hard[0].params).toMatchObject({
      name: 'Alice',
      rule: 'vegetarian',
      ingredient: 'Chicken',
      recipe: 'Lentil stew',
    });
  });

  it('flags a break at a shared Meal Time only for the Member it concerns', () => {
    const plan = basePlan();
    plan.members.push({ id: 2, name: 'Dana', bandLow: null, bandHigh: null });
    plan.slots = plan.slots.map((m) => (m.id === 2 ? { ...m, memberIds: [1, 2] } : m));
    plan.mealTimes = plan.slots;
    plan.portions = plan.portions.concat(
      DAYS.map((day, i) => ({
        id: 1000 + i,
        cookId: 2,
        memberId: 2,
        mealTimeId: 2,
        eatDate: day,
        servings: 1,
      }))
    );
    plan.ranges.push({ mealTimeId: 2, memberId: 2, calMin: 500, calMax: 900, setCalories: null });
    plan.breaks = [
      { recipeId: 11, memberId: 2, ruleKind: 'group', rule: 'nuts', foodName: 'Almond' },
    ];
    const hard = validatePlan(plan).failures.filter((f) => f.code === 'hardRule');
    expect(new Set(hard.map((f) => f.memberId))).toEqual(new Set([2]));
    expect(hard).toHaveLength(7);
  });

  it('flags a Recipe id that does not exist, and skips the check when no list is given', () => {
    const plan = basePlan();
    plan.recipeIds = [10, 12];
    const missing = validatePlan(plan).failures.filter((f) => f.code === 'unknownRecipe');
    expect(missing).toHaveLength(7);
    expect(missing[0].params).toMatchObject({ recipe: 'Lentil stew', recipeId: 11 });
    delete plan.recipeIds;
    expect(codes(validatePlan(plan))).not.toContain('unknownRecipe');
  });

  it('finds the failures of one cell and of one day', () => {
    const plan = without(basePlan(), (p) => p.mealTimeId === 1 && p.eatDate === MON);
    const { failures } = validatePlan(plan);
    expect(failuresForCell(failures, [1], MON).map((f) => f.code)).toEqual(['unfilled']);
    expect(failuresForCell(failures, [2], MON)).toEqual([]);
    expect(failuresForCell(failures, [1], DAYS[2])).toEqual([]);
    expect(failuresForDay(failures, 1, MON).map((f) => f.code)).toEqual(['dayUnder']);
  });

  it('validates a full Household week well under a second', () => {
    const members = [1, 2, 3, 4].map((id) => ({
      id,
      name: `M${id}`,
      bandLow: 1700,
      bandHigh: 1800,
    }));
    const slots = [];
    const ranges = [];
    const portions = [];
    const breaks = [];
    const kinds = ['planned', 'planned', 'planned', 'set', 'if_room'];
    let mealId = 1;
    let portionId = 1;
    for (const member of members) {
      kinds.forEach((kind, index) => {
        slots.push({
          id: mealId,
          name: `Meal ${index}`,
          time: `0${index + 6}:00`,
          kind,
          weekdays: null,
          memberIds: [member.id],
        });
        ranges.push({
          mealTimeId: mealId,
          memberId: member.id,
          calMin: kind === 'planned' ? 300 : null,
          calMax: kind === 'set' ? null : 700,
          setCalories: kind === 'set' ? 200 : null,
        });
        for (const day of DAYS) {
          if (kind === 'set') continue;
          portions.push({
            id: portionId,
            cookId: 1 + (portionId % 4),
            memberId: member.id,
            mealTimeId: mealId,
            eatDate: day,
            servings: 1,
          });
          portionId += 1;
        }
        breaks.push({
          recipeId: 10 + (mealId % 4),
          memberId: member.id,
          ruleKind: 'food',
          rule: 'x',
          foodName: 'y',
        });
        mealId += 1;
      });
    }
    const plan = {
      days: DAYS,
      cooks: [
        { id: 1, recipeId: 10, recipeName: 'A', kcalPerServing: 400 },
        { id: 2, recipeId: 11, recipeName: 'B', kcalPerServing: 450 },
        { id: 3, recipeId: 12, recipeName: 'C', kcalPerServing: 500 },
        { id: 4, recipeId: 13, recipeName: 'D', kcalPerServing: 350 },
      ],
      portions,
      mealTimes: slots,
      slots,
      members,
      ranges,
      breaks,
      recipeIds: [10, 11, 12, 13],
    };
    // 4 Members x 7 days x 5 Meal Times, of which the Set one holds no Portion.
    expect(portions.length).toBe(4 * 7 * 4);
    const start = performance.now();
    const result = validatePlan(plan);
    const first = performance.now() - start;
    const runs = 200;
    const again = performance.now();
    for (let i = 0; i < runs; i += 1) validatePlan(plan);
    const average = (performance.now() - again) / runs;
    console.log(
      `validatePlan 4 Members x 7 days x 5 Meal Times: first run ${first.toFixed(2)} ms, ` +
        `average ${average.toFixed(3)} ms over ${runs} runs, ${result.failures.length} failures`
    );
    expect(first).toBeLessThan(1000);
    expect(average).toBeLessThan(100);
  });
});
