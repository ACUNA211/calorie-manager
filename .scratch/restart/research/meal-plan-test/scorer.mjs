// Scores one draft Meal Plan against the inputs. No model calls.
//   node scorer.mjs <draft.json> [--hard-rules <file>]
// Checks: slot coverage, Recipe ids and candidate membership, portion steps,
// slot ranges, Set meals untouched, Hard rules, day totals against the
// Calorie Target (ceiling) and the Planning band, and kcal distance from the band.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadInputs, enumerateWeek, DAY_NAMES, addDays } from './lib/slots.mjs';
import { prefilterWeek, forbiddenFor, PORTION_STEPS } from './lib/prefilter.mjs';

const CATEGORIES = [
  'missing_slot', 'unfilled_planned', 'unknown_recipe', 'not_candidate', 'invalid_portion',
  'duplicate_slot', 'extra_slot', 'touched_set', 'range', 'hard_rule', 'under_band', 'over_target',
];
const DAY_BREAKS = new Set(['under_band', 'over_target']);

export function scoreDraft(draft, inputs) {
  const breaks = [];
  const add = (kind, slot, detail) => breaks.push({ kind, slot, detail });
  const weekStart = draft.weekStart;
  const { slots, setMeals } = enumerateWeek(inputs, weekStart);
  const { candidates } = prefilterWeek(inputs, weekStart);
  const recipes = new Map(inputs.recipes.map((r) => [r.id, r]));
  const target = inputs.targets.calorieTarget;
  const bandLow = Math.round(target * inputs.targets.planningBand.low);
  const bandHigh = Math.round(target * inputs.targets.planningBand.high);
  const forbidden = forbiddenFor(inputs.hardRules, inputs.targets.members);
  const slotIds = new Set(slots.map((s) => s.id));
  const setIds = new Set(setMeals.map((s) => s.id));

  if (!Array.isArray(draft.plan)) {
    return { weekStart, error: 'draft has no plan array', ruleBreaks: 1 };
  }

  // Index entries by slot; flag Set slots, unknown ids and duplicates.
  const entries = new Map();
  for (const e of draft.plan) {
    if (setIds.has(e.slot)) add('touched_set', e.slot, 'Set meal was given an entry');
    else if (!slotIds.has(e.slot)) add('extra_slot', e.slot, 'slot id does not exist this week');
    else if (entries.has(e.slot)) add('duplicate_slot', e.slot, 'slot given twice');
    else entries.set(e.slot, e);
  }

  // Per slot: coverage, ids, portions, ranges, Hard rules.
  const calories = new Map(); // slot id -> kcal counted for the day
  for (const s of slots) {
    const e = entries.get(s.id);
    const planned = s.kind === 'Planned';
    if (!e) {
      add('missing_slot', s.id, `no entry for ${s.kind} slot`);
      continue;
    }
    if (e.recipeId === null || e.recipeId === undefined) {
      if (planned) add('unfilled_planned', s.id, 'Planned slot left empty');
      continue;
    }
    const r = recipes.get(e.recipeId);
    if (!r) {
      add('unknown_recipe', s.id, `id ${e.recipeId} is not in the Recipe library`);
      continue;
    }
    if (!candidates[s.id].some((c) => c.id === e.recipeId)) {
      add('not_candidate', s.id, `${e.recipeId} was not a candidate for this slot`);
    }
    const portionOk = PORTION_STEPS.some((p) => Math.abs(p - e.portion) < 1e-9);
    if (!portionOk) {
      add('invalid_portion', s.id, `portion ${e.portion} is not a quarter step from 0.25 to 4`);
      continue;
    }
    const kcal = Math.round(e.portion * r.caloriesPerServing);
    calories.set(s.id, kcal);
    if (kcal < s.min || kcal > s.max) {
      add('range', s.id, `${kcal} kcal outside ${s.min}-${s.max}`);
    }
    if (r.tags.some((t) => forbidden.has(t))) {
      add('hard_rule', s.id, `${r.id} breaks a Hard rule for someone eating this slot`);
    }
  }

  // Day totals: Set meals + every filled slot, against ceiling and band.
  const days = DAY_NAMES.map((dayName, d) => {
    let total = 0;
    for (const sm of setMeals.filter((x) => x.day === dayName)) total += sm.calories;
    for (const s of slots.filter((x) => x.day === dayName)) total += calories.get(s.id) ?? 0;
    let distanceKcal = 0;
    let status = 'in band';
    if (total > target) {
      distanceKcal = total - target;
      status = 'over ceiling';
      add('over_target', dayName, `${total} kcal is over the ${target} Calorie Target`);
    } else if (total < bandLow) {
      distanceKcal = bandLow - total;
      status = 'under band';
      add('under_band', dayName, `${total} kcal is under the ${bandLow}-${bandHigh} band`);
    }
    return { day: dayName, date: addDays(weekStart, d), total, status, distanceKcal };
  });

  const byKind = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const b of breaks) byKind[b.kind]++;
  const dayBreaks = breaks.filter((b) => DAY_BREAKS.has(b.kind)).length;
  return {
    weekStart,
    ruleBreaks: breaks.length,
    slotBreaks: breaks.length - dayBreaks,
    dayBreaks,
    bandDistanceKcal: days.reduce((a, d) => a + d.distanceKcal, 0),
    daysInBand: days.filter((d) => d.status === 'in band').length,
    byKind: Object.fromEntries(Object.entries(byKind).filter(([, n]) => n > 0)),
    days,
    breaks,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const draftPath = process.argv[2];
  const hrIdx = process.argv.indexOf('--hard-rules');
  if (!draftPath) {
    console.error('usage: node scorer.mjs <draft.json> [--hard-rules <file>]');
    process.exit(1);
  }
  const inputs = loadInputs(hrIdx > 0 ? process.argv[hrIdx + 1] : undefined);
  const draft = JSON.parse(readFileSync(draftPath, 'utf8'));
  console.log(JSON.stringify(scoreDraft(draft, inputs), null, 2));
}
