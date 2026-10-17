// Loads the test inputs and enumerates the slots for one week.
// Shared by the pre-filter, the prompt builder, the runner and the scorer.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function readJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

export function loadInputs(hardRulesPath = 'inputs/hard-rules.json') {
  return {
    mealTimes: readJson('inputs/meal-times.json'),
    targets: readJson('inputs/targets.json'),
    hardRules: readJson(hardRulesPath),
    recipes: readJson('inputs/recipes.json'),
    weeks: readJson('inputs/weeks.json').weeks,
  };
}

export function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Returns { slots, setMeals } for one Sunday-start week.
// slot id = "<Day>-<mealTime id>", e.g. "Mon-lunch". Planned and If room
// meal times are slots the model fills; Set meal times are fixed calories.
export function enumerateWeek(inputs, weekStart) {
  const slots = [];
  const setMeals = [];
  for (let d = 0; d < 7; d++) {
    const day = DAY_NAMES[d];
    const date = addDays(weekStart, d);
    for (const mt of inputs.mealTimes) {
      if (!mt.days.includes(day)) continue;
      if (mt.kind === 'Set') {
        setMeals.push({ id: `${day}-${mt.id}`, day, date, mealTime: mt.name, calories: mt.calories });
      } else {
        slots.push({
          id: `${day}-${mt.id}`,
          day,
          date,
          time: mt.time,
          mealTimeId: mt.id,
          mealTime: mt.name,
          kind: mt.kind,
          min: mt.min,
          max: mt.max,
        });
      }
    }
  }
  return { slots, setMeals };
}
