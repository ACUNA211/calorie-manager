import { describe, expect, it } from 'vitest';
import {
  GRAMS_PER_OUNCE,
  GRAMS_PER_POUND,
  basisGrams,
  basisLabel,
  formatMacro,
  formatMass,
  formatWeight,
  gramsToOunces,
  gramsToPounds,
  kgToLb,
  lbToKg,
  massUnitName,
  normalizeUnits,
  ouncesToGrams,
  parseMass,
  parseMassKeeping,
  perBasis,
  poundsToGrams,
  roundGramsToTenth,
  toInputMass,
  toInputWeight,
  weightUnitName,
} from './units.js';

describe('conversions', () => {
  it('converts grams to ounces and pounds and back', () => {
    expect(gramsToOunces(GRAMS_PER_OUNCE)).toBeCloseTo(1, 10);
    expect(ouncesToGrams(gramsToOunces(250))).toBeCloseTo(250, 6);
    expect(gramsToPounds(GRAMS_PER_POUND)).toBeCloseTo(1, 10);
    expect(poundsToGrams(gramsToPounds(1234.5))).toBeCloseTo(1234.5, 6);
  });

  it('converts kilograms and pounds both ways', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(220.462)).toBeCloseTo(100, 2);
  });

  it('rounds stored grams to one decimal', () => {
    expect(roundGramsToTenth(155.94)).toBe(155.9);
    expect(roundGramsToTenth(1.25)).toBe(1.3);
    expect(roundGramsToTenth(0.04)).toBe(0);
  });
});

describe('normalizeUnits and unit names', () => {
  it('reads metric as metric and anything else as US', () => {
    expect(normalizeUnits('metric')).toBe('metric');
    expect(normalizeUnits('us')).toBe('us');
    expect(normalizeUnits(undefined)).toBe('us');
    expect(normalizeUnits(null)).toBe('us');
    expect(normalizeUnits('imperial')).toBe('us');
  });

  it('names the units for labels', () => {
    expect(massUnitName('metric')).toBe('g');
    expect(massUnitName('us')).toBe('oz');
    expect(weightUnitName('metric')).toBe('kg');
    expect(weightUnitName('us')).toBe('lb');
  });

  it('uses per 100 g in metric and per 1 oz in US', () => {
    expect(basisGrams('metric')).toBe(100);
    expect(basisGrams('us')).toBe(GRAMS_PER_OUNCE);
    expect(basisLabel('metric')).toBe('100 g');
    expect(basisLabel('us')).toBe('1 oz');
  });
});

describe('formatMass', () => {
  it('shows metric grams up to 1 kg, then kilograms', () => {
    expect(formatMass(150, 'metric')).toBe('150 g');
    expect(formatMass(4.5, 'metric')).toBe('4.5 g');
    expect(formatMass(1500, 'metric')).toBe('1.5 kg');
  });

  it('shows US ounces up to 1 lb, then pounds', () => {
    expect(formatMass(150, 'us')).toBe('5.3 oz');
    expect(formatMass(GRAMS_PER_POUND, 'us')).toBe('1 lb');
    expect(formatMass(1000, 'us')).toBe('2.2 lb');
  });

  it('keeps two decimals for small US amounts so a macro never reads 0 oz', () => {
    expect(formatMass(1.2, 'us')).toBe('0.04 oz');
    expect(formatMass(0, 'us')).toBe('0 oz');
  });

  it('defaults to US', () => {
    expect(formatMass(28.349523125)).toBe('1 oz');
  });

  it('uses the locale for the decimal mark', () => {
    expect(formatMass(4.5, 'metric', 'es')).toBe('4,5 g');
  });
});

describe('formatMacro', () => {
  it('is always grams, so a US macro never turns into ounces', () => {
    expect(formatMacro(1.2)).toBe('1.2 g');
    expect(formatMacro(150)).toBe('150 g');
    expect(formatMacro(0)).toBe('0 g');
    expect(formatMacro(1500)).toBe('1,500 g');
  });

  it('uses the locale for the decimal mark', () => {
    expect(formatMacro(4.5, 'es')).toBe('4,5 g');
  });

  it('leaves food amounts to formatMass, which still follows the units', () => {
    expect(formatMass(150, 'us')).toBe('5.3 oz');
    expect(formatMacro(150)).toBe('150 g');
  });
});

describe('formatWeight', () => {
  it('shows kilograms in metric', () => {
    expect(formatWeight(72.5, 'metric')).toBe('72.5 kg');
  });

  it('shows pounds in US, to one decimal', () => {
    expect(formatWeight(72.5, 'us')).toBe('159.8 lb');
  });
});

