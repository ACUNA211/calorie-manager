import { describe, it, expect } from 'vitest';
import {
  dayTotals,
  draftToRow,
  findOverlaps,
  minutesOf,
  missingSharerRanges,
  needsCalories,
  newSharerIds,
  normalizeSharerIds,
  normalizeTime,
  rangeRow,
  targetsFromRow,
  validateMealTime,
} from './mealTimesLogic.js';

describe('sharers of a Meal Time', () => {
  it('always includes the creator and the editing Member, sorted and without repeats', () => {
    expect(normalizeSharerIds([9, 4, 9], 7, 4)).toEqual([4, 7, 9]);
  });

  it('keeps the creator and the editor when the list is empty', () => {
    expect(normalizeSharerIds([], 4, 4)).toEqual([4]);
    expect(normalizeSharerIds(undefined, 7, 4)).toEqual([4, 7]);
  });

  it('drops ids that are not numbers', () => {
    expect(normalizeSharerIds([null, '9'], 4, 4)).toEqual([4, 9]);
  });
});

describe('needsCalories', () => {
  it('a Set Meal Time needs its one number', () => {
    expect(needsCalories({ kind: 'set', set_calories: 300, cal_min: null, cal_max: null })).toBe(
      false
    );
    expect(needsCalories({ kind: 'set', set_calories: null, cal_min: 400, cal_max: 600 })).toBe(
      true
    );
  });

  it('a Planned Meal Time needs both ends of its range', () => {
    expect(needsCalories({ kind: 'planned', set_calories: null, cal_min: 400, cal_max: 600 })).toBe(
      false
    );
    expect(
      needsCalories({ kind: 'planned', set_calories: null, cal_min: null, cal_max: 600 })
    ).toBe(true);
    expect(needsCalories({ kind: 'planned', set_calories: 300, cal_min: 400, cal_max: null })).toBe(
      true
    );
  });

  it('an If room Meal Time needs only its maximum', () => {
    expect(
      needsCalories({ kind: 'if_room', set_calories: null, cal_min: null, cal_max: 300 })
    ).toBe(false);
    expect(
      needsCalories({ kind: 'if_room', set_calories: null, cal_min: null, cal_max: null })
    ).toBe(true);
  });
});

const target = { calorie_target: 2000, band_low_pct: 90, band_high_pct: 100 };

const planned = (over = {}) => ({
  name: 'Lunch',
  time: '12:30',
  kind: 'planned',
  weekdays: [1, 2, 3],
  calMin: '400',
  calMax: '600',
  setCalories: '',
  id: null,
  ...over,
});

describe('validateMealTime', () => {
  it('accepts a complete Planned draft', () => {
    expect(validateMealTime(planned()).errors).toEqual({});
  });

  it('needs a name and a time', () => {
    const { errors } = validateMealTime(planned({ name: '   ', time: '' }));
    expect(errors.name).toBe('mealTimes.errors.nameRequired');
    expect(errors.time).toBe('mealTimes.errors.timeRequired');
  });

  it('needs one calorie number for Set and ignores the range', () => {
    expect(validateMealTime(planned({ kind: 'set', setCalories: '' })).errors.setCalories).toBe(
      'mealTimes.errors.setCaloriesRequired'
    );
    expect(validateMealTime(planned({ kind: 'set', setCalories: '650' })).errors).toEqual({});
  });

  it('needs a min and a max for Planned', () => {
    expect(validateMealTime(planned({ calMin: '', calMax: '500' })).errors.range).toBe(
      'mealTimes.errors.rangeRequired'
    );
  });

  it('accepts an If room Meal Time with only a maximum', () => {
    expect(
      validateMealTime(planned({ kind: 'if_room', calMin: '', calMax: '300' })).errors
    ).toEqual({});
  });

  it('needs a maximum for If room, even when a minimum is given', () => {
    expect(
      validateMealTime(planned({ kind: 'if_room', calMin: '', calMax: '' })).errors.range
    ).toBe('mealTimes.errors.maxRequired');
    expect(
      validateMealTime(planned({ kind: 'if_room', calMin: '100', calMax: '' })).errors.range
    ).toBe('mealTimes.errors.maxRequired');
  });

  it('accepts an If room minimum that is no more than the maximum', () => {
    expect(
      validateMealTime(planned({ kind: 'if_room', calMin: '200', calMax: '200' })).errors
    ).toEqual({});
  });

  it('refuses an If room minimum above its maximum', () => {
    expect(
      validateMealTime(planned({ kind: 'if_room', calMin: '400', calMax: '300' })).errors.range
    ).toBe('mealTimes.errors.rangeOrder');
  });

  it('refuses an If room minimum that is not a whole number', () => {
    expect(
      validateMealTime(planned({ kind: 'if_room', calMin: '12.5', calMax: '300' })).errors.range
    ).toBe('mealTimes.errors.minInvalid');
  });

  it('refuses a Planned minimum above the maximum', () => {
    expect(validateMealTime(planned({ calMin: '700', calMax: '600' })).errors.range).toBe(
      'mealTimes.errors.rangeOrder'
    );
  });

  it('refuses decimals and negative numbers', () => {
    expect(validateMealTime(planned({ calMin: '12.5' })).errors.range).toBe(
      'mealTimes.errors.rangeRequired'
    );
    expect(validateMealTime(planned({ calMax: '-5' })).errors.range).toBe(
      'mealTimes.errors.rangeRequired'
    );
    expect(validateMealTime(planned({ kind: 'if_room', calMax: '-5' })).errors.range).toBe(
      'mealTimes.errors.maxRequired'
    );
  });
});

