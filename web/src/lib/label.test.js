import { describe, it, expect, vi } from 'vitest';
import {
  energyCheck,
  energyFromMacros,
  labelFoodPayload,
  parseAmount,
  parseLabelForm,
  saveLabelFood,
  toPer100g,
} from './label.js';

// One label per serving (250 g). Its macros add up to 4·15 + 4·1 + 9·3 = 91 kcal, and the
// calories printed are 92, within the tolerance.
const SERVING = {
  name: 'Oat drink',
  brand: 'Oatly',
  servingGrams: '250',
  kcal: '92',
  protein: '1',
  carbs: '15',
  fat: '3',
  fibre: '',
  sugars: '7',
  sodium: '',
};

describe('toPer100g', () => {
  it('scales a per-serving value to 100 g', () => {
    expect(toPer100g(115, 250)).toBe(46);
    expect(toPer100g(30, 40)).toBe(75);
  });

  it('keeps one decimal place', () => {
    expect(toPer100g(1, 30)).toBe(3.3);
    expect(toPer100g(0, 30)).toBe(0);
  });
});

describe('energy check', () => {
  it('adds up 4 per gram of carbs and protein, 9 per gram of fat', () => {
    expect(energyFromMacros({ protein: 1, carbs: 15, fat: 3 })).toBe(4 + 60 + 27);
  });

  it('allows 20 % or 10 kcal, whichever is larger', () => {
    const small = energyCheck({ kcal: 20, protein: 0, carbs: 4, fat: 0 });
    expect(small.tolerance).toBe(10);
    expect(small.ok).toBe(true);
    const big = energyCheck({ kcal: 100, protein: 0, carbs: 100, fat: 0 });
    expect(big.expected).toBe(400);
    expect(big.tolerance).toBe(80);
    expect(big.ok).toBe(false);
  });

  it('gives no answer when a macro is missing', () => {
    expect(energyCheck({ kcal: 100, protein: null, carbs: 1, fat: 1 })).toBeNull();
  });
});

describe('parseAmount', () => {
  it('reads blanks as null, accepts a comma decimal, and rejects anything else', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('.5')).toBe(0.5);
    expect(Number.isNaN(parseAmount('12g'))).toBe(true);
    expect(Number.isNaN(parseAmount('-1'))).toBe(true);
    expect(Number.isNaN(parseAmount('1.2.3'))).toBe(true);
  });
});

describe('parseLabelForm', () => {
  it('converts the per-serving values to per 100 g', () => {
    const outcome = parseLabelForm(SERVING);
    expect(outcome.ok).toBe(true);
    expect(outcome.food.name).toBe('Oat drink');
    expect(outcome.food.brand).toBe('Oatly');
    expect(outcome.food.servingGrams).toBe(250);
    expect(outcome.food.per100g).toEqual({
      kcal: 36.8,
      protein: 0.4,
      carbs: 6,
      fat: 1.2,
      fibre: null,
      sugars: 2.8,
      sodium: null,
    });
    expect(outcome.food.perServing.kcal).toBe(92);
    expect(outcome.food.energyWarning).toBeNull();
  });

  it('keeps blank optional values as null, never 0', () => {
    const outcome = parseLabelForm({ ...SERVING, sugars: '', fibre: '', sodium: '' });
    expect(outcome.food.per100g.fibre).toBeNull();
    expect(outcome.food.per100g.sugars).toBeNull();
    expect(outcome.food.per100g.sodium).toBeNull();
  });

  it('turns a blank brand into null', () => {
    expect(parseLabelForm({ ...SERVING, brand: '  ' }).food.brand).toBeNull();
  });

  it('asks for the required fields when they are blank', () => {
    const outcome = parseLabelForm({
      ...SERVING,
      name: ' ',
      servingGrams: '',
      kcal: '',
      protein: '',
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toEqual({
      name: 'required',
      servingGrams: 'required',
      kcal: 'required',
      protein: 'required',
    });
  });

  it('refuses text where a number belongs', () => {
    const outcome = parseLabelForm({ ...SERVING, kcal: 'a lot' });
    expect(outcome.errors).toEqual({ kcal: 'number' });
  });

  it('refuses a serving of 0 g and calories outside the range', () => {
    expect(parseLabelForm({ ...SERVING, servingGrams: '0' }).errors).toEqual({
      servingGrams: 'range',
    });
    expect(parseLabelForm({ ...SERVING, kcal: '2500' }).errors).toEqual({ kcal: 'range' });
  });

  it('refuses a nutrient heavier than the serving', () => {
    expect(parseLabelForm({ ...SERVING, servingGrams: '20', fat: '30' }).errors).toEqual({
      fat: 'overServing',
    });
  });

  it('refuses sugars more than carbs', () => {
    expect(parseLabelForm({ ...SERVING, sugars: '20' }).errors).toEqual({
      sugars: 'sugarsOverCarbs',
    });
  });

  it('refuses a name over 200 characters', () => {
    expect(parseLabelForm({ ...SERVING, name: 'x'.repeat(201) }).errors).toEqual({
      name: 'tooLong',
    });
  });

  it('flags calories far from the macros, and keeps the food otherwise valid', () => {
    const outcome = parseLabelForm({ ...SERVING, kcal: '300' });
    expect(outcome.ok).toBe(true);
    expect(outcome.food.energyWarning).toMatchObject({ expected: 91, ok: false });
  });

  it('does not flag calories within the tolerance', () => {
    // 4·15 + 4·1 + 9·3 = 91; 100 kcal is 9 kcal away, inside the 10 kcal floor
    const outcome = parseLabelForm({ ...SERVING, kcal: '100' });
    expect(outcome.food.energyWarning).toBeNull();
  });
});

describe('labelFoodPayload and saveLabelFood', () => {
  const food = parseLabelForm(SERVING).food;

  it('sends the 14-digit barcode and the per 100 g values', () => {
    expect(labelFoodPayload('036000291452', food)).toEqual({
      p_gtin: '00036000291452',
      p_name: 'Oat drink',
      p_brand: 'Oatly',
      p_serving_grams: 250,
      p_kcal_per_100g: 36.8,
      p_protein_g: 0.4,
      p_carbs_g: 6,
      p_fat_g: 1.2,
      p_fibre_g: null,
      p_sugars_g: 2.8,
      p_sodium_mg: null,
    });
  });

  it('calls save_label_food and returns the new id', async () => {
    const client = { rpc: vi.fn(async () => ({ data: 77, error: null })) };
    await expect(saveLabelFood(client, '036000291452', food)).resolves.toBe(77);
    expect(client.rpc).toHaveBeenCalledWith(
      'save_label_food',
      labelFoodPayload('036000291452', food)
    );
  });

  it('throws without a call when the barcode is not valid', async () => {
    const client = { rpc: vi.fn() };
    await expect(saveLabelFood(client, '036000291453', food)).rejects.toThrow('not valid');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('throws when the call fails', async () => {
    const client = { rpc: vi.fn(async () => ({ data: null, error: new Error('down') })) };
    await expect(saveLabelFood(client, '036000291452', food)).rejects.toThrow('down');
  });
});
