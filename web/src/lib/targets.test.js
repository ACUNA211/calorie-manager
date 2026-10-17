import { describe, it, expect, vi } from 'vitest';
import {
  bandCalories,
  emptyForm,
  loadTargets,
  parseWhole,
  resolveMemberId,
  rowToForm,
  saveTargets,
  validateTargets,
} from './targets.js';

const filled = (overrides = {}) => ({
  ...emptyForm(),
  calorieTarget: '2000',
  proteinFloor: '120',
  carbLow: '150',
  carbHigh: '220',
  fatLow: '50',
  fatHigh: '80',
  ...overrides,
});

describe('parseWhole', () => {
  it('reads an empty field as cleared', () => {
    expect(parseWhole('')).toEqual({ ok: true, value: null });
    expect(parseWhole('   ')).toEqual({ ok: true, value: null });
  });

  it('reads whole numbers, with or without spaces', () => {
    expect(parseWhole(' 1800 ')).toEqual({ ok: true, value: 1800 });
    expect(parseWhole('-5')).toEqual({ ok: true, value: -5 });
  });

  it('refuses decimals and separators', () => {
    expect(parseWhole('1.5')).toEqual({ ok: false, error: 'targets.errors.whole' });
    expect(parseWhole('2,000')).toEqual({ ok: false, error: 'targets.errors.whole' });
    expect(parseWhole('abc')).toEqual({ ok: false, error: 'targets.errors.whole' });
  });
});

describe('validateTargets', () => {
  it('accepts a full set of Targets and returns the columns to save', () => {
    const result = validateTargets(filled());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({
      calorie_target: 2000,
      protein_floor_g: 120,
      carb_low_g: 150,
      carb_high_g: 220,
      fat_low_g: 50,
      fat_high_g: 80,
      band_low_pct: 90,
      band_high_pct: 100,
    });
  });

  it('accepts empty carbs and fat, and an empty Calorie Target, as cleared', () => {
    const result = validateTargets(
      filled({ carbLow: '', carbHigh: '', fatLow: '', fatHigh: '', calorieTarget: '' })
    );
    expect(result.ok).toBe(true);
    expect(result.values.carb_low_g).toBeNull();
    expect(result.values.carb_high_g).toBeNull();
    expect(result.values.fat_low_g).toBeNull();
    expect(result.values.fat_high_g).toBeNull();
    expect(result.values.calorie_target).toBeNull();
  });

  it('refuses a Calorie Target of zero', () => {
    const result = validateTargets(filled({ calorieTarget: '0' }));
    expect(result.ok).toBe(false);
    expect(result.errors.calorieTarget).toBe('targets.errors.calorieTargetPositive');
  });

  it('refuses negative grams', () => {
    const result = validateTargets(filled({ proteinFloor: '-10', carbLow: '-1', carbHigh: '5' }));
    expect(result.errors.proteinFloor).toBe('targets.errors.notNegative');
    expect(result.errors.carbLow).toBe('targets.errors.notNegative');
  });

  it('refuses decimals in grams', () => {
    const result = validateTargets(filled({ proteinFloor: '12.5' }));
    expect(result.errors.proteinFloor).toBe('targets.errors.whole');
  });

  it('refuses a carb or fat range whose low end is above the high end', () => {
    const result = validateTargets(filled({ carbLow: '220', carbHigh: '150' }));
    expect(result.errors.carbHigh).toBe('targets.errors.rangeOrder');
    const fat = validateTargets(filled({ fatLow: '90', fatHigh: '80' }));
    expect(fat.errors.fatHigh).toBe('targets.errors.rangeOrder');
  });

  it('refuses a range with only one end filled', () => {
    const result = validateTargets(filled({ fatHigh: '' }));
    expect(result.errors.fatHigh).toBe('targets.errors.rangeIncomplete');
  });

  it('refuses a band outside 50 to 100 percent', () => {
    expect(validateTargets(filled({ bandLow: '40' })).errors.bandLow).toBe(
      'targets.errors.bandRange'
    );
    expect(validateTargets(filled({ bandHigh: '101' })).errors.bandHigh).toBe(
      'targets.errors.bandRange'
    );
    expect(validateTargets(filled({ bandLow: '' })).errors.bandLow).toBe(
      'targets.errors.bandRange'
    );
  });

  it('refuses a band whose low end is above its high end', () => {
    const result = validateTargets(filled({ bandLow: '100', bandHigh: '90' }));
    expect(result.ok).toBe(false);
    expect(result.errors.bandHigh).toBe('targets.errors.bandOrder');
  });

  it('refuses numbers too large for the database', () => {
    const result = validateTargets(filled({ proteinFloor: '999999999' }));
    expect(result.errors.proteinFloor).toBe('targets.errors.tooLarge');
  });
});

describe('bandCalories', () => {
  it('turns the band percentages into calories of the Calorie Target', () => {
    expect(bandCalories(2000, 90, 100)).toEqual({ low: 1800, high: 2000 });
    expect(bandCalories(1650, 90, 100)).toEqual({ low: 1485, high: 1650 });
  });
});

describe('rowToForm', () => {
  it('uses the default band when there is no row', () => {
    expect(rowToForm(null)).toEqual(emptyForm());
    expect(emptyForm()).toMatchObject({ bandLow: '90', bandHigh: '100' });
  });

  it('turns a stored row into strings, with nulls as empty fields', () => {
    const form = rowToForm({
      calorie_target: 2000,
      protein_floor_g: null,
      carb_low_g: null,
      carb_high_g: null,
      fat_low_g: 50,
      fat_high_g: 80,
      band_low_pct: 90,
      band_high_pct: 100,
    });
    expect(form).toMatchObject({
      calorieTarget: '2000',
      proteinFloor: '',
      carbLow: '',
      fatLow: '50',
      bandHigh: '100',
    });
  });
});

describe('data access', () => {
  it('finds the Member for a signed-in person', async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: 4 }, error: null }));
    const client = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })) };
    await expect(resolveMemberId(client, 'user-1')).resolves.toBe(4);
    expect(client.from).toHaveBeenCalledWith('members');
  });

  it('loads the settings row for a Member', async () => {
    const eq = vi.fn(() => ({
      maybeSingle: async () => ({ data: { calorie_target: 2000 }, error: null }),
    }));
    const client = { from: vi.fn(() => ({ select: () => ({ eq }) })) };
    await expect(loadTargets(client, 4)).resolves.toEqual({ calorie_target: 2000 });
    expect(eq).toHaveBeenCalledWith('member_id', 4);
  });

  it('saves with an upsert keyed by member_id and throws on error', async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const client = { from: vi.fn(() => ({ upsert })) };
    await saveTargets(client, 4, { calorie_target: 1900 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ member_id: 4, calorie_target: 1900 }),
      { onConflict: 'member_id' }
    );

    const failing = { from: vi.fn(() => ({ upsert: async () => ({ error: new Error('x') }) })) };
    await expect(saveTargets(failing, 4, {})).rejects.toThrow('x');
  });
});
