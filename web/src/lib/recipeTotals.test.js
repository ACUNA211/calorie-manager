import { describe, it, expect } from 'vitest';
import {
  MACRO_KEYS,
  gramsPerServing,
  nutrientTotal,
  perServing,
  recipeTotals,
} from './recipeTotals.js';

// A complete food: every value known. Values are per 100 g.
const rice = {
  kcal_per_100g: 130,
  protein_g: 2.7,
  carbs_g: 28,
  fat_g: 0.3,
  fibre_g: 0.4,
  sugars_g: 0.1,
  sodium_mg: 1,
};
const chicken = {
  kcal_per_100g: 165,
  protein_g: 31,
  carbs_g: 0,
  fat_g: 3.6,
  fibre_g: 0,
  sugars_g: 0,
  sodium_mg: 74,
};
// A food where USDA gave no fibre or sodium: those stay null, never 0.
const sauce = {
  kcal_per_100g: 80,
  protein_g: 1,
  carbs_g: 10,
  fat_g: 4,
  fibre_g: null,
  sugars_g: 6,
  sodium_mg: null,
};

const close = (actual, expected) => expect(actual).toBeCloseTo(expected, 6);

describe('nutrientTotal', () => {
  it('is 0 for an empty ingredient list', () => {
    expect(nutrientTotal([], 'kcal_per_100g')).toBe(0);
  });

  it('scales each food by its grams over 100', () => {
    const ingredients = [
      { grams: 200, food: rice },
      { grams: 150, food: chicken },
    ];
    close(nutrientTotal(ingredients, 'kcal_per_100g'), 200 * 1.3 + 150 * 1.65);
  });

  it('is null when any food is missing the value', () => {
    const ingredients = [
      { grams: 100, food: rice },
      { grams: 100, food: sauce },
    ];
    expect(nutrientTotal(ingredients, 'fibre_g')).toBeNull();
  });

  it('counts a known zero as a value, not as missing', () => {
    const ingredients = [{ grams: 100, food: chicken }];
    expect(nutrientTotal(ingredients, 'carbs_g')).toBe(0);
  });

  it('is null when the food itself is absent', () => {
    expect(nutrientTotal([{ grams: 100, food: null }], 'kcal_per_100g')).toBeNull();
  });
});

describe('perServing', () => {
  it('divides a total by the servings', () => {
    expect(perServing(1000, 4)).toBe(250);
  });

  it('is null for a total that is unknown', () => {
    expect(perServing(null, 4)).toBeNull();
  });

  it('is null for servings that are zero, negative or missing', () => {
    expect(perServing(1000, 0)).toBeNull();
    expect(perServing(1000, -2)).toBeNull();
    expect(perServing(1000, null)).toBeNull();
    expect(perServing(1000, undefined)).toBeNull();
  });

  it('accepts fractional servings', () => {
    expect(perServing(500, 2.5)).toBe(200);
  });
});

describe('gramsPerServing', () => {
  it('shares the cooked weight across the servings', () => {
    expect(gramsPerServing(1200, 4)).toBe(300);
  });

  it('is null when no cooked weight is given', () => {
    expect(gramsPerServing(null, 4)).toBeNull();
    expect(gramsPerServing(undefined, 4)).toBeNull();
  });

  it('is null for a cooked weight that is zero or negative', () => {
    expect(gramsPerServing(0, 4)).toBeNull();
    expect(gramsPerServing(-100, 4)).toBeNull();
  });

  it('is null when the servings are not positive', () => {
    expect(gramsPerServing(1200, 0)).toBeNull();
    expect(gramsPerServing(1200, null)).toBeNull();
  });
});

describe('recipeTotals', () => {
  it('lists the macros it knows about', () => {
    expect(MACRO_KEYS).toEqual(['protein', 'carbs', 'fat', 'fibre', 'sugars', 'sodium']);
  });

  it('totals a Recipe with no ingredients to 0, with nothing unknown', () => {
    const result = recipeTotals({ servings: 2, ingredients: [] });
    expect(result.totalGrams).toBe(0);
    expect(result.kcal).toEqual({ total: 0, perServing: 0 });
    for (const key of MACRO_KEYS) {
      expect(result.macros[key]).toEqual({ total: 0, perServing: 0 });
    }
  });

  it('gives calories per serving from the ingredients', () => {
    const result = recipeTotals({
      servings: 4,
      ingredients: [
        { grams: 200, food: rice }, // 260 kcal
        { grams: 150, food: chicken }, // 247.5 kcal
      ],
    });
    expect(result.totalGrams).toBe(350);
    close(result.kcal.total, 507.5);
    close(result.kcal.perServing, 126.875);
  });

  it('gives each macro total and per serving', () => {
    const result = recipeTotals({
      servings: 2,
      ingredients: [
        { grams: 100, food: rice },
        { grams: 100, food: chicken },
      ],
    });
    close(result.macros.protein.total, 2.7 + 31);
    close(result.macros.protein.perServing, (2.7 + 31) / 2);
    close(result.macros.carbs.total, 28);
    close(result.macros.fat.perServing, (0.3 + 3.6) / 2);
    close(result.macros.sodium.total, 1 + 74);
  });

  it('keeps a macro unknown (null) when one ingredient lacks it, and still totals the rest', () => {
    const result = recipeTotals({
      servings: 2,
      ingredients: [
        { grams: 100, food: rice },
        { grams: 100, food: sauce },
      ],
    });
    expect(result.macros.fibre).toBeNull();
    expect(result.macros.sodium).toBeNull();
    close(result.macros.protein.total, 2.7 + 1);
    close(result.kcal.total, 130 + 80);
  });

  it('leaves the per-serving value null when servings are not positive', () => {
    const result = recipeTotals({
      servings: 0,
      ingredients: [{ grams: 100, food: rice }],
    });
    expect(result.kcal.total).toBe(130);
    expect(result.kcal.perServing).toBeNull();
    expect(result.macros.carbs.perServing).toBeNull();
  });

  it('does not change its input', () => {
    const recipe = { servings: 2, ingredients: [{ grams: 100, food: rice }] };
    const copy = JSON.parse(JSON.stringify(recipe));
    recipeTotals(recipe);
    expect(recipe).toEqual(copy);
  });
});
