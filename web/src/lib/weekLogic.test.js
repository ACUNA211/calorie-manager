import { describe, expect, it } from 'vitest';
import {
  buildWeek,
  dayStats,
  groupByDay,
  shiftWeek,
  weekEndKey,
  weekKeys,
  weekStartKey,
} from './weekLogic.js';

// Targets as targetView returns them: Calorie Target 2000, Planning band 90 to 100 (1800 to 2000 kcal).
const targets = {
  calorieTarget: 2000,
  bandLowPct: 90,
  bandHighPct: 100,
  proteinFloor: 120,
  carbLow: 150,
  carbHigh: 220,
  fatLow: 50,
  fatHigh: 80,
};
const noTargets = { ...targets, calorieTarget: null };

// The week of Sunday 11 October to Saturday 17 October 2026 (17 October is a Saturday).
const START = '2026-10-11';
const TODAY = '2026-10-17';

const row = (log_date, kcal, protein_g, carbs_g, fat_g) => ({
  log_date,
  kcal,
  protein_g,
  carbs_g,
  fat_g,
});

// Sample data: Sunday two entries (1800 kcal, in the band), Monday over (2100), Tuesday
// nothing, Wednesday under the band (1500), Thursday in the band (1950) with one entry
// missing its protein figure. Friday and Saturday are empty. One row is outside the week.
// With the default band (90 to 100 percent) Thursday's 1950 is inside the band.
const entries = [
  row('2026-10-11', 900, 40, 100, 30),
  row('2026-10-11', 900, 40, 110, 25),
  row('2026-10-12', 2100, 100, 200, 70),
  row('2026-10-14', 1500, 90, 150, 50),
  row('2026-10-15', 1950, null, 160, 60),
  row('2026-10-18', 5000, 300, 500, 150),
];

describe('week dates', () => {
  it('starts the week on the Sunday on or before the day', () => {
    expect(weekStartKey('2026-10-17')).toBe('2026-10-11');
    expect(weekStartKey('2026-10-11')).toBe('2026-10-11');
    expect(weekStartKey('2026-10-01')).toBe('2026-09-27');
    expect(weekStartKey('2027-01-02')).toBe('2026-12-27');
  });

  it('ends the week on the Saturday', () => {
    expect(weekEndKey('2026-10-11')).toBe('2026-10-17');
    expect(weekEndKey('2026-12-27')).toBe('2027-01-02');
  });

  it('lists seven days, Sunday first', () => {
    expect(weekKeys('2026-10-11')).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
    ]);
  });

  it('moves a week at a time, across month and year ends', () => {
    expect(shiftWeek('2026-10-11', 1)).toBe('2026-10-18');
    expect(shiftWeek('2026-10-11', -1)).toBe('2026-10-04');
    expect(shiftWeek('2026-12-27', 1)).toBe('2027-01-03');
  });
});

describe('groupByDay', () => {
  it('groups the rows by their day, keeping their order', () => {
    const byDay = groupByDay(entries);
    expect(byDay.get('2026-10-11')).toHaveLength(2);
    expect(byDay.get('2026-10-13')).toBeUndefined();
  });
});

