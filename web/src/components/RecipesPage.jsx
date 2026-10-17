import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadRecipes } from '../lib/recipes.js';
import { recipeTotals } from '../lib/recipeTotals.js';
import RecipeEditor from './RecipeEditor.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

// The Meal Time names a Recipe is tagged with, one line, or '' when it has none.
function tagLabel(recipe, t) {
  const names = (recipe.meal_time_tags ?? []).map(
    (tag) => tag.name ?? t('recipes.tags.unavailable')
  );
  return names.length > 0 ? t('recipes.tags.label', { names: names.join(', ') }) : '';
}

// Whether every word typed is part of the Recipe's name (case and accents ignored).
function matchesSearch(recipe, text) {
  const words = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const name = recipe.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return words.every((word) => name.includes(word));
}

// The Household's Recipes (shared by row-level security), with a search and an editor.
// Editing state: null shows the list; { recipe: null } creates; { recipe } edits.
export default function RecipesPage() {
  const { t, formatNumber } = useI18n();
  const [state, setState] = useState({ status: 'loading', recipes: [] });
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const recipes = await loadRecipes(supabase);
      setState({ status: 'ready', recipes });
    } catch {
      setState((current) => ({ ...current, status: 'error' }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadRecipes(supabase)
      .then((recipes) => {
        if (active) setState({ status: 'ready', recipes });
      })
      .catch(() => {
        if (active) setState({ status: 'error', recipes: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  // Closing the editor reloads the list after a save or a delete.
  function handleClose(changed) {
    setEditing(null);
    if (changed) refresh();
  }

  if (editing) {
    const original = editing.recipe?.copied_from;
    const originalName = state.recipes.find((recipe) => recipe.id === original)?.name ?? null;
    return (
      <RecipeEditor recipe={editing.recipe} originalName={originalName} onClose={handleClose} />
    );
  }

  if (state.status === 'loading') return <p>{t('recipes.loading')}</p>;
  if (state.status === 'error') return <p role="alert">{t('recipes.loadError')}</p>;

  const shown = state.recipes.filter(
    (recipe) => (!starredOnly || recipe.starred) && matchesSearch(recipe, query)
  );
  const namesById = new Map(state.recipes.map((recipe) => [recipe.id, recipe.name]));

  return (
    <section aria-labelledby="recipes-heading">
      <h2 id="recipes-heading">{t('recipes.heading')}</h2>

      {state.recipes.length === 0 ? (
        <p>{t('recipes.empty')}</p>
      ) : (
        <>
          <label htmlFor="recipes-search">{t('recipes.searchLabel')}</label>
          <input
            id="recipes-search"
            type="search"
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div>
            <input
              id="recipes-starred-only"
              type="checkbox"
              checked={starredOnly}
              onChange={(event) => setStarredOnly(event.target.checked)}
            />{' '}
            <label htmlFor="recipes-starred-only">{t('recipes.filters.starredOnly')}</label>
          </div>
          {shown.length === 0 && <p>{t('recipes.noMatches')}</p>}
          <ul>
            {shown.map((recipe) => {
              const totals = recipeTotals(recipe);
              const kcal = totals.kcal.perServing;
              const tags = tagLabel(recipe, t);
              const hasOriginal = recipe.copied_from != null;
              const originalName = namesById.get(recipe.copied_from);
              return (
                <li key={recipe.id}>
                  <button type="button" onClick={() => setEditing({ recipe })}>
                    {recipe.starred && <span aria-label={t('recipes.starred')}>★ </span>}
                    <strong>{recipe.name}</strong>
                  </button>
                  <div>
                    {t('recipes.makes', { count: formatNumber(recipe.servings) })}
                    {' · '}
                    {kcal === null
                      ? t('recipes.unknown')
                      : t('recipes.perServing', {
                          kcal: formatNumber(kcal, { maximumFractionDigits: 0 }),
                        })}
                  </div>
                  {tags && <div>{tags}</div>}
                  {hasOriginal && (
                    <div>
                      {originalName
                        ? t('recipes.copy.original', { name: originalName })
                        : t('recipes.copy.originalMissing')}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button type="button" onClick={() => setEditing({ recipe: null })}>
        {t('recipes.addButton')}
      </button>
    </section>
  );
}
