import { describe, expect, it } from 'vitest';
import {
  MAX_LOG_GRAMS,
  addDays,
  amountToGrams,
  buildLogRow,
  calorieBar,
  canLogOn,
  clockMinutes,
  clockTime,
  dateKey,
  defaultMealTimeId,
  entryNutrition,
  floorStatus,
  isDateKey,
  isFutureDay,
  logProblem,
  macroBar,
  mealSections,
  mealsOnDay,
  nearestMealTime,
  parseDateKey,
  rangeStatus,
  sumEntries,
  targetView,
  weekdayOf,
} from './todayLogic.js';

const at = (hours, minutes) => new Date(2026, 9, 17, hours, minutes); // 17 Oct 2026, a Saturday

const breakfast = {
  id: 1,
  name: 'Breakfast',
  time_of_day: '07:30:00',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  kind: 'planned',
  cal_min: 300,
  cal_max: 450,
  set_calories: null,
};
const lunch = {
  id: 2,
  name: 'Lunch',
  time_of_day: '12:30',
  weekdays: [1, 2, 3, 4, 5],
  kind: 'set',
  cal_min: null,
  cal_max: null,
  set_calories: 600,
};
const dinner = {
  id: 3,
  name: 'Dinner',
  time_of_day: '18:45',
  weekdays: [0, 6],
  kind: 'if_room',
  cal_min: null,
  cal_max: 700,
  set_calories: null,
};

const targets = {
  calorieTarget: 2000,
  bandLowPct: 90,
  bandHighPct: 100,
  proteinFloor: 100,
  carbLow: 200,
  carbHigh: 300,
  fatLow: null,
  fatHigh: null,
};

describe('dateKey', () => {
  it('builds the local calendar day, zero padded', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('does not move the day for late evening (no UTC shift)', () => {
    expect(dateKey(new Date(2026, 9, 17, 23, 30))).toBe('2026-10-17');
  });
});

describe('isDateKey and parseDateKey', () => {
  it('accepts only YYYY-MM-DD', () => {
    expect(isDateKey('2026-10-17')).toBe(true);
    expect(isDateKey('2026-10-7')).toBe(false);
    expect(isDateKey('17/10/2026')).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });

  it('parses a key to local midnight on that day', () => {
    const date = parseDateKey('2026-10-17');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(17);
    expect(date.getHours()).toBe(0);
  });

  it('throws on a malformed key', () => {
    expect(() => parseDateKey('yesterday')).toThrow();
  });
});

describe('addDays', () => {
  it('moves one day either way', () => {
    expect(addDays('2026-10-17', 1)).toBe('2026-10-18');
    expect(addDays('2026-10-17', -1)).toBe('2026-10-16');
  });

  it('rolls over month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('moves a whole week without drifting', () => {
    expect(addDays('2026-10-17', 7)).toBe('2026-10-24');
    expect(addDays('2026-10-17', 0)).toBe('2026-10-17');
  });
});

describe('weekdayOf', () => {
  it('uses 0 for Sunday, as the Meal Time weekdays do', () => {
    expect(weekdayOf('2026-10-18')).toBe(0); // a Sunday
    expect(weekdayOf('2026-10-17')).toBe(6); // a Saturday
    expect(weekdayOf('2026-10-19')).toBe(1); // a Monday
  });
});

describe('isFutureDay and canLogOn', () => {
  it('treats only days after today as future', () => {
    expect(isFutureDay('2026-10-18', '2026-10-17')).toBe(true);
    expect(isFutureDay('2026-10-17', '2026-10-17')).toBe(false);
    expect(isFutureDay('2026-10-16', '2026-10-17')).toBe(false);
  });

  it('compares across month and year ends', () => {
    expect(isFutureDay('2027-01-01', '2026-12-31')).toBe(true);
    expect(isFutureDay('2026-11-30', '2026-12-01')).toBe(false);
  });

  it('allows logging today and the past, never the future', () => {
    expect(canLogOn('2026-10-17', '2026-10-17')).toBe(true);
    expect(canLogOn('2026-10-01', '2026-10-17')).toBe(true);
    expect(canLogOn('2026-10-18', '2026-10-17')).toBe(false);
  });
});

