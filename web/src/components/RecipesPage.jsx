import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadRecipes } from '../lib/recipes.js';
import { recipeTotals } from '../lib/recipeTotals.js';
import RecipeEditor from './RecipeEditor.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

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
    return <RecipeEditor recipe={editing.recipe} onClose={handleClose} />;
  }

  if (state.status === 'loading') return <p>{t('recipes.loading')}</p>;
  if (state.status === 'error') return <p role="alert">{t('recipes.loadError')}</p>;

  const shown = state.recipes.filter((recipe) => matchesSearch(recipe, query));

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
          {shown.length === 0 && <p>{t('recipes.noMatches')}</p>}
          <ul>
            {shown.map((recipe) => {
              const totals = recipeTotals(recipe);
              const kcal = totals.kcal.perServing;
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