describe('input text', () => {
  it('prefills a field in the display unit, without the unit name', () => {
    expect(toInputMass(150, 'metric')).toBe('150');
    expect(toInputMass(150, 'us')).toBe('5.29');
    expect(toInputMass(62.5, 'metric')).toBe('62.5');
    expect(toInputMass(null, 'us')).toBe('');
    expect(toInputMass(1, 'us')).toBe('0.04');
    expect(toInputMass('', 'us')).toBe('');
  });

  it('prefills a weight in kg or lb', () => {
    expect(toInputWeight(72.5, 'metric')).toBe('72.5');
    expect(toInputWeight(72.5, 'us')).toBe('159.8');
    expect(toInputWeight(null, 'us')).toBe('');
  });
});

describe('parseMass', () => {
  it('reads a bare number in the Member units (oz in US, g in metric)', () => {
    expect(parseMass('5.5', 'us')).toEqual({ ok: true, grams: 155.9 });
    expect(parseMass('150', 'metric')).toEqual({ ok: true, grams: 150 });
  });

  it('reads a comma as the decimal mark', () => {
    expect(parseMass('5,5', 'us')).toEqual({ ok: true, grams: 155.9 });
    expect(parseMass('62,5', 'metric')).toEqual({ ok: true, grams: 62.5 });
  });

  it('stores the right grams for a US amount', () => {
    expect(parseMass('1', 'us')).toEqual({ ok: true, grams: 28.3 });
    expect(parseMass('4', 'us')).toEqual({ ok: true, grams: 113.4 });
    expect(parseMass('1 lb', 'us')).toEqual({ ok: true, grams: 453.6 });
    expect(parseMass('2 lbs', 'us')).toEqual({ ok: true, grams: 907.2 });
  });

  it('reads an explicit unit name over the Member units', () => {
    expect(parseMass('0.5kg', 'us')).toEqual({ ok: true, grams: 500 });
    expect(parseMass('200 g', 'us')).toEqual({ ok: true, grams: 200 });
    expect(parseMass('2 oz', 'metric')).toEqual({ ok: true, grams: 56.7 });
    expect(parseMass('3 ounces', 'metric')).toEqual({ ok: true, grams: 85 });
    expect(parseMass('1 pound', 'metric')).toEqual({ ok: true, grams: 453.6 });
    expect(parseMass('1 kilogram', 'us')).toEqual({ ok: true, grams: 1000 });
  });

  it('rounds to one decimal of a gram', () => {
    expect(parseMass('1.25', 'metric')).toEqual({ ok: true, grams: 1.3 });
  });

  it('refuses zero, negative, blank, text and unknown units', () => {
    for (const text of ['', '   ', '0', '0.0', '-3', 'abc', '5 cups', '1 lb 4 oz', '1,2,3']) {
      expect(parseMass(text, 'us'), JSON.stringify(text)).toEqual({
        ok: false,
        error: 'units.errors.mass',
      });
    }
  });

  it('refuses a null or missing amount', () => {
    expect(parseMass(null, 'us')).toEqual({ ok: false, error: 'units.errors.mass' });
    expect(parseMass(undefined, 'metric')).toEqual({ ok: false, error: 'units.errors.mass' });
  });
});

describe('round trips', () => {
  it('a US amount shown and typed back stays within a gram and a half', () => {
    for (const grams of [1, 28.3, 113.4, 150.2, 999.9]) {
      const shown = toInputMass(grams, 'us');
      const back = parseMass(shown, 'us').grams;
      expect(Math.abs(back - grams), `${grams} g shown as ${shown}`).toBeLessThanOrEqual(1.5);
    }
  });

  it('a metric amount shown and typed back is exact', () => {
    for (const grams of [1, 62.5, 150, 999.9]) {
      expect(parseMass(toInputMass(grams, 'metric'), 'metric').grams).toBe(grams);
    }
  });
});

describe('parseMassKeeping', () => {
  it('keeps the stored grams when the text is still as shown', () => {
    expect(parseMassKeeping(toInputMass(155.9, 'us'), 'us', 155.9)).toEqual({
      ok: true,
      grams: 155.9,
    });
  });

  it('parses new text when the Member changed it', () => {
    expect(parseMassKeeping('6', 'us', 155.9)).toEqual({ ok: true, grams: 170.1 });
  });

  it('parses the text when nothing is stored', () => {
    expect(parseMassKeeping('5.3', 'us', null)).toEqual({ ok: true, grams: 150.3 });
    expect(parseMassKeeping('5.3', 'us', undefined)).toEqual({ ok: true, grams: 150.3 });
  });

  it('refuses bad text even with grams stored', () => {
    expect(parseMassKeeping('x', 'us', 150)).toEqual({ ok: false, error: 'units.errors.mass' });
  });
});

describe('perBasis', () => {
  it('leaves a per-100 g figure alone in metric', () => {
    expect(perBasis(165, 'metric')).toBe(165);
  });

  it('scales a per-100 g figure to per 1 oz in US', () => {
    expect(perBasis(165, 'us')).toBeCloseTo(46.78, 2);
  });

  it('keeps null as null', () => {
    expect(perBasis(null, 'us')).toBeNull();
    expect(perBasis(undefined, 'metric')).toBeNull();
  });
});
