import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  bandCalories,
  emptyForm,
  loadTargets,
  resolveMemberId,
  rowToForm,
  saveTargets,
  validateTargets,
} from '../lib/targets.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { formatNumber } from '../i18n/format.js';
import { useActingMember } from '../lib/actingMember.jsx';

// Targets for one Member: the Member being acted as ("logging for", see actingMember.jsx).
// A memberId prop overrides that; without either, the signed-in person's own Member is used.
export default function TargetsPage({ user, memberId }) {
  const { t, locale } = useI18n();
  const { actingMemberId, actingName, actingIsDependent } = useActingMember();
  const targetMemberId = memberId ?? actingMemberId;
  // The state records which request it answers, so a new user or Member shows the
  // loading line until its own Targets arrive, without resetting state inside the effect.
  const requestKey = `${user.id}:${targetMemberId ?? ''}`;
  const [loaded, setLoaded] = useState({ key: null, status: 'loading', memberId: null });
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const id = targetMemberId ?? (await resolveMemberId(supabase, user.id));
        if (id === null || id === undefined) throw new Error('no Member');
        const row = await loadTargets(supabase, id);
        if (!active) return;
        setForm(rowToForm(row));
        setErrors({});
        setNotice(null);
        setLoaded({ key: requestKey, status: 'ready', memberId: id });
      } catch {
        if (active) setLoaded({ key: requestKey, status: 'error', memberId: null });
      }
    })();

    return () => {
      active = false;
    };
  }, [user.id, targetMemberId, requestKey]);

  const state = loaded.key === requestKey ? loaded : { status: 'loading', memberId: null };

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice(null);
    const result = validateTargets(form);
    setErrors(result.errors);
    if (!result.ok) return;

    setBusy(true);
    try {
      await saveTargets(supabase, state.memberId, result.values);
      setNotice('saved');
    } catch {
      setNotice('saveError');
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <p>{t('targets.loading')}</p>;
  if (state.status === 'error') return <p role="alert">{t('targets.loadError')}</p>;

  const aim = aimText();

  function aimText() {
    const check = validateTargets(form);
    const calorieTarget = check.values.calorie_target;
    const aimOk = !check.errors.calorieTarget && !check.errors.bandLow && !check.errors.bandHigh;
    if (!aimOk) return t('targets.aimInvalid');
    if (calorieTarget === null) return t('targets.aimNeedsTarget');
    const { low, high } = bandCalories(
      calorieTarget,
      check.values.band_low_pct,
      check.values.band_high_pct
    );
    return t('targets.aim', {
      low: formatNumber(low, locale),
      high: formatNumber(high, locale),
    });
  }

  const field = (name, labelKey) => {
    const errorKey = errors[name];
    const errorId = `targets-${name}-error`;
    return (
      <div>
        <label>
          {t(labelKey)}
          <input
            type="text"
            inputMode="numeric"
            value={form[name]}
            aria-invalid={errorKey ? 'true' : 'false'}
            aria-describedby={errorKey ? errorId : undefined}
            onChange={(event) => updateField(name, event.target.value)}
          />
        </label>
        {errorKey && (
          <p id={errorId} role="alert">
            {t(errorKey)}
          </p>
        )}
      </div>
    );
  };

  return (
    <section aria-labelledby="targets-heading">
      <h2 id="targets-heading">{t('targets.heading')}</h2>
      {actingIsDependent && !memberId && <p>{t('targets.forDependent', { name: actingName })}</p>}
      <p>{t('targets.clearHint')}</p>
      <form onSubmit={handleSubmit} noValidate>
        {field('calorieTarget', 'targets.calorieTargetLabel')}
        <p>{aim}</p>
        {field('proteinFloor', 'targets.proteinFloorLabel')}
        <fieldset>
          <legend>{t('targets.carbsLegend')}</legend>
          {field('carbLow', 'targets.carbLowLabel')}
          {field('carbHigh', 'targets.carbHighLabel')}
        </fieldset>
        <fieldset>
          <legend>{t('targets.fatLegend')}</legend>
          {field('fatLow', 'targets.fatLowLabel')}
          {field('fatHigh', 'targets.fatHighLabel')}
        </fieldset>
        <fieldset>
          <legend>{t('targets.bandLegend')}</legend>
          {field('bandLow', 'targets.bandLowLabel')}
          {field('bandHigh', 'targets.bandHighLabel')}
        </fieldset>
        <button type="submit" disabled={busy}>
          {busy ? t('targets.saving') : t('targets.saveButton')}
        </button>
        {notice === 'saved' && <p role="status">{t('targets.saved')}</p>}
        {notice === 'saveError' && <p role="alert">{t('targets.saveError')}</p>}
      </form>
    </section>
  );
}
