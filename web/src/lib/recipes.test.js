import { describe, it, expect, vi } from 'vitest';
import {
  addIngredient,
  copyRecipe,
  deleteRecipe,
  draftFromRecipe,
  emptyRecipeDraft,
  loadMealTimeOptions,
  loadRecipes,
  NAME_MAX,
  parseAmount,
  previewIngredients,
  removeIngredient,
  saveRecipe,
  searchFoods,
  setIngredientGrams,
  toggleMealTime,
  uniqueIds,
  validateRecipe,
  variationName,
} from './recipes.js';

const rice = { id: 7, name: 'Rice', kcal_per_100g: 130, protein_g: 2.7 };
const egg = { id: 9, name: 'Egg', kcal_per_100g: 143, protein_g: 12.6 };

// A chainable fake of the Supabase query builder. Each table+operation gets a result.
// Every call is recorded so a test can check what was sent.
function fakeClient(results = {}) {
  const calls = [];
  const from = (table) => {
    const record = { table, ops: [] };
    calls.push(record);
    const builder = {};
    const chain =
      (name) =>
      (...args) => {
        record.ops.push([name, ...args]);
        return builder;
      };
    for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'ilike', 'order', 'limit']) {
      builder[name] = chain(name);
    }
    builder.single = () => {
      record.ops.push(['single']);
      return builder;
    };
    builder.then = (resolve, reject) => {
      const first = record.ops[0]?.[0];
      const key = `${table}:${first}`;
      const result = results[key] ?? { data: null, error: null };
      return Promise.resolve(result).then(resolve, reject);
    };
    return builder;
  };
  return { from: vi.fn(from), calls };
}

describe('parseAmount', () => {
  it('reads a positive whole number or decimal', () => {
    expect(parseAmount('250')).toEqual({ ok: true, value: 250 });
    expect(parseAmount(' 2.5 ')).toEqual({ ok: true, value: 2.5 });
  });

  it('treats an empty field as not given', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: null });
    expect(parseAmount('   ')).toEqual({ ok: true, value: null });
  });

  it('refuses text, negatives and commas', () => {
    expect(parseAmount('2 cups')).toEqual({ ok: false, error: 'recipes.errors.number' });
    expect(parseAmount('-5')).toEqual({ ok: false, error: 'recipes.errors.number' });
    expect(parseAmount('1,5')).toEqual({ ok: false, error: 'recipes.errors.number' });
  });

  it('refuses zero', () => {
    expect(parseAmount('0')).toEqual({ ok: false, error: 'recipes.errors.notPositive' });
    expect(parseAmount('0.0')).toEqual({ ok: false, error: 'recipes.errors.notPositive' });
  });
});

describe('draft helpers', () => {
  it('starts an empty draft with one serving', () => {
    const draft = emptyRecipeDraft();
    expect(draft).toMatchObject({
      id: null,
      name: '',
      servings: '1',
      cookedWeight: '',
      ingredients: [],
    });
  });

  it('adds, edits and removes ingredient lines by key', () => {
    let draft = addIngredient(emptyRecipeDraft(), rice);
    draft = addIngredient(draft, egg);
    expect(draft.ingredients.map((item) => item.food.name)).toEqual(['Rice', 'Egg']);
    expect(draft.ingredients[0].grams).toBe('');

    const riceKey = draft.ingredients[0].key;
    draft = setIngredientGrams(draft, riceKey, '200');
    expect(draft.ingredients[0].grams).toBe('200');
    expect(draft.ingredients[1].grams).toBe('');

    draft = removeIngredient(draft, riceKey);
    expect(draft.ingredients.map((item) => item.food.name)).toEqual(['Egg']);
  });

  it('gives each new ingredient line its own key', () => {
    const draft = addIngredient(addIngredient(emptyRecipeDraft(), rice), rice);
    expect(draft.ingredients[0].key).not.toBe(draft.ingredients[1].key);
  });

  it('turns a stored Recipe into a draft with strings and keys', () => {
    const draft = draftFromRecipe({
      id: 3,
      name: 'Fried rice',
      starred: true,
      servings: 4,
      cooked_weight_g: null,
      notes: null,
      ingredients: [{ id: 11, grams: 300, food: rice }],
    });
    expect(draft).toMatchObject({
      id: 3,
      name: 'Fried rice',
      starred: true,
      servings: '4',
      cookedWeight: '',
      notes: '',
    });
    expect(draft.ingredients[0]).toMatchObject({ food: rice, grams: '300' });
    expect(draft.ingredients[0].key).toBeTruthy();
    expect(draft.mealTimeIds).toEqual([]);
  });

  it('takes the Meal Time tags from a stored Recipe, as ids', () => {
    const draft = draftFromRecipe({
      id: 3,
      name: 'Fried rice',
      starred: false,
      servings: 2,
      cooked_weight_g: null,
      notes: null,
      meal_time_tags: [
        { id: 12, name: 'Dinner' },
        { id: 4, name: null },
      ],
      ingredients: [],
    });
    expect(draft.mealTimeIds).toEqual([4, 12]);
  });

  it('turns a copy of a Recipe back into an ordinary draft', () => {
    const draft = draftFromRecipe({
      id: 8,
      name: 'Fried rice (variation)',
      starred: false,
      servings: 2,
      cooked_weight_g: null,
      notes: null,
      copied_from: 3,
      meal_time_tags: [],
      ingredients: [],
    });
    expect(draft).not.toHaveProperty('copied_from');
    expect(draft.id).toBe(8);
  });

  it('previews only ingredients with usable grams', () => {
    let draft = addIngredient(addIngredient(emptyRecipeDraft(), rice), egg);
    draft = setIngredientGrams(draft, draft.ingredients[0].key, '100');
    draft = setIngredientGrams(draft, draft.ingredients[1].key, 'lots');
    expect(previewIngredients(draft)).toEqual([{ grams: 100, food: rice }]);
  });
});

