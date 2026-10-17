import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  displayName,
  nutritionFor,
  saveFoodNames,
  saveUsdaFoodAndTranslate,
  searchFoods,
} from '../lib/foods.js';
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
  // The Food Library food whose names are being edited: { key, id, name, nameEs, status }
  const [editing, setEditing] = useState(null);

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

  // Clears the results so the list shows "Searching" until the refreshed search lands.
  function refreshAfterChange() {
    setSearch((current) => ({ ...current, query: '' }));
    setRefreshKey((key) => key + 1);
  }

  async function handleSave(result) {
    setSaveState({ key: result.key, status: 'saving' });
    try {
      // The Spanish name is filled after the save; a failed translation keeps the food saved.
      await saveUsdaFoodAndTranslate(supabase, result.fdcId);
      setSaveState({ key: null, status: 'saved' });
      refreshAfterChange();
    } catch {
      setSaveState({ key: result.key, status: 'error' });
    }
  }

  function startEditing(result) {
    setEditing({
      key: result.key,
      id: result.id,
      name: result.name,
      nameEs: result.nameEs || '',
      status: null,
    });
  }

  async function handleSaveNames(event) {
    event.preventDefault();
    if (editing.name.trim() === '') {
      setEditing({ ...editing, status: 'empty' });
      return;
    }
    setEditing({ ...editing, status: 'saving' });
    try {
      await saveFoodNames(supabase, editing.id, { name: editing.name, nameEs: editing.nameEs });
      setEditing(null);
      setSaveState({ key: null, status: 'namesSaved' });
      refreshAfterChange();
    } catch {
      setEditing((current) => (current ? { ...current, status: 'error' } : current));
    }
  }

  function renderNameForm() {
    const busy = editing.status === 'saving';
    return (
      <form onSubmit={handleSaveNames} aria-label={t('foods.editNamesLabel')}>
        <label>
          {t('foods.englishName')}
          <input
            type="text"
            value={editing.name}
            onChange={(event) => setEditing({ ...editing, name: event.target.value })}
          />
        </label>
        <label>
          {t('foods.spanishName')}
          <input
            type="text"
            value={editing.nameEs}
            onChange={(event) => setEditing({ ...editing, nameEs: event.target.value })}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? t('foods.saving') : t('foods.saveNames')}
        </button>
        <button type="button" onClick={() => setEditing(null)}>
          {t('foods.cancel')}
        </button>
        {editing.status === 'empty' && <p role="alert">{t('foods.nameRequired')}</p>}
        {editing.status === 'error' && <p role="alert">{t('foods.namesSaveError')}</p>}
      </form>
    );
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
                    {displayName(result, locale)}
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
                  {result.source === 'library' &&
                    (editing && editing.key === result.key ? (
                      renderNameForm()
                    ) : (
                      <button type="button" onClick={() => startEditing(result)}>
                        {t('foods.editNames')}
                      </button>
                    ))}
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
      {saveState.status === 'namesSaved' && <p role="status">{t('foods.namesSaved')}</p>}
      {body}
    </section>
  );
}
