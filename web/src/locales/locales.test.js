import { describe, it, expect } from 'vitest';
import { MESSAGES, LOCALES, flattenMessages } from '../i18n/locale.js';

const keysOf = (code) => Object.keys(flattenMessages(MESSAGES[code])).sort();

describe('locale files', () => {
  it('ship English and Spanish', () => {
    expect(LOCALES).toEqual(['en', 'es']);
  });

  it.each(LOCALES.map((code) => [code]))('have a non-empty string for every key in %s', (code) => {
    const flat = flattenMessages(MESSAGES[code]);
    for (const [key, value] of Object.entries(flat)) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('have exactly the same keys in English and Spanish', () => {
    const english = keysOf('en');
    const spanish = keysOf('es');
    const onlyInEnglish = english.filter((key) => !spanish.includes(key));
    const onlyInSpanish = spanish.filter((key) => !english.includes(key));

    expect(onlyInEnglish, 'keys missing from es.json').toEqual([]);
    expect(onlyInSpanish, 'keys missing from en.json').toEqual([]);
  });
});
