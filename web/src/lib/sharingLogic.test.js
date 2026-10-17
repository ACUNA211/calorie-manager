import { describe, expect, it } from 'vitest';
import { DAY_STATUS, flagsForWeek, otherAdults, statusOfDay } from './sharingLogic.js';

describe('statusOfDay', () => {
  it('reads a Week view day as on track, over, nothing logged or no Target', () => {
    expect(statusOfDay({ logged: false, under: null })).toBe(DAY_STATUS.NOTHING);
    expect(statusOfDay({ logged: true, under: null })).toBe(DAY_STATUS.NO_TARGET);
    expect(statusOfDay({ logged: true, under: true })).toBe(DAY_STATUS.ON_TRACK);
    expect(statusOfDay({ logged: true, under: false })).toBe(DAY_STATUS.OVER);
  });
});

describe('flagsForWeek', () => {
  it('gives seven days, Sunday first, from the flags the database returns', () => {
    const days = flagsForWeek(
      [
        { day_key: '2026-10-11', is_over: false },
        { day_key: '2026-10-14', is_over: true },
      ],
      '2026-10-11'
    );
    expect(days.map((day) => day.key)).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
    ]);
    expect(days.map((day) => day.status)).toEqual([
      DAY_STATUS.ON_TRACK,
      DAY_STATUS.NOTHING,
      DAY_STATUS.NOTHING,
      DAY_STATUS.OVER,
      DAY_STATUS.NOTHING,
      DAY_STATUS.NOTHING,
      DAY_STATUS.NOTHING,
    ]);
  });

  it('marks a logged day with no Calorie Target as having no Target, not as on track', () => {
    const [sunday] = flagsForWeek([{ day_key: '2026-10-11', is_over: null }], '2026-10-11');
    expect(sunday.status).toBe(DAY_STATUS.NO_TARGET);
  });

  it('carries no calories, so a flag never shows the amount', () => {
    const days = flagsForWeek([{ day_key: '2026-10-11', is_over: true }], '2026-10-11');
    expect(days.every((day) => day.kcal === null)).toBe(true);
  });

  it('copes with no rows at all', () => {
    expect(flagsForWeek(null, '2026-10-11').every((day) => day.status === 'nothing')).toBe(true);
  });
});

describe('otherAdults', () => {
  it('lists the other adults only, without the signed-in adult or any Dependent', () => {
    const members = [
      { id: 1, role: 'owner' },
      { id: 2, role: 'member' },
      { id: 3, role: 'dependent' },
      { id: 4, role: 'member' },
    ];
    expect(otherAdults(members, 1).map((member) => member.id)).toEqual([2, 4]);
  });
});
