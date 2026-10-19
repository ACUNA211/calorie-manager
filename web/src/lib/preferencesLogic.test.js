import { describe, it, expect } from 'vitest';
import {
  DIET_RULES,
  FOOD_GROUPS,
  emptyHouseholdForm,
  emptyMemberForm,
  householdRowToForm,
  memberRowToForm,
  parseList,
  parseMinutes,
  validateHousehold,
  validateMember,
} from './preferencesLogic.js';

describe('fixed lists', () => {
  it('offers the diet rules and food groups from the fixed lists', () => {
    expect(DIET_RULES).toEqual([
      'vegetarian',
      'vegan',
      'pescatarian',
      'halal',
      'kosher',
      'gluten_free',
      'dairy_free',
    ]);
    expect(FOOD_GROUPS).toContain('shellfish');
    expect(new Set(FOOD_GROUPS).size).toBe(FOOD_GROUPS.length);
  });
});

describe('parseList', () => {
  it('trims, splits on commas and new lines, and drops blanks and repeats', () => {
    expect(parseList(' thai ,Italian\n\nTHAI;  Sri   Lankan ')).toEqual([
      'thai',
      'Italian',
      'Sri Lankan',
    ]);
    expect(parseList('')).toEqual([]);
    expect(parseList(null)).toEqual([]);
  });
});

describe('parseMinutes', () => {
  it('reads whole minutes and treats empty as not set', () => {
    expect(parseMinutes('')).toEqual({ ok: true, value: null });
    expect(parseMinutes(' 30 ')).toEqual({ ok: true, value: 30 });
  });
  it('refuses decimals, text and out-of-range times', () => {
    expect(parseMinutes('1.5').error).toBe('preferences.errors.minutesWhole');
    expect(parseMinutes('abc').error).toBe('preferences.errors.minutesWhole');
    expect(parseMinutes('4').error).toBe('preferences.errors.minutesRange');
    expect(parseMinutes('481').error).toBe('preferences.errors.minutesRange');
  });
});

describe('validateHousehold', () => {
  it('turns a filled form into columns', () => {
    const form = {
      ...emptyHouseholdForm(),
      cuisines: 'Italian, Thai',
      weeknightMinutes: '30',
      weekendMinutes: '90',
      equipment: ['oven', 'air_fryer', 'toaster'],
      repeatFrequency: 'sometimes',
      leftoversTolerance: 'plenty',
      budgetFeel: 'tight',
    };
    const result = validateHousehold(form);
    expect(result.ok).toBe(true);
    expect(result.values).toEqual({
      cuisines: ['Italian', 'Thai'],
      weeknight_minutes: 30,
      weekend_minutes: 90,
      equipment: ['oven', 'air_fryer'],
      repeat_frequency: 'sometimes',
      leftovers_tolerance: 'plenty',
      budget_feel: 'tight',
    });
  });

  it('saves an empty form as nulls and empty lists', () => {
    const result = validateHousehold(emptyHouseholdForm());
    expect(result.ok).toBe(true);
    expect(result.values).toMatchObject({
      cuisines: [],
      weeknight_minutes: null,
      repeat_frequency: null,
      budget_feel: null,
    });
  });

  it('reports a bad time and an over-long cuisine', () => {
    const result = validateHousehold({
      ...emptyHouseholdForm(),
      weeknightMinutes: 'soon',
      cuisines: 'x'.repeat(61),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.weeknightMinutes).toBe('preferences.errors.minutesWhole');
    expect(result.errors.cuisines).toBe('preferences.errors.itemTooLong');
  });

  it('ignores a value outside the allowed choices', () => {
    const result = validateHousehold({ ...emptyHouseholdForm(), budgetFeel: 'lavish' });
    expect(result.values.budget_feel).toBeNull();
  });

  it('round-trips a stored row', () => {
    const row = {
      cuisines: ['thai'],
      weeknight_minutes: 25,
      weekend_minutes: null,
      equipment: ['oven'],
      repeat_frequency: 'often',
      leftovers_tolerance: 'none',
      budget_feel: 'relaxed',
    };
    const form = householdRowToForm(row);
    expect(form.weeknightMinutes).toBe('25');
    expect(form.weekendMinutes).toBe('');
    expect(validateHousehold(form).values).toMatchObject({
      cuisines: ['thai'],
      weeknight_minutes: 25,
      budget_feel: 'relaxed',
    });
    expect(householdRowToForm(null)).toEqual(emptyHouseholdForm());
  });
});

describe('validateMember', () => {
  it('keeps Hard rules from the fixed lists and drops anything else', () => {
    const result = validateMember({
      ...emptyMemberForm(),
      favourites: 'tacos',
      dislikes: 'olives, beets',
      hardFoods: 'cilantro',
      hardFoodGroups: ['shellfish', 'kryptonite'],
      hardDiets: ['halal', 'keto'],
    });
    expect(result.ok).toBe(true);
    expect(result.values).toEqual({
      favourites: ['tacos'],
      dislikes: ['olives', 'beets'],
      hard_foods: ['cilantro'],
      hard_food_groups: ['shellfish'],
      hard_diets: ['halal'],
    });
  });

  it('refuses more than 50 items in a list', () => {
    const many = Array.from({ length: 51 }, (_, i) => `food${i}`).join(',');
    const result = validateMember({ ...emptyMemberForm(), hardFoods: many });
    expect(result.ok).toBe(false);
    expect(result.errors.hardFoods).toBe('preferences.errors.tooManyItems');
  });

  it('round-trips a stored row and starts empty without one', () => {
    const form = memberRowToForm({
      favourites: ['a'],
      dislikes: [],
      hard_foods: ['x', 'y'],
      hard_food_groups: ['soy'],
      hard_diets: ['vegan', 'nope'],
    });
    expect(form.hardFoods).toBe('x, y');
    expect(form.hardDiets).toEqual(['vegan']);
    expect(memberRowToForm(null)).toEqual(emptyMemberForm());
  });
});
