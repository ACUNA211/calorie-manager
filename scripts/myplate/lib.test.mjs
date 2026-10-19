// Ticket #67: tests for the MyPlate import logic. Run with: node --test scripts/myplate/lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSql,
  extractRecipeLd,
  extractRecipeUrls,
  isAllowed,
  parseIngredient,
  parseRobots,
  parseYield,
  pickMatch,
  recipeTotals,
  toGrams,
} from './lib.mjs';

test('robots: longest rule wins, wildcard group applies', () => {
  const r = parseRobots('User-agent: *\nDisallow: /admin\nAllow: /admin/public\nDisallow: /*.pdf$\n');
  assert.equal(isAllowed(r, '/recipes/x'), true);
  assert.equal(isAllowed(r, '/admin/x'), false);
  assert.equal(isAllowed(r, '/admin/public/x'), true);
  assert.equal(isAllowed(r, '/a/b.pdf'), false);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow: /\n'), '/anything'), false);
  assert.equal(isAllowed(parseRobots('User-agent: *\nDisallow:\n'), '/anything'), true);
});

test('JSON-LD Recipe is found, also inside @graph', () => {
  const html = `<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Soup","recipeYield":["4","4 servings"]}]}</script>`;
  const ld = extractRecipeLd(html);
  assert.equal(ld.name, 'Soup');
  assert.equal(parseYield(ld.recipeYield), 4);
  assert.equal(extractRecipeLd('<p>none</p>'), null);
});

test('recipe URLs: same host, recipe pages only', () => {
  const html = '<a href="/myplate-kitchen/recipes/soup">a</a><a href="https://other.com/recipes/x">b</a><a href="/about">c</a>';
  assert.deepEqual(extractRecipeUrls(html, 'https://www.myplate.gov'), [
    'https://www.myplate.gov/myplate-kitchen/recipes/soup',
  ]);
});

test('ingredient lines', () => {
  assert.deepEqual(parseIngredient('1 1/2 cups chopped onion, divided'), {
    qty: 1.5,
    unit: 'cups',
    name: 'chopped onion',
    text: '1 1/2 cups chopped onion, divided',
  });
  const egg = parseIngredient('2 large eggs');
  assert.equal(egg.qty, 2);
  assert.equal(egg.unit, null);
  assert.equal(parseIngredient('½ tsp salt').qty, 0.5);
  assert.equal(parseIngredient('salt to taste').qty, null);
  assert.equal(parseIngredient('1 pound (454 g) chicken breast').unit, 'pound');
});

test('grams: mass direct, others only from a USDA portion, never guessed', () => {
  assert.equal(toGrams(parseIngredient('1 lb beans')).grams, 453.6);
  assert.equal(toGrams(parseIngredient('8 oz beans')).grams, 226.8);
  assert.equal(toGrams(parseIngredient('1 cup rice')).grams, null);
  const portions = [{ gramWeight: 185, amount: 1, measure: 'cup' }, { gramWeight: 50, amount: 1, measure: 'large' }];
  assert.equal(toGrams(parseIngredient('2 cups rice'), portions).grams, 370);
  assert.equal(toGrams(parseIngredient('1 tbsp rice'), portions).grams, 11.6);
  assert.equal(toGrams(parseIngredient('2 large eggs'), portions).grams, 100);
  assert.equal(toGrams(parseIngredient('2 cans beans'), portions).grams, null);
  assert.equal(toGrams(parseIngredient('salt to taste')).grams, null);
});

test('matching is conservative', () => {
  const c = (description, dataType = 'SR Legacy') => ({ description, dataType, fdcId: 1 });
  assert.equal(pickMatch('chicken breast', [c('Chicken, thigh, raw')]), null);
  assert.equal(pickMatch('onion', [c('Onions, raw'), c('Onion rings, breaded, frozen, cooked', 'Branded')]).description, 'Onions, raw');
  assert.equal(pickMatch('olive oil', [c('Oil, olive, salad or cooking')]).description, 'Oil, olive, salad or cooking');
  assert.equal(pickMatch('quinoa', []), null);
  assert.equal(pickMatch('', [c('x')]), null);
});

test('totals per serving; a macro nobody reports stays null', () => {
  const items = [
    { grams: 200, food: { kcal: 50, protein_g: 2, carbs_g: 10, fat_g: null } },
    { grams: 100, food: { kcal: 100, protein_g: 5, carbs_g: null, fat_g: null } },
  ];
  const t = recipeTotals(items, 2);
  assert.equal(t.total.kcal, 200);
  assert.equal(t.perServing.kcal, 100);
  assert.equal(t.total.protein_g, 9);
  assert.equal(t.total.fat_g, null);
});

test('SQL credits the source and escapes quotes', () => {
  const sql = buildSql(
    [
      {
        url: 'https://www.myplate.gov/myplate-kitchen/recipes/o-brien',
        name: "O'Brien potatoes",
        servings: 4,
        ingredients: [{ text: '1 lb potatoes', grams: 453.6, food: { fdcId: '170026', name: 'Potatoes', kcal: 77, protein_g: 2, carbs_g: 17, fat_g: 0.1, fibre_g: null, sugars_g: null, sodium_mg: 6 } }],
      },
    ],
    3,
  );
  assert.match(sql, /O''Brien/);
  assert.match(sql, /source_name, source_url/);
  assert.match(sql, /USDA MyPlate Kitchen/);
  assert.match(sql, /fibre_g[\s\S]*null, null, 6/);
  assert.throws(() => buildSql([], 'x; drop'));
});
