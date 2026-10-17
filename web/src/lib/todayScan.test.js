import { describe, expect, it, vi } from 'vitest';
import {
  addPackageWithWeight,
  canActOnScan,
  defaultEatenAmount,
  eatenRow,
  eatFood,
  packageToAdd,
  undoEat,
} from './todayScan.js';

// The Today scan rules (ticket #27) and the Eaten write, with a fake Supabase client that
// records each call. No database.

const food = {
  id: 7,
  name: 'Oat milk',
  kcalPer100g: 50,
  servingGrams: 250,
  macros: { protein: 1, carbs: 7, fat: 1.5 },
};

function fakeClient({
  takeResult = 40,
  takeError = null,
  insertError = null,
  deleteRows = [{ id: 501 }],
} = {}) {
  const calls = [];
  const client = {
    calls,
    rpc: vi.fn(async (name, args) => {
      calls.push(['rpc', name, args]);
      if (name === 'pantry_take') {
        if (takeError) return { data: null, error: takeError };
        return { data: takeResult, error: null };
      }
      return { data: 1, error: null };
    }),
    from: vi.fn((table) => ({
      insert: (row) => ({
        select: () => ({
          single: async () => {
            calls.push(['insert', table, row]);
            if (insertError) return { data: null, error: insertError };
            return { data: { ...row, id: 501, created_at: '2026-10-17T12:00:00Z' }, error: null };
          },
        }),
      }),
      delete: () => ({
        eq: (column, value) => ({
          select: async () => {
            calls.push(['delete', table, column, value]);
            return { data: deleteRows, error: null };
          },
        }),
      }),
      select: () => ({
        eq: (column, value) => ({
          single: async () => {
            calls.push(['select', table, column, value]);
            return {
              data: {
                id: 7,
                name: 'Oat milk',
                package_grams: client.packageGrams ?? null,
                servings: [],
              },
              error: null,
            };
          },
        }),
      }),
    })),
  };
  return client;
}

describe('canActOnScan', () => {
  it('acts on a Food Library or USDA food', () => {
    expect(canActOnScan({ status: 'found', source: 'library' })).toBe(true);
    expect(canActOnScan({ status: 'found', source: 'usda' })).toBe(true);
  });

  it('does not act on an Open Food Facts food, a miss or an invalid code', () => {
    expect(canActOnScan({ status: 'found', source: 'off' })).toBe(false);
    expect(canActOnScan({ status: 'notFound' })).toBe(false);
    expect(canActOnScan({ status: 'invalid' })).toBe(false);
    expect(canActOnScan(undefined)).toBe(false);
  });
});

describe('defaultEatenAmount', () => {
  it('starts at one serving when the food has a serving size', () => {
    expect(defaultEatenAmount(food)).toEqual({ amount: '1', unit: 'servings' });
  });

  it('starts at 100 g when it does not', () => {
    expect(defaultEatenAmount({ ...food, servingGrams: null })).toEqual({
      amount: '100',
      unit: 'grams',
    });
  });
});

describe('eatenRow', () => {
  const now = new Date(2026, 9, 17, 12, 30);

  it('builds a Calorie Log row for one serving at the chosen Meal Time', () => {
    const built = eatenRow({
      memberId: 4,
      logDate: '2026-10-17',
      todayKey: '2026-10-17',
      food,
      amount: '1',
      unit: 'servings',
      mealChoice: '12',
      now,
    });
    expect(built.ok).toBe(true);
    expect(built.grams).toBe(250);
    expect(built.row).toMatchObject({
      member_id: 4,
      log_date: '2026-10-17',
      meal_time_id: 12,
      log_time: null,
      food_id: 7,
      servings: 1,
      grams: 250,
      kcal: 125,
      protein_g: 2.5,
      carbs_g: 17.5,
      fat_g: 3.8,
    });
  });

  it('logs at another time with the clock time, and no Meal Time', () => {
    const built = eatenRow({
      memberId: 4,
      logDate: '2026-10-17',
      todayKey: '2026-10-17',
      food,
      amount: '100',
      unit: 'grams',
      mealChoice: 'other',
      now,
    });
    expect(built.row.meal_time_id).toBeNull();
    expect(built.row.log_time).toBe('12:30');
    expect(built.row.grams).toBe(100);
    expect(built.row.kcal).toBe(50);
  });

  it('refuses a future day, a bad amount and a food with no calories', () => {
    const base = { memberId: 4, todayKey: '2026-10-17', food, mealChoice: 'other', now };
    expect(eatenRow({ ...base, logDate: '2026-10-18', amount: '1', unit: 'servings' }).error).toBe(
      'today.log.errors.futureDay'
    );
    expect(eatenRow({ ...base, logDate: '2026-10-17', amount: 'abc', unit: 'grams' }).error).toBe(
      'today.log.errors.amount'
    );
    expect(
      eatenRow({
        ...base,
        food: { ...food, kcalPer100g: null },
        logDate: '2026-10-17',
        amount: '100',
        unit: 'grams',
      }).error
    ).toBe('today.log.errors.noKcal');
  });
});

