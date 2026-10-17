import { describe, it, expect } from 'vitest';
import {
  PANTRY_MAX_GRAMS,
  addAmounts,
  applyCorrection,
  groupBySection,
  normalizeSection,
  parseGrams,
  roundGrams,
  validateAddAmount,
  visibleItems,
} from './pantryLogic.js';

const item = (id, name, grams, storeSection = 'Other') => ({ id, name, grams, storeSection });

describe('parseGrams', () => {
  it('reads whole and one-decimal amounts', () => {
    expect(parseGrams('150')).toEqual({ ok: true, value: 150 });
    expect(parseGrams(' 62.5 ')).toEqual({ ok: true, value: 62.5 });
    expect(parseGrams('0')).toEqual({ ok: true, value: 0 });
  });

  it('accepts a comma as the decimal mark', () => {
    expect(parseGrams('62,5')).toEqual({ ok: true, value: 62.5 });
  });

  it('asks for an amount when the text is empty', () => {
    expect(parseGrams('  ')).toEqual({ ok: false, error: 'pantry.errors.amountRequired' });
  });

  it('refuses text that is not a number of grams', () => {
    for (const text of ['abc', '-5', '1.25', '1.2.3', '12g']) {
      expect(parseGrams(text), text).toEqual({ ok: false, error: 'pantry.errors.amountInvalid' });
    }
  });

  it('refuses more than the Pantry can hold for one food', () => {
    expect(parseGrams('100001')).toEqual({ ok: false, error: 'pantry.errors.amountTooHigh' });
    expect(parseGrams(String(PANTRY_MAX_GRAMS))).toEqual({ ok: true, value: PANTRY_MAX_GRAMS });
  });
});

describe('validateAddAmount', () => {
  it('refuses zero when adding a food', () => {
    expect(validateAddAmount('0')).toEqual({ ok: false, error: 'pantry.errors.amountZero' });
  });

  it('passes a positive amount through', () => {
    expect(validateAddAmount('40')).toEqual({ ok: true, value: 40 });
  });
});

describe('addAmounts', () => {
  it('adds the new grams to the amount already held', () => {
    expect(addAmounts(100, 50)).toBe(150);
    expect(addAmounts(0, 20)).toBe(20);
  });

  it('keeps one decimal place', () => {
    expect(addAmounts(0.1, 0.2)).toBe(0.3);
  });

  it('never goes above the largest amount', () => {
    expect(addAmounts(99999, 5000)).toBe(PANTRY_MAX_GRAMS);
  });
});

describe('applyCorrection', () => {
  it('used up sets the amount to zero', () => {
    expect(applyCorrection(150, 'used_up')).toBe(0);
  });

  it('about half halves the amount', () => {
    expect(applyCorrection(150, 'half')).toBe(75);
    expect(applyCorrection(33, 'half')).toBe(16.5);
  });

  it('a typed amount replaces the amount', () => {
    expect(applyCorrection(150, 'set', 33.3)).toBe(33.3);
    expect(applyCorrection(150, 'set', 0)).toBe(0);
  });

  it('refuses an action it does not know', () => {
    expect(() => applyCorrection(10, 'nonsense')).toThrow('Unknown Pantry correction');
  });
});

describe('roundGrams', () => {
  it('rounds to one decimal place', () => {
    expect(roundGrams(16.04)).toBe(16);
    expect(roundGrams(16.06)).toBe(16.1);
  });
});

describe('visibleItems', () => {
  it('hides a used-up item (zero)', () => {
    const items = [item(1, 'Rice', 0), item(2, 'Oats', 40)];
    expect(visibleItems(items).map((row) => row.name)).toEqual(['Oats']);
  });
});

describe('normalizeSection', () => {
  it('keeps a known section and moves an unknown one to Other', () => {
    expect(normalizeSection('Produce')).toBe('Produce');
    expect(normalizeSection('Garden')).toBe('Other');
    expect(normalizeSection(null)).toBe('Other');
  });
});

describe('groupBySection', () => {
  it('orders sections the way a shopper walks the store', () => {
    const groups = groupBySection([
      item(1, 'Milk', 500, 'Dairy & eggs'),
      item(2, 'Carrot', 200, 'Produce'),
      item(3, 'Mystery', 10, 'Garden'),
      item(4, 'Beans', 300, 'Canned & dry goods'),
    ]);
    expect(groups.map((group) => group.section)).toEqual([
      'Produce',
      'Dairy & eggs',
      'Canned & dry goods',
      'Other',
    ]);
    expect(groups.map((group) => group.key)).toEqual([
      'produce',
      'dairyEggs',
      'cannedDry',
      'other',
    ]);
  });

  it('sorts the items in a section by name and leaves out used-up items', () => {
    const groups = groupBySection([
      item(1, 'Tomato', 100, 'Produce'),
      item(2, 'Apple', 300, 'Produce'),
      item(3, 'Banana', 0, 'Produce'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((row) => row.name)).toEqual(['Apple', 'Tomato']);
  });

  it('returns no groups when nothing is left in the Pantry', () => {
    expect(groupBySection([item(1, 'Rice', 0, 'Pantry')])).toEqual([]);
  });
});
