import { describe, expect, it } from 'vitest';
import {
  MAX_LOG_GRAMS,
  OTHER_TIME,
  editEntryPatch,
  entryUnits,
  entryValues,
  rescaleNutrition,
  restoreRow,
  sortEntries,
} from './todayLogic.js';

// A logged entry at a Meal Time: 60 g of toast, 500 kcal.
const toast = {
  id: 5,
  log_date: '2026-10-17',
  meal_time_id: 1,
  log_time: null,
  food_id: 3,
  description: 'Toast',
  servings: null,
  grams: 60,
  kcal: 500,
  protein_g: 12,
  carbs_g: 60,
  fat_g: 4,
  created_at: '2026-10-17T07:40:00+00:00',
};

describe('sortEntries', () => {
  it('orders entries by created_at, then id, without changing the input', () => {
    const input = [
      { id: 3, created_at: '2026-10-17T08:00:00+00:00' },
      { id: 2, created_at: '2026-10-17T07:00:00+00:00' },
      { id: 1, created_at: '2026-10-17T07:00:00+00:00' },
    ];
    expect(sortEntries(input).map((entry) => entry.id)).toEqual([1, 2, 3]);
    expect(input.map((entry) => entry.id)).toEqual([3, 2, 1]);
  });
});

describe('entryUnits', () => {
  it('shows an entry with servings in servings, with the serving size worked out', () => {
    expect(entryUnits({ grams: 100, servings: 2 })).toEqual({
      unit: 'servings',
      amount: '2',
      servingGrams: 50,
    });
  });

  it('shows an entry without servings in grams', () => {
    expect(entryUnits({ grams: 60, servings: null })).toEqual({
      unit: 'grams',
      amount: '60',
      servingGrams: null,
    });
  });
});

describe('rescaleNutrition', () => {
  const entry = { grams: 100, kcal: 200, protein_g: 10, carbs_g: null, fat_g: 3 };

  it('scales calories and macros to the new weight, to one decimal', () => {
    expect(rescaleNutrition(entry, 50)).toEqual({
      kcal: 100,
      protein_g: 5,
      carbs_g: null,
      fat_g: 1.5,
    });
    expect(rescaleNutrition(entry, 75).kcal).toBe(150);
  });

  it('keeps a missing macro missing', () => {
    expect(rescaleNutrition(entry, 200).carbs_g).toBeNull();
  });
});

describe('editEntryPatch', () => {
  it('recalculates calories and macros for a new amount and keeps the Meal Time', () => {
    const result = editEntryPatch({
      entry: toast,
      amount: '120',
      unit: 'grams',
      mealChoice: '1',
      nowTime: '08:00',
    });
    expect(result).toEqual({
      ok: true,
      changed: true,
      patch: {
        grams: 120,
        servings: null,
        kcal: 1000,
        protein_g: 24,
        carbs_g: 120,
        fat_g: 8,
        meal_time_id: 1,
        log_time: null,
      },
    });
  });

  it('reports no change when the amount and Meal Time stay the same', () => {
    const result = editEntryPatch({
      entry: toast,
      amount: '60',
      unit: 'grams',
      mealChoice: '1',
      nowTime: '08:00',
    });
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(false);
  });

  it('moves an entry from a Meal Time to another time, with the clock time now', () => {
    const result = editEntryPatch({
      entry: toast,
      amount: '60',
      unit: 'grams',
      mealChoice: OTHER_TIME,
      nowTime: '08:05',
    });
    expect(result.changed).toBe(true);
    expect(result.patch).toMatchObject({ meal_time_id: null, log_time: '08:05' });
  });

  it('keeps the clock time of an entry already at another time', () => {
    const entry = { ...toast, meal_time_id: null, log_time: '09:15:00' };
    const result = editEntryPatch({
      entry,
      amount: '60',
      unit: 'grams',
      mealChoice: OTHER_TIME,
      nowTime: '08:05',
    });
    expect(result.changed).toBe(false);
    expect(result.patch.log_time).toBe('09:15:00');
  });

  it('clears the clock time when an entry moves to a Meal Time', () => {
    const entry = { ...toast, meal_time_id: null, log_time: '09:15:00' };
    const result = editEntryPatch({
      entry,
      amount: '60',
      unit: 'grams',
      mealChoice: '2',
      nowTime: '08:05',
    });
    expect(result.patch).toMatchObject({ meal_time_id: 2, log_time: null });
  });

  it('changes the amount of an entry logged in servings, and its servings', () => {
    const entry = { ...toast, grams: 100, servings: 2, kcal: 200, protein_g: 8 };
    const result = editEntryPatch({
      entry,
      amount: '3',
      unit: 'servings',
      mealChoice: '1',
      nowTime: '08:00',
    });
    expect(result.patch).toMatchObject({ grams: 150, servings: 3, kcal: 300, protein_g: 12 });
  });

  it('refuses an amount of zero', () => {
    expect(
      editEntryPatch({
        entry: toast,
        amount: '0',
        unit: 'grams',
        mealChoice: '1',
        nowTime: '08:00',
      })
    ).toEqual({ ok: false, error: 'today.log.errors.amount' });
  });

  it('refuses an amount above the most one entry can hold', () => {
    const result = editEntryPatch({
      entry: toast,
      amount: String(MAX_LOG_GRAMS + 1),
      unit: 'grams',
      mealChoice: '1',
      nowTime: '08:00',
    });
    expect(result).toEqual({ ok: false, error: 'today.log.errors.tooLarge' });
  });

  it('refuses an entry with no amount to scale from', () => {
    const result = editEntryPatch({
      entry: { ...toast, grams: null },
      amount: '60',
      unit: 'grams',
      mealChoice: '1',
      nowTime: '08:00',
    });
    expect(result).toEqual({ ok: false, error: 'today.edit.errors.noGrams' });
  });
});

describe('entryValues', () => {
  it('returns the stored values, with missing macros and links as null', () => {
    expect(entryValues({ ...toast, servings: undefined, protein_g: undefined })).toEqual({
      grams: 60,
      servings: null,
      kcal: 500,
      protein_g: null,
      carbs_g: 60,
      fat_g: 4,
      meal_time_id: 1,
      log_time: null,
    });
  });
});

describe('restoreRow', () => {
  it('rebuilds the deleted row with its values and created_at, and no id', () => {
    const row = restoreRow(toast, 4);
    expect(row).toEqual({
      member_id: 4,
      log_date: '2026-10-17',
      grams: 60,
      servings: null,
      kcal: 500,
      protein_g: 12,
      carbs_g: 60,
      fat_g: 4,
      meal_time_id: 1,
      log_time: null,
      food_id: 3,
      description: 'Toast',
      created_at: '2026-10-17T07:40:00+00:00',
    });
    expect(row).not.toHaveProperty('id');
  });

  it('leaves created_at out when the entry has none', () => {
    expect(restoreRow({ ...toast, created_at: undefined }, 4)).not.toHaveProperty('created_at');
  });
});
