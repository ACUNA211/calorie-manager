import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useActingMember } from '../lib/actingMember.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { normalizeUnits } from '../lib/units.js';

// The display units (ticket #11) of the Member being acted as: metric or US. Saving writes the
// Member's own display_units (migration 031) and reloads the Household, so every screen shows
// the new units straight away. Stored values stay in grams and kilograms.
export default function UnitsSetting() {
  const { t } = useI18n();
  const { actingMemberId, actingUnits, refresh } = useActingMember();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  if (actingMemberId === null || actingMemberId === undefined) return null;

  async function change(event) {
    const next = normalizeUnits(event.target.value);
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase
        .from('members')
        .update({ display_units: next })
        .eq('id', actingMemberId);
      if (error) throw error;
      await refresh();
      setNotice('saved');
    } catch {
      setNotice('saveError');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="units-setting-heading">
      <h2 id="units-setting-heading">{t('units.heading')}</h2>
      <p>{t('units.help')}</p>
      <label>
        {t('units.label')}{' '}
        <select value={normalizeUnits(actingUnits)} disabled={busy} onChange={change}>
          <option value="us">{t('units.us')}</option>
          <option value="metric">{t('units.metric')}</option>
        </select>
      </label>
      {notice === 'saved' && <p role="status">{t('units.saved')}</p>}
      {notice === 'saveError' && <p role="alert">{t('units.saveError')}</p>}
    </section>
  );
}
