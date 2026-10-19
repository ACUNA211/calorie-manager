import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { searchLibrary } from '../lib/foods.js';
import { FOOD_CACHE_KEY, jsonStore, searchCachedFoods } from '../lib/offlineQueue.js';
import { validateHandLine } from '../lib/shoppingLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';

// Foods kept on this phone by Today's offline search, so a food can be picked with no signal.
function cachedFoods(query) {
  try {
    return searchCachedFoods(jsonStore(window.localStorage, FOOD_CACHE_KEY, 'array').load(), query);
  } catch {
    return [];
  }
}

// Adds a line by hand: free text, or a food from the Food Library, with an optional amount.
// `onAdd({ name, foodId, grams, text })` does the adding (and queues it with no signal) and
// resolves with { queued }.
export default function ShoppingAddForm({ online, onAdd }) {
  const { t } = useI18n();
  const units = useUnits();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [food, setFood] = useState(null);
  const [matches, setMatches] = useState(null);
  const [message, setMessage] = useState(null);

  async function findFood() {
    const query = name.trim();
    if (query === '') return;
    let found;
    if (online) {
      try {
        found = await searchLibrary(supabase, query);
      } catch {
        found = cachedFoods(query);
      }
    } else {
      found = cachedFoods(query);
    }
    setMatches(found.slice(0, 6));
  }

  function pick(result) {
    setFood(result);
    setName(result.name);
    setMatches(null);
  }

  async function submit(event) {
    event.preventDefault();
    const checked = validateHandLine({
      name,
      food,
      amount,
      parseMass: units.parseMass,
      formatMass: units.formatMass,
    });
    if (!checked.ok) {
      setMessage({ kind: 'error', key: checked.error });
      return;
    }
    try {
      const outcome = await onAdd(checked);
      setName('');
      setAmount('');
      setFood(null);
      setMatches(null);
      setMessage({
        kind: 'status',
        key: outcome.queued ? 'shopping.add.queued' : 'shopping.add.added',
        name: checked.name,
      });
    } catch {
      setMessage({ kind: 'error', key: 'shopping.add.errors.failed' });
    }
  }

  return (
    <form className="shopping-add" onSubmit={submit}>
      <h3>{t('shopping.add.heading')}</h3>
      <label>
        {t('shopping.add.nameLabel')}
        <input
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setFood(null);
          }}
        />
      </label>
      <button type="button" onClick={findFood} disabled={name.trim() === ''}>
        {t('shopping.add.findFood')}
      </button>
      {food ? (
        <p className="small mute">{t('shopping.add.usingFood', { name: food.name })}</p>
      ) : null}
      {matches ? (
        matches.length === 0 ? (
          <p className="small mute">{t('shopping.add.noFoods')}</p>
        ) : (
          <ul className="rows">
            {matches.map((result) => (
              <li key={result.key}>
                <button type="button" onClick={() => pick(result)}>
                  {t('shopping.add.pickFood', { name: result.name })}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      <label>
        {food
          ? t('shopping.add.amountFoodLabel', { unit: units.massUnit })
          : t('shopping.add.amountLabel')}
        <input type="text" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <button type="submit" className="btn-primary">
        {t('shopping.add.button')}
      </button>
      {message?.kind === 'error' ? <p role="alert">{t(message.key)}</p> : null}
      {message?.kind === 'status' ? (
        <p className="small" data-testid="shopping-add-status">
          {t(message.key, { name: message.name })}
        </p>
      ) : null}
    </form>
  );
}