describe('dayStats', () => {
  it('gives a day with nothing logged no totals, no band and not under', () => {
    const day = dayStats('2026-10-13', [], targets, TODAY);
    expect(day).toMatchObject({
      logged: false,
      totals: null,
      bar: null,
      macros: null,
      under: null,
    });
  });

  it('counts a logged day under when its calories are at or below the Calorie Target', () => {
    expect(dayStats('d', [row('d', 2000, 1, 1, 1)], targets, TODAY).under).toBe(true);
    expect(dayStats('d', [row('d', 2001, 1, 1, 1)], targets, TODAY).under).toBe(false);
  });

  it('reads the Planning band from the calories', () => {
    expect(dayStats('d', [row('d', 1800, 1, 1, 1)], targets, TODAY).bar.status).toBe('inBand');
    expect(dayStats('d', [row('d', 1950, 1, 1, 1)], targets, TODAY).bar.status).toBe('inBand');
    expect(dayStats('d', [row('d', 1500, 1, 1, 1)], targets, TODAY).bar.status).toBe('under');
    expect(dayStats('d', [row('d', 2100, 1, 1, 1)], targets, TODAY).bar.status).toBe('over');
  });

  it('reads above the band but still under the Target when the band tops out below 100 percent', () => {
    // Band 80 to 90 percent: 1600 to 1800 kcal. 1950 is over the band but not over the Target.
    const narrow = { ...targets, bandLowPct: 80, bandHighPct: 90 };
    const day = dayStats('d', [row('d', 1950, 1, 1, 1)], narrow, TODAY);
    expect(day.bar.status).toBe('aboveBand');
    expect(day.under).toBe(true);
  });

  it('has no under count without a Calorie Target', () => {
    const day = dayStats('d', [row('d', 1500, 1, 1, 1)], noTargets, TODAY);
    expect(day.bar.status).toBe('noTarget');
    expect(day.under).toBeNull();
  });

  it('flags future days, so the screen can tell them from empty past days', () => {
    expect(dayStats('2026-10-18', [], targets, TODAY).isFuture).toBe(true);
    expect(dayStats('2026-10-16', [], targets, TODAY).isFuture).toBe(false);
  });
});

describe('buildWeek on sample data', () => {
  const week = buildWeek(entries, START, targets, TODAY);

  it('shows seven days, Sunday first, with the entries of each day only', () => {
    expect(week.days.map((day) => day.key)).toEqual(weekKeys(START));
    expect(week.days[0].totals.kcal).toBe(1800);
    expect(week.days[1].totals.kcal).toBe(2100);
  });

  it('shows the day total and macros for each logged day', () => {
    expect(week.days[0].totals).toMatchObject({ kcal: 1800, protein: 80, carbs: 210, fat: 55 });
    // Protein 80 g against a floor of 120 g is short by 40 g.
    expect(week.days[0].macros.protein.status).toBe('short');
    expect(week.days[0].macros.protein.left).toBe(40);
    expect(week.days[0].macros.carbs.status).toBe('inRange');
  });

  it('shows an empty day as empty, not as zero calories', () => {
    const tuesday = week.days[2];
    expect(tuesday.logged).toBe(false);
    expect(tuesday.totals).toBeNull();
    expect(tuesday.bar).toBeNull();
    expect(tuesday.under).toBeNull();
  });

  it('counts the logged days under the Calorie Target', () => {
    // Logged days: Sunday 1800, Monday 2100 (over), Wednesday 1500, Thursday 1950.
    expect(week.summary.loggedCount).toBe(4);
    expect(week.summary.underCount).toBe(3);
  });

  it('averages over logged days only, so empty days do not pull it down', () => {
    // (1800 + 2100 + 1500 + 1950) / 4. Dividing by seven would give 1050.
    expect(week.summary.average.kcal).toBe(1837.5);
    // Protein: (80 + 100 + 90 + 0) / 4. Thursday's missing figure counts as nothing.
    expect(week.summary.average.protein).toBe(67.5);
    expect(week.summary.average.carbs).toBe(180);
    expect(week.summary.average.fat).toBe(58.8);
  });

  it('counts the logged days that have a meal with no macro figures', () => {
    expect(week.summary.missingMacroDays).toBe(1);
  });
});

describe('buildWeek edge cases', () => {
  it('has no averages and no logged days for an empty week', () => {
    const week = buildWeek([], START, targets, TODAY);
    expect(week.summary).toMatchObject({
      loggedCount: 0,
      underCount: 0,
      missingMacroDays: 0,
    });
    expect(week.summary.average).toEqual({ kcal: null, protein: null, carbs: null, fat: null });
  });

  it('gives no under count without a Calorie Target, and still averages', () => {
    const week = buildWeek(entries, START, noTargets, TODAY);
    expect(week.summary.underCount).toBeNull();
    expect(week.summary.average.kcal).toBe(1837.5);
  });

  it('averages a single logged day as that day', () => {
    const week = buildWeek([row('2026-10-14', 1234.5, 10, 20, 30)], START, targets, TODAY);
    expect(week.summary.average.kcal).toBe(1234.5);
    expect(week.summary.loggedCount).toBe(1);
  });
});