describe('validateRecipe', () => {
  const filled = () => {
    let draft = { ...emptyRecipeDraft(), name: '  Egg fried rice  ', servings: '2' };
    draft = addIngredient(draft, rice);
    draft = setIngredientGrams(draft, draft.ingredients[0].key, '200');
    return draft;
  };

  it('accepts a complete draft and returns the values to save', () => {
    const result = validateRecipe(filled());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({
      id: null,
      name: 'Egg fried rice',
      starred: false,
      servings: 2,
      cookedWeightG: null,
      notes: null,
      mealTimeIds: [],
      ingredients: [{ foodId: 7, grams: 200 }],
    });
  });

  it('requires a name, and keeps it under the length limit', () => {
    expect(validateRecipe({ ...filled(), name: '   ' }).errors.name).toBe(
      'recipes.errors.nameRequired'
    );
    expect(validateRecipe({ ...filled(), name: 'x'.repeat(121) }).errors.name).toBe(
      'recipes.errors.nameTooLong'
    );
  });

  it('requires servings above zero', () => {
    expect(validateRecipe({ ...filled(), servings: '' }).errors.servings).toBe(
      'recipes.errors.servingsRequired'
    );
    expect(validateRecipe({ ...filled(), servings: '0' }).errors.servings).toBe(
      'recipes.errors.notPositive'
    );
    expect(validateRecipe({ ...filled(), servings: 'four' }).errors.servings).toBe(
      'recipes.errors.number'
    );
  });

  it('takes an optional cooked weight in grams', () => {
    expect(validateRecipe({ ...filled(), cookedWeight: '1200' }).values.cookedWeightG).toBe(1200);
    expect(validateRecipe({ ...filled(), cookedWeight: '' }).values.cookedWeightG).toBeNull();
    expect(validateRecipe({ ...filled(), cookedWeight: '-3' }).errors.cookedWeight).toBe(
      'recipes.errors.number'
    );
  });

  it('needs at least one ingredient, each with a food and grams', () => {
    expect(validateRecipe(emptyRecipeDraft()).errors.ingredients).toBe(
      'recipes.errors.noIngredients'
    );

    let draft = addIngredient(emptyRecipeDraft(), rice);
    const key = draft.ingredients[0].key;
    expect(validateRecipe(draft).errors[`ingredient:${key}`]).toBe('recipes.errors.gramsRequired');

    draft = setIngredientGrams(draft, key, '0');
    expect(validateRecipe(draft).errors[`ingredient:${key}`]).toBe('recipes.errors.notPositive');

    draft = { ...draft, ingredients: [{ key, food: null, grams: '100' }] };
    expect(validateRecipe(draft).errors[`ingredient:${key}`]).toBe('recipes.errors.noFood');
  });

  it('trims notes and turns blank notes into null, and limits their length', () => {
    expect(validateRecipe({ ...filled(), notes: '  Use day-old rice.  ' }).values.notes).toBe(
      'Use day-old rice.'
    );
    expect(validateRecipe({ ...filled(), notes: '   ' }).values.notes).toBeNull();
    expect(validateRecipe({ ...filled(), notes: 'n'.repeat(2001) }).errors.notes).toBe(
      'recipes.errors.notesTooLong'
    );
  });

  it('keeps the id when editing an existing Recipe', () => {
    expect(validateRecipe({ ...filled(), id: 5 }).values.id).toBe(5);
  });
});