describe('draftToRow', () => {
  it('keeps only the range for Planned and only the number for Set', () => {
    expect(draftToRow(planned({ weekdays: [3, 1, 3] }))).toEqual({
      name: 'Lunch',
      time_of_day: '12:30',
      kind: 'planned',
      weekdays: [1, 3],
      set_calories: null,
      cal_min: 400,
      cal_max: 600,
    });
    expect(draftToRow(planned({ kind: 'set', setCalories: '650' }))).toMatchObject({
      kind: 'set',
      set_calories: 650,
      cal_min: null,
      cal_max: null,
    });
  });

  it('stores an If room minimum left blank as null, and keeps a typed one', () => {
    expect(draftToRow(planned({ kind: 'if_room', calMin: '', calMax: '300' }))).toMatchObject({
      kind: 'if_room',
      cal_min: null,
      cal_max: 300,
    });
    expect(draftToRow(planned({ kind: 'if_room', calMin: '100', calMax: '300' }))).toMatchObject({
      cal_min: 100,
      cal_max: 300,
    });
  });
});

describe('new sharers', () => {
  it('lists only the Members added on this save, not the existing sharers or the editor', () => {
    expect(newSharerIds([4, 7, 9], [4, 7], 4)).toEqual([9]);
    expect(newSharerIds([4, 9, 9], [], 4)).toEqual([9]);
    expect(newSharerIds([], [4], 4)).toEqual([]);
  });

  it('a new sharer with no range of their own is missing one', () => {
    const draft = planned({ sharerIds: [4, 9], sharerRanges: {}, existingSharerIds: [] });
    expect(missingSharerRanges(draft, [], 4)).toEqual([9]);
  });

  it('a new sharer with a range for the kind is not missing', () => {
    const draft = planned({
      sharerIds: [4, 9],
      sharerRanges: { 9: { calMin: '300', calMax: '500' } },
    });
    expect(missingSharerRanges(draft, [], 4)).toEqual([]);
  });

  it('a range that is incomplete for Planned is missing', () => {
    const draft = planned({ sharerIds: [4, 9], sharerRanges: { 9: { calMin: '300' } } });
    expect(missingSharerRanges(draft, [], 4)).toEqual([9]);
  });

  it('an If room sharer needs a maximum, and a minimum is optional', () => {
    const base = { kind: 'if_room', sharerIds: [4, 9] };
    expect(
      missingSharerRanges({ ...base, sharerRanges: { 9: { calMin: '', calMax: '' } } }, [], 4)
    ).toEqual([9]);
    expect(
      missingSharerRanges({ ...base, sharerRanges: { 9: { calMin: '', calMax: '200' } } }, [], 4)
    ).toEqual([]);
    expect(
      missingSharerRanges({ ...base, sharerRanges: { 9: { calMin: '300', calMax: '200' } } }, [], 4)
    ).toEqual([9]);
  });

  it('a Set sharer needs one number', () => {
    const base = { kind: 'set', sharerIds: [4, 9] };
    expect(
      missingSharerRanges({ ...base, sharerRanges: { 9: { setCalories: '' } } }, [], 4)
    ).toEqual([9]);
    expect(
      missingSharerRanges({ ...base, sharerRanges: { 9: { setCalories: '150' } } }, [], 4)
    ).toEqual([]);
  });

  it('existing sharers never count as missing', () => {
    const draft = planned({ sharerIds: [4, 9], sharerRanges: {} });
    expect(missingSharerRanges(draft, [4, 9], 4)).toEqual([]);
  });

  it('the editing Member never counts as missing', () => {
    const draft = planned({ sharerIds: [4], sharerRanges: {} });
    expect(missingSharerRanges(draft, [], 4)).toEqual([]);
  });
});

describe('rangeRow', () => {
  it('gives an If room blank minimum as null and the maximum as a number', () => {
    expect(rangeRow('if_room', { calMin: '', calMax: '250' })).toEqual({
      set_calories: null,
      cal_min: null,
      cal_max: 250,
    });
  });
});

