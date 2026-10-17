// Dates and numbers formatted with the browser's Intl support, per language.
// Pass a language code such as 'en' or 'es'. Nothing here hard-codes a pattern.

export const DATE_SHORT = { weekday: 'short', day: 'numeric', month: 'short' };

export function formatDate(date, locale, options = DATE_SHORT) {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatNumber(value, locale, options = undefined) {
  return new Intl.NumberFormat(locale, options).format(value);
}
