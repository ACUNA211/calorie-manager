// Pure rules for Rebalance (ticket 57). No React, no Supabase, no AI: fixed formulas only.
// Jev rates what the Member said elsewhere; this file picks the change from Cooks already planned.
//
// Input shape (all plain data, calories as numbers):
//   day      = { date: 'YYYY-MM-DD', loggedKcal, portions: [portion] }
//   portion  = { id, cookId, mealTimeId, kind: 'set' | 'planned' | 'if_room', servings,
//                kcalPerServing, calMin (kcal floor of its Meal Time, planned only), logged }
// Logged Portions are already inside loggedKcal, so they are skipped (never counted twice, never
// changed). Set Portions count towards the day but are never changed.
//
// Levers, in order: drop If room Portions, shrink Planned Portions in quarter servings (never
// below the Meal Time floor calMin), spread over the rest of the week (each later day gives at
// most maxSpreadPct of the Calorie Target, using the same two levers), else it cannot fit.
// A Cook's servings made is never touched: servings taken off a Portion become Leftovers.

export const QUARTER = 0.25;
export const DEFAULT_MAX_SPREAD_PCT = 10;
export const MAX_OPTIONS = 3;

const kcalOf = (p) => p.servings * p.kcalPerServing;
const open = (p) => !p.logged;

// What a day would add up to as planned: logged plus every Portion not yet logged.
export function dayTotal(day) {
  return day.loggedKcal + day.portions.filter(open).reduce((sum, p) => sum + kcalOf(p), 0);
}

// Calories over the Calorie Target for the given days (logged + planned rest of the period).
// Positive = over; zero or negative = room.
export function overage(days, calorieTarget) {
  return days.reduce((sum, d) => sum + dayTotal(d), 0) - calorieTarget * days.length;
}

// Lever 1: drop If room Portions, biggest first, only as many as needed.
function dropLever(portions, need) {
  const changes = [];
  const candidates = portions.filter((p) => open(p) && p.kind === 'if_room' && p.servings > 0);
  candidates.sort((a, b) => kcalOf(b) - kcalOf(a));
  let left = need;
  for (const p of candidates) {
    if (left <= 0) break;
    changes.push({
      type: 'drop',
      portionId: p.id,
      cookId: p.cookId,
      from: p.servings,
      to: 0,
      kcalSaved: kcalOf(p),
      leftoverServings: p.servings,
    });
    left -= kcalOf(p);
  }
  return { changes, left };
}

// Lever 2: shrink Planned Portions one quarter serving at a time, always from the Portion whose
// Meal Time has the most calories above its floor. Stops when covered or no step is possible
// without a Meal Time dropping below calMin. `skip` holds ids already dropped.
function shrinkLever(portions, need, skip = new Set()) {
  const planned = portions.filter((p) => open(p) && p.kind === 'planned' && !skip.has(p.id));
  const servings = new Map(planned.map((p) => [p.id, p.servings]));
  const mealTotal = (mealTimeId) =>
    planned
      .filter((p) => p.mealTimeId === mealTimeId)
      .reduce((s, p) => s + servings.get(p.id) * p.kcalPerServing, 0);
  let left = need;
  while (left > 0) {
    let best = null;
    let bestRoom = 0;
    for (const p of planned) {
      const step = QUARTER * p.kcalPerServing;
      if (servings.get(p.id) < QUARTER - 1e-9 || step <= 0) continue;
      const room = mealTotal(p.mealTimeId) - (p.calMin ?? 0);
      if (room + 1e-9 < step) continue; // a step would go below the range
      if (room > bestRoom) {
        best = p;
        bestRoom = room;
      }
    }
    if (!best) break;
    servings.set(best.id, servings.get(best.id) - QUARTER);
    left -= QUARTER * best.kcalPerServing;
  }
  const changes = [];
  for (const p of planned) {
    const to = servings.get(p.id);
    if (to === p.servings) continue;
    changes.push({
      type: 'shrink',
      portionId: p.id,
      cookId: p.cookId,
      from: p.servings,
      to,
      kcalSaved: (p.servings - to) * p.kcalPerServing,
      leftoverServings: p.servings - to,
    });
  }
  return { changes, left };
}

