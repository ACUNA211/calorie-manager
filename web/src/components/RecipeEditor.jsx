import { useId, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  addIngredient,
  deleteRecipe,
  draftFromRecipe,
  emptyRecipeDraft,
  parseAmount,
  previewIngredients,
  removeIngredient,
  saveRecipe,
  setIngredientGrams,
  validateRecipe,
} from '../lib/recipes.js';
import { gramsPerServing, recipeTotals } from '../lib/recipeTotals.js';
import RecipeIngredientsField from './RecipeIngredientsField.jsx';
import RecipeTotals from './RecipeTotals.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';

// Creates a Recipe (recipe = null) or edits one. onClose(changed) runs after a save or a
// delete (changed true) or a cancel (false), so the list can reload.
export default function RecipeEditor({ recipe, onClose }) {
  const { t, formatNumber } = useI18n();
  const ids = useId();
  const [draft, setDraft] = useState(() => (recipe ? draftFromRecipe(recipe) : emptyRecipeDraft()));
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const servings = parseAmount(draft.servings).value;
  const cooked = parseAmount(draft.cookedWeight).value;
  const totals = recipeTotals({ servings, ingredients: previewIngredients(draft) });
  const perServingGrams = gramsPerServing(cooked, servings);

  async function handleSave(event) {
    event.preventDefault();
    const result = validateRecipe(draft);
    setErrors(result.errors);
    setNotice('');
    if (!result.ok) return;

    setBusy(true);
    try {
      await saveRecipe(supabase, result.values);
      onClose(true);
    } catch {
      setNotice(t('recipes.saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setNotice('');
    try {
      await deleteRecipe(supabase, draft.id);
      onClose(true);
    } catch {
      setNotice(t('recipes.deleteError'));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const fieldId = (name) => `${ids}-${name}`;

  return (
    <section aria-labelledby={fieldId('heading')}>
      <h2 id={fieldId('heading')}>{recipe ? t('recipes.editorEdit') : t('recipes.editorNew')}</h2>
      <button type="button" onClick={() => onClose(false)}>
        {t('recipes.back')}
      </button>

      <form onSubmit={handleSave} noValidate>
        <div>
          <label htmlFor={fieldId('name')}>{t('recipes.fields.name')}</label>
          <input
            id={fieldId('name')}
            type="text"
            value={draft.name}
            aria-invalid={Boolean(errors.name)}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          {errors.name && (
            <p role="alert" className="field-error">
              {t(errors.name)}
            </p>
          )}
        </div>

        <div>
          <input
            id={fieldId('starred')}
            type="checkbox"
            checked={draft.starred}
            onChange={(event) => setDraft({ ...draft, starred: event.target.checked })}
          />{' '}
          <label htmlFor={fieldId('starred')}>{t('recipes.fields.starred')}</label>
        </div>

        <div>
          <label htmlFor={fieldId('servings')}>{t('recipes.fields.servings')}</label>
          <input
            id={fieldId('servings')}
            type="text"
            inputMode="decimal"
            aria-describedby={fieldId('servings-hint')}
            aria-invalid={Boolean(errors.servings)}
            value={draft.servings}
            onChange={(event) => setDraft({ ...draft, servings: event.target.value })}
          />
          <p id={fieldId('servings-hint')}>{t('recipes.hints.servings')}</p>
          {errors.servings && (
            <p role="alert" className="field-error">
              {t(errors.servings)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={fieldId('cooked')}>{t('recipes.fields.cookedWeight')}</label>
          <input
            id={fieldId('cooked')}
            type="text"
            inputMode="decimal"
            aria-describedby={fieldId('cooked-hint')}
            aria-invalid={Boolean(errors.cookedWeight)}
            value={draft.cookedWeight}
            onChange={(event) => setDraft({ ...draft, cookedWeight: event.target.value })}
          />
          <p id={fieldId('cooked-hint')}>
            {perServingGrams === null
              ? t('recipes.hints.cookedWeight')
              : t('recipes.hints.gramsPerServing', {
                  grams: formatNumber(perServingGrams, { maximumFractionDigits: 0 }),
                })}
          </p>
          {errors.cookedWeight && (
            <p role="alert" className="field-error">
              {t(errors.cookedWeight)}
            </p>
          )}
        </div>

        <RecipeIngredientsField
          ingredients={draft.ingredients}
          errors={errors}
          onAdd={(food) => setDraft(addIngredient(draft, food))}
          onRemove={(key) => setDraft(removeIngredient(draft, key))}
          onGrams={(key, grams) => setDraft(setIngredientGrams(draft, key, grams))}
        />

        <RecipeTotals totals={totals} hasIngredients={draft.ingredients.length > 0} />

        <div>
          <label htmlFor={fieldId('notes')}>{t('recipes.fields.notes')}</label>
          <textarea
            id={fieldId('notes')}
            rows={4}
            aria-describedby={fieldId('notes-hint')}
            value={draft.notes}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          />
          <p id={fieldId('notes-hint')}>{t('recipes.hints.notes')}</p>
          {errors.notes && (
            <p role="alert" className="field-error">
              {t(errors.notes)}
            </p>
          )}
        </div>

        {notice && <p role="alert">{notice}</p>}

        <div>
          <button type="submit" disabled={busy}>
            {t('recipes.actions.save')}
          </button>{' '}
          <button type="button" onClick={() => onClose(false)} disabled={busy}>
            {t('recipes.actions.cancel')}
          </button>
        </div>
      </form>

      {draft.id && (
        <div>
          {confirmDelete ? (
            <>
              <p>{t('recipes.actions.deleteConfirm', { name: draft.name })}</p>
              <button type="button" onClick={handleDelete} disabled={busy}>
                {t('recipes.actions.deleteYes')}
              </button>{' '}
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>
                {t('recipes.actions.deleteKeep')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy}>
              {t('recipes.actions.delete')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
