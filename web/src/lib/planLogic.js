// Pure rules for the Plan grid: Meal Times as rows, the seven days as columns, each Cook with
// its Portions in the cell where they are eaten, and each Member's day total against their
// Planning band. No React and no Supabase here. Week math comes from weekLogic.js.

import { weekKeys } from './weekLogic.js';
import { weekdayOf } from './todayLogic.js';
import { QUARTER } from './rebalanceLogic.js';

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
export function rowKeyOf(meal) {
  return `${meal.time}|${String(meal.name).trim().toLowerCase()}`;
}

// The grid for one week. `data` is normalizePlanWeek() output. `memberId` is a Member id to
// show only their Portions, or null for everyone. Returns:
//   empty    true when the week has no plan or no Cooks (so the page says so)
//   status   'draft' | 'approved' | null
//   days     the seven day keys, Sunday first
//   changedSinceApproval  true when an approved plan has been edited since it was approved
//   rows     [{ key, name, time, shared, mealTimes, addable (7 flags), cells: [ [ { cookId, recipeName, colour, portions } ] x 7 ] }]
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
  const rowFor = (meal) => {
    const key = rowKeyOf(meal);
    let row = rowMap.get(key);
    if (!row) {
      row = {
        key,
        name: meal.name,
        time: meal.time,
        shared: false,
        mealTimes: new Map(),
        cells: days.map(() => new Map()),
      };
      rowMap.set(key, row);
    }
    row.mealTimes.set(meal.id, meal);
    if (meal.memberIds.length > 1) row.shared = true;
    return row;
  };
  // Editing: every Meal Time of the Household (or of the filtered Member) is a row, so an empty
  // slot can be added to. Without data.slots (read only) only Meal Times with a Portion appear.
  if (Array.isArray(data.slots)) {
    for (const meal of data.slots) {
      if (memberId == null || meal.memberIds.includes(memberId)) rowFor(meal);
    }
  }
  for (const portion of visible) {
    const meal = mealTimes.get(portion.mealTimeId);
    const row = rowFor(meal);
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
      mealTimeId: portion.mealTimeId,
      servings: portion.servings,
      kcal: portionKcal(portion, cook),
    });
  }

  const rows = [...rowMap.values()]
    .sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name))
    .map((row) => ({
      ...row,
      mealTimes: [...row.mealTimes.values()],
      addable: days.map(
        (day) =>
          data.cooks.length > 0 &&
          placementTargets(data, [...row.mealTimes.values()], day, memberId).length > 0
      ),
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
    changedSinceApproval: Boolean(data.plan?.changed_since_approval),
    days,
    rows,
    totals,
  };
}

// ---- Editing ------------------------------------------------------------------------------

export const MAX_PORTION = 4;
export const MAX_SERVINGS = 20;

// Every Meal Time the page knows: the Household's slots plus the ones a Portion sits at.
function allMealTimes(data) {
  const byId = new Map();
  for (const meal of data.slots ?? []) byId.set(meal.id, meal);
  for (const meal of data.mealTimes ?? []) if (!byId.has(meal.id)) byId.set(meal.id, meal);
  return [...byId.values()];
}

// Does the Meal Time happen on this day? No weekday list means every day.
function onDay(meal, dayKey) {
  return !meal.weekdays || meal.weekdays.includes(weekdayOf(dayKey));
}

// A Member's planned calories on a day.
export function memberDayKcal(data, memberId, dayKey) {
  const cooks = new Map(data.cooks.map((cook) => [cook.id, cook]));
  return data.portions
    .filter((portion) => portion.memberId === memberId && portion.eatDate === dayKey)
    .reduce((sum, portion) => sum + portionKcal(portion, cooks.get(portion.cookId)), 0);
}

// Who gets a Portion if a Cook is placed in this cell: one entry per Member who shares one of
// the row's Meal Times on that day and has nothing there yet. A Member is listed once, at the
// first of the row's Meal Times. `memberId` limits it to one Member (the page filter).
// Returns [{ memberId, mealTimeId, kind }].
export function placementTargets(data, rowMealTimes, dayKey, memberId = null) {
  const known = new Set(data.members.map((member) => member.id));
  const taken = new Set(
    data.portions
      .filter((portion) => portion.eatDate === dayKey)
      .map((portion) => `${portion.memberId}|${portion.mealTimeId}`)
  );
  const targets = [];
  const seen = new Set();
  for (const meal of rowMealTimes) {
    if (!onDay(meal, dayKey)) continue;
    for (const id of meal.memberIds) {
      if ((memberId != null && id !== memberId) || !known.has(id) || seen.has(id)) continue;
      if (taken.has(`${id}|${meal.id}`)) continue;
      seen.add(id);
      targets.push({ memberId: id, mealTimeId: meal.id, kind: meal.kind });
    }
  }
  return targets;
}

// Servings for a new Portion, in quarter servings, from what the Member has left in their band.
// remainingKcal: band top minus what is already planned that day (null: no band, so 1 serving).
// slotsLeft: Planned Meal Times still empty that day including this one, so the first meal does
// not use the whole day. Never below a quarter serving, never above MAX_PORTION.
export function sizePortion({ kcalPerServing, remainingKcal, slotsLeft = 1 }) {
  if (remainingKcal == null || !(kcalPerServing > 0)) return 1;
  const share = remainingKcal / Math.max(1, slotsLeft);
  const quarters = Math.floor(share / kcalPerServing / QUARTER + 1e-9);
  return Math.min(MAX_PORTION, Math.max(QUARTER, quarters * QUARTER));
}

// How many Planned Meal Times the Member still has empty on a day (one per row, like the grid).
function plannedSlotsLeft(data, memberId, dayKey) {
  const mealTimes = allMealTimes(data);
  const byId = new Map(mealTimes.map((meal) => [meal.id, meal]));
  const filledRows = new Set(
    data.portions
      .filter((portion) => portion.memberId === memberId && portion.eatDate === dayKey)
      .map((portion) => byId.get(portion.mealTimeId))
      .filter(Boolean)
      .map(rowKeyOf)
  );
  const open = new Set();
  for (const meal of mealTimes) {
    if (meal.kind !== 'planned' || !meal.memberIds.includes(memberId) || !onDay(meal, dayKey)) {
      continue;
    }
    const key = rowKeyOf(meal);
    if (!filledRows.has(key)) open.add(key);
  }
  return open.size;
}

// The Portions to create when a Cook is placed in a cell: [{ memberId, mealTimeId, servings }].
// Each Member's Portion is sized from their own remaining band calories that day.
export function planPlacement(data, cookId, rowMealTimes, dayKey, memberId = null) {
  const cook = data.cooks.find((entry) => entry.id === cookId);
  if (!cook) return [];
  return placementTargets(data, rowMealTimes, dayKey, memberId).map((target) => {
    const member = data.members.find((entry) => entry.id === target.memberId);
    const remaining =
      member?.bandHigh == null
        ? null
        : member.bandHigh - memberDayKcal(data, target.memberId, dayKey);
    const slotsLeft =
      target.kind === 'planned' ? plannedSlotsLeft(data, target.memberId, dayKey) : 1;
    return {
      memberId: target.memberId,
      mealTimeId: target.mealTimeId,
      servings: sizePortion({
        kcalPerServing: cook.kcalPerServing,
        remainingKcal: remaining,
        slotsLeft,
      }),
    };
  });
}

// Moves the given Portions ([{ id, memberId }]) of one Cook to another cell. Each Member goes
// to the target row's Meal Time they share on that day. Returns { ok: true, moves } with
// [{ portionId, mealTimeId, eatDate }] (Portions already there are left out), or
// { ok: false, reason: 'noSlot' | 'occupied' } and nothing moves.
export function planMove(data, portions, rowMealTimes, dayKey) {
  const moving = portions.map((portion) => portion.id);
  const moves = [];
  for (const portion of portions) {
    const meal = rowMealTimes.find(
      (entry) => onDay(entry, dayKey) && entry.memberIds.includes(portion.memberId)
    );
    if (!meal) return { ok: false, reason: 'noSlot' };
    const current = data.portions.find((entry) => entry.id === portion.id);
    if (current && current.mealTimeId === meal.id && current.eatDate === dayKey) continue;
    const occupied = data.portions.some(
      (entry) =>
        !moving.includes(entry.id) &&
        entry.memberId === portion.memberId &&
        entry.mealTimeId === meal.id &&
        entry.eatDate === dayKey
    );
    if (occupied) return { ok: false, reason: 'occupied' };
    moves.push({ portionId: portion.id, mealTimeId: meal.id, eatDate: dayKey });
  }
  return { ok: true, moves };
}

// One quarter serving up or down. Never goes below a quarter (remove the Portion instead).
export function stepServings(servings, direction) {
  const next = servings + (direction < 0 ? -QUARTER : QUARTER);
  return Math.min(MAX_SERVINGS, Math.max(QUARTER, next));
}

// A Cook's servings made once all its Portions are placed: it grows to cover them, never
// shrinks (servings left over are Leftovers). The database does the same in plan_set_portion.
export function servingsMadeFor(servingsMade, portionServings) {
  const total = portionServings.reduce((sum, servings) => sum + servings, 0);
  return Math.max(servingsMade ?? 0, total);
}