describe('clockMinutes and clockTime', () => {
  it('gives minutes after midnight and an HH:MM string', () => {
    expect(clockMinutes(at(7, 30))).toBe(450);
    expect(clockTime(at(7, 5))).toBe('07:05');
    expect(clockTime(at(0, 0))).toBe('00:00');
  });
});

describe('targetView', () => {
  it('reads the Targets row with the Planning band defaulted', () => {
    expect(targetView(null)).toEqual({
      calorieTarget: null,
      bandLowPct: 90,
      bandHighPct: 100,
      proteinFloor: null,
      carbLow: null,
      carbHigh: null,
      fatLow: null,
      fatHigh: null,
    });
  });

  it('keeps the stored values when present', () => {
    const view = targetView({
      calorie_target: 1800,
      band_low_pct: 85,
      band_high_pct: 95,
      protein_floor_g: 120,
      carb_low_g: 150,
      carb_high_g: 220,
      fat_low_g: 50,
      fat_high_g: 80,
    });
    expect(view.calorieTarget).toBe(1800);
    expect(view.bandLowPct).toBe(85);
    expect(view.bandHighPct).toBe(95);
    expect(view.proteinFloor).toBe(120);
    expect(view.fatHigh).toBe(80);
  });
});

describe('mealsOnDay', () => {
  it('keeps only the Meal Times that apply on the weekday, in time order', () => {
    const shuffled = [dinner, lunch, breakfast];
    expect(mealsOnDay(shuffled, 6).map((meal) => meal.id)).toEqual([1, 3]);
    expect(mealsOnDay(shuffled, 2).map((meal) => meal.id)).toEqual([1, 2]);
  });

  it('returns nothing for no Meal Times', () => {
    expect(mealsOnDay([], 3)).toEqual([]);
    expect(mealsOnDay(null, 3)).toEqual([]);
  });

  it('breaks equal times by id', () => {
    const a = { ...breakfast, id: 9, time_of_day: '08:00' };
    const b = { ...breakfast, id: 4, time_of_day: '08:00' };
    expect(mealsOnDay([a, b], 1).map((meal) => meal.id)).toEqual([4, 9]);
  });
});

describe('nearestMealTime', () => {
  it('picks the Meal Time closest to the clock on that weekday', () => {
    // 11:50 on a Monday: lunch at 12:30 (40 min) beats breakfast at 07:30
    expect(nearestMealTime([breakfast, lunch], 1, 11 * 60 + 50).id).toBe(2);
    // 08:10 on a Monday: breakfast
    expect(nearestMealTime([breakfast, lunch], 1, 8 * 60 + 10).id).toBe(1);
  });

  it('ignores Meal Times that do not apply on the weekday', () => {
    // Monday: dinner is not on, so 18:40 gets nothing close; lunch is 6h10 away but still the nearest
    expect(nearestMealTime([lunch, dinner], 1, 18 * 60 + 40).id).toBe(2);
    // Sunday: lunch is not on, so dinner is the only choice
    expect(nearestMealTime([lunch, dinner], 0, 9 * 60).id).toBe(3);
  });

  it('gives the earlier Meal Time on a tie', () => {
    // 10:00 is the midpoint of 07:30 and 12:30: both are 150 minutes away, so the earlier wins
    expect(nearestMealTime([breakfast, lunch], 1, 600).id).toBe(1);
  });

  it('is null when no Meal Time applies that day', () => {
    expect(nearestMealTime([lunch], 0, 600)).toBeNull();
    expect(nearestMealTime([], 1, 600)).toBeNull();
  });
});

describe('defaultMealTimeId', () => {
  it('uses the nearest Meal Time to the clock, or null', () => {
    expect(defaultMealTimeId([breakfast, lunch], 2, at(12, 10))).toBe(2);
    expect(defaultMealTimeId([lunch], 0, at(12, 10))).toBeNull();
  });
});

