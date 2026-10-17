// Search folding, ported from the old artifact's norm(): lower case, accents removed,
// anything that is not a-z, 0-9 or a space becomes a space. "Jalapeño" and "jalapeno"
// fold to the same text, so search ignores both case and accents.

const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_SEARCH_CHARS = /[^a-z0-9 ]+/g;

export function norm(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(NON_SEARCH_CHARS, ' ');
}

// The words a person typed, folded, with a plural ending dropped from longer words
// ("eggs" matches "egg"), as the old artifact did.
export function searchTokens(query) {
  return norm(query)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => (token.length > 3 ? token.replace(/(es|s)$/, '') : token));
}
