import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { deleteEntry, updateEntry } from '../lib/today.js';
import {
  MAX_LOG_GRAMS,
  OTHER_TIME,
  clockTime,
  editEntryPatch,
  entryUnits,
  amountToGrams,
  rescaleNutrition,
} from '../lib/todayLogic.js';
import { normalizeTime } from '../lib/mealTimesLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

// Edit one Calorie Log entry: its amount (recalculated), its Meal Time or another time, or
// delete it. onSaved gets the stored row and the entry as it was; onDeleted gets the entry.
// onCancel closes the panel without a change.
export default function EditEntryPanel({ entry, meals, onSaved, onDeleted, onCancel }) {
  const { t, formatNumber } = useI18n();
  const number = (value, digits = 0) => formatNumber(value, { maximumFractionDigits: digits });
  const initial = entryUnits(entry);
  const [amount, setAmount] = useState(initial.amount);
  const [unit, setUnit] = useState(initial.unit);
  const [mealChoice, setMealChoice] = useState(() =>
    entry.meal_time_id == null ? OTHER_TIME : String(entry.meal_time_id)
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const parsed = amountToGrams({ amount, unit, servingGrams: initial.servingGrams });
  const preview = parsed.ok ? rescaleNutrition(entry, parsed.grams) : null;

  async function handleSave(event) {
    event.preventDefault();
    if (busy) return;
    const result = editEntryPatch({
      entry,
      amount,
      unit,
      mealChoice,
      nowTime: clockTime(new Date()),
    });
    if (!result.ok) {
      setError(t(result.error, { max: MAX_LOG_GRAMS }));
      return;
    }
    if (!result.changed) {
      onCancel();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await updateEntry(supabase, entry.id, result.patch);
      onSaved(saved, entry);
    } catch {
      setError(t('today.edit.errors.saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteEntry(supabase, entry.id);
      onDeleted(entry);
    } catch {
      setError(t('today.edit.errors.deleteError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="edit-entry-heading">
      <h2 id="edit-entry-heading">{t('today.edit.heading')}</h2>
      <p>{t('today.edit.food', { name: entry.description })}</p>

      <form onSubmit={handleSave}>
        <label>
          {t('today.log.amount')}{' '}
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>{' '}
        {initial.servingGrams > 0 ? (
          <label>
            {t('today.log.unit')}{' '}
            <select value={unit} onChange={(event) => setUnit(event.target.value)}>
              <option value="grams">{t('today.log.unitGrams')}</option>
              <option value="servings">{t('today.log.unitServings')}</option>
            </select>
          </label>
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
                </option>
              ))}
              <option value={OTHER_TIME}>{t('today.otherTime')}</option>
            </select>
          </label>
        </p>
        {preview && preview.kcal != null ? (
          <div>
            <p>{t('today.log.preview', { kcal: number(preview.kcal) })}</p>
            <p>
              {preview.protein_g != null && preview.carbs_g != null && preview.fat_g != null
                ? t('today.log.previewMacros', {
                    protein: number(preview.protein_g, 1),
                    carbs: number(preview.carbs_g, 1),
                    fat: number(preview.fat_g, 1),
                  })
                : t('today.log.previewNoMacros')}
            </p>
          </div>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? t('today.log.saving') : t('today.edit.save')}
        </button>{' '}
        <button type="button" onClick={onCancel} disabled={busy}>
          {t('today.log.cancel')}
        </button>{' '}
        <button type="button" onClick={handleDelete} disabled={busy}>
          {t('today.edit.delete')}
        </button>
      </form>
    </section>
  );
}