describe('mealSections', () => {
  const entries = [
    { id: 10, meal_time_id: 1, kcal: 300, description: 'Oats' },
    { id: 11, meal_time_id: 1, kcal: 100.5, description: 'Banana' },
    { id: 12, meal_time_id: null, kcal: 50, description: 'Mint' },
    { id: 13, meal_time_id: 99, kcal: 20, description: 'Old meal' },
  ];

  it('groups each applicable Meal Time with its own entries and total', () => {
    const { sections } = mealSections([breakfast, lunch], entries, 1);
    expect(sections.map((section) => section.meal.id)).toEqual([1, 2]);
    expect(sections[0].entries.map((entry) => entry.id)).toEqual([10, 11]);
    expect(sections[0].kcal).toBe(400.5);
    expect(sections[1].entries).toEqual([]);
    expect(sections[1].kcal).toBe(0);
  });

  it('puts entries with no Meal Time, or one that no longer applies, under other', () => {
    const { other } = mealSections([breakfast, lunch], entries, 1);
    expect(other.entries.map((entry) => entry.id)).toEqual([12, 13]);
    expect(other.kcal).toBe(70);
  });

  it('hides Meal Times that do not apply on the weekday, but keeps their entries as other', () => {
    const { sections, other } = mealSections([breakfast, lunch], entries, 0);
    expect(sections.map((section) => section.meal.id)).toEqual([1]);
    expect(other.entries.map((entry) => entry.id)).toEqual([12, 13]);
  });

  it('handles a day with no entries', () => {
    const { sections, other } = mealSections([breakfast], [], 3);
    expect(sections[0].entries).toEqual([]);
    expect(other).toEqual({ entries: [], kcal: 0 });
  });
});

