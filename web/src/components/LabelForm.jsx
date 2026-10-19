import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { parseLabelForm, saveLabelFood } from '../lib/label.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';
import LabelPhotoPicker from './LabelPhotoPicker.jsx';

// The fields, in the order a Nutrition Facts label reads. Each is a text box so a comma
// works as the decimal mark; lib/label.js reads the numbers.
const FIELDS = [
  ['name', 'foods.labelName', 'text'],
  ['brand', 'foods.labelBrand', 'text'],
  ['servingGrams', 'foods.labelServing', 'decimal'],
  ['kcal', 'foods.labelKcal', 'decimal'],
  ['protein', 'foods.labelProtein', 'decimal'],
  ['carbs', 'foods.labelCarbs', 'decimal'],
  ['fat', 'foods.labelFat', 'decimal'],
  ['fibre', 'foods.labelFibre', 'decimal'],
  ['sugars', 'foods.labelSugars', 'decimal'],
  ['sodium', 'foods.labelSodium', 'decimal'],
];

// The message for each validation key from lib/label.js.
const ERROR_KEYS = {
  required: 'foods.labelRequired',
  number: 'foods.labelNumber',
  range: 'foods.labelRange',
  tooLong: 'foods.labelTooLong',
  overServing: 'foods.labelOverServing',
  sugarsOverCarbs: 'foods.labelSugarsOverCarbs',
};

const EMPTY = Object.fromEntries(FIELDS.map(([field]) => [field, '']));

// Types in a food from its Nutrition Facts label, for a barcode nothing knows (ticket 20).
// onSaved receives the new Food Library id. A far-off calorie total asks for a second press
// ("Save anyway") before the food is saved.
export default function LabelForm({ code, onSaved, onCancel }) {
  const { t } = useI18n();
  const units = useUnits();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  // null, 'confirmEnergy' (the calories need a second press), 'saving' or 'error'
  const [status, setStatus] = useState(null);
  const [energy, setEnergy] = useState(null);

  function change(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    // Any edit makes the earlier calorie confirmation out of date
    setStatus((current) => (current === 'confirmEnergy' ? null : current));
  }

  async function save(food) {
    setStatus('saving');
    try {
      const id = await saveLabelFood(supabase, code, food);
      onSaved(id);
    } catch {
      setStatus('error');
    }
  }

  function submit(event) {
    event.preventDefault();
    const outcome = parseLabelForm(values, units.units);
    if (!outcome.ok) {
      setErrors(outcome.errors);
      setStatus(null);
      return;
    }
    setErrors({});
    if (outcome.food.energyWarning && status !== 'confirmEnergy') {
      setEnergy({
        kcal: outcome.food.perServing.kcal,
        expected: outcome.food.energyWarning.expected,
      });
      setStatus('confirmEnergy');
      return;
    }
    save(outcome.food);
  }

  function saveAnyway() {
    const outcome = parseLabelForm(values, units.units);
    if (!outcome.ok) {
      setErrors(outcome.errors);
      setStatus(null);
      return;
    }
    save(outcome.food);
  }

  const busy = status === 'saving';

  return (
    <form noValidate onSubmit={submit} aria-label={t('foods.labelTitle')}>
      <h4>{t('foods.labelTitle')}</h4>
      <p>{t('foods.labelIntro')}</p>
      <p>{t('foods.labelBlankNote')}</p>
      <LabelPhotoPicker
        onValues={(photoValues) => {
          // Pre-fill only: the Member still checks and presses Save (ticket 66)
          setValues(photoValues);
          setErrors({});
          setStatus(null);
        }}
      />
      {FIELDS.map(([field, labelKey, mode]) => {
        const errorKey = errors[field];
        const id = `label-${field}`;
        return (
          <div key={field}>
            <label htmlFor={id}>{t(labelKey, { unit: units.massUnit })}</label>
            <input
              id={id}
              type="text"
              inputMode={mode === 'decimal' ? 'decimal' : 'text'}
              value={values[field]}
              aria-invalid={errorKey ? 'true' : undefined}
              onChange={(event) => change(field, event.target.value)}
            />
            {errorKey && <p role="alert">{t(ERROR_KEYS[errorKey] ?? 'foods.labelRange')}</p>}
          </div>
        );
      })}
      {status === 'confirmEnergy' && energy && (
        <div role="alert">
          <p>
            {t('foods.labelEnergyWarning', {
              kcal: Math.round(energy.kcal),
              expected: Math.round(energy.expected),
            })}
          </p>
          <button type="button" disabled={busy} onClick={saveAnyway}>
            {t('foods.labelSaveAnyway')}
          </button>
        </div>
      )}
      <button type="submit" disabled={busy}>
        {busy ? t('foods.saving') : t('foods.labelSave')}
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        {t('foods.cancel')}
      </button>
      {status === 'error' && <p role="alert">{t('foods.labelSaveError')}</p>}
    </form>
  );
}
