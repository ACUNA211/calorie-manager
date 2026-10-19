import { useId, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  canContinue,
  draftFromParsed,
  matchRecipeLines,
  PASTE_MAX_CHARS,
  parseRecipeText,
  PasteError,
  resolveIngredients,
  rowWithFood,
  rowWithGrams,
  searchCandidates,
} from '../lib/pasteRecipe.js';
import PasteRecipeReview from './PasteRecipeReview.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';

// Paste a Recipe: the Member pastes recipe text, one AI call reads it, the ingredients are
// matched to foods, and the Member checks the matches. Nothing is saved here.
// onDone(draft) opens the Recipe editor with the draft; onManual() opens a blank editor;
// onCancel() goes back to the Recipes list.
export default function PasteRecipe({ onDone, onManual, onCancel }) {
  const { t } = useI18n();
  const units = useUnits();
  const ids = useId();
  // input | working | review | cap | failed
  const [phase, setPhase] = useState('input');
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState(null);
  const [header, setHeader] = useState({ name: '', servings: '', notes: '' });
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRead(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed === '') return setInputError('empty');
    if (trimmed.length > PASTE_MAX_CHARS) return setInputError('long');
    setInputError(null);
    setPhase('working');
    try {
      const parsed = await parseRecipeText(supabase, trimmed);
      const matched = await matchRecipeLines(supabase, parsed.ingredients, undefined, units.units);
      setHeader({
        name: parsed.name,
        servings: parsed.servings === null ? '' : String(parsed.servings),
        notes: parsed.notes ?? '',
      });
      setRows(matched);
      setNotice('');
      setPhase('review');
    } catch (error) {
      setPhase(error instanceof PasteError && error.code === 'cap' ? 'cap' : 'failed');
    }
  }

  function updateRow(key, change) {
    setRows((current) => current.map((row) => (row.key === key ? change(row) : row)));
  }

  async function handleSearch(key, query) {
    const row = rows.find((item) => item.key === key);
    if (!row) return;
    const next = await searchCandidates(supabase, row, query);
    updateRow(key, () => next);
  }

  async function handleContinue() {
    const check = canContinue(rows);
    if (!check.ok) {
      setNotice(t('recipes.paste.noFood'));
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      const ingredients = await resolveIngredients(supabase, rows);
      onDone(draftFromParsed(header, ingredients));
    } catch {
      setNotice(t('recipes.paste.resolveError'));
      setBusy(false);
    }
  }

  const heading = `${ids}-heading`;

  if (phase === 'review') {
    return (
      <PasteRecipeReview
        header={header}
        onHeader={setHeader}
        rows={rows}
        onFood={(key, food) => updateRow(key, (row) => rowWithFood(row, food, units.units))}
        onGrams={(key, grams) => updateRow(key, (row) => rowWithGrams(row, grams))}
        onRemove={(key) => setRows((current) => current.filter((row) => row.key !== key))}
        onSearch={handleSearch}
        onContinue={handleContinue}
        onBack={() => setPhase('input')}
        busy={busy}
        notice={notice}
      />
    );
  }

  if (phase === 'working') {
    return (
      <section aria-labelledby={heading}>
        <h2 id={heading}>{t('recipes.paste.heading')}</h2>
        <p role="status">{t('recipes.paste.working')}</p>
      </section>
    );
  }

  if (phase === 'cap' || phase === 'failed') {
    return (
      <section aria-labelledby={heading}>
        <h2 id={heading}>{t('recipes.paste.heading')}</h2>
        <p role="alert">
          {phase === 'cap' ? t('recipes.paste.capReached') : t('recipes.paste.failed')}
        </p>
        <div className="actions">
          <button type="button" onClick={() => setPhase('input')}>
            {t('recipes.paste.back')}
          </button>
          <button type="button" onClick={onManual}>
            {t('recipes.paste.manual')}
          </button>
        </div>
      </section>
    );
  }

  const textId = `${ids}-text`;
  const hintId = `${ids}-text-hint`;
  return (
    <section aria-labelledby={heading}>
      <h2 id={heading}>{t('recipes.paste.heading')}</h2>
      <p>{t('recipes.paste.intro')}</p>

      <form onSubmit={handleRead} noValidate>
        <label htmlFor={textId}>{t('recipes.paste.textLabel')}</label>
        <textarea
          id={textId}
          rows={10}
          aria-describedby={hintId}
          aria-invalid={Boolean(inputError)}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p id={hintId}>{t('recipes.paste.textHint')}</p>
        {inputError && (
          <p role="alert" className="field-error">
            {t(`recipes.paste.errors.${inputError}`)}
          </p>
        )}
        <button type="submit" className="btn-primary">
          {t('recipes.paste.read')}
        </button>
      </form>

      <div className="actions">
        <button type="button" className="btn-quiet" onClick={onManual}>
          {t('recipes.paste.manual')}
        </button>
        <button type="button" className="btn-quiet" onClick={onCancel}>
          {t('recipes.paste.cancel')}
        </button>
      </div>
    </section>
  );
}