describe('sumEntries', () => {
  it('adds calories and macros, rounded to one decimal', () => {
    const totals = sumEntries([
      { kcal: 100.3, protein_g: 5.1, carbs_g: 20, fat_g: 2 },
      { kcal: 50.2, protein_g: 1.2, carbs_g: 4.4, fat_g: 0.3 },
    ]);
    expect(totals).toEqual({ kcal: 150.5, protein: 6.3, carbs: 24.4, fat: 2.3, missingMacros: 0 });
  });

  it('counts a missing macro as nothing and reports how many entries lack one', () => {
    const totals = sumEntries([
      { kcal: 200, protein_g: null, carbs_g: 30, fat_g: 5 },
      { kcal: 100, protein_g: 10, carbs_g: 10, fat_g: 1 },
    ]);
    expect(totals.protein).toBe(10);
    expect(totals.missingMacros).toBe(1);
    expect(totals.kcal).toBe(300);
  });

  it('is all zeros for no entries', () => {
    expect(sumEntries([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, missingMacros: 0 });
    expect(sumEntries(undefined).kcal).toBe(0);
  });
});

describe('calorieBar', () => {
  it('reports noTarget with no Calorie Target', () => {
    const bar = calorieBar(500, { ...targets, calorieTarget: null });
    expect(bar).toMatchObject({ status: 'noTarget', target: null, left: null, fraction: 0 });
  });

  it('is under below the band, with the aim and what is left', () => {
    const bar = calorieBar(1000, targets);
    expect(bar.status).toBe('under');
    expect(bar.aimLow).toBe(1800);
    expect(bar.aimHigh).toBe(2000);
    expect(bar.left).toBe(1000);
    expect(bar.fraction).toBe(0.5);
  });

  it('is inBand from the band low up to the band high', () => {
    expect(calorieBar(1800, targets).status).toBe('inBand');
    expect(calorieBar(1950, targets).status).toBe('inBand');
    expect(calorieBar(2000, targets).status).toBe('inBand');
  });

  it('is aboveBand between the band high and the Target', () => {
    const narrow = { ...targets, bandHighPct: 95 }; // band 1800 to 1900
    expect(calorieBar(1950, narrow).status).toBe('aboveBand');
    expect(calorieBar(2000, narrow).status).toBe('aboveBand');
  });

  it('is over once eaten passes the Target, with a negative left', () => {
    const bar = calorieBar(2150.5, targets);
    expect(bar.status).toBe('over');
    expect(bar.left).toBe(-150.5);
    expect(bar.fraction).toBe(1);
  });

  it('clamps the bar fraction between 0 and 1', () => {
    expect(calorieBar(0, targets).fraction).toBe(0);
    expect(calorieBar(9999, targets).fraction).toBe(1);
  });

  it('uses the band as a percent of the Target (rounded to whole kcal)', () => {
    const bar = calorieBar(1000, { ...targets, calorieTarget: 1999, bandLowPct: 90 });
    expect(bar.aimLow).toBe(1799);
  });
});

describe('floorStatus (protein)', () => {
  it('is noTarget with no floor', () => {
    expect(floorStatus(40, null)).toEqual({
      status: 'noTarget',
      eaten: 40,
      floor: null,
      left: null,
    });
  });

  it('is short with the grams still to go', () => {
    expect(floorStatus(60.5, 100)).toMatchObject({ status: 'short', left: 39.5 });
  });

  it('is met at or above the floor, with nothing to go', () => {
    expect(floorStatus(100, 100)).toMatchObject({ status: 'met', left: 0 });
    expect(floorStatus(130, 100)).toMatchObject({ status: 'met', left: 0 });
  });
});

describe('rangeStatus (carbs and fat)', () => {
  it('is noTarget when both ends are missing', () => {
    expect(rangeStatus(50, null, null)).toEqual({
      status: 'noTarget',
      eaten: 50,
      low: null,
      high: null,
    });
  });

  it('is under below the low end, over above the high end, inRange between', () => {
    expect(rangeStatus(199, 200, 300).status).toBe('under');
    expect(rangeStatus(200, 200, 300).status).toBe('inRange');
    expect(rangeStatus(300, 200, 300).status).toBe('inRange');
    expect(rangeStatus(301, 200, 300).status).toBe('over');
  });

  it('checks only the end that is set when one is missing', () => {
    expect(rangeStatus(10, null, 300).status).toBe('inRange');
    expect(rangeStatus(400, null, 300).status).toBe('over');
  });
});

describe('macroBar', () => {
  it('reads protein, carbs and fat against their Targets', () => {
    const bar = macroBar({ protein: 80, carbs: 250, fat: 70 }, targets);
    expect(bar.protein).toMatchObject({ status: 'short', left: 20 });
    expect(bar.carbs.status).toBe('inRange');
    expect(bar.fat.status).toBe('noTarget');
  });
});

describe('amountToGrams', () => {
  it('takes grams as typed', () => {
    expect(amountToGrams({ amount: '150', unit: 'grams', servingGrams: 30 })).toEqual({
      ok: true,
      grams: 150,
      servings: null,
    });
  });

  it('accepts decimals and rounds grams to one decimal', () => {
    expect(amountToGrams({ amount: ' 12.345 ', unit: 'grams' })).toMatchObject({
      ok: true,
      grams: 12.3,
    });
  });

  it('turns servings into grams with the serving size', () => {
    expect(amountToGrams({ amount: '2', unit: 'servings', servingGrams: 40 })).toEqual({
      ok: true,
      grams: 80,
      servings: 2,
    });
    expect(amountToGrams({ amount: '1.5', unit: 'servings', servingGrams: 30 })).toMatchObject({
      ok: true,
      grams: 45,
      servings: 1.5,
    });
  });

  it('refuses servings when the food has no serving size', () => {
    expect(amountToGrams({ amount: '1', unit: 'servings', servingGrams: null })).toEqual({
      ok: false,
      error: 'today.log.errors.servingUnknown',
    });
    expect(amountToGrams({ amount: '1', unit: 'servings', servingGrams: 0 }).ok).toBe(false);
  });

  it('refuses empty, negative, zero and non-numeric amounts', () => {
    for (const amount of ['', '  ', '0', '-5', 'abc', '1,5', '2e3']) {
      expect(amountToGrams({ amount, unit: 'grams' })).toEqual({
        ok: false,
        error: 'today.log.errors.amount',
      });
    }
  });

  it('refuses an amount that rounds to nothing', () => {
    expect(amountToGrams({ amount: '0.01', unit: 'grams' })).toEqual({
      ok: false,
      error: 'today.log.errors.amount',
    });
  });

  it('refuses more than the maximum grams', () => {
    expect(amountToGrams({ amount: String(MAX_LOG_GRAMS), unit: 'grams' }).ok).toBe(true);
    expect(amountToGrams({ amount: String(MAX_LOG_GRAMS + 1), unit: 'grams' })).toEqual({
      ok: false,
      error: 'today.log.errors.tooLarge',
    });
  });
});

describe('entryNutrition', () => {
  it('scales calories and macros to the grams eaten', () => {
    const food = {
      kcalPer100g: 389,
      macros: { protein: 16.8, carbs: 66.4, fat: 6.8 },
    };
    expect(entryNutrition(food, 50)).toEqual({ kcal: 194.5, protein: 8.4, carbs: 33.2, fat: 3.4 });
  });

  it('keeps a missing macro as null, never 0', () => {
    const food = { kcalPer100g: 100, macros: null };
    expect(entryNutrition(food, 40)).toEqual({ kcal: 40, protein: null, carbs: null, fat: null });
  });

  it('gives null calories when the food has none', () => {
    expect(entryNutrition({ kcalPer100g: null, macros: null }, 40).kcal).toBeNull();
  });
});

describe('buildLogRow', () => {
  const food = { id: 7, name: 'Oats' };
  const nutrition = { kcal: 150, protein: 5, carbs: 27, fat: 3 };

  it('builds an entry at a Meal Time (no log_time)', () => {
    expect(
      buildLogRow({
        memberId: 4,
        logDate: '2026-10-17',
        food,
        grams: 40,
        servings: null,
        nutrition,
        mealTimeId: 1,
        logTime: '09:15',
      })
    ).toEqual({
      member_id: 4,
      log_date: '2026-10-17',
      meal_time_id: 1,
      log_time: null,
      food_id: 7,
      description: 'Oats',
      servings: null,
      grams: 40,
      kcal: 150,
      protein_g: 5,
      carbs_g: 27,
      fat_g: 3,
    });
  });

  it('builds an entry at another time with the clock time', () => {
    const row = buildLogRow({
      memberId: 4,
      logDate: '2026-10-17',
      food,
      grams: 40,
      servings: 1,
      nutrition,
      mealTimeId: null,
      logTime: '16:02',
    });
    expect(row.meal_time_id).toBeNull();
    expect(row.log_time).toBe('16:02');
    expect(row.servings).toBe(1);
  });
});

describe('logProblem', () => {
  const food = { id: 7, name: 'Oats', kcalPer100g: 389, servingGrams: 40, macros: null };

  it('passes a valid entry on a past or current day', () => {
    expect(
      logProblem({
        food,
        amount: '50',
        unit: 'grams',
        logDate: '2026-10-17',
        todayKey: '2026-10-17',
      })
    ).toBeNull();
    expect(
      logProblem({
        food,
        amount: '2',
        unit: 'servings',
        logDate: '2026-10-01',
        todayKey: '2026-10-17',
      })
    ).toBeNull();
  });

  it('asks for a food first', () => {
    expect(
      logProblem({
        food: null,
        amount: '50',
        unit: 'grams',
        logDate: '2026-10-17',
        todayKey: '2026-10-17',
      })
    ).toBe('today.log.errors.food');
  });

  it('refuses a future day', () => {
    expect(
      logProblem({
        food,
        amount: '50',
        unit: 'grams',
        logDate: '2026-10-18',
        todayKey: '2026-10-17',
      })
    ).toBe('today.log.errors.futureDay');
  });

  it('passes on the amount problem', () => {
    expect(
      logProblem({
        food,
        amount: '0',
        unit: 'grams',
        logDate: '2026-10-17',
        todayKey: '2026-10-17',
      })
    ).toBe('today.log.errors.amount');
  });

  it('refuses a food with no calorie figure', () => {
    expect(
      logProblem({
        food: { ...food, kcalPer100g: null },
        amount: '50',
        unit: 'grams',
        logDate: '2026-10-17',
        todayKey: '2026-10-17',
      })
    ).toBe('today.log.errors.noKcal');
  });
});
