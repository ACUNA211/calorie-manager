// Pure rules for the weight log and its 12-week trend: reading a typed weight, the kg and lb
// conversion, the 7-day moving average and the chart geometry for the trend line. No React and
// no Supabase here. Weight is stored in kilograms to one decimal (migration 030).
//
// Display units (ticket #11): the stored kilograms are shown in kg or lb by the Member's
// setting, through units.js and useUnits(). The kg and lb conversions below use units.js.

import { addDays, isDateKey, isFutureDay } from './todayLogic.js';
import { weekEndKey } from './weekLogic.js';
import * as unitsLib from './units.js';

export const MIN_KG = 20;
export const MAX_KG = 400;
export const TREND_WEEKS = 12;
export const AVERAGE_DAYS = 7;
export const KG_PER_LB = unitsLib.KG_PER_POUND;

const oneDecimal = (value) => Math.round(value * 10) / 10;

// The stored value: kilograms to one decimal place.
export function roundKg(kg) {
  return oneDecimal(kg);
}

export function kgToLb(kg) {
  return unitsLib.kgToLb(kg);
}

export function lbToKg(lb) {
  return roundKg(unitsLib.lbToKg(lb));
}

// Reads a weight typed in kilograms (units 'metric', the default) or pounds ('us'), such as
// "72.5" or "72,5". Whole numbers are fine, one decimal at most. Returns { ok, value } with the
// value in kg, or { ok: false, error } where error is a translation key.
export function parseWeight(text, units = 'metric') {
  const trimmed = String(text ?? '')
    .trim()
    .replace(',', '.');
  if (!/^\d{1,3}(\.\d)?$/.test(trimmed)) return { ok: false, error: 'weight.errors.number' };
  const typed = Number(trimmed);
  const kg = unitsLib.normalizeUnits(units) === unitsLib.US ? lbToKg(typed) : typed;
  if (kg < MIN_KG || kg > MAX_KG) return { ok: false, error: 'weight.errors.range' };
  return { ok: true, value: roundKg(kg) };
}

// Checks one weight entry before it is saved. A weight can be logged for today or an earlier
// day, never a future one. Returns { ok, values } with the columns to save, or { ok: false,
// field, error } where error is a translation key.
export function checkWeightEntry({ date, weight, todayKey, units = 'metric' }) {
  if (!isDateKey(date)) return { ok: false, field: 'date', error: 'weight.errors.date' };
  if (isFutureDay(date, todayKey))
    return { ok: false, field: 'date', error: 'weight.errors.future' };
  const parsed = parseWeight(weight, units);
  if (!parsed.ok) return { ok: false, field: 'weight', error: parsed.error };
  return { ok: true, values: { log_date: date, kg: parsed.value } };
}

// The 12 weeks that end with the week starting on weekStartKey: the trend shows the 84 days
// from 11 weeks before that week's Sunday to its Saturday. The weights are fetched from six
// days earlier still, so the first days of the trend have a full 7-day average.
export function trendWindow(weekStartKey) {
  const startKey = addDays(weekStartKey, -7 * (TREND_WEEKS - 1));
  return {
    startKey,
    endKey: weekEndKey(weekStartKey),
    fetchFromKey: addDays(startKey, -(AVERAGE_DAYS - 1)),
  };
}

// The 7-day moving average at one day: the mean of the weights logged on that day and the six
// before it (calendar days, so a missing day is simply not in the mean). Null when none of
// the seven days has a weight. byDay maps 'YYYY-MM-DD' to kg.
export function averageAt(byDay, key) {
  let sum = 0;
  let count = 0;
  for (let back = 0; back < AVERAGE_DAYS; back += 1) {
    const kg = byDay.get(addDays(key, -back));
    if (kg !== undefined) {
      sum += kg;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

// The trend over the window: one point per day, with the day's weight (null if not logged) and
// the 7-day average (null if no weight in those seven days). entries are weight rows with
// log_date and kg, and may reach back before the window. entries holds the rows inside the
// window, oldest first, for the list under the chart.
export function buildTrend(entries, startKey, endKey) {
  const byDay = new Map();
  for (const entry of entries || []) byDay.set(entry.log_date, Number(entry.kg));
  const days = [];
  for (let key = startKey; key <= endKey; key = addDays(key, 1)) {
    days.push({ key, kg: byDay.get(key) ?? null, average: averageAt(byDay, key) });
  }
  const inWindow = (entries || [])
    .filter((entry) => entry.log_date >= startKey && entry.log_date <= endKey)
    .map((entry) => ({ id: entry.id, log_date: entry.log_date, kg: Number(entry.kg) }))
    .sort((a, b) => (a.log_date < b.log_date ? -1 : a.log_date > b.log_date ? 1 : 0));
  return { startKey, endKey, days, entries: inWindow };
}

// The chart geometry for the trend line, in the SVG's own units. Returns null when there is
// no weight to draw. dots are the day weights; averagePath is one SVG path with a move at
// the start of each run of days that have an average, so gaps are not joined. The scale
// runs from the lowest to the highest value shown, with a band of 1 kg when they are equal.
export function trendLayout(trend, { width, height, pad }) {
  const days = trend.days;
  const values = [];
  for (const day of days) {
    if (day.kg !== null) values.push(day.kg);
    if (day.average !== null) values.push(day.average);
  }
  if (values.length === 0 || days.length < 2) return null;

  const low = Math.min(...values);
  const high = Math.max(...values);
  let min = low;
  let max = high;
  if (max - min < 1) {
    const mid = (max + min) / 2;
    min = mid - 0.5;
    max = mid + 0.5;
  }
  const x = (index) => pad + (index * (width - 2 * pad)) / (days.length - 1);
  const y = (value) => pad + ((max - value) / (max - min)) * (height - 2 * pad);

  const dots = [];
  const segments = [];
  let previousHad = false;
  days.forEach((day, index) => {
    if (day.kg !== null) dots.push({ key: day.key, x: x(index), y: y(day.kg), kg: day.kg });
    if (day.average !== null) {
      const command = previousHad ? 'L' : 'M';
      segments.push(`${command}${x(index).toFixed(1)} ${y(day.average).toFixed(1)}`);
      previousHad = true;
    } else {
      previousHad = false;
    }
  });

  return {
    width,
    height,
    dots,
    averagePath: segments.join(' '),
    // The lowest and highest weight or average in the window, as logged (no padding).
    low,
    high,
  };
}