// Runs the chosen levers on one day's Portions for `need` calories.
function applyLevers(day, need, { drop, shrink }) {
  let changes = [];
  let left = need;
  const dropped = new Set();
  if (drop && left > 0) {
    const r = dropLever(day.portions, left);
    changes = changes.concat(r.changes);
    r.changes.forEach((c) => dropped.add(c.portionId));
    left = r.left;
  }
  if (shrink && left > 0) {
    const r = shrinkLever(day.portions, left, dropped);
    changes = changes.concat(r.changes);
    left = r.left;
  }
  return { changes, left: Math.max(left, 0) };
}

const saved = (changes) => changes.reduce((s, c) => s + c.kcalSaved, 0);

function buildOption(label, levers, today, later, calorieTarget, maxSpreadPct) {
  const need = overage([today], calorieTarget);
  const first = applyLevers(today, need, levers);
  const changes = first.changes.map((c) => ({ ...c, date: today.date }));
  const lands = [{ date: today.date, kcal: dayTotal(today) - saved(first.changes) }];
  let remaining = first.left;
  let spread = 0;

  if (levers.spread && remaining > 0) {
    const cap = (calorieTarget * maxSpreadPct) / 100;
    for (const day of later) {
      if (remaining <= 0) break;
      const r = applyLevers(day, Math.min(cap, remaining), { drop: true, shrink: true });
      const got = saved(r.changes);
      if (got <= 0) continue;
      changes.push(...r.changes.map((c) => ({ ...c, date: day.date })));
      lands.push({ date: day.date, kcal: dayTotal(day) - got });
      remaining -= got;
      spread += got;
    }
    remaining = Math.max(remaining, 0);
  }

  return {
    label,
    levers: Object.keys(levers).filter((k) => levers[k]),
    changes,
    kcalSaved: saved(changes),
    spreadKcal: spread,
    landsAt: lands[0].kcal, // where today lands
    lands, // today first, then each later day that changed
    shortfall: remaining, // calories still over after every lever used here
    fits: remaining <= 0,
  };
}

const signature = (o) =>
  o.changes
    .map((c) => `${c.date}:${c.portionId}:${c.to}`)
    .sort()
    .join('|');

// The entry point. `later` is the rest of the week after today (empty unless the Member asked
// for the week). Returns { status: 'ok' | 'fits' | 'cantFit', overage, options }.
//   ok      : already at or under the Calorie Target; no options.
//   fits    : 1..3 options that all get under the target, smallest change first.
//   cantFit : no lever combination fits; options holds the best effort (all levers) with its
//             shortfall, so the Member can see how close it gets.
export function planRebalance({
  today,
  later = [],
  calorieTarget,
  maxSpreadPct = DEFAULT_MAX_SPREAD_PCT,
}) {
  const over = overage([today], calorieTarget);
  if (over <= 0) return { status: 'ok', overage: over, options: [] };

  const sets = [
    ['drop', { drop: true }],
    ['shrink', { shrink: true }],
    ['drop+shrink', { drop: true, shrink: true }],
    ['spread', { drop: true, shrink: true, spread: true }],
  ];
  const built = sets.map(([label, lv]) =>
    buildOption(label, lv, today, later, calorieTarget, maxSpreadPct)
  );
  const seen = new Set();
  const fitting = built
    .filter((o) => o.fits && o.changes.length > 0)
    .filter((o) => {
      const sig = signature(o);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    })
    .sort((a, b) => a.kcalSaved - b.kcalSaved || a.changes.length - b.changes.length);

  if (fitting.length)
    return { status: 'fits', overage: over, options: fitting.slice(0, MAX_OPTIONS) };

  const best = built[built.length - 1];
  return { status: 'cantFit', overage: over, options: best.changes.length ? [best] : [] };
}
