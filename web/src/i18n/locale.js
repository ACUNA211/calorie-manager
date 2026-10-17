// Pure helpers for choosing, remembering and looking up the display language.
// Adding a language means adding a file in src/locales/ and listing it in MESSAGES.

import en from '../locales/en.json';
import es from '../locales/es.json';

export const MESSAGES = { en, es };
export const LOCALES = Object.keys(MESSAGES);
export const DEFAULT_LOCALE = 'en';
export const LOCALE_KEY = 'calorieManager.locale';

// Maps a browser tag such as "es-MX" to a supported language ("es"), or null.
export function matchLocale(tag) {
  const base = String(tag || '')
    .toLowerCase()
    .split('-')[0];
  return LOCALES.includes(base) ? base : null;
}

// localStorage can throw (private mode, blocked storage), so reads and writes are guarded.
export function readStoredLocale(storage) {
  if (!storage) return null;
  try {
    const value = storage.getItem(LOCALE_KEY);
    return LOCALES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLocale(storage, locale) {
  if (!storage) return;
  try {
    storage.setItem(LOCALE_KEY, locale);
  } catch {
    // Storage is unavailable: the choice lasts for this visit only.
  }
}

// The remembered choice wins; otherwise the first browser language we support; otherwise English.
export function pickInitialLocale(storage, browserLanguages) {
  const stored = readStoredLocale(storage);
  if (stored) return stored;
  for (const tag of browserLanguages || []) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

// Nested JSON becomes dot-separated keys: { home: { signOut: 'x' } } -> { 'home.signOut': 'x' }.
export function flattenMessages(tree, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      Object.assign(out, flattenMessages(value, path));
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

const FLAT = Object.fromEntries(
  Object.entries(MESSAGES).map(([code, tree]) => [code, flattenMessages(tree)])
);

// Looks a key up in the chosen language, then English, then shows the key itself.
// {{name}} placeholders are filled from vars.
export function translate(locale, key, vars = {}) {
  const template = FLAT[locale]?.[key] ?? FLAT[DEFAULT_LOCALE][key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}