describe('eatFood and undoEat', () => {
  const row = { member_id: 4, log_date: '2026-10-17', food_id: 7, grams: 250, kcal: 125 };

  it('logs the entry, then takes the grams off the Pantry', async () => {
    const client = fakeClient({ takeResult: 250 });
    const eaten = await eatFood(client, { row, foodId: 7, grams: 250 });
    expect(eaten.entry.id).toBe(501);
    expect(eaten.taken).toBe(250);
    expect(eaten.pantryFailed).toBe(false);
    expect(client.calls.map((call) => call[0] + ':' + (call[1] ?? ''))).toEqual([
      'insert:calorie_log',
      'rpc:pantry_take',
    ]);
    expect(client.calls[1][2]).toEqual({ p_food_id: 7, p_grams: 250 });
  });

  it('does not fail when the food is not in the Pantry (nothing taken)', async () => {
    const client = fakeClient({ takeResult: 0 });
    const eaten = await eatFood(client, { row, foodId: 7, grams: 250 });
    expect(eaten.taken).toBe(0);
    expect(eaten.pantryFailed).toBe(false);
  });

  it('keeps the logged entry when the Pantry step fails, and says so', async () => {
    const client = fakeClient({ takeError: { message: 'boom' } });
    const eaten = await eatFood(client, { row, foodId: 7, grams: 250 });
    expect(eaten.entry.id).toBe(501);
    expect(eaten.pantryFailed).toBe(true);
    expect(eaten.taken).toBe(0);
  });

  it('writes nothing to the Pantry when the entry itself is not saved', async () => {
    const client = fakeClient({ insertError: { message: 'nope' } });
    await expect(eatFood(client, { row, foodId: 7, grams: 250 })).rejects.toEqual({
      message: 'nope',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('undo deletes the entry and puts back exactly what was taken', async () => {
    const client = fakeClient({ takeResult: 40 });
    const eaten = await eatFood(client, { row, foodId: 7, grams: 250 });
    await eaten.undo();
    expect(client.calls).toContainEqual(['delete', 'calorie_log', 'id', 501]);
    expect(client.calls).toContainEqual(['rpc', 'pantry_add', { p_food_id: 7, p_grams: 40 }]);
  });

  it('undo with nothing taken only deletes the entry', async () => {
    const client = fakeClient({ takeResult: 0 });
    await undoEat(client, { entryId: 501, foodId: 7, taken: 0 });
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.calls).toEqual([['delete', 'calorie_log', 'id', 501]]);
  });
});

describe('packageToAdd and addPackageWithWeight', () => {
  it('reports the package weight when the Household has set one', async () => {
    const client = fakeClient();
    client.packageGrams = 425;
    await expect(packageToAdd(client, 7)).resolves.toEqual({ name: 'Oat milk', grams: 425 });
  });

  it('reports no weight when none is known', async () => {
    const client = fakeClient();
    await expect(packageToAdd(client, 7)).resolves.toEqual({ name: 'Oat milk', grams: null });
  });

  it('saves a typed weight on the food, then adds one package at that weight', async () => {
    const client = fakeClient();
    await expect(addPackageWithWeight(client, 7, '425')).resolves.toEqual({
      ok: true,
      grams: 425,
    });
    expect(client.calls).toEqual([
      ['rpc', 'set_package_grams', { p_food_id: 7, p_grams: 425 }],
      ['rpc', 'pantry_add', { p_food_id: 7, p_grams: 425 }],
    ]);
  });

  it('refuses a weight that is not a number, and writes nothing', async () => {
    const client = fakeClient();
    await expect(addPackageWithWeight(client, 7, 'lots')).resolves.toEqual({
      ok: false,
      error: 'pantry.errors.amountInvalid',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
