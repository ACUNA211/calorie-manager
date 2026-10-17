import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  displayName,
  lookupGtin,
  nutritionFor,
  saveFoodNames,
  saveUsdaFoodAndTranslate,
  searchFoods,
} from '../lib/foods.js';
import { searchTokens } from '../lib/norm.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { formatNumber } from '../i18n/format.js';
import ScanPanel from './ScanPanel.jsx';
import OffCredit from './OffCredit.jsx';
import LabelForm from './LabelForm.jsx';

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
  // Scan (ticket 18): null, or { phase, attempt, code, result }. Phases: camera, looking,
  // found, notFound, label (typing in a label, ticket 20), error. scanToken changes whenever the scan opens or closes, so a
  // lookup that finishes after that is dropped.
  const [scan, setScan] = useState(null);
  const scanToken = useRef(0);
  const searchInput = useRef(null);

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
      // A food saved from a scan is looked up again, so it now shows as a Food Library food.
      if (scan && scan.phase === 'found' && scan.result.key === result.key) {
        lookUp(scan.code);
      }
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

  // Opens the camera again (a new attempt remounts the panel, which releases the old one).
  function openScan() {
    scanToken.current += 1;
    setScan((current) => ({ phase: 'camera', attempt: (current?.attempt ?? 0) + 1 }));
  }

  function closeScan() {
    scanToken.current += 1;
    setScan(null);
  }

  // Closes the scan and moves the cursor to the search box, the fallback when a barcode
  // cannot be read or found.
  function searchByName() {
    closeScan();
    searchInput.current?.focus();
  }

  // Looks a scanned code up: the Food Library first, then USDA (inside usda_lookup_gtin).
  async function lookUp(code) {
    scanToken.current += 1;
    const token = scanToken.current;
    setScan({ phase: 'looking', code });
    let next;
    try {
      const outcome = await lookupGtin(supabase, code);
      next =
        outcome.status === 'found'
          ? { phase: 'found', code, result: outcome.result }
          : { phase: 'notFound', code, offStatus: outcome.offStatus ?? null };
    } catch {
      next = { phase: 'error', code };
    }
    if (token === scanToken.current) setScan((current) => ({ ...next, attempt: current?.attempt }));
  }

  // A label typed in and saved (ticket 20): the scan looks the code up again, so the food now
  // shows as a Food Library food, and the search list is refreshed.
  function handleLabelSaved() {
    refreshAfterChange();
    lookUp(scan.code);
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

  // One food as a list item: its name, source, numbers, and Save (USDA) or Edit names (library).
  function renderResultItem(result) {
    const isSaving = saveState.key === result.key && saveState.status === 'saving';
    const failed = saveState.key === result.key && saveState.status === 'error';
    return (
      <li key={result.key}>
        <h3>
          {displayName(result, locale)}
          {result.brand ? ` · ${result.brand}` : ''}
        </h3>
        <p>
          {t(
            result.source === 'library'
              ? result.typedFromLabel
                ? 'foods.inLibraryFromLabel'
                : 'foods.inLibrary'
              : result.source === 'off'
                ? 'foods.fromOff'
                : 'foods.fromUsda'
          )}
        </p>
        {renderNutrition(result)}
        {result.source === 'off' && <OffCredit />}
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
          <ul>{results.map((result) => renderResultItem(result))}</ul>
        )}
      </>
    );
  }

  // The scan area: the camera, then the state of the lookup, with a way out of each.
  function renderScan() {
    if (scan.phase === 'camera') {
      return (
        <ScanPanel
          key={scan.attempt}
          onCode={lookUp}
          onCancel={closeScan}
          onSearch={searchByName}
        />
      );
    }
    if (scan.phase === 'label') {
      return (
        <LabelForm
          key={scan.attempt}
          code={scan.code}
          onSaved={handleLabelSaved}
          onCancel={() => setScan({ ...scan, phase: 'notFound' })}
        />
      );
    }
    if (scan.phase === 'looking') {
      return <p role="status">{t('foods.scanLooking', { code: scan.code })}</p>;
    }
    if (scan.phase === 'found') {
      return (
        <>
          <p role="status">{t('foods.scanFound', { code: scan.code })}</p>
          <ul>{renderResultItem(scan.result)}</ul>
          <button type="button" onClick={openScan}>
            {t('foods.scanAgain')}
          </button>
          <button type="button" onClick={closeScan}>
            {t('foods.scanClose')}
          </button>
        </>
      );
    }
    // notFound and error: never a dead end, so search and scan again are both offered.
    // When Open Food Facts could not answer, the line says to try again, not "not found".
    const offMessage =
      scan.offStatus === 'rateLimited'
        ? t('foods.scanOffBusy')
        : scan.offStatus === 'unavailable'
          ? t('foods.scanOffError')
          : null;
    return (
      <>
        <p role={scan.phase === 'error' ? 'alert' : 'status'}>
          {scan.phase === 'error'
            ? t('foods.scanError')
            : t('foods.scanNotFound', { code: scan.code })}
        </p>
        {offMessage && <p role="status">{offMessage}</p>}
        <button type="button" onClick={searchByName}>
          {t('foods.searchByName')}
        </button>
        {/* Only when no source knows the code, not when Open Food Facts was busy or down */}
        {scan.phase === 'notFound' && !scan.offStatus && (
          <button type="button" onClick={() => setScan({ ...scan, phase: 'label' })}>
            {t('foods.typeInLabel')}
          </button>
        )}
        <button type="button" onClick={openScan}>
          {t('foods.scanAgain')}
        </button>
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
          <input
            ref={searchInput}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </form>
      <p>{t('foods.searchHint')}</p>
      <button type="button" onClick={openScan}>
        {t('foods.scanButton')}
      </button>
      {scan && renderScan()}
      {saveState.status === 'saved' && <p role="status">{t('foods.saved')}</p>}
      {saveState.status === 'namesSaved' && <p role="status">{t('foods.namesSaved')}</p>}
      {body}
    </section>
  );
}
