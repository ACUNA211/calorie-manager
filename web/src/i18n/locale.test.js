import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_KEY,
  matchLocale,
  pickInitialLocale,
  readStoredLocale,
  storeLocale,
  translate,
} from './locale.js';
import { formatDate, formatNumber } from './format.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
}

function brokenStorage() {
  const fail = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  return { getItem: fail, setItem: fail };
}

describe('matchLocale', () => {
  it('maps regional tags to a supported language and ignores the rest', () => {
    expect(matchLocale('es-MX')).toBe('es');
    expect(matchLocale('en-US')).toBe('en');
    expect(matchLocale('fr-FR')).toBeNull();
    expect(matchLocale('')).toBeNull();
    expect(matchLocale(undefined)).toBeNull();
  });
});

describe('pickInitialLocale', () => {
  it('prefers the choice remembered on this device', () => {
    const storage = memoryStorage({ [LOCALE_KEY]: 'es' });
    expect(pickInitialLocale(storage, ['en-US'])).toBe('es');
  });

  it('falls back to the first supported browser language', () => {
    expect(pickInitialLocale(memoryStorage(), ['fr-FR', 'es-ES', 'en-US'])).toBe('es');
  });

  it('defaults to English when nothing matches', () => {
    expect(pickInitialLocale(memoryStorage(), ['fr-FR'])).toBe(DEFAULT_LOCALE);
    expect(pickInitialLocale(null, [])).toBe('en');
  });

  it('ignores a stored value that is not a supported language', () => {
    const storage = memoryStorage({ [LOCALE_KEY]: 'de' });
    expect(pickInitialLocale(storage, ['es-MX'])).toBe('es');
  });
});

describe('stored locale', () => {
  it('stores and reads back a supported language', () => {
    const storage = memoryStorage();
    storeLocale(storage, 'es');
    expect(storage.data[LOCALE_KEY]).toBe('es');
    expect(readStoredLocale(storage)).toBe('es');
  });

  it('does not throw when storage is blocked', () => {
    expect(readStoredLocale(brokenStorage())).toBeNull();
    expect(() => storeLocale(brokenStorage(), 'es')).not.toThrow();
  });
});

describe('translate', () => {
  it('returns the text for the chosen language', () => {
    expect(translate('en', 'home.signOut')).toBe('Sign out');
    expect(translate('es', 'home.signOut')).toBe('Cerrar sesión');
  });

  it('fills {{placeholders}} from the variables', () => {
    expect(translate('en', 'home.greeting', { email: 'a@b.co' })).toBe('Hi, a@b.co');
    expect(translate('es', 'home.greeting', { email: 'a@b.co' })).toBe('Hola, a@b.co');
  });

  it('falls back to English, then to the key, for a missing string', () => {
    expect(translate('es', 'no.such.key')).toBe('no.such.key');
  });
});

describe('formatDate and formatNumber', () => {
  // 17 October 2025 is a Friday. These are the outputs Intl gives in Node and browsers.
  const friday = new Date(2025, 9, 17);

  it('formats a short date per language', () => {
    expect(formatDate(friday, 'en')).toBe('Fri, Oct 17');
    expect(formatDate(friday, 'es')).toBe('vie, 17 oct');
  });

  it('formats numbers per language', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    // Spanish does not group four-digit numbers and uses a comma for decimals.
    expect(formatNumber(1234.5, 'es')).toBe('1234,5');
    expect(formatNumber(12345.5, 'es')).toBe('12.345,5');
  });

  it('passes options through to Intl', () => {
    expect(formatNumber(0.25, 'en', { style: 'percent' })).toBe('25%');
  });
});