describe('variationName and uniqueIds', () => {
  it('adds the suffix to the original name', () => {
    expect(variationName('  Fried rice ', ' (variation)')).toBe('Fried rice (variation)');
  });

  it('cuts the name so the whole copy name stays within the length limit', () => {
    const long = 'x'.repeat(NAME_MAX + 20);
    const name = variationName(long, ' (variation)');
    expect(name.length).toBe(NAME_MAX);
    expect(name.endsWith(' (variation)')).toBe(true);
  });

  it('sorts Meal Time ids and drops repeats', () => {
    expect(uniqueIds([12, 4, 12, 9])).toEqual([4, 9, 12]);
    expect(uniqueIds(undefined)).toEqual([]);
  });
});

describe('toggleMealTime', () => {
  it('adds a tag once, and removes it when unticked', () => {
    let draft = { ...emptyRecipeDraft(), mealTimeIds: [9] };
    draft = toggleMealTime(draft, 4, true);
    draft = toggleMealTime(draft, 4, true);
    expect(draft.mealTimeIds).toEqual([4, 9]);
    draft = toggleMealTime(draft, 9, false);
    expect(draft.mealTimeIds).toEqual([4]);
  });
});

describe('loadMealTimeOptions', () => {
  it('lists the Meal Times the caller can read, in time order', async () => {
    const client = fakeClient({
      'meal_times:select': {
        data: [
          { id: 2, name: 'Lunch', time_of_day: '12:30:00' },
          { id: 1, name: 'Breakfast', time_of_day: '07:30:00' },
        ],
        error: null,
      },
    });
    const options = await loadMealTimeOptions(client);
    expect(client.calls[0].table).toBe('meal_times');
    expect(client.calls[0].ops.slice(1)).toEqual([
      ['order', 'time_of_day', { ascending: true }],
      ['order', 'id', { ascending: true }],
    ]);
    expect(options).toEqual([
      { id: 2, name: 'Lunch' },
      { id: 1, name: 'Breakfast' },
    ]);
  });

  it('throws when the query fails', async () => {
    const client = fakeClient({ 'meal_times:select': { data: null, error: new Error('down') } });
    await expect(loadMealTimeOptions(client)).rejects.toThrow('down');
  });
});

describe('copyRecipe', () => {
  it('calls the recipe_copy function with the id and the new name, and returns the new id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 77, error: null });
    const id = await copyRecipe({ rpc }, 41, 'Fried rice (variation)');
    expect(rpc).toHaveBeenCalledWith('recipe_copy', {
      p_recipe_id: 41,
      p_name: 'Fried rice (variation)',
    });
    expect(id).toBe(77);
  });

  it('throws when the copy fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('not found') });
    await expect(copyRecipe({ rpc }, 41, 'x')).rejects.toThrow('not found');
  });
});

describe('loadRecipes', () => {
  it('orders starred first, then by name, and sorts ingredients by their sort', async () => {
    const client = fakeClient({
      'recipes:select': {
        data: [
          {
            id: 1,
            name: 'Chili',
            starred: false,
            servings: '4',
            cooked_weight_g: null,
            notes: null,
            copied_from: null,
            recipe_meal_time_tags: [],
            recipe_ingredients: [
              { id: 22, grams: '100', sort: 2, foods: egg },
              { id: 21, grams: '50', sort: 1, foods: rice },
            ],
          },
        ],
        error: null,
      },
    });

    const recipes = await loadRecipes(client);

    expect(client.calls[0].table).toBe('recipes');
    expect(client.calls[0].ops.slice(1)).toEqual([
      ['order', 'starred', { ascending: false }],
      ['order', 'name', { ascending: true }],
    ]);
    expect(recipes).toEqual([
      {
        id: 1,
        name: 'Chili',
        starred: false,
        servings: 4,
        cooked_weight_g: null,
        notes: null,
        copied_from: null,
        meal_time_tags: [],
        ingredients: [
          { id: 21, grams: 50, food: rice },
          { id: 22, grams: 100, food: egg },
        ],
      },
    ]);
  });

  it('maps the original of a copy and the Meal Time tags, named or not', async () => {
    const client = fakeClient({
      'recipes:select': {
        data: [
          {
            id: 5,
            name: 'Chili (variation)',
            starred: false,
            servings: 4,
            cooked_weight_g: null,
            notes: null,
            copied_from: 1,
            recipe_ingredients: [],
            recipe_meal_time_tags: [
              { meal_time_id: 9, meal_times: { id: 9, name: 'Dinner', time_of_day: '18:00:00' } },
              // Another Member's Meal Time: the row comes back with no name.
              { meal_time_id: 3, meal_times: null },
            ],
          },
        ],
        error: null,
      },
    });

    const [recipe] = await loadRecipes(client);

    expect(recipe.copied_from).toBe(1);
    expect(recipe.meal_time_tags).toEqual([
      { id: 3, name: null },
      { id: 9, name: 'Dinner' },
    ]);
    expect(client.calls[0].table).toBe('recipes');
  });

  it('throws when the query fails', async () => {
    const client = fakeClient({ 'recipes:select': { data: null, error: new Error('down') } });
    await expect(loadRecipes(client)).rejects.toThrow('down');
  });
});

