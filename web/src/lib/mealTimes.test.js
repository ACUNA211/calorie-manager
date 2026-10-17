import { describe, it, expect, beforeEach } from 'vitest';
import {
  deleteMealTime,
  loadMealTimes,
  loadMemberId,
  loadTargets,
  saveMealTime,
  setWeekdays,
} from './mealTimes.js';

// A chainable fake of the Supabase query builder. Each call is recorded; awaiting the
// builder resolves to the result queued for its table.
function fakeClient(results = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const call = { table, ops: [] };
      calls.push(call);
      const builder = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') {
              const result = results[table] ?? { data: null, error: null };
              return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
            }
            return (...args) => {
              call.ops.push([prop, ...args]);
              return builder;
            };
          },
        }
      );
      return builder;
    },
  };
  return client;
}

describe('meal times data access', () => {
  let client;

  beforeEach(() => {
    client = undefined;
  });

  it('finds the Member for a login', async () => {
    client = fakeClient({ members: { data: { id: 4 }, error: null } });
    expect(await loadMemberId(client, 'user-1')).toBe(4);
    expect(client.calls[0].ops).toEqual([
      ['select', 'id'],
      ['eq', 'user_id', 'user-1'],
      ['maybeSingle'],
    ]);
  });

  it('returns null when the login has no Member yet', async () => {
    client = fakeClient({ members: { data: null, error: null } });
    expect(await loadMemberId(client, 'user-2')).toBeNull();
  });

  it("loads one Member's Meal Times in time order with the times trimmed to HH:MM", async () => {
    client = fakeClient({
      meal_times: {
        data: [
          {
            id: 1,
            name: 'Breakfast',
            time_of_day: '07:30:00',
            weekdays: [0, 1],
            kind: 'set',
            cal_min: null,
            cal_max: null,
            set_calories: 300,
          },
        ],
        error: null,
      },
    });
    const meals = await loadMealTimes(client, 4);
    expect(meals).toEqual([
      {
        id: 1,
        name: 'Breakfast',
        time_of_day: '07:30',
        weekdays: [0, 1],
        kind: 'set',
        cal_min: null,
        cal_max: null,
        set_calories: 300,
      },
    ]);
    const ops = client.calls[0].ops;
    expect(ops).toContainEqual(['eq', 'member_id', 4]);
    expect(ops).toContainEqual(['order', 'time_of_day', { ascending: true }]);
  });

  it('throws the Supabase error when loading fails', async () => {
    client = fakeClient({ meal_times: { data: null, error: new Error('down') } });
    await expect(loadMealTimes(client, 4)).rejects.toThrow('down');
  });

  it("reads the Target and band from the Member's settings row", async () => {
    client = fakeClient({
      member_settings: {
        data: { calorie_target: 2000, band_low_pct: 90, band_high_pct: 100 },
        error: null,
      },
    });
    expect(await loadTargets(client, 4)).toEqual({
      calorie_target: 2000,
      band_low_pct: 90,
      band_high_pct: 100,
    });
    expect(client.calls[0].table).toBe('member_settings');
    expect(client.calls[0].ops).toContainEqual(['eq', 'member_id', 4]);
  });

  it('inserts a new Meal Time for the Member and returns its id', async () => {
    client = fakeClient({ meal_times: { data: { id: 21 }, error: null } });
    const id = await saveMealTime(client, 4, {
      id: null,
      name: ' Lunch ',
      time: '12:30',
      kind: 'planned',
      weekdays: [3, 1],
      calMin: '400',
      calMax: '600',
      setCalories: '',
    });
    expect(id).toBe(21);
    const insert = client.calls[0].ops.find(([op]) => op === 'insert');
    expect(insert[1]).toEqual({
      name: 'Lunch',
      time_of_day: '12:30',
      kind: 'planned',
      weekdays: [1, 3],
      set_calories: null,
      cal_min: 400,
      cal_max: 600,
      member_id: 4,
    });
  });

  it('updates an existing Meal Time only within the Member', async () => {
    client = fakeClient({ meal_times: { data: null, error: null } });
    const id = await saveMealTime(client, 4, {
      id: 9,
      name: 'Snack',
      time: '16:00',
      kind: 'set',
      weekdays: [6],
      calMin: '',
      calMax: '',
      setCalories: '150',
    });
    expect(id).toBe(9);
    const ops = client.calls[0].ops;
    expect(ops.find(([op]) => op === 'update')[1]).toMatchObject({
      kind: 'set',
      set_calories: 150,
      weekdays: [6],
    });
    expect(ops).toContainEqual(['eq', 'id', 9]);
    expect(ops).toContainEqual(['eq', 'member_id', 4]);
  });

  it('sets weekdays sorted and without repeats', async () => {
    client = fakeClient({ meal_times: { data: null, error: null } });
    await setWeekdays(client, 4, 9, [5, 1, 5]);
    expect(client.calls[0].ops.find(([op]) => op === 'update')[1]).toEqual({ weekdays: [1, 5] });
  });

  it('deletes a Meal Time within the Member', async () => {
    client = fakeClient({ meal_times: { data: null, error: null } });
    await deleteMealTime(client, 4, 9);
    const ops = client.calls[0].ops;
    expect(ops).toContainEqual(['delete']);
    expect(ops).toContainEqual(['eq', 'id', 9]);
    expect(ops).toContainEqual(['eq', 'member_id', 4]);
  });
});
