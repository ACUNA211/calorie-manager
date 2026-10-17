// Pure Pantry rules: amounts, corrections, and the store-section order. No database and no
// screen here, so every rule can be tested on its own. The database (migration 019) applies
// the same rules to the stored amount.

export const PANTRY_MAX_GRAMS = 100000;

// Store sections in the order a shopper walks the store. `value` is what foods.store_section
// holds; `key` names the translation under pantry.sections.
export const STORE_SECTIONS = [
  { value: 'Produce', key: 'produce' },
  { value: 'Meat & seafood', key: 'meatSeafood' },
  { value: 'Dairy & eggs', key: 'dairyEggs' },
  { value: 'Bakery & tortillas', key: 'bakery' },
  { value: 'Frozen', key: 'frozen' },
  { value: 'Canned & dry goods', key: 'cannedDry' },
  { value: 'Pantry', key: 'pantry' },
  { value: 'Drinks', key: 'drinks' },
  { value: 'Snacks', key: 'snacks' },
  { value: 'Other', key: 'other' },
];

const OTHER = STORE_SECTIONS[STORE_SECTIONS.length - 1].value;

// A section the app does not know goes under "Other", so no item is lost from the list.
export function normalizeSection(name) {
  return STORE_SECTIONS.some((section) => section.value === name) ? name : OTHER;
}

// One decimal place, the precision the database stores.
export function roundGrams(value) {
  return Math.round(value * 10) / 10;
}

// Reads a typed amount in grams. A comma is accepted as the decimal mark. Returns a
// translation key for the error so the screen can show it through t().
export function parseGrams(text) {
  const cleaned = String(text ?? '')
    .trim()
    .replace(',', '.');
  if (cleaned === '') return { ok: false, error: 'pantry.errors.amountRequired' };
  if (!/^\d+(\.\d)?$/.test(cleaned)) return { ok: false, error: 'pantry.errors.amountInvalid' };
  const value = Number(cleaned);
  if (value > PANTRY_MAX_GRAMS) return { ok: false, error: 'pantry.errors.amountTooHigh' };
  return { ok: true, value };
}

// An amount added to the Pantry must be more than zero.
export function validateAddAmount(text) {
  const parsed = parseGrams(text);
  if (!parsed.ok) return parsed;
  if (parsed.value <= 0) return { ok: false, error: 'pantry.errors.amountZero' };
  return parsed;
}

// The new amount after adding to the one already held, never above the largest amount.
export function addAmounts(current, added) {
  return Math.min(roundGrams(current + added), PANTRY_MAX_GRAMS);
}

// The corrections a Member can make to an item. "set" takes a typed amount.
export const CORRECTIONS = ['used_up', 'half', 'set'];

// The amount an item has after a correction. Used up is zero, about half halves the
// amount, and a typed amount replaces it.
export function applyCorrection(grams, action, typedGrams = null) {
  if (action === 'used_up') return 0;
  if (action === 'half') return roundGrams(grams / 2);
  if (action === 'set') return roundGrams(typedGrams);
  throw new Error(`Unknown Pantry correction: ${action}`);
}

// Items still in the Pantry. A used-up item (zero) is hidden.
export function visibleItems(items) {
  return items.filter((item) => item.grams > 0);
}

// Groups visible items by store section, in shopping order; items within a section go
// by name. Returns [{ section, key, items }] for each section that has items.
export function groupBySection(items) {
  const order = new Map(STORE_SECTIONS.map((section, index) => [section.value, index]));
  const groups = new Map();
  for (const item of visibleItems(items)) {
    const section = normalizeSection(item.storeSection);
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(item);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => order.get(a) - order.get(b))
    .map(([section, sectionItems]) => ({
      section,
      key: STORE_SECTIONS.find((entry) => entry.value === section).key,
      items: sectionItems.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
