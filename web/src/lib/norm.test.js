import { describe, it, expect } from 'vitest';
import { norm, searchTokens } from './norm.js';

describe('norm', () => {
  it('lower-cases and removes accents', () => {
    expect(norm('Jalapeño')).toBe('jalapeno');
    expect(norm('CAFÉ con Leche')).toBe('cafe con leche');
    expect(norm('Ñandú')).toBe('nandu');
  });

  it('turns punctuation and other symbols into spaces', () => {
    expect(norm('Chicken, breast (raw)')).toBe('chicken  breast  raw ');
  });

  it('treats missing input as empty text', () => {
    expect(norm(null)).toBe('');
    expect(norm(undefined)).toBe('');
  });
});

describe('searchTokens', () => {
  it('folds the query and drops a plural ending from longer words', () => {
    expect(searchTokens('Eggs')).toEqual(['egg']);
    expect(searchTokens('  Pimentón   dulce ')).toEqual(['pimenton', 'dulce']);
  });

  it('keeps short words as they are', () => {
    expect(searchTokens('gas')).toEqual(['gas']);
    expect(searchTokens('oats')).toEqual(['oat']);
  });

  it('returns no tokens for an empty query', () => {
    expect(searchTokens('   ')).toEqual([]);
  });
});
