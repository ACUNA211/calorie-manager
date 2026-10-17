import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { searchFoods } from '../lib/foods.js';
import { searchTokens } from '../lib/norm.js';
import { insertEntry, libraryFoodFor } from '../lib/today.js';
import {
  MAX_LOG_GRAMS,
  amountToGrams,
  buildLogRow,
  clockTime,
  defaultMealTimeId,
  entryNutrition,
  logProblem,
} from '../lib/todayLogic.js';
import { normalizeTime } from '../lib/mealTimesLogic.js';
import { isNetworkError, makeClientId } from '../lib/offlineQueue.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

// Marks the "another time" choice in the Meal Time picker.
const OTHER = 'other';

const EMPTY_SEARCH = {
  status: 'idle',
  results: [],
  libraryFailed: false,
  usdaFailed: false,
  offlineSearch: false,
};

// Log food: search the Food Library and USDA, pick a food, enter an amount and a Meal Time,
// then save it as a Calorie Log entry. A USDA food is saved to the Food Library first, so
// the entry has its macros. onLogged receives the stored row, or the queued row (with
// `pending`) when there is no connection (ticket #34). `offline` comes from useOfflineLog: it
// says whether the phone is online, searches the foods kept on the phone, and queues entries.
export default function LogFoodPanel({
  memberId,
  logDate,
  todayKey,
  meals,
  weekday,
  onLogged,
  offline,
}) {
  const { t, formatNumber } = useI18n();
  const number = (value, digits = 0) => formatNumber(value, { maximumFractionDigits: digits });
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const searchRun = useRef(0);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('100');
  const [unit, setUnit] = useState('grams');
  // The nearest Meal Time to the clock when the panel opens; "another time" when none applies.
  const [nearestId] = useState(() => defaultMealTimeId(meals, weekday, new Date()));
  const [mealChoice, setMealChoice] = useState(() =>
    nearestId == null ? OTHER : String(nearestId)
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();
    const text = query.trim();
    if (searchTokens(text).length === 0) {
      setSearch(EMPTY_SEARCH);
      return;
    }
    const run = searchRun.current + 1;
    searchRun.current = run;
    setSearch((current) => ({ ...current, status: 'searching' }));
    if (!offline.online) {
      // No connection: only the foods this phone has seen online. USDA needs a connection.
      setSearch({
        ...EMPTY_SEARCH,
        status: 'ready',
        results: offline.searchOffline(text),
        offlineSearch: true,
      });
      return;
    }
    const outcome = await searchFoods(supabase, text);
    if (run !== searchRun.current) return;
    offline.rememberFoods(outcome.results);
    setSearch({
      status: 'ready',
      results: outcome.results,
      libraryFailed: outcome.libraryFailed,
      usdaFailed: outcome.usdaFailed,
      offlineSearch: false,
    });
  }

  // A food with a serving size starts in servings (one serving); otherwise in grams.
  function pick(result) {
    setSelected(result);
    setError('');
    if (result.servingGrams > 0) {
      setUnit('servings');
      setAmount('1');
    } else {
      setUnit('grams');
      setAmount('100');
    }
  }

  const parsed = selected
    ? amountToGrams({ amount, unit, servingGrams: selected.servingGrams })
    : null;
  const nutrition = parsed?.ok ? entryNutrition(selected, parsed.grams) : null;

  async function handleLog(event) {
    event.preventDefault();
    if (busy) return;
    const problem = logProblem({ food: selected, amount, unit, logDate, todayKey });
    if (problem) {
      setError(t(problem, { max: MAX_LOG_GRAMS }));
      return;
    }
    const amounts = amountToGrams({ amount, unit, servingGrams: selected.servingGrams });
    // A USDA food is saved to the Food Library before it is logged, which needs a connection.
    if (!offline.online && selected.source !== 'library') {
      setError(t('today.offline.usdaSaveNeedsConnection'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      let food;
      try {
        food = await libraryFoodFor(supabase, selected);
      } catch {
        setError(t('today.log.errors.usdaSave'));
        return;
      }

      const nutritionNow = entryNutrition(food, amounts.grams);
      if (nutritionNow.kcal == null) {
        setError(t('today.log.errors.noKcal'));
        return;
      }

      const mealTimeId = mealChoice === OTHER ? null : Number(mealChoice);
      // The client_id lets a queued entry be resent without logging it twice (migration 025).
      const row = {
        ...buildLogRow({
          memberId,
          logDate,
          food,
          grams: amounts.grams,
          servings: amounts.servings,
          nutrition: nutritionNow,
          mealTimeId,
          logTime: clockTime(new Date()),
        }),
        client_id: makeClientId(),
      };
      await saveEntry(row);
    } finally {
      setBusy(false);
    }
  }

  // Saves the row now when the phone is online. With no connection, or when the request never
  // got an answer, the row waits on the phone instead and is sent later (see useOfflineLog).
  async function saveEntry(row) {
    let saved = null;
    if (offline.online) {
      try {
        saved = await insertEntry(supabase, row);
      } catch (failure) {
        if (!isNetworkError(failure)) {
          setError(t('today.log.errors.saveError'));
          return;
        }
      }
    }
    if (saved) {
      onLogged(saved);
      return;
    }
    try {
      onLogged(offline.enqueue(row));
    } catch {
      setError(t('today.offline.storageError'));
    }
  }

  return (
    <section aria-labelledby="log-food-heading">
      <h2 id="log-food-heading">{t('today.log.heading')}</h2>
      {offline.online ? null : <p>{t('today.offline.banner')}</p>}

      <form onSubmit={handleSearch}>
        <label>
          {t('today.log.searchLabel')}{' '}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>{' '}
        <button type="submit" disabled={search.status === 'searching'}>
          {search.status === 'searching' ? t('today.log.searching') : t('today.log.search')}
        </button>
      </form>

      {search.libraryFailed ? <p role="alert">{t('today.log.libraryFailed')}</p> : null}
      {search.usdaFailed ? <p role="alert">{t('today.log.usdaFailed')}</p> : null}
      {search.offlineSearch ? <p>{t('today.offline.usdaNeedsConnection')}</p> : null}
      {search.status === 'ready' && search.results.length === 0 ? (
        <p>{t('today.log.none')}</p>
      ) : null}

      {search.results.length > 0 ? (
        <ul>
          {search.results.map((result) => (
            <li key={result.key}>
              <span>
                {result.name}
                {result.brand ? ` (${result.brand})` : ''}
              </span>{' '}
              <span>
                {result.source === 'library'
                  ? t('today.log.sourceLibrary')
                  : t('today.log.sourceUsda')}
              </span>{' '}
              <button type="button" onClick={() => pick(result)}>
                {t('today.log.pick')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <form onSubmit={handleLog}>
          <p>
            {t('today.log.selected', { name: selected.name })}{' '}
            <button type="button" onClick={() => setSelected(null)}>
              {t('today.log.change')}
            </button>
          </p>
          <label>
            {t('today.log.amount')}{' '}
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>{' '}
          {selected.servingGrams > 0 ? (
            <label>
              {t('today.log.unit')}{' '}
              <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                <option value="grams">{t('today.log.unitGrams')}</option>
                <option value="servings">{t('today.log.unitServings')}</option>
              </select>
            </label>
          ) : null}
          {selected.servingGrams > 0 ? (
            <p>{t('today.log.servingHint', { grams: number(selected.servingGrams, 1) })}</p>
          ) : null}
          <p>
            <label>
              {t('today.log.mealTime')}{' '}
              <select value={mealChoice} onChange={(event) => setMealChoice(event.target.value)}>
                {meals.map((meal) => (
                  <option key={meal.id} value={String(meal.id)}>
                    {t('today.log.mealOption', {
                      name: meal.name,
                      time: normalizeTime(meal.time_of_day),
                    })}
                    {Number(meal.id) === Number(nearestId) ? t('today.log.nearestSuffix') : ''}
                  </option>
                ))}
                <option value={OTHER}>{t('today.otherTime')}</option>
              </select>
            </label>
          </p>
          {nutrition && nutrition.kcal != null ? (
            <div>
              <p>{t('today.log.preview', { kcal: number(nutrition.kcal) })}</p>
              <p>
                {nutrition.protein != null && nutrition.carbs != null && nutrition.fat != null
                  ? t('today.log.previewMacros', {
                      protein: number(nutrition.protein, 1),
                      carbs: number(nutrition.carbs, 1),
                      fat: number(nutrition.fat, 1),
                    })
                  : t('today.log.previewNoMacros')}
              </p>
            </div>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? t('today.log.saving') : t('today.log.submit')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
