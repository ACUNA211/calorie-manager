import { describe, it, expect, beforeEach } from 'vitest';
import {
  deleteMealTime,
  loadMealTimes,
  loadMemberId,
  loadMembers,
  loadTargets,
  saveMealTime,
  setWeekdays,
  sharerRangesPayload,
} from './mealTimes.js';

// A chainable fake of the Supabase query builder. Each call is recorded; awaiting the
// builder resolves to the next result queued for its table (a single result also works).
// rpc() records the function name and arguments and resolves to the queued rpc result.
function fakeClient(results = {}) {
  const calls = [];
  const queues = {};
  const next = (key) => {
    const queued = results[key];
    if (Array.isArray(queued)) {
      queues[key] = queues[key] ?? [...queued];
      return queues[key].shift() ?? { data: null, error: null };
    }
    return queued ?? { data: null, error: null };
  };
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
              const result = next(table);
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
    rpc(name, args) {
      calls.push({ rpc: name, args, ops: [] });
      return Promise.resolve(next(`rpc:${name}`));
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

  it('lists the Household Members in the order they joined', async () => {
    client = fakeClient({
      members: {
        data: [
          { id: 4, display_name: 'Alice', role: 'owner' },
          { id: 9, display_name: 'Kid', role: 'dependent' },
        ],
        error: null,
      },
    });
    expect(await loadMembers(client)).toEqual([
      { id: 4, display_name: 'Alice', role: 'owner' },
      { id: 9, display_name: 'Kid', role: 'dependent' },
    ]);
    expect(client.calls[0].ops).toContainEqual(['order', 'created_at', { ascending: true }]);
  });

  it("loads one Member's Meal Times in time order, with that Member's range and the sharers", async () => {
    client = fakeClient({
      meal_time_members: [
        {
          data: [
            {
              cal_min: 400,
              cal_max: 600,
              set_calories: null,
              meal_times: {
                id: 2,
                name: 'Snack',
                time_of_day: '16:00:00',
                weekdays: [1],
                kind: 'planned',
                member_id: 9,
              },
            },
            {
              cal_min: 600,
              cal_max: 800,
              set_calories: null,
              meal_times: {
                id: 1,
                name: 'Family dinner',
                time_of_day: '07:30:00',
                weekdays: [0, 1],
                kind: 'planned',
                member_id: 4,
              },
            },
          ],
          error: null,
        },
        {
          data: [
            { meal_time_id: 1, member_id: 4, members: { display_name: 'Alice' } },
            { meal_time_id: 1, member_id: 9, members: { display_name: 'Kid' } },
          ],
          error: null,
        },
      ],
    });
    const meals = await loadMealTimes(client, 4);
    expect(meals).toEqual([
      {
        id: 1,
        name: 'Family dinner',
        time_of_day: '07:30',
        weekdays: [0, 1],
        kind: 'planned',
        createdBy: 4,
        cal_min: 600,
        cal_max: 800,
        set_calories: null,
        sharers: [
          { id: 4, name: 'Alice' },
          { id: 9, name: 'Kid' },
        ],
      },
      {
        id: 2,
        name: 'Snack',
        time_of_day: '16:00',
        weekdays: [1],
        kind: 'planned',
        createdBy: 9,
        cal_min: 400,
        cal_max: 600,
        set_calories: null,
        sharers: [],
      },
    ]);
    expect(client.calls[0].table).toBe('meal_time_members');
    expect(client.calls[0].ops).toContainEqual(['eq', 'member_id', 4]);
    expect(client.calls[1].ops).toContainEqual(['in', 'meal_time_id', [1, 2]]);
  });

  it('skips the sharer lookup when there are no Meal Times', async () => {
    client = fakeClient({ meal_time_members: { data: [], error: null } });
    expect(await loadMealTimes(client, 4)).toEqual([]);
    expect(client.calls).toHaveLength(1);
  });

  it('throws the Supabase error when loading fails', async () => {
    client = fakeClient({ meal_time_members: { data: null, error: new Error('down') } });
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

  it('saves a new Meal Time through save_meal_time, with the creator always among the sharers', async () => {
    client = fakeClient({ 'rpc:save_meal_time': { data: 21, error: null } });
    const id = await saveMealTime(client, 4, {
      id: null,
      name: ' Family dinner ',
      time: '18:30',
      kind: 'planned',
      weekdays: [3, 1],
      calMin: '600',
      calMax: '800',
      setCalories: '',
      createdBy: 4,
      sharerIds: [9, 9],
      sharerRanges: { 9: { calMin: '450', calMax: '650', setCalories: '' } },
    });
    expect(id).toBe(21);
    expect(client.calls[0].rpc).toBe('save_meal_time');
    expect(client.calls[0].args).toEqual({
      p_member_id: 4,
      p_meal_time_id: null,
      p_name: 'Family dinner',
      p_time_of_day: '18:30',
      p_kind: 'planned',
      p_weekdays: [1, 3],
      p_cal_min: 600,
      p_cal_max: 800,
      p_set_calories: null,
      p_sharer_ids: [4, 9],
      p_sharer_ranges: [{ member_id: 9, cal_min: 450, cal_max: 650, set_calories: null }],
    });
  });

  it('sends each new sharer their own range, never the editor range', () => {
    const payload = sharerRangesPayload(
      {
        kind: 'planned',
        createdBy: 4,
        existingSharerIds: [4],
        sharerIds: [4, 9, 12],
        calMin: '600',
        calMax: '800',
        sharerRanges: {
          9: { calMin: '300', calMax: '500' },
          12: { calMin: '100', calMax: '200' },
        },
      },
      4
    );
    expect(payload).toEqual([
      { member_id: 9, cal_min: 300, cal_max: 500, set_calories: null },
      { member_id: 12, cal_min: 100, cal_max: 200, set_calories: null },
    ]);
  });

  it('leaves out a new sharer with no range, so the database refuses rather than copying', () => {
    const payload = sharerRangesPayload(
      {
        kind: 'planned',
        createdBy: 4,
        existingSharerIds: [4],
        sharerIds: [4, 9],
        calMin: '600',
        calMax: '800',
        sharerRanges: {},
      },
      4
    );
    expect(payload).toEqual([]);
  });

  it('does not send a range for a sharer who already shares the Meal Time', () => {
    const payload = sharerRangesPayload(
      {
        kind: 'planned',
        createdBy: 4,
        existingSharerIds: [4, 9],
        sharerIds: [4, 9],
        sharerRanges: { 9: { calMin: '1', calMax: '2' } },
      },
      4
    );
    expect(payload).toEqual([]);
  });

  it('sends a Set sharer one number and an If room sharer a null minimum when blank', () => {
    expect(
      sharerRangesPayload(
        {
          kind: 'set',
          createdBy: 4,
          existingSharerIds: [4],
          sharerIds: [4, 9],
          sharerRanges: { 9: { setCalories: '150' } },
        },
        4
      )
    ).toEqual([{ member_id: 9, cal_min: null, cal_max: null, set_calories: 150 }]);
    expect(
      sharerRangesPayload(
        {
          kind: 'if_room',
          createdBy: 4,
          existingSharerIds: [4],
          sharerIds: [4, 9],
          sharerRanges: { 9: { calMin: '', calMax: '200' } },
        },
        4
      )
    ).toEqual([{ member_id: 9, cal_min: null, cal_max: 200, set_calories: null }]);
  });

  it('updates an existing Meal Time through save_meal_time, adding the editing Member', async () => {
    client = fakeClient({ 'rpc:save_meal_time': { data: 9, error: null } });
    const id = await saveMealTime(client, 4, {
      id: 9,
      name: 'Snack',
      time: '16:00',
      kind: 'set',
      weekdays: [6],
      calMin: '',
      calMax: '',
      setCalories: '150',
      createdBy: 7,
      sharerIds: [7],
    });
    expect(id).toBe(9);
    expect(client.calls[0].args).toMatchObject({
      p_member_id: 4,
      p_meal_time_id: 9,
      p_kind: 'set',
      p_weekdays: [6],
      p_cal_min: null,
      p_cal_max: null,
      p_set_calories: 150,
      p_sharer_ids: [4, 7],
    });
  });

  it('throws the Supabase error when saving fails', async () => {
    client = fakeClient({ 'rpc:save_meal_time': { data: null, error: new Error('refused') } });
    await expect(
      saveMealTime(client, 4, {
        id: null,
        name: 'Lunch',
        time: '12:30',
        kind: 'planned',
        weekdays: [1],
        calMin: '400',
        calMax: '600',
        setCalories: '',
      })
    ).rejects.toThrow('refused');
  });

  it('sets weekdays sorted and without repeats, on the Meal Time itself', async () => {
    client = fakeClient({ meal_times: { data: null, error: null } });
    await setWeekdays(client, 4, 9, [5, 1, 5]);
    const ops = client.calls[0].ops;
    expect(ops.find(([op]) => op === 'update')[1]).toEqual({ weekdays: [1, 5] });
    expect(ops).toContainEqual(['eq', 'id', 9]);
  });

  it('the creator deletes the Meal Time', async () => {
    client = fakeClient({ meal_times: { data: null, error: null } });
    await deleteMealTime(client, 4, 9, 4);
    const ops = client.calls[0].ops;
    expect(client.calls[0].table).toBe('meal_times');
    expect(ops).toContainEqual(['delete']);
    expect(ops).toContainEqual(['eq', 'id', 9]);
    expect(ops).toContainEqual(['eq', 'member_id', 4]);
  });

  it('another sharer only removes their own sharing row', async () => {
    client = fakeClient({ meal_time_members: { data: null, error: null } });
    await deleteMealTime(client, 9, 9, 4);
    const ops = client.calls[0].ops;
    expect(client.calls[0].table).toBe('meal_time_members');
    expect(ops).toContainEqual(['delete']);
    expect(ops).toContainEqual(['eq', 'meal_time_id', 9]);
    expect(ops).toContainEqual(['eq', 'member_id', 9]);
  });
});
