// Display units (ticket #11). Everything is stored in grams (and kilograms for body weight);
// this file is the one place that turns stored values into text and typed text back into
// stored values. Each Member picks 'metric' (g, kg) or 'us' (oz, lb). The default is 'us'.
//
// Liquids: no food in the database is marked as a liquid, so there is no ml, fl oz or cup
// display yet. Every amount is a mass (g, oz, lb). The volume units in pasteRecipe.js are
// only for typed Recipe lines, and they are converted to grams there.
//
// No React here. The hook in useUnits.jsx binds these functions to the Member's setting and
// the current language.

import { formatNumber } from '../i18n/format.js';

export const METRIC = 'metric';
export const US = 'us';
export const DEFAULT_UNITS = US;

export const GRAMS_PER_OUNCE = 28.349523125;
export const GRAMS_PER_POUND = 453.59237;
export const KG_PER_POUND = GRAMS_PER_POUND / 1000;

// Any value that is not 'metric' reads as the default, so a missing or unknown setting is US.
export function normalizeUnits(value) {
  return value === METRIC ? METRIC : US;
}

export function gramsToOunces(grams) {
  return grams / GRAMS_PER_OUNCE;
}

export function ouncesToGrams(ounces) {
  return ounces * GRAMS_PER_OUNCE;
}

export function gramsToPounds(grams) {
  return grams / GRAMS_PER_POUND;
}

export function poundsToGrams(pounds) {
  return pounds * GRAMS_PER_POUND;
}

export function kgToLb(kg) {
  return kg / KG_PER_POUND;
}

export function lbToKg(lb) {
  return lb * KG_PER_POUND;
}

// Stored grams are kept to one decimal (todayLogic, pantryLogic, recipes).
export function roundGramsToTenth(grams) {
  return Math.round(grams * 10) / 10;
}

// ---- Display ---------------------------------------------------------------------------

// A mass with its unit, such as "150 g", "1.25 kg", "5.3 oz" or "2.5 lb". Metric uses g up to
// 1 kg, then kg. US uses oz up to 1 lb, then lb. Digits are rounded for display only.
export function formatMass(grams, units = DEFAULT_UNITS, locale = 'en') {
  const value = Number(grams);
  if (normalizeUnits(units) === METRIC) {
    if (Math.abs(value) >= 1000) {
      return `${formatNumber(value / 1000, locale, { maximumFractionDigits: 2 })} kg`;
    }
    return `${formatNumber(value, locale, { maximumFractionDigits: 1 })} g`;
  }
  if (Math.abs(value) >= GRAMS_PER_POUND) {
    const pounds = gramsToPounds(value);
    return `${formatNumber(pounds, locale, { maximumFractionDigits: 2 })} lb`;
  }
  // Under one ounce keep two decimals, so a 1.2 g macro does not show as "0 oz".
  const ounces = gramsToOunces(value);
  const digits = Math.abs(ounces) < 1 ? 2 : 1;
  return `${formatNumber(ounces, locale, { maximumFractionDigits: digits })} oz`;
}

// A macro (protein, carbs, fat, fibre, sugars) with its unit: always grams, whatever the
// Member's units, since macros are counted in grams everywhere, US labels included (ticket 93).
// Sodium is milligrams and is not formatted here. Food amounts use formatMass instead.
export function formatMacro(grams, locale = 'en') {
  return `${formatNumber(Number(grams), locale, { maximumFractionDigits: 1 })} g`;
}

// Body weight from kilograms, with its unit: "72.5 kg" or "159.8 lb" (one decimal either way).
export function formatWeight(kg, units = DEFAULT_UNITS, locale = 'en') {
  const value = Number(kg);
  if (normalizeUnits(units) === METRIC) {
    return `${formatNumber(value, locale, { maximumFractionDigits: 1 })} kg`;
  }
  return `${formatNumber(kgToLb(value), locale, { maximumFractionDigits: 1 })} lb`;
}

// The unit names alone, for labels and column headings.
export function massUnitName(units = DEFAULT_UNITS) {
  return normalizeUnits(units) === METRIC ? 'g' : 'oz';
}

