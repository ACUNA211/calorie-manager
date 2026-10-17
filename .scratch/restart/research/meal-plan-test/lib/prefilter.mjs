// Code pre-filter: for each slot, the Recipes the model may choose from.
// A Recipe is a candidate when it suits the Meal Time, breaks no Hard rule
// for anyone eating, and some portion in quarter steps (0.25 to 4 servings)
// lands its calories inside the slot's range.
//
// Run directly to print the candidates for one week:
//   node lib/prefilter.mjs 2026-10-18 [--hard-rules inputs/hard-rules.json]
import { fileURLToPath } from 'node:url';
import { loadInputs, enumerateWeek } from './slots.mjs';

export const PORTION_STEPS = Array.from({ length: 16 }, (_, i) => (i + 1) / 4); // 0.25 .. 4

export function forbiddenFor(hardRules, memberIds) {
  const forbidden = new Set();
  for (const id of memberIds) {
    for (const tag of hardRules.members[id]?.forbiddenTags ?? []) forbidden.add(tag);
  }
  return forbidden;
}

export function candidatesFor(slot, recipes, forbidden) {
  const out = [];
  for (const r of recipes) {
    if (!r.suits.includes(slot.mealTimeId)) continue;
    if (r.tags.some((t) => forbidden.has(t))) continue;
    const portions = PORTION_STEPS.filter((p) => {
      const kcal = p * r.caloriesPerServing;
      return kcal >= slot.min && kcal <= slot.max;
    });
    if (portions.length === 0) continue;
    out.push({ id: r.id, name: r.name, caloriesPerServing: r.caloriesPerServing });
  }
  return out;
}

export function prefilterWeek(inputs, weekStart) {
  const { slots, setMeals } = enumerateWeek(inputs, weekStart);
  const forbidden = forbiddenFor(inputs.hardRules, inputs.targets.members);
  const bySlot = Object.fromEntries(
    slots.map((s) => [s.id, candidatesFor(s, inputs.recipes, forbidden)]),
  );
  return { slots, setMeals, candidates: bySlot };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const week = process.argv[2];
  const hrIdx = process.argv.indexOf('--hard-rules');
  const inputs = loadInputs(hrIdx > 0 ? process.argv[hrIdx + 1] : undefined);
  if (!week) {
    console.error('usage: node lib/prefilter.mjs <weekStart YYYY-MM-DD>');
    process.exit(1);
  }
  const { slots, candidates } = prefilterWeek(inputs, week);
  for (const s of slots) {
    const list = candidates[s.id].map((c) => `${c.id} ${c.name} (${c.caloriesPerServing})`).join('; ');
    console.log(`${s.id} [${s.min}-${s.max} ${s.kind}]: ${list || 'NO CANDIDATES'}`);
  }
}