describe('searchFoods', () => {
  it('returns nothing for blank text without asking the database', async () => {
    const client = fakeClient();
    expect(await searchFoods(client, '   ')).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('searches the food names and escapes wildcard characters', async () => {
    const client = fakeClient({ 'foods:select': { data: [rice], error: null } });
    const found = await searchFoods(client, ' 100%_rice\\ ');

    expect(found).toEqual([rice]);
    const ops = client.calls[0].ops;
    expect(ops).toContainEqual(['ilike', 'name', '%100\\%\\_rice\\\\%']);
    expect(ops).toContainEqual(['limit', 15]);
  });
});

describe('saveRecipe', () => {
  const values = {
    id: null,
    name: 'Egg fried rice',
    starred: true,
    servings: 2,
    cookedWeightG: 900,
    notes: 'Day-old rice',
    ingredients: [
      { foodId: 7, grams: 200 },
      { foodId: 9, grams: 100 },
    ],
  };

  it('inserts the Recipe, clears its old lines and inserts the new ones in order', async () => {
    const client = fakeClient({
      'recipes:insert': { data: { id: 41 }, error: null },
    });

    const id = await saveRecipe(client, values);

    expect(id).toBe(41);
    const [recipes, lines] = client.calls;
    expect(recipes.ops[0]).toEqual([
      'insert',
      {
        name: 'Egg fried rice',
        starred: true,
        servings: 2,
        cooked_weight_g: 900,
        notes: 'Day-old rice',
      },
    ]);
    expect(lines.table).toBe('recipe_ingredients');
    expect(lines.ops[0]).toEqual(['delete']);
    const insert = client.calls[2];
    expect(insert.table).toBe('recipe_ingredients');
    expect(insert.ops[0]).toEqual([
      'insert',
      [
        { recipe_id: 41, food_id: 7, grams: 200, sort: 0 },
        { recipe_id: 41, food_id: 9, grams: 100, sort: 1 },
      ],
    ]);
  });

  it('updates an existing Recipe instead of inserting one', async () => {
    const client = fakeClient();
    await saveRecipe(client, { ...values, id: 41, ingredients: [] });

    expect(client.calls[0].ops[0][0]).toBe('update');
    expect(client.calls[0].ops).toContainEqual(['eq', 'id', 41]);
    // No ingredients: the old lines are cleared and nothing new is inserted.
    // No tags: the old tags are cleared and nothing new is inserted.
    expect(client.calls.map((call) => call.table)).toEqual([
      'recipes',
      'recipe_ingredients',
      'recipe_meal_time_tags',
    ]);
  });

  it('replaces the Meal Time tags: clears the old ones, then inserts the ticked ones', async () => {
    const client = fakeClient({
      'recipes:insert': { data: { id: 41 }, error: null },
    });
    await saveRecipe(client, { ...values, mealTimeIds: [4, 12] });

    const tags = client.calls.filter((call) => call.table === 'recipe_meal_time_tags');
    expect(tags[0].ops).toEqual([['delete'], ['eq', 'recipe_id', 41]]);
    expect(tags[1].ops[0]).toEqual([
      'insert',
      [
        { recipe_id: 41, meal_time_id: 4 },
        { recipe_id: 41, meal_time_id: 12 },
      ],
    ]);
  });

  it('throws when the Recipe cannot be saved', async () => {
    const client = fakeClient({
      'recipes:insert': { data: null, error: new Error('denied') },
    });
    await expect(saveRecipe(client, values)).rejects.toThrow('denied');
  });
});

describe('deleteRecipe', () => {
  it('deletes the Recipe by id (its lines go with it)', async () => {
    const client = fakeClient();
    await deleteRecipe(client, 41);
    expect(client.calls[0].table).toBe('recipes');
    expect(client.calls[0].ops).toEqual([['delete'], ['eq', 'id', 41]]);
  });
});
