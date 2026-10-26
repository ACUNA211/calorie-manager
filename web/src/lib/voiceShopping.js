// Voice commands on the Shopping list (ticket 61, CONTEXT "Voice command"). Jev picks the
// action and which open line was meant; code pulls out the item name and any amount, since a
// decision model chooses and never writes text. Pure functions: the page asks the decide Edge
// Function and turns the answers into at most three option cards. Nothing here changes data.

// The Voice command actions from CONTEXT.md. Only the first two act on this page; the others
// stay in the list so Jev can say "this is not a Shopping list command" (tickets 62 and 63).
export const VOICE_ACTIONS = [
  { value: 'tick_shopping_line', description: 'Tick a Shopping list line Bought.' },
  { value: 'add_shopping_item', description: 'Add an item to the Shopping list.' },
  { value: 'log_planned_portion', description: 'Log a planned Portion at a Meal Time.' },
  { value: 'log_other', description: 'Log something else that was eaten or drunk.' },
  { value: 'mark_pantry_used', description: 'Mark a Pantry item used up or partly used.' },
  { value: 'start_rebalance', description: 'Start a Rebalance after eating too much.' },
];

export const NO_LINE = 'none';
// The decide function takes at most 40 options per choice: 39 lines plus "none".
export const MAX_CANDIDATE_LINES = 39;
export const MAX_CARDS = 3;
// A meaning less likely than this is not shown as a card.
export const MIN_CARD_PROBABILITY = 0.05;

const lineValue = (line) => `line_${line.id}`;

// The open, unticked lines the Member can still tick (a tick waiting on the phone counts as
// ticked). Lists longer than the limit keep the lines sharing the most words with what was said.
export function candidateLines(lines, transcript, max = MAX_CANDIDATE_LINES) {
  const open = lines.filter((line) => !line.purchased && !line.pending);
  if (open.length <= max) return open;
  const said = new Set(words(transcript));
  const overlap = (line) => words(line.name).filter((w) => said.has(w)).length;
  return open
    .map((line, index) => ({ line, index, score: overlap(line) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.line);
}

function words(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
}

// The questions sent with the transcript: which action, and which of the candidate lines.
export function shoppingQuestions(lines) {
  return {
    action: {
      type: 'choice',
      instructions:
        'A Member of a household spoke a command to their calorie and shopping app. Which action does the command most likely ask for?',
      choices: VOICE_ACTIONS,
    },
    line: {
      type: 'choice',
      instructions:
        'If the command is about an item already on the Shopping list, which line is it? The Member may name it loosely, in English or Spanish, or by a related word.',
      choices: [
        ...lines.map((line) => ({ value: lineValue(line), description: line.name })),
        { value: NO_LINE, description: 'No line on the list matches the command.' },
      ],
    },
  };
}

// ---------- the item and amount for "add" ----------

const NUMBER_WORDS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  half: 0.5,
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  doce: 12,
  medio: 0.5,
  media: 0.5,
};

const UNITS = [
  'g',
  'grams?',
  'gramos?',
  'kg',
  'kilos?',
  'kilograms?',
  'kilogramos?',
  'lbs?',
  'pounds?',
  'libras?',
  'oz',
  'ounces?',
  'onzas?',
  'l',
  'liters?',
  'litres?',
  'litros?',
  'ml',
  'dozen',
  'docenas?',
  'cans?',
  'latas?',
  'bottles?',
  'botellas?',
  'bags?',
  'bolsas?',
  'box(?:es)?',
  'cajas?',
  'packs?',
  'packages?',
  'paquetes?',
  'loaf',
  'loaves',
  'barras?',
  'bunch(?:es)?',
  'manojos?',
  'jars?',
  'frascos?',
  'cartons?',
  'cartones?',
];

const LEADING = [
  'please',
  'can you',
  'could you',
  'add',
  'put',
  'we need',
  'i need',
  'we need to buy',
  'i need to buy',
  'buy',
  'get',
  'por favor',
  'añade',
  'anade',
  'agrega',
  'añadir',
  'agregar',
  'pon',
  'apunta',
  'necesito',
  'necesitamos',
  'compra',
  'comprar',
];

const TRAILING = [
  'to the shopping list',
  'to the list',
  'on the shopping list',
  'on the list',
  'to shopping',
  'please',
  'a la lista de (?:la )?compras?',
  'a la lista',
  'en la lista de (?:la )?compras?',
  'en la lista',
  'por favor',
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LEADING_RE = new RegExp(
  `^(?:(?:${[...LEADING]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|')})\\b[\\s,]*)+`,
  'i'
);
const TRAILING_RE = new RegExp(`(?:[\\s,]+(?:${TRAILING.join('|')}))+$`, 'i');
const AMOUNT_RE = new RegExp(
  `^(\\d+(?:[.,]\\d+)?|(?:${Object.keys(NUMBER_WORDS).join('|')})\\b)\\s*(?:(?:an?\\s+)?(${UNITS.join('|')})\\b\\.?)?\\s*(?:(?:of|de)\\s+)?`,
  'i'
);

// "Add two litres of milk to the list" -> { name: 'Milk', text: '2 litres' }.
// "Añade pan" -> { name: 'Pan', text: null }. Returns null when no item is left.
export function parseSpokenAdd(transcript) {
  let rest = String(transcript ?? '')
    .trim()
    .replace(/[.!?¡¿]+/g, '')
    .trim();
  rest = rest.replace(LEADING_RE, '').replace(TRAILING_RE, '').trim();

  let text = null;
  const match = AMOUNT_RE.exec(rest);
  if (match) {
    const [whole, rawNumber, unit] = match;
    const word = rawNumber.toLowerCase();
    const isWordNumber = word in NUMBER_WORDS;
    // "a"/"an"/"un"/"una" alone are articles ("add a melon"), not amounts.
    const article = ['a', 'an', 'un', 'una'].includes(word) && !unit;
    if (!article) {
      const number = isWordNumber ? NUMBER_WORDS[word] : Number(rawNumber.replace(',', '.'));
      text = unit ? `${number} ${unit.toLowerCase()}` : String(number);
    }
    rest = rest.slice(whole.length).trim();
  }
  rest = rest.replace(/^(?:of|de)\s+/i, '').trim();
  if (rest === '') return null;
  return { name: rest.charAt(0).toUpperCase() + rest.slice(1), text };
}

// ---------- cards ----------

// Up to three meanings, most likely first: "Bought: <line>" for the likeliest lines, and
// "Add <item>" when code found an item to add. A card's probability is the action's times the
// line's. Returns [] when no Shopping list meaning is likely enough.
export function shoppingCards(answers, lines, transcript) {
  const action = answers?.action?.probabilities ?? {};
  const pick = answers?.line?.probabilities ?? {};
  const pTick = Number(action.tick_shopping_line ?? 0);
  const pAdd = Number(action.add_shopping_item ?? 0);
  const cards = [];

  for (const line of lines) {
    const p = pTick * Number(pick[lineValue(line)] ?? 0);
    if (p >= MIN_CARD_PROBABILITY) cards.push({ kind: 'tick', line, probability: p });
  }

  const item = parseSpokenAdd(transcript);
  if (item && pAdd >= MIN_CARD_PROBABILITY) {
    cards.push({ kind: 'add', name: item.name, text: item.text, probability: pAdd });
  }

  return cards.sort((a, b) => b.probability - a.probability).slice(0, MAX_CARDS);
}
