import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { correctPantryItem } from '../lib/pantry.js';
import { parseGrams } from '../lib/pantryLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';

// The Pantry grouped by store section. Each item can be corrected: used up, about half,
// or a typed amount.
export default function PantryList({ groups, onChanged }) {
  const { t } = useI18n();
  return (
    <>
      {groups.map((group) => (
        <section key={group.section}>
          <h3>{t(`pantry.sections.${group.key}`)}</h3>
          <ul>
            {group.items.map((item) => (
              <PantryRow key={item.id} item={item} onChanged={onChanged} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function PantryRow({ item, onChanged }) {
  const { t } = useI18n();
  const units = useUnits();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function correct(action, typedGrams = null) {
    setBusy(true);
    setError(null);
    try {
      await correctPantryItem(supabase, item.id, action, typedGrams);
      await onChanged();
    } catch {
      setError('pantry.correct.error');
    } finally {
      setBusy(false);
    }
  }

  function handleSet(event) {
    event.preventDefault();
    const parsed = parseGrams(typed, units.units);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    correct('set', parsed.value);
  }

  return (
    <li>
      <p>
        <strong>{item.name}</strong>
        {item.brand ? ` · ${item.brand}` : ''}{' '}
        <span>{t('pantry.grams', { value: units.formatMass(item.grams) })}</span>
      </p>
      <button type="button" disabled={busy} onClick={() => correct('used_up')}>
        {t('pantry.correct.usedUp')}
      </button>{' '}
      <button type="button" disabled={busy} onClick={() => correct('half')}>
        {t('pantry.correct.half')}
      </button>
      <form onSubmit={handleSet}>
        <label>
          {t('pantry.correct.setLabel', { name: item.name, unit: units.massUnit })}
          <input
            type="text"
            inputMode="decimal"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>{' '}
        <button type="submit" disabled={busy}>
          {t('pantry.correct.setButton')}
        </button>
      </form>
      {error && <p role="alert">{t(error)}</p>}
    </li>
  );
}
