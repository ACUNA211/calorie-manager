import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { nutritionFor, saveUsdaFood, searchFoods } from '../lib/foods.js';
import { searchTokens } from '../lib/norm.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { formatNumber } from '../i18n/format.js';

// Waits this long after the last keystroke before searching.
const SEARCH_DELAY_MS = 300;

const NUTRIENT_ROWS = [
  ['kcal', 'foods.kcal', 'foods.kcalValue'],
  ['protein', 'foods.protein', 'foods.grams'],
  ['carbs', 'foods.carbs', 'foods.grams'],
  ['fat', 'foods.fat', 'foods.grams'],
  ['fibre', 'foods.fibre', 'foods.grams'],
  ['sugars', 'foods.sugars', 'foods.grams'],
  ['sodium', 'foods.sodium', 'foods.milligrams'],
];

// Search the Food Library first and USDA second, show calories and macros per 100 g and
// per serving, and save a USDA result into the Food Library.
export default function FoodsPage() {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({
    status: 'idle',
    query: '',
    results: [],
    libraryFailed: false,
    usdaFailed: false,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [saveState, setSaveState] = useState({ key: null, status: null });

  const text = query.trim();
  // Punctuation alone (no words to search for) runs no search.
  const searchable = searchTokens(text).length > 0;

  // Each new query (or a save) starts one search after the typing pauses. A search that
  // was overtaken by a newer one is dropped.
  useEffect(() => {
    if (!searchable) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      const outcome = await searchFoods(supabase, text);
      if (!active) return;
      setSearch({
        status: 'ready',
        query: text,
        results: outcome.results,
        libraryFailed: outcome.libraryFailed,
        usdaFailed: outcome.usdaFailed,
      });
    }, SEARCH_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text, searchable, refreshKey]);

  // Results only count while they answer the current text.
  const ready = searchable && search.status === 'ready' && search.query === text ? search : null;

  async function handleSave(result) {
    setSaveState({ key: result.key, status: 'saving' });
    try {
      await saveUsdaFood(supabase, result.fdcId);
      setSaveState({ key: null, status: 'saved' });
      // Clear the results so the list shows "Searching" until the refreshed search lands.
      setSearch((current) => ({ ...current, query: '' }));
      setRefreshKey((key) => key + 1);
    } catch {
      setSaveState({ key: result.key, status: 'error' });
    }
  }

  const formatValue = (value, unitKey) => {
    if (value === null || value === undefined) return t('foods.notReported');
    return t(unitKey, { value: formatNumber(value, locale, { maximumFractionDigits: 1 }) });
  };

  function renderNutrition(result) {
    const view = nutritionFor(result);
    const hasPerServing = view.perServing !== null;
    return (
      <div>
        {!result.macros && <p>{t('foods.macrosAfterSave')}</p>}
        <table>
          <thead>
            <tr>
              <th scope="col">{t('foods.per100g')}</th>
              {hasPerServing && <th scope="col">{t('foods.perServing')}</th>}
            </tr>
          </thead>
          <tbody>
            {NUTRIENT_ROWS.map(([key, labelKey, unitKey]) => (
              <tr key={key}>
                <th scope="row">{t(labelKey)}</th>
                <td>
                  {formatValue(key === 'kcal' ? view.per100g.kcal : view.per100g[key], unitKey)}
                </td>
                {hasPerServing && (
                  <td>
                    {formatValue(
                      key === 'kcal' ? view.perServing.kcal : view.perServing[key],
                      unitKey
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {hasPerServing ? (
          <p>
            {t('foods.servingLine', {
              label: view.perServing.label || t('foods.grams', { value: view.perServing.grams }),
              grams: formatNumber(view.perServing.grams, locale, { maximumFractionDigits: 1 }),
            })}
          </p>
        ) : (
          <p>{t('foods.noServing')}</p>
        )}
      </div>
    );
  }

  function renderResults() {
    const { results, libraryFailed, usdaFailed } = ready;
    return (
      <>
        {libraryFailed && <p role="alert">{t('foods.libraryLoadError')}</p>}
        {usdaFailed && <p role="alert">{t('foods.usdaLoadError')}</p>}
        {results.length === 0 ? (
          <p>{t('foods.noResults', { query: text })}</p>
        ) : (
          <ul>
            {results.map((result) => {
              const isSaving = saveState.key === result.key && saveState.status === 'saving';
              const failed = saveState.key === result.key && saveState.status === 'error';
              return (
                <li key={result.key}>
                  <h3>
                    {result.name}
                    {result.brand ? ` · ${result.brand}` : ''}
                  </h3>
                  <p>{t(result.source === 'library' ? 'foods.inLibrary' : 'foods.fromUsda')}</p>
                  {renderNutrition(result)}
                  {result.source === 'usda' && (
                    <>
                      <button type="button" disabled={isSaving} onClick={() => handleSave(result)}>
                        {isSaving ? t('foods.saving') : t('foods.save')}
                      </button>
                      {failed && <p role="alert">{t('foods.saveError')}</p>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  let body = null;
  if (searchable && !ready) body = <p role="status">{t('foods.searching')}</p>;
  else if (ready) body = renderResults();

  return (
    <section aria-labelledby="foods-heading">
      <h2 id="foods-heading">{t('foods.heading')}</h2>
      <form role="search" onSubmit={(event) => event.preventDefault()}>
        <label>
          {t('foods.searchLabel')}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </form>
      <p>{t('foods.searchHint')}</p>
      {saveState.status === 'saved' && <p role="status">{t('foods.saved')}</p>}
      {body}
    </section>
  );
}
