// Barcode (GTIN) helpers for Scan (ticket 18). Pure: no network, no DOM.
//
// A product code can reach us as UPC-A (12 digits), EAN-13 (13), GTIN-14 (14) or EAN-8 /
// UPC-E (8). The same product has one number with its leading zeros removed, so every
// form of it (12, 13 and 14 digits, zero-padded) reduces to one key. The database
// (usda_lookup_gtin, migration 003) compares the keys, so the app sends one form.

// Lengths a scanner can return for a product code.
const CODE_LENGTHS = [8, 12, 13, 14];

// Keeps the digits of a scanned value (spaces and dashes are dropped).
export function digitsOnly(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

// GS1 check digit for the digits before it: counting from the right, weight 3 then 1.
export function gtinCheckDigit(body) {
  const digits = digitsOnly(body);
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const fromRight = digits.length - i;
    sum += Number(digits[i]) * (fromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

// True for a code with a plausible length and, for 12 to 14 digits, a right check digit.
// An 8-digit code (EAN-8 or UPC-E) is accepted without a check: UPC-E's check digit is
// worked out from its expanded form, and the lookup itself is the real test.
export function isValidGtin(raw) {
  const digits = digitsOnly(raw);
  if (!CODE_LENGTHS.includes(digits.length)) return false;
  if (digits.length === 8) return true;
  const body = digits.slice(0, -1);
  return gtinCheckDigit(body) === Number(digits[digits.length - 1]);
}

// The code with its leading zeros removed: the key every form of one product shares.
// Returns '' when the value is not a valid code.
export function gtinKey(raw) {
  if (!isValidGtin(raw)) return '';
  return digitsOnly(raw).replace(/^0+/, '');
}

// The 12-, 13- and 14-digit zero-padded forms of a valid code, in that order. Empty for an
// invalid code. Looking up any one of them finds the same product.
export function gtinForms(raw) {
  const key = gtinKey(raw);
  if (key === '') return [];
  return [12, 13, 14]
    .filter((length) => length >= key.length)
    .map((length) => key.padStart(length, '0'));
}
