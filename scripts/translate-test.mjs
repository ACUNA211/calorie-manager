// Ticket #15: live test of translation options on 20 Food Library names.
// Run:  node scripts/translate-test.mjs > .scratch/restart/research/translation-test-output.md
// Keys are read only from the environment. A vendor is skipped when its key is missing.
//   GOOGLE_TRANSLATE_KEY                  Cloud Translation Basic (v2) API key
//   AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION   Azure AI Translator (F0 or S1)
//   ANTHROPIC_API_KEY                     Claude Haiku 5.5 (cheap AI option)
// Nothing is saved by this script; it prints a Markdown table to stdout.

const FOODS = [
  ['Chicken breast, roasted', 'Pechuga de pollo asada'],
  ['Greek yogurt, plain, nonfat', 'Yogur griego natural sin grasa'],
  ['Brown rice, cooked', 'Arroz integral cocido'],
  ['Egg, whole, raw', 'Huevo entero crudo'],
  ['Oatmeal, cooked', 'Avena cocida'],
  ['Bananas, raw', 'Plátano crudo'],
  ['Black beans, cooked', 'Frijoles negros cocidos'],
  ['Broccoli, cooked, boiled', 'Brócoli cocido, hervido'],
  ['Olive oil', 'Aceite de oliva'],
  ['Cheddar cheese', 'Queso cheddar'],
  ['Whole wheat bread', 'Pan integral'],
  ['Salmon, Atlantic, farmed, cooked', 'Salmón atlántico de cultivo, cocido'],
  ['Potato, baked, flesh and skin', 'Papa al horno, con piel'],
  ['Ground beef, 90% lean, cooked', 'Carne molida de res, 90% magra, cocida'],
  ['Tortilla, corn', 'Tortilla de maíz'],
  ['Apple, raw, with skin', 'Manzana cruda, con cáscara'],
  ['Milk, whole', 'Leche entera'],
  ['Peanut butter, smooth', 'Mantequilla de maní cremosa'],
  ['Spinach, raw', 'Espinaca cruda'],
  ['Lentils, cooked', 'Lentejas cocidas'],
];

const english = FOODS.map(([en]) => en);

async function google(texts) {
  const r = await fetch('https://translation.googleapis.com/language/translate/v2', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': process.env.GOOGLE_TRANSLATE_KEY,
    },
    body: JSON.stringify({ q: texts, source: 'en', target: 'es', format: 'text' }),
  });
  if (!r.ok) throw new Error(`Google ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data.translations.map((t) => t.translatedText);
}

async function azure(texts) {
  const url = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=es';
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_KEY,
      'Ocp-Apim-Subscription-Region': process.env.AZURE_TRANSLATOR_REGION,
    },
    body: JSON.stringify(texts.map((Text) => ({ Text }))),
  });
  if (!r.ok) throw new Error(`Azure ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.map((x) => x.translations[0].text);
}

async function haiku(texts) {
  const prompt =
    'Translate these English food names into Spanish as used in Latin America. ' +
    'Reply with only the list, one name per line, same order, no numbering.\n' +
    texts.join('\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.content[0].text.split('\n').map((s) => s.trim()).filter(Boolean);
}

const vendors = [
  ['Google', 'GOOGLE_TRANSLATE_KEY', google],
  ['Azure', 'AZURE_TRANSLATOR_KEY', azure],
  ['Haiku 5.5', 'ANTHROPIC_API_KEY', haiku],
];

const results = {};
for (const [name, envVar, fn] of vendors) {
  if (!process.env[envVar]) {
    console.error(`${name}: skipped, ${envVar} not set`);
    continue;
  }
  try {
    results[name] = await fn(english);
  } catch (err) {
    console.error(`${name}: ${err.message}`);
  }
}

const cols = Object.keys(results);
console.log(`| # | English | Reference (ours) | ${cols.join(' | ')} |`);
console.log(`|---|---|---|${cols.map(() => '---').join('|')}|`);
FOODS.forEach(([en, ref], i) => {
  const cells = cols.map((c) => results[c][i] ?? '(missing)');
  console.log(`| ${i + 1} | ${en} | ${ref} | ${cells.join(' | ')} |`);
});