export function weightUnitName(units = DEFAULT_UNITS) {
  return normalizeUnits(units) === METRIC ? 'kg' : 'lb';
}

// Nutrition is listed per 100 g in metric and per 1 oz in US. The values are scaled, not
// stored differently: a per-100 g figure of 165 kcal is 46.7 kcal per oz.
export function basisGrams(units = DEFAULT_UNITS) {
  return normalizeUnits(units) === METRIC ? 100 : GRAMS_PER_OUNCE;
}

export function basisLabel(units = DEFAULT_UNITS) {
  return normalizeUnits(units) === METRIC ? '100 g' : '1 oz';
}

// A per-100 g figure scaled to the display basis. Null stays null.
export function perBasis(per100g, units = DEFAULT_UNITS) {
  if (per100g === null || per100g === undefined) return null;
  return (Number(per100g) * basisGrams(units)) / 100;
}

// ---- Input -----------------------------------------------------------------------------

// Text for an input field, in the display unit and with no unit name: 150 or 5.3. Used to
// prefill a field from a stored value; typing back goes through parseMass.
// Two decimals in US (an ounce is coarse, and a 1 g amount must not read as "0"), one in metric.
export function toInputMass(grams, units = DEFAULT_UNITS) {
  if (grams === null || grams === undefined || grams === '') return '';
  const value = Number(grams);
  if (normalizeUnits(units) === METRIC) return String(Math.round(value * 10) / 10);
  return String(Math.round(gramsToOunces(value) * 100) / 100);
}

export function toInputWeight(kg, units = DEFAULT_UNITS) {
  if (kg === null || kg === undefined || kg === '') return '';
  const value = Number(kg);
  const shown = normalizeUnits(units) === METRIC ? value : kgToLb(value);
  return String(Math.round(shown * 10) / 10);
}

// Unit suffixes a typed amount may carry, mapped to the unit they name. A bare number is in
// the Member's own unit (oz in US, g in metric).
const MASS_SUFFIX = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
};

const AMOUNT_PATTERN = /^(\d+(?:[.,]\d+)?|[.,]\d+)\s*([a-z]*)$/i;

// Reads a typed amount such as "150", "5.5", "5,5 oz", "2 lb" or "0.5kg". A comma is the
// decimal mark. Returns { ok: true, grams } with grams rounded to one decimal, or
// { ok: false, error } with a translation key. Zero and negative amounts are refused.
export function parseMass(text, units = DEFAULT_UNITS) {
  const trimmed = String(text ?? '').trim();
  const match = AMOUNT_PATTERN.exec(trimmed);
  if (!match) return { ok: false, error: 'units.errors.mass' };
  const suffix = match[2].toLowerCase();
  const unit = suffix === '' ? massUnitName(units) : MASS_SUFFIX[suffix];
  if (!unit) return { ok: false, error: 'units.errors.mass' };
  const value = Number(match[1].replace(',', '.'));
  if (!(value > 0)) return { ok: false, error: 'units.errors.mass' };

  let grams;
  if (unit === 'g') grams = value;
  else if (unit === 'kg') grams = value * 1000;
  else if (unit === 'oz') grams = ouncesToGrams(value);
  else grams = poundsToGrams(value);
  const rounded = roundGramsToTenth(grams);
  if (!(rounded > 0)) return { ok: false, error: 'units.errors.mass' };
  return { ok: true, grams: rounded };
}

// Reads a typed amount for a stored value that is being edited. When the text is still what
// the field showed for the stored grams, the stored grams are kept: oz are rounded for
// display, so parsing the shown oz again would drift the grams by a few tenths. Otherwise the
// text is parsed as parseMass does.
export function parseMassKeeping(text, units = DEFAULT_UNITS, storedGrams = null) {
  if (storedGrams !== null && storedGrams !== undefined && storedGrams !== '') {
    const stored = Number(storedGrams);
    if (stored > 0 && String(text ?? '').trim() === toInputMass(stored, units)) {
      return { ok: true, grams: stored };
    }
  }
  return parseMass(text, units);
}