describe('time helpers', () => {
  it('reads stored times with seconds and works in minutes', () => {
    expect(normalizeTime('07:30:00')).toBe('07:30');
    expect(minutesOf('07:30:00')).toBe(450);
    expect(minutesOf('12:05')).toBe(725);
  });
});

describe('findOverlaps', () => {
  const lunch = { id: 1, name: 'Lunch', time_of_day: '12:30', weekdays: [1, 2, 3] };
  const snack = { id: 2, name: 'Snack', time_of_day: '12:30', weekdays: [2, 5] };
  const late = { id: 3, name: 'Late', time_of_day: '14:30', weekdays: [1] };

  it('finds a Meal Time at the exact same time that shares a weekday', () => {
    expect(findOverlaps(lunch, [lunch, snack, late], [1, 2, 3])).toEqual([
      { meal: snack, weekdays: [2] },
    ]);
  });

  it('does not count 18:00 and 18:30 on the same day as overlapping', () => {
    const sixPm = { id: 4, time_of_day: '18:00', weekdays: [1] };
    const sixThirty = { id: 5, time_of_day: '18:30', weekdays: [1] };
    expect(findOverlaps(sixPm, [sixThirty], [1])).toEqual([]);
    expect(findOverlaps(sixThirty, [sixPm], [1])).toEqual([]);
  });

  it('counts 18:00 and 18:00 on the same day as overlapping', () => {
    const sixPm = { id: 4, time_of_day: '18:00', weekdays: [1] };
    const otherSixPm = { id: 5, time_of_day: '18:00:00', weekdays: [1, 6] };
    expect(findOverlaps(sixPm, [otherSixPm], [1])).toEqual([{ meal: otherSixPm, weekdays: [1] }]);
  });

  it('ignores a one-minute difference', () => {
    const at1229 = { id: 9, time_of_day: '12:29', weekdays: [1] };
    const at1231 = { id: 10, time_of_day: '12:31', weekdays: [1] };
    expect(findOverlaps(lunch, [at1229, at1231], [1])).toEqual([]);
  });

  it('checks only the days asked about', () => {
    expect(findOverlaps(lunch, [snack], [1])).toEqual([]);
  });

  it('never clashes with itself', () => {
    expect(findOverlaps(lunch, [lunch], [1, 2, 3])).toEqual([]);
  });

  it('treats a new Meal Time (no id) as clashing with the existing ones', () => {
    const draft = { id: null, time_of_day: '12:30' };
    expect(findOverlaps(draft, [lunch], [1])).toEqual([{ meal: lunch, weekdays: [1] }]);
  });
});

describe('dayTotals', () => {
  const meals = [
    { id: 1, kind: 'set', set_calories: 500, weekdays: [1] },
    { id: 2, kind: 'planned', cal_min: 400, cal_max: 600, weekdays: [1] },
    { id: 3, kind: 'if_room', cal_min: null, cal_max: 300, weekdays: [1] },
    { id: 4, kind: 'planned', cal_min: 2100, cal_max: 2200, weekdays: [2] },
  ];

  it('adds Set in full, Planned min to the floor and max to the ceiling, If room only to the ceiling', () => {
    const totals = dayTotals(meals, 1, target);
    expect(totals.floor).toBe(900);
    expect(totals.ceiling).toBe(1400);
    expect(totals.aimLow).toBe(1800);
    expect(totals.aimHigh).toBe(2000);
  });

  it('is over when the floor passes the Target', () => {
    expect(dayTotals(meals, 2, target).status).toBe('over');
  });

  it('is short when even the ceiling cannot reach the bottom of the aim', () => {
    expect(dayTotals(meals, 1, target).status).toBe('short');
  });

  it('is ok when the day can land in the aim', () => {
    const ok = [{ id: 5, kind: 'planned', cal_min: 1500, cal_max: 1900, weekdays: [3] }];
    expect(dayTotals(ok, 3, target).status).toBe('ok');
  });

  it('has no aim without a Calorie Target', () => {
    expect(dayTotals(meals, 1, { calorie_target: null }).status).toBe('noTarget');
  });

  it('uses the band from the Targets row', () => {
    const totals = dayTotals([], 0, { calorie_target: 2000, band_low_pct: 80, band_high_pct: 95 });
    expect(totals.aimLow).toBe(1600);
    expect(totals.aimHigh).toBe(1900);
  });
});

describe('targetsFromRow', () => {
  it('falls back to the 90 to 100 band when there is no row', () => {
    expect(targetsFromRow(null)).toEqual({
      calorie_target: null,
      band_low_pct: 90,
      band_high_pct: 100,
    });
  });
});
