import { describe, it, expect } from 'vitest';
import {
  addedDate,
  groupLines,
  lineFromRow,
  shoppingMeasure,
  shortfalls,
  splitList,
} from './shoppingLogic.js';

const line = (id, name, storeSection, addedAt = '2026-10-19T10:00:00Z', extra = {}) => ({
  id,
  name,
  storeSection,
  addedAt,
  purchased: false,
  ...extra,
});

describe('shortfalls', () => {
  it('takes the Pantry off the need', () => {
    expect(shortfalls({ 1: 300 }, { 1: 100 })).toEqual([{ foodId: '1', short: 200, credit: 100 }]);
  });

  it('adds no line when the Pantry covers the need', () => {
    expect(shortfalls({ 1: 400 }, { 1: 1000 })).toEqual([]);
    expect(shortfalls({ 1: 400 }, { 1: 400 })).toEqual([]);
  });

  it('adds a line for a food the Pantry does not hold', () => {
    expect(shortfalls({ 2: 150 }, {})).toEqual([{ foodId: '2', short: 150, credit: 0 }]);
  });

  it('ignores a shortfall of half a gram or less', () => {
    expect(shortfalls({ 1: 100.4 }, { 1: 100 })).toEqual([]);
  });

  it('only adds the extra need once the plan grows', () => {
    // First sync: need 300, Pantry 100, line for 200. Plan grows to 600.
    const state = { 1: { covered: 300, taken: 100, bought: 0 } };
    expect(shortfalls({ 1: 600 }, { 1: 100 }, state)).toEqual([
      { foodId: '1', short: 300, credit: 0 },
    ]);
  });

  it('draws spare Pantry first when the plan grows', () => {
    const state = { 1: { covered: 400, taken: 400, bought: 0 } };
    expect(shortfalls({ 1: 800 }, { 1: 1000 }, state)).toEqual([]);
  });

  it('does not count grams bought for the plan as spare', () => {
    // Bought a 425 g can for the 200 g short; the Pantry now holds 525 g.
    const state = { 1: { covered: 300, taken: 100, bought: 425 } };
    expect(shortfalls({ 1: 600 }, { 1: 525 }, state)).toEqual([
      { foodId: '1', short: 300, credit: 0 },
    ]);
  });

  it('adds nothing when the plan shrinks', () => {
    const state = { 1: { covered: 600, taken: 0, bought: 0 } };
    expect(shortfalls({ 1: 300 }, {}, state)).toEqual([]);
  });
});

describe('shoppingMeasure', () => {
  it('prefers the package weight', () => {
    expect(
      shoppingMeasure({ packageGrams: 1000, servings: [{ label: '1 cup', grams: 185 }] }, 400)
    ).toEqual({
      kind: 'package',
      label: null,
      count: 1,
      grams: 1000,
    });
  });

  it('rounds up to whole packages', () => {
    expect(shoppingMeasure({ packageGrams: 454 }, 1000)).toMatchObject({ count: 3, grams: 1362 });
  });

  it('uses the largest serving, such as a can', () => {
    const food = {
      servings: [
        { label: '1 tbsp', grams: 15 },
        { label: '1 can', grams: 425 },
      ],
    };
    expect(shoppingMeasure(food, 200)).toEqual({
      kind: 'serving',
      label: '1 can',
      count: 1,
      grams: 425,
    });
    expect(shoppingMeasure(food, 900)).toMatchObject({ count: 3, grams: 1275 });
  });

  it('falls back to steps of 50 g', () => {
    expect(shoppingMeasure({ servings: [] }, 150)).toEqual({
      kind: 'weight',
      label: null,
      count: 3,
      grams: 150,
    });
    expect(shoppingMeasure({}, 151)).toMatchObject({ grams: 200 });
  });

  it('ignores servings with no weight', () => {
    expect(shoppingMeasure({ servings: [{ label: 'x', grams: 0 }] }, 10)).toMatchObject({
      kind: 'weight',
      grams: 50,
    });
  });
});

describe('groupLines and splitList', () => {
  it('groups by store section in shopping order', () => {
    const groups = groupLines([
      line(1, 'Beans', 'Canned & dry goods'),
      line(2, 'Apple', 'Produce'),
      line(3, 'Mystery', 'Aisle 9'),
    ]);
    expect(groups.map((g) => g.section)).toEqual(['Produce', 'Canned & dry goods', 'Other']);
    expect(groups[0].key).toBe('produce');
  });

  it('puts the oldest line first, then by name', () => {
    const [group] = groupLines([
      line(1, 'Pear', 'Produce', '2026-10-20T10:00:00Z'),
      line(2, 'Fig', 'Produce', '2026-10-19T10:00:00Z'),
      line(3, 'Apple', 'Produce', '2026-10-19T10:00:00Z'),
    ]);
    expect(group.lines.map((l) => l.name)).toEqual(['Apple', 'Fig', 'Pear']);
  });

  it('moves ticked lines to done', () => {
    const { open, done } = splitList([
      line(1, 'Apple', 'Produce'),
      line(2, 'Fig', 'Produce', undefined, { purchased: true }),
    ]);
    expect(open[0].lines).toHaveLength(1);
    expect(done.map((l) => l.name)).toEqual(['Fig']);
  });
});

describe('lineFromRow and addedDate', () => {
  it('reads a row', () => {
    const l = lineFromRow({
      id: 5,
      item_name: 'Beans',
      purchased: false,
      source: 'plan',
      grams: '425',
      store_section: 'Canned & dry goods',
      measure_kind: 'serving',
      measure_label: '1 can',
      measure_count: 1,
      created_at: '2026-10-19T10:00:00Z',
    });
    expect(l).toMatchObject({
      id: 5,
      name: 'Beans',
      grams: 425,
      measureKind: 'serving',
      measureCount: 1,
    });
    expect(addedDate(l).toISOString()).toBe('2026-10-19T10:00:00.000Z');
  });

  it('copes with a hand-added row', () => {
    const l = lineFromRow({ id: 6, item_name: 'Foil', created_at: null });
    expect(l).toMatchObject({
      source: 'hand',
      grams: null,
      storeSection: 'Other',
      measureKind: null,
    });
    expect(addedDate(l)).toBeNull();
  });
});
