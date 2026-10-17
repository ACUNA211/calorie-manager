import { describe, expect, it } from 'vitest';
import {
  MAX_KG,
  MIN_KG,
  averageAt,
  buildTrend,
  checkWeightEntry,
  kgToLb,
  lbToKg,
  parseWeight,
  trendLayout,
  trendWindow,
} from './weightLogic.js';

describe('parseWeight', () => {
  it('reads a kilogram weight with a point or a comma, to one decimal', () => {
    expect(parseWeight('72.5')).toEqual({ ok: true, value: 72.5 });
    expect(parseWeight(' 72,5 ')).toEqual({ ok: true, value: 72.5 });
    expect(parseWeight('72')).toEqual({ ok: true, value: 72 });
  });

  it('refuses more than one decimal, text and empty input', () => {
    for (const text of ['72.25', 'seventy', '', '  ', '-70', '1,000']) {
      expect(parseWeight(text), text).toEqual({ ok: false, error: 'weight.errors.number' });
    }
  });

  it('keeps the range from 20 kg to 400 kg, both ends included', () => {
    expect(MIN_KG).toBe(20);
    expect(MAX_KG).toBe(400);
    expect(parseWeight('20')).toEqual({ ok: true, value: 20 });
    expect(parseWeight('400')).toEqual({ ok: true, value: 400 });
    expect(parseWeight('19.9')).toEqual({ ok: false, error: 'weight.errors.range' });
    expect(parseWeight('400.1')).toEqual({ ok: false, error: 'weight.errors.range' });
  });
});

describe('kg and lb conversion (helpers for ticket 11)', () => {
  it('converts with the exact pound (0.45359237 kg)', () => {
    expect(kgToLb(1)).toBeCloseTo(2.2046226, 6);
    expect(lbToKg(154.3)).toBe(70);
    expect(lbToKg(kgToLb(72.5))).toBe(72.5);
  });
});

describe('checkWeightEntry', () => {
  const todayKey = '2026-10-17';

  it('accepts today and earlier days, and returns the columns to save', () => {
    expect(checkWeightEntry({ date: todayKey, weight: '72.5', todayKey })).toEqual({
      ok: true,
      values: { log_date: '2026-10-17', kg: 72.5 },
    });
    expect(checkWeightEntry({ date: '2026-10-01', weight: '71', todayKey }).ok).toBe(true);
  });

  it('refuses a future day and a malformed date', () => {
    expect(checkWeightEntry({ date: '2026-10-18', weight: '72', todayKey })).toEqual({
      ok: false,
      field: 'date',
      error: 'weight.errors.future',
    });
    expect(checkWeightEntry({ date: '17/10/2026', weight: '72', todayKey })).toEqual({
      ok: false,
      field: 'date',
      error: 'weight.errors.date',
    });
  });

  it('reports a bad weight against its field', () => {
    expect(checkWeightEntry({ date: todayKey, weight: 'abc', todayKey })).toEqual({
      ok: false,
      field: 'weight',
      error: 'weight.errors.number',
    });
  });
});

describe('trendWindow', () => {
  it('covers 12 weeks (84 days) ending with the Saturday of the week shown', () => {
    // The week of Sunday 11 October 2026 (Saturday 17 October is its last day).
    const window = trendWindow('2026-10-11');
    expect(window.endKey).toBe('2026-10-17');
    expect(window.startKey).toBe('2026-07-26');
    expect(window.fetchFromKey).toBe('2026-07-20');
  });
});

