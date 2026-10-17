import { describe, it, expect } from 'vitest';
import { digitsOnly, gtinCheckDigit, gtinForms, gtinKey, isValidGtin } from './gtin.js';

// 036000291452 is a real UPC-A (check digit 2); 4006381333931 is a real EAN-13.
const UPC_A = '036000291452';
const EAN_13 = '4006381333931';

describe('digitsOnly', () => {
  it('drops spaces, dashes and other non-digits', () => {
    expect(digitsOnly('0 36000-29145 2')).toBe('036000291452');
  });
});

describe('gtinCheckDigit', () => {
  it('works out the check digit of UPC-A and EAN-13 bodies', () => {
    expect(gtinCheckDigit('03600029145')).toBe(2);
    expect(gtinCheckDigit('400638133393')).toBe(1);
  });
});

describe('isValidGtin', () => {
  it('accepts UPC-A, EAN-13 and their zero-padded forms', () => {
    expect(isValidGtin(UPC_A)).toBe(true);
    expect(isValidGtin(`0${UPC_A}`)).toBe(true);
    expect(isValidGtin(`00${UPC_A}`)).toBe(true);
    expect(isValidGtin(EAN_13)).toBe(true);
    expect(isValidGtin(`0${EAN_13}`)).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidGtin('036000291453')).toBe(false);
    expect(isValidGtin('0036000291453')).toBe(false);
  });

  it('rejects lengths that are not a product code', () => {
    expect(isValidGtin('03600029145')).toBe(false);
    expect(isValidGtin('0360002914520')).toBe(false);
    expect(isValidGtin('')).toBe(false);
    expect(isValidGtin(null)).toBe(false);
  });

  it('accepts an 8-digit code without a check digit', () => {
    expect(isValidGtin('12345678')).toBe(true);
  });
});

describe('gtinKey', () => {
  it('is the same for every zero-padded form of one product', () => {
    expect(gtinKey(UPC_A)).toBe('36000291452');
    expect(gtinKey(`0${UPC_A}`)).toBe('36000291452');
    expect(gtinKey(`00${UPC_A}`)).toBe('36000291452');
  });

  it('ignores spaces in a scanned value', () => {
    expect(gtinKey('0 36000 29145 2')).toBe('36000291452');
  });

  it('is empty for an invalid code', () => {
    expect(gtinKey('036000291453')).toBe('');
  });
});

describe('gtinForms', () => {
  it('gives the 12-, 13- and 14-digit zero-padded forms of a UPC-A', () => {
    expect(gtinForms(UPC_A)).toEqual(['036000291452', '0036000291452', '00036000291452']);
  });

  it('gives the same forms when the code arrives already zero-padded', () => {
    expect(gtinForms('0036000291452')).toEqual(gtinForms(UPC_A));
    expect(gtinForms('00036000291452')).toEqual(gtinForms(UPC_A));
  });

  it('gives the 13- and 14-digit forms of an EAN-13 (no 12-digit form exists)', () => {
    expect(gtinForms(EAN_13)).toEqual(['4006381333931', '04006381333931']);
  });

  it('is empty for an invalid code', () => {
    expect(gtinForms('036000291453')).toEqual([]);
  });
});
