// Builds the prompt for one week from prompt.txt and the pre-filter output.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prefilterWeek } from './prefilter.mjs';
import { loadInputs } from './slots.mjs';

const TEMPLATE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'prompt.txt'), 'utf8');

export function buildPrompt(inputs, weekStart) {
  const { slots, setMeals, candidates } = prefilterWeek(inputs, weekStart);
  const band = inputs.targets.planningBand;
  const target = inputs.targets.calorieTarget;
  const setLines = setMeals.map((s) => `- ${s.id} (${s.date}, ${s.mealTime}): ${s.calories} kcal`).join('\n') || '- none';
  const slotLines = slots
    .map((s) => {
      const cands = candidates[s.id].map((c) => `${c.id} ${c.name} (${c.caloriesPerServing})`).join('; ');
      const head = `${s.id} | ${s.date} ${s.time} | ${s.kind} ${s.min}-${s.max} kcal`;
      return `${head} | ${cands || 'NO CANDIDATES (leave empty)'}`;
    })
    .join('\n');
  const fill = {
    WEEK_START: weekStart,
    CALORIE_TARGET: target,
    BAND_LOW: Math.round(target * band.low),
    BAND_HIGH: Math.round(target * band.high),
    SET_MEALS: setLines,
    SLOTS: slotLines,
  };
  return TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_, k) => String(fill[k]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const week = process.argv[2];
  process.stdout.write(buildPrompt(loadInputs(), week) + '\n');
}
