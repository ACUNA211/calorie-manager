import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { searchFoods } from '../lib/foods.js';
import { addToPantry, foodIdFor } from '../lib/pantry.js';
import { validateAddAmount } from '../lib/pantryLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';

// Search a food (Food Library first, then USDA), enter an amount in the Member's units, and add
// it to the Pantry.
// Adding a food already in the Pantry adds to its amount (the database keeps one row).
export default function PantryAddForm({ onAdded }) {
  const { t } = useI18n();
  const units = useUnits();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState({
    status: 'idle',
    query: '',
    results: [],
    libraryFailed: false,
    usdaFailed: false,
  });
  const [amounts, setAmounts] = useState({});
  const [add, setAdd] = useState({ key: null, status: null, error: null, name: null });

  async function handleSearch(event) {
    event.preventDefault();
    const text = query.trim();
    if (text === '') return;
    setSearch({
      status: 'searching',
      query: text,
      results: [],
      libraryFailed: false,
      usdaFailed: false,
    });
    const outcome = await searchFoods(supabase, text);
    setSearch({
      status: 'ready',
      query: text,
      results: outcome.results,
      libraryFailed: outcome.libraryFailed,
      usdaFailed: outcome.usdaFailed,
    });
  }

  async function handleAdd(result) {
    const parsed = validateAddAmount(amounts[result.key] ?? '', units.units);
    if (!parsed.ok) {
      setAdd({ key: result.key, status: 'error', error: parsed.error, name: null });
      return;
    }
    setAdd({ key: result.key, status: 'saving', error: null, name: null });
    try {
      const foodId = await foodIdFor(supabase, result);
      await addToPantry(supabase, foodId, parsed.value);
      setAmounts((current) => ({ ...current, [result.key]: '' }));
      setAdd({ key: result.key, status: 'saved', error: null, name: result.name });
      await onAdded();
    } catch {
      setAdd({ key: result.key, status: 'error', error: 'pantry.add.error', name: null });
    }
  }

  const ready = search.status === 'ready' ? search : null;

  return (
    <div className="pantry-add">
      <h3>{t('pantry.add.heading')}</h3>
      <form onSubmit={handleSearch} className="search-box">
        <label>
          {t('pantry.add.searchLabel')}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="submit" disabled={query.trim() === '' || search.status === 'searching'}>
          {search.status === 'searching' ? t('pantry.add.searching') : t('pantry.add.search')}
        </button>
      </form>

      {ready && (
        <>
          {ready.libraryFailed && <p role="alert">{t('pantry.add.libraryLoadError')}</p>}
          {ready.usdaFailed && <p role="alert">{t('pantry.add.usdaLoadError')}</p>}
          {ready.results.length === 0 ? (
            <p>{t('pantry.add.noResults', { query: ready.query })}</p>
          ) : (
            <ul className="rows">
              {ready.results.map((result) => {
                const isThis = add.key === result.key;
                return (
                  <li key={result.key}>
                    <h4>
                      {result.name}
                      {result.brand ? ` · ${result.brand}` : ''}
                    </h4>
                    <p className="small mute">
                      {t(
                        result.source === 'library' ? 'pantry.add.inLibrary' : 'pantry.add.fromUsda'
                      )}
                    </p>
                    <label>
                      {t('pantry.add.amountLabel', { name: result.name, unit: units.massUnit })}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={amounts[result.key] ?? ''}
                        onChange={(event) =>
                          setAmounts((current) => ({
                            ...current,
                            [result.key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isThis && add.status === 'saving'}
                      onClick={() => handleAdd(result)}
                    >
                      {isThis && add.status === 'saving'
                        ? t('pantry.add.adding')
                        : t('pantry.add.addButton', { name: result.name })}
                    </button>
                    {isThis && add.status === 'saved' && (
                      <p role="status">{t('pantry.add.added', { name: add.name })}</p>
                    )}
                    {isThis && add.status === 'error' && <p role="alert">{t(add.error)}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
