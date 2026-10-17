import { useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  addIngredient,
  copyRecipe,
  deleteRecipe,
  draftFromRecipe,
  emptyRecipeDraft,
  loadMealTimeOptions,
  parseAmount,
  parseGramsField,
  previewIngredients,
  removeIngredient,
  saveRecipe,
  setIngredientGrams,
  toggleMealTime,
  validateRecipe,
  variationName,
} from '../lib/recipes.js';
import { gramsPerServing, recipeTotals } from '../lib/recipeTotals.js';
import RecipeIngredientsField from './RecipeIngredientsField.jsx';
import RecipeTotals from './RecipeTotals.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';

// Creates a Recipe (recipe = null) or edits one. initialDraft opens a new Recipe on a draft
// (a pasted Recipe, not yet saved). onClose(changed) runs after a save, a delete or a copy
// (changed true) or a cancel (false), so the list can reload.
// originalName is the name of the Recipe this one was copied from, when it is known.
export default function RecipeEditor({
  recipe,
  initialDraft = null,
  originalName = null,
  onClose,
}) {
  const { t } = useI18n();
  const units = useUnits();
  const ids = useId();
  const [draft, setDraft] = useState(() => {
    if (recipe) return draftFromRecipe(recipe, units.units);
    return initialDraft ?? emptyRecipeDraft();
  });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mealTimeOptions, setMealTimeOptions] = useState([]);

  // The Meal Times the caller can read, for the tag checkboxes. A failure leaves the list
  // empty, and any tags already on the Recipe still show (below).
  useEffect(() => {
    let active = true;
    loadMealTimeOptions(supabase)
      .then((options) => {
        if (active) setMealTimeOptions(options);
      })
      .catch(() => {
        if (active) setMealTimeOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Every option, plus any tag on the Recipe that the caller cannot read (kept on save).
  const tagOptions = [...mealTimeOptions];
  for (const tag of recipe?.meal_time_tags ?? []) {
    if (!tagOptions.some((option) => option.id === tag.id)) {
      tagOptions.push({ id: tag.id, name: tag.name });
    }
  }

  const servings = parseAmount(draft.servings).value;
  const cooked = parseGramsField(draft.cookedWeight, units.units, draft.storedCookedWeight).value;
  const totals = recipeTotals({
    servings,
    ingredients: previewIngredients(draft, units.units),
  });
  const perServingGrams = gramsPerServing(cooked, servings);

  async function handleSave(event) {
    event.preventDefault();
    const result = validateRecipe(draft, units.units);
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

  // Copies the saved Recipe (not unsaved edits in this form) as a variation.
  async function handleCopy() {
    setBusy(true);
    setNotice('');
    try {
      await copyRecipe(supabase, recipe.id, variationName(recipe.name, t('recipes.copy.suffix')));
      onClose(true);
    } catch {
      setNotice(t('recipes.copy.error'));
      setBusy(false);
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
          <label htmlFor={fieldId('cooked')}>
            {t('recipes.fields.cookedWeight', { unit: units.massUnit })}
          </label>
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
                  grams: units.formatMass(perServingGrams),
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

        <fieldset>
          <legend>{t('recipes.tags.heading')}</legend>
          <p>{t('recipes.tags.hint')}</p>
          {tagOptions.length === 0 ? (
            <p>{t('recipes.tags.none')}</p>
          ) : (
            tagOptions.map((option) => (
              <div key={option.id}>
                <input
                  id={fieldId(`tag-${option.id}`)}
                  type="checkbox"
                  checked={draft.mealTimeIds.includes(option.id)}
                  onChange={(event) =>
                    setDraft(toggleMealTime(draft, option.id, event.target.checked))
                  }
                />{' '}
                <label htmlFor={fieldId(`tag-${option.id}`)}>
                  {option.name ?? t('recipes.tags.unavailable')}
                </label>
              </div>
            ))
          )}
        </fieldset>

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

      {recipe && (
        <div>
          {originalName && <p>{t('recipes.copy.original', { name: originalName })}</p>}
          {recipe.copied_from != null && !originalName && (
            <p>{t('recipes.copy.originalMissing')}</p>
          )}
          <p>{t('recipes.copy.hint')}</p>
          <button type="button" onClick={handleCopy} disabled={busy}>
            {t('recipes.copy.button')}
          </button>
        </div>
      )}

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
