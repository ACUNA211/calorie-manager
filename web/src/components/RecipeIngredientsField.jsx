import { useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { searchFoods } from '../lib/recipes.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

const SEARCH_DELAY_MS = 250;

// The ingredient lines of a Recipe, plus a search over the Food Library to add more.
// Amounts are typed in grams. The parent owns the draft; this component only reports edits.
export default function RecipeIngredientsField({ ingredients, errors, onAdd, onRemove, onGrams }) {
  const { t } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchFailed, setSearchFailed] = useState(false);

  // Searches a moment after typing stops. A stale result is dropped if the text changed.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const found = await searchFoods(supabase, query);
        if (!active) return;
        setResults(found);
        setSearchFailed(false);
      } catch {
        if (!active) return;
        setResults([]);
        setSearchFailed(true);
      }
    }, SEARCH_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <fieldset>
      <legend>{t('recipes.ingredients.heading')}</legend>

      {ingredients.length === 0 && <p>{t('recipes.ingredients.empty')}</p>}

      <ul>
        {ingredients.map((item) => {
          const name = item.food.name;
          const error = errors[`ingredient:${item.key}`];
          const gramsId = `${searchId}-grams-${item.key}`;
          return (
            <li key={item.key}>
              <label htmlFor={gramsId}>{t('recipes.ingredients.gramsLabel', { name })}</label>{' '}
              <input
                id={gramsId}
                type="text"
                inputMode="decimal"
                value={item.grams}
                onChange={(event) => onGrams(item.key, event.target.value)}
              />{' '}
              <span>{name}</span>{' '}
              <button type="button" onClick={() => onRemove(item.key)}>
                {t('recipes.ingredients.remove', { name })}
              </button>
              {error && (
                <p role="alert" className="field-error">
                  {t(error)}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <label htmlFor={searchId}>{t('recipes.ingredients.searchLabel')}</label>
      <input
        id={searchId}
        type="search"
        value={query}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />

      {searchFailed && <p role="alert">{t('recipes.ingredients.searchError')}</p>}
      {!searchFailed && query.trim() !== '' && results.length === 0 && (
        <p>{t('recipes.ingredients.searchEmpty')}</p>
      )}
      {results.length > 0 && (
        <ul>
          {results.map((food) => (
            <li key={food.id}>
              <button type="button" onClick={() => onAdd(food)}>
                {t('recipes.ingredients.add', { name: food.name })}
              </button>
              {food.brand ? ` ${food.brand}` : ''}
            </li>
          ))}
        </ul>
      )}
      {errors.ingredients && (
        <p role="alert" className="field-error">
          {t(errors.ingredients)}
        </p>
      )}
    </fieldset>
  );
}