describe('averageAt and buildTrend', () => {
  it('averages the seven calendar days ending on the day, counting only the days that have a weight', () => {
    const byDay = new Map([
      ['2026-10-10', 80],
      ['2026-10-12', 70],
      ['2026-10-14', 71],
    ]);
    // 8 to 14 Oct holds the 10th (80), the 12th (70) and the 14th (71).
    expect(averageAt(byDay, '2026-10-14')).toBeCloseTo((80 + 70 + 71) / 3, 10);
    // 11 to 17 Oct holds the 12th and the 14th only.
    expect(averageAt(byDay, '2026-10-17')).toBeCloseTo((70 + 71) / 2, 10);
    // 4 to 10 Oct holds only the 10th.
    expect(averageAt(byDay, '2026-10-10')).toBe(80);
    // 15 to 21 Oct holds no weight at all, so there is no average.
    expect(averageAt(byDay, '2026-10-21')).toBeNull();
  });

  it('builds one point per day of the window, with nulls for days without a weight', () => {
    const entries = [
      { log_date: '2026-10-05', kg: 72 },
      { log_date: '2026-10-06', kg: '71.5' },
    ];
    const trend = buildTrend(entries, '2026-10-05', '2026-10-08');
    expect(trend.days.map((day) => day.key)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ]);
    expect(trend.days.map((day) => day.kg)).toEqual([72, 71.5, null, null]);
    expect(trend.days[1].average).toBeCloseTo(71.75, 10);
    expect(trend.days[3].average).toBeCloseTo(71.75, 10);
    expect(trend.entries).toEqual([
      { log_date: '2026-10-05', kg: 72 },
      { log_date: '2026-10-06', kg: 71.5 },
    ]);
  });

  it('uses weights from before the window for the first averages, but lists only the window', () => {
    const entries = [
      { log_date: '2026-10-01', kg: 74 },
      { log_date: '2026-10-05', kg: 72 },
    ];
    const trend = buildTrend(entries, '2026-10-05', '2026-10-06');
    expect(trend.days[0].kg).toBe(72);
    expect(trend.days[0].average).toBe(73);
    expect(trend.entries).toEqual([{ log_date: '2026-10-05', kg: 72 }]);
  });
});

describe('trendLayout', () => {
  const size = { width: 300, height: 100, pad: 10 };

  it('returns null when there is no weight to draw', () => {
    const trend = buildTrend([], '2026-10-05', '2026-10-08');
    expect(trendLayout(trend, size)).toBeNull();
  });

  it('places each day on the x axis and each weight on the y axis, lowest at the bottom', () => {
    const entries = [
      { log_date: '2026-10-01', kg: 70 },
      { log_date: '2026-10-03', kg: 72 },
    ];
    const trend = buildTrend(entries, '2026-10-01', '2026-10-03');
    const layout = trendLayout(trend, size);
    // Three days: x at 10, 150 and 290.
    expect(layout.dots).toEqual([
      { key: '2026-10-01', x: 10, y: 90, kg: 70 },
      { key: '2026-10-03', x: 290, y: 10, kg: 72 },
    ]);
    expect(layout.low).toBe(70);
    expect(layout.high).toBe(72);
  });

  it('draws the 7-day average as a path that starts a new run after a gap', () => {
    const entries = [
      { log_date: '2026-10-01', kg: 70 },
      { log_date: '2026-10-02', kg: 70 },
      { log_date: '2026-10-10', kg: 72 },
    ];
    const trend = buildTrend(entries, '2026-10-01', '2026-10-10');
    const layout = trendLayout(trend, { width: 290, height: 100, pad: 10 });
    // Averages run from the 1st to the 8th, then stop on the 9th (no weight in its seven
    // days), and start again on the 10th: two runs, so two moves.
    const moves = layout.averagePath.match(/M/g) || [];
    expect(moves).toHaveLength(2);
    expect(layout.averagePath.startsWith('M')).toBe(true);
  });

  it('keeps a flat weight in the middle of the chart, not on an edge', () => {
    const entries = [
      { log_date: '2026-10-01', kg: 70 },
      { log_date: '2026-10-02', kg: 70 },
    ];
    const trend = buildTrend(entries, '2026-10-01', '2026-10-02');
    const layout = trendLayout(trend, { width: 300, height: 100, pad: 10 });
    expect(layout.dots.map((dot) => dot.y)).toEqual([50, 50]);
  });
});
