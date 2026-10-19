import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadIntake } from '../lib/intake.js';
import { loadTargets, rowToForm, saveTargets, validateTargets } from '../lib/targets.js';
import { decideTargetsUpdate } from '../lib/weightSuggestion.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { formatNumber } from '../i18n/format.js';

const LABELS = {
  calorieTarget: 'weightSuggest.calorie',
  proteinFloor: 'weightSuggest.protein',
  carbLow: 'weightSuggest.carbLow',
  carbHigh: 'weightSuggest.carbHigh',
  fatLow: 'weightSuggest.fatLow',
  fatHigh: 'weightSuggest.fatHigh',
};

// Ticket #65: shown under the weight form right after a new weight is logged. It re-runs the
// Intake formula with that weight and, when the Calorie Target or protein floor would change,
// asks "Update your Targets?" with old -> new values. Nothing is saved unless the Member says
// yes; no keeps the current Targets. A Dependent, or a Member without Intake answers, sees
// nothing. Mount it with a new `key` for each logged weight.
export default function TargetsSuggestion({ memberId, kg, isLatest, isDependent, todayKey }) {
  const { t, locale } = useI18n();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (isDependent) {
          if (active) setState({ status: 'hidden' });
          return;
        }
        const [intake, targets] = await Promise.all([
          loadIntake(supabase, memberId),
          loadTargets(supabase, memberId),
        ]);
        if (!active) return;
        const decision = decideTargetsUpdate({
          isDependent,
          intake,
          targets,
          kg,
          todayKey,
          isLatest,
        });
        setState(decision.show ? { status: 'asking', decision, targets } : { status: 'hidden' });
      } catch {
        if (active) setState({ status: 'hidden' });
      }
    })();
    return () => {
      active = false;
    };
  }, [memberId, kg, isLatest, isDependent, todayKey]);

  if (state.status === 'loading' || state.status === 'hidden') return null;
  if (state.status === 'kept') return <p role="status">{t('weightSuggest.kept')}</p>;
  if (state.status === 'saved') return <p role="status">{t('weightSuggest.saved')}</p>;

  const { decision, targets } = state;
  const number = (value) =>
    value === null ? t('weightSuggest.notSet') : formatNumber(value, locale);

  async function handleYes() {
    const result = validateTargets({ ...rowToForm(targets), ...decision.form });
    if (!result.ok) {
      setState((current) => ({ ...current, error: true }));
      return;
    }
    setState((current) => ({ ...current, busy: true, error: false }));
    try {
      await saveTargets(supabase, memberId, result.values);
      setState({ status: 'saved' });
    } catch {
      setState((current) => ({ ...current, busy: false, error: true }));
    }
  }

  return (
    <section className="weight-suggest" aria-labelledby="weight-suggest-heading">
      <h4 id="weight-suggest-heading">{t('weightSuggest.heading')}</h4>
      <p>{t('weightSuggest.explain')}</p>
      <ul className="plain">
        {decision.changes.map((change) => (
          <li key={change.field}>
            {t('weightSuggest.change', {
              label: t(LABELS[change.field]),
              from: number(change.from),
              to: number(change.to),
            })}
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary" disabled={state.busy} onClick={handleYes}>
        {t('weightSuggest.yes')}
      </button>{' '}
      <button type="button" disabled={state.busy} onClick={() => setState({ status: 'kept' })}>
        {t('weightSuggest.no')}
      </button>
      {state.error ? <p role="alert">{t('weightSuggest.saveError')}</p> : null}
    </section>
  );
}
