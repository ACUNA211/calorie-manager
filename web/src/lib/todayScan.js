// Scan on Today (ticket #27): the scanned food with Add to Pantry and Eaten. The pure rules
// and the two writes live here; TodayScan.jsx only shows them. Every function that touches
// the database takes the Supabase client first, so tests pass a fake.
//
// Eaten logs the food at a Meal Time (a Calorie Log row, as Log food does) and takes that
// amount off the Pantry (migration 029, pantry_take). Undo deletes the entry and puts back
// exactly the grams the Pantry gave up. Open Food Facts foods can't be logged yet (ticket
// #85), so an OFF-only result gets no buttons.

import { addToPantry, loadFoodPackage, setPackageGrams, takeFromPantry } from './pantry.js';
import { packageGrams, validateAddAmount } from './pantryLogic.js';
import { insertEntry, deleteEntry } from './today.js';
import {
  amountToGrams,
  buildLogRow,
  clockTime,
  entryNutrition,
  logProblem,
  MAX_LOG_GRAMS,
  OTHER_TIME,
} from './todayLogic.js';

// Sources a scan can act on. An Open Food Facts food ('off') is shown but not usable yet.
export const ACTIONABLE_SOURCES = ['library', 'usda'];

export function canActOnScan(outcome) {
  return outcome?.status === 'found' && ACTIONABLE_SOURCES.includes(outcome.source);
}

// The amount the Eaten picker starts at: one serving when the food has a serving size,
// otherwise 100 g.
export function defaultEatenAmount(food) {
  if (food.servingGrams > 0) return { amount: '1', unit: 'servings' };
  return { amount: '100', unit: 'grams' };
}

// The Calorie Log row for Eaten, or the first problem as a translation key. Uses the same
// checks as Log food: a day that can take entries, an amount within limits and a known
// calorie figure for the food.
export function eatenRow({ memberId, logDate, todayKey, food, amount, unit, mealChoice, now }) {
  const problem = logProblem({ food, amount, unit, logDate, todayKey });
  if (problem) return { ok: false, error: problem, max: MAX_LOG_GRAMS };
  const parsed = amountToGrams({ amount, unit, servingGrams: food.servingGrams });
  const nutrition = entryNutrition(food, parsed.grams);
  const mealTimeId = mealChoice == null || mealChoice === OTHER_TIME ? null : Number(mealChoice);
  const row = buildLogRow({
    memberId,
    logDate,
    food,
    grams: parsed.grams,
    servings: parsed.servings,
    nutrition,
    mealTimeId,
    logTime: clockTime(now),
  });
  return { ok: true, row, grams: parsed.grams };
}

// Logs the food, then takes its grams off the Pantry. The entry is written first, so a
// failed Pantry step never loses the log: the result says pantryFailed and the entry stays.
// A food the Pantry does not hold takes nothing and is not a failure. Returns the stored
// entry, the grams taken, and an undo that reverses both. Throws only when the entry itself
// is not saved (then nothing changed).
export async function eatFood(client, { row, foodId, grams }) {
  const entry = await insertEntry(client, row);
  let taken = 0;
  let pantryFailed = false;
  try {
    taken = await takeFromPantry(client, foodId, grams);
  } catch {
    pantryFailed = true;
  }
  return {
    entry,
    taken,
    pantryFailed,
    undo: () => undoEat(client, { entryId: entry.id, foodId, taken }),
  };
}

// Reverses an Eaten: deletes the entry and gives the taken grams back to the Pantry. With
// nothing taken, only the entry is deleted.
export async function undoEat(client, { entryId, foodId, taken }) {
  await deleteEntry(client, entryId);
  if (taken > 0) await addToPantry(client, foodId, taken);
}

// The package to add for Add to Pantry: its name and label weight, or grams null when the
// weight is not known yet (the screen then asks for it once).
export async function packageToAdd(client, foodId) {
  const food = await loadFoodPackage(client, foodId);
  return { name: food.name, grams: packageGrams(food) };
}

// Adds one package at its label weight. Returns the grams added.
export async function addOnePackage(client, foodId, grams) {
  await addToPantry(client, foodId, grams);
  return grams;
}

// Remembers a typed package weight on the food, then adds one package at that weight.
// A typed weight that fails validation is returned as a translation key, nothing is saved.
export async function addPackageWithWeight(client, foodId, text) {
  const parsed = validateAddAmount(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  await setPackageGrams(client, foodId, parsed.value);
  await addOnePackage(client, foodId, parsed.value);
  return { ok: true, grams: parsed.value };
}
