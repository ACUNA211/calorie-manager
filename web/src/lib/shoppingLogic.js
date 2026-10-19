// Pure Shopping list rules: what to buy, in what measure, and how the list is grouped. No
// database and no screen here. The database (migration 044, sync_shopping_list) applies the same
// rules when a Meal Plan is approved or grows; these functions give the screen the same words
// and let the rules be tested on their own.

import {
  STORE_SECTIONS,
  normalizeSection,
  packageGrams as foodPackageGrams,
} from './pantryLogic.js';

// What is still short, per food: the plan need, minus what earlier syncs already accounted for
// (`covered`: lines plus Pantry credit), minus spare Pantry. Spare Pantry is the amount held, less
// what an earlier sync already counted on (`taken`) and less grams ticked bought for the plan.
// `state[foodId]` is { covered, taken, bought }; a food never seen has all three at zero, so the
// first time the Pantry simply comes off the need. A shortfall of half a gram or less is ignored.
// Returns [{ foodId, short, credit }] for foods that need a new line.
export function shortfalls(need, pantry = {}, state = {}) {
  const out = [];
  for (const [foodId, wanted] of Object.entries(need)) {
    const { covered = 0, taken = 0, bought = 0 } = state[foodId] ?? {};
    const spare = Math.max(Number(pantry[foodId] ?? 0) - taken - bought, 0);
    const credit = Math.min(spare, Math.max(wanted - covered, 0));
    const short = wanted - covered - credit;
    if (short > 0.5) out.push({ foodId, short, credit });
  }
  return out;
}

// The one measure a food is bought in: its package (set weight), else its largest serving (a
// can, a bag), else steps of 50 g. Returns { kind, label, count, grams } where grams is the
// whole amount, rounded up to whole measures.
export function shoppingMeasure(food, grams) {
  const pack =
    food.packageGrams !== null && food.packageGrams !== undefined
      ? Number(food.packageGrams)
      : null;
  if (pack && pack > 0) {
    const count = Math.ceil(grams / pack);
    return { kind: 'package', label: null, count, grams: count * pack };
  }
  const servings = (Array.isArray(food.servings) ? food.servings : []).filter(
    (entry) => entry && Number(entry.grams) > 0
  );
  if (servings.length > 0) {
    const biggest = servings.reduce((a, b) => (Number(b.grams) > Number(a.grams) ? b : a));
    const count = Math.ceil(grams / Number(biggest.grams));
    return {
      kind: 'serving',
      label: String(biggest.label ?? ''),
      count,
      grams: count * Number(biggest.grams),
    };
  }
  const total = Math.ceil(grams / 50) * 50;
  return { kind: 'weight', label: null, count: total / 50, grams: total };
}

// Re-export so the screen needs one import for package weights.
export { foodPackageGrams };

// A grocery_list row as the screen uses it.
export function lineFromRow(row) {
  return {
    id: row.id,
    name: row.item_name || '',
    foodId: row.food_id ?? null,
    source: row.source || 'hand',
    purchased: Boolean(row.purchased),
    grams: row.grams === null || row.grams === undefined ? null : Number(row.grams),
    needGrams:
      row.need_grams === null || row.need_grams === undefined ? null : Number(row.need_grams),
    text: row.quantity_needed || '',
    storeSection: row.store_section || 'Other',
    measureKind: row.measure_kind || null,
    measureLabel: row.measure_label || null,
    measureCount:
      row.measure_count === null || row.measure_count === undefined
        ? null
        : Number(row.measure_count),
    addedAt: row.created_at || null,
  };
}

// Open lines grouped by store section in shopping order. Within a section the oldest line comes
// first, then by name. Returns [{ section, key, lines }] for sections that have lines.
export function groupLines(lines) {
  const order = new Map(STORE_SECTIONS.map((section, index) => [section.value, index]));
  const groups = new Map();
  for (const line of lines) {
    const section = normalizeSection(line.storeSection);
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(line);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => order.get(a) - order.get(b))
    .map(([section, sectionLines]) => ({
      section,
      key: STORE_SECTIONS.find((entry) => entry.value === section).key,
      lines: sectionLines.sort(
        (a, b) =>
          String(a.addedAt ?? '').localeCompare(String(b.addedAt ?? '')) ||
          a.name.localeCompare(b.name) ||
          a.id - b.id
      ),
    }));
}

// Splits the list into what is left to buy (grouped) and what is already ticked.
export function splitList(lines) {
  return {
    open: groupLines(lines.filter((line) => !line.purchased)),
    done: lines.filter((line) => line.purchased),
  };
}

// The date a line was added, as a local Date (null when the row has none).
export function addedDate(line) {
  if (!line.addedAt) return null;
  const date = new Date(line.addedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---- Bought / Have it (ticket 47). The database (migration 046) does the same sums. ----

// How long Undo stays on screen. The database allows a little longer (10 s) for slow phones.
export const UNDO_MS = 5000;
export const PANTRY_MAX_GRAMS = 100000;

const round1 = (value) => Math.round(value * 10) / 10;

// The two ticks a line offers. A line with no food (a hand-added "foil") has nothing to put in
// the Pantry, so it only offers one plain tick, sent as Bought.
export function tickOptions(line) {
  return line.foodId === null || line.foodId === undefined ? ['bought'] : ['bought', 'have_it'];
}

// What a tick does to the Pantry. `held` is the grams there now. Bought adds the line's grams (or
// `scannedGrams`, the real package weight from a Scan, which replaces the planned amount); Have it
// raises the Pantry to at least what the line needs and never lowers it. Returns
// { before, after, delta }; delta is what the tick really changed, and is what Undo takes back.
export function pantryAfterTick(kind, line, held = 0, scannedGrams = null) {
  const before = Number(held) || 0;
  if (line.foodId === null || line.foodId === undefined) return { before, after: before, delta: 0 };
  const planned = scannedGrams ?? line.grams;
  if (!(planned > 0)) return { before, after: before, delta: 0 };
  let after;
  if (kind === 'bought') {
    after = Math.min(before + round1(planned), PANTRY_MAX_GRAMS);
  } else {
    const needed = scannedGrams ?? line.needGrams ?? line.grams;
    after = Math.max(before, Math.min(round1(needed), PANTRY_MAX_GRAMS));
  }
  return { before, after, delta: round1(after - before) };
}

// Undo takes back exactly the amount the tick added, so a Pantry change somebody else made in
// between stays. It never goes below zero.
export function pantryAfterUndo(held, delta) {
  return Math.max(round1((Number(held) || 0) - delta), 0);
}

// The list with one line marked ticked (or unticked again, for Undo).
export function withTicked(lines, lineId, purchased) {
  return lines.map((line) => (line.id === lineId ? { ...line, purchased } : line));
}
