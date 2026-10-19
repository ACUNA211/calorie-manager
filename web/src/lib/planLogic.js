// Pure rules for the Plan grid: Meal Times as rows, the seven days as columns, each Cook with
// its Portions in the cell where they are eaten, and each Member's day total against their
// Planning band. No React and no Supabase here. Week math comes from weekLogic.js.

import { weekKeys } from './weekLogic.js';

export const COOK_COLOURS = 6;

// Calories of one Portion: servings of the Cook's Recipe times its calories per serving.
export function portionKcal(portion, cook) {
  return Math.round(portion.servings * (cook?.kcalPerServing ?? 0));
}

// Where a day total sits against the Member's band: no band, nothing planned, under it, in it
// or over it.
export function bandState(kcal, bandLow, bandHigh) {
  if (bandLow == null || bandHigh == null) return 'noBand';
  if (!kcal) return 'none';
  if (kcal < bandLow) return 'under';
  if (kcal > bandHigh) return 'over';
  return 'in';
}

// Meal Times with the same name and time of day (each Member has their own "Breakfast 7:30")
// share a row; a Meal Time shared by several Members is one row anyway.
function rowKeyOf(meal) {
  return `${meal.time}|${String(meal.name).trim().toLowerCase()}`;
}

// The grid for one week. `data` is normalizePlanWeek() output. `memberId` is a Member id to
// show only their Portions, or null for everyone. Returns:
//   empty    true when the week has no plan or no Cooks (so the page says so)
//   status   'draft' | 'approved' | null
//   days     the seven day keys, Sunday first
//   rows     [{ key, name, time, shared, cells: [ [ { cookId, recipeName, colour, portions } ] x 7 ] }]
//            each portion: { id, memberId, memberName, servings, kcal }
//   totals   [{ memberId, name, bandLow, bandHigh, days: [{ key, kcal, state }] }]
export function buildPlanGrid(data, startKey, memberId = null) {
  const days = weekKeys(startKey);
  const cooks = new Map(
    data.cooks.map((cook, index) => [cook.id, { ...cook, colour: index % COOK_COLOURS }])
  );
  const memberNames = new Map(data.members.map((member) => [member.id, member.name]));
  const mealTimes = new Map(data.mealTimes.map((meal) => [meal.id, meal]));

  const visible = data.portions.filter(
    (portion) =>
      (memberId == null || portion.memberId === memberId) &&
      cooks.has(portion.cookId) &&
      mealTimes.has(portion.mealTimeId) &&
      days.includes(portion.eatDate)
  );

  const rowMap = new Map();
  for (const portion of visible) {
    const meal = mealTimes.get(portion.mealTimeId);
    const key = rowKeyOf(meal);
    let row = rowMap.get(key);
    if (!row) {
      row = {
        key,
        name: meal.name,
        time: meal.time,
        shared: false,
        cells: days.map(() => new Map()),
      };
      rowMap.set(key, row);
    }
    if (meal.memberIds.length > 1) row.shared = true;
    const cook = cooks.get(portion.cookId);
    const cell = row.cells[days.indexOf(portion.eatDate)];
    if (!cell.has(cook.id)) {
      cell.set(cook.id, {
        cookId: cook.id,
        recipeName: cook.recipeName,
        colour: cook.colour,
        portions: [],
      });
    }
    cell.get(cook.id).portions.push({
      id: portion.id,
      memberId: portion.memberId,
      memberName: memberNames.get(portion.memberId) ?? '',
      servings: portion.servings,
      kcal: portionKcal(portion, cook),
    });
  }

  const rows = [...rowMap.values()]
    .sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name))
    .map((row) => ({
      ...row,
      cells: row.cells.map((cell) =>
        [...cell.values()].map((entry) => ({
          ...entry,
          portions: entry.portions.sort((a, b) => a.memberId - b.memberId),
        }))
      ),
    }));

  const shownMembers = data.members.filter((member) => memberId == null || member.id === memberId);
  const totals = shownMembers.map((member) => {
    const perDay = days.map((key) => {
      const kcal = visible
        .filter((portion) => portion.memberId === member.id && portion.eatDate === key)
        .reduce((sum, portion) => sum + portionKcal(portion, cooks.get(portion.cookId)), 0);
      return { key, kcal, state: bandState(kcal, member.bandLow, member.bandHigh) };
    });
    return {
      memberId: member.id,
      name: member.name,
      bandLow: member.bandLow,
      bandHigh: member.bandHigh,
      days: perDay,
    };
  });

  return {
    empty: !data.plan || data.cooks.length === 0,
    status: data.plan?.status ?? null,
    days,
    rows,
    totals,
  };
}
