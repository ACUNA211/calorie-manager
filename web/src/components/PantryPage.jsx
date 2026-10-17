import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadPantry } from '../lib/pantry.js';
import { groupBySection, visibleItems } from '../lib/pantryLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import PantryAddForm from './PantryAddForm.jsx';
import PantryList from './PantryList.jsx';
import PantryScan from './PantryScan.jsx';

// The Household's Pantry: add a food with an amount, and correct what is there. Every
// Member sees the same list, so the list is reloaded after each change.
export default function PantryPage() {
  const { t } = useI18n();
  const [pantry, setPantry] = useState({ status: 'loading', items: [] });

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  // Each reload (first load, or after a change) reads the Pantry again. A read that was
  // overtaken by a newer one is dropped.
  useEffect(() => {
    let active = true;
    loadPantry(supabase)
      .then((items) => {
        if (active) setPantry({ status: 'ready', items });
      })
      .catch(() => {
        if (active) setPantry((current) => ({ ...current, status: 'error' }));
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <section>
      <h2>{t('pantry.heading')}</h2>
      <p>{t('pantry.intro')}</p>
      <PantryScan onAdded={refresh} />
      <PantryAddForm onAdded={refresh} />
      {pantry.status === 'loading' && <p>{t('pantry.loading')}</p>}
      {pantry.status === 'error' && <p role="alert">{t('pantry.loadError')}</p>}
      {pantry.status === 'ready' &&
        (visibleItems(pantry.items).length === 0 ? (
          <p>{t('pantry.empty')}</p>
        ) : (
          <PantryList groups={groupBySection(pantry.items)} onChanged={refresh} />
        ))}
    </section>
  );
}
