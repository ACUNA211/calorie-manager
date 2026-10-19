import { useId, useState } from 'react';
import { canContinue, rowNeedsCheck } from '../lib/pasteRecipe.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';

// The review of a pasted Recipe: the header fields, and one row per ingredient with its
// match, a way to pick another food, and the grams. Rows that need a look are flagged.
export default function PasteRecipeReview({
  header,
  onHeader,
  rows,
  onFood,
  onGrams,
  onRemove,
  onSearch,
  onContinue,
  onBack,
  busy,
  notice,
}) {
  const { t } = useI18n();
  const ids = useId();
  const flagged = rows.filter(rowNeedsCheck).length;
  const check = canContinue(rows);

  return (
    <section aria-labelledby={`${ids}-heading`}>
      <h2 id={`${ids}-heading`}>{t('recipes.paste.reviewHeading')}</h2>
      <p>{t('recipes.paste.reviewHint')}</p>
      <p role="status">
        {flagged === 0
          ? t('recipes.paste.allMatched')
          : t('recipes.paste.flagged', { count: flagged })}
      </p>

      <div>
        <label htmlFor={`${ids}-name`}>{t('recipes.paste.nameLabel')}</label>
        <input
          id={`${ids}-name`}
          type="text"
          value={header.name}
          onChange={(event) => onHeader({ ...header, name: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor={`${ids}-servings`}>{t('recipes.paste.servingsLabel')}</label>
        <input
          id={`${ids}-servings`}
          type="text"
          inputMode="decimal"
          value={header.servings}
          onChange={(event) => onHeader({ ...header, servings: event.target.value })}
        />
      </div>
      <div>
        <label htmlFor={`${ids}-notes`}>{t('recipes.paste.notesLabel')}</label>
        <textarea
          id={`${ids}-notes`}
          rows={3}
          value={header.notes}
          onChange={(event) => onHeader({ ...header, notes: event.target.value })}
        />
      </div>

      <ul className="paste-rows">
        {rows.map((row) => (
          <PasteRow
            key={row.key}
            row={row}
            onFood={onFood}
            onGrams={onGrams}
            onRemove={onRemove}
            onSearch={onSearch}
          />
        ))}
      </ul>

      {notice && <p role="alert">{notice}</p>}
      {!check.ok && rows.length > 0 && <p>{t('recipes.paste.noFood')}</p>}

      <div className="actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onContinue}
          disabled={busy || !check.ok}
        >
          {t('recipes.paste.continue')}
        </button>
        <button type="button" onClick={onBack} disabled={busy}>
          {t('recipes.paste.back')}
        </button>
      </div>
    </section>
  );
}

// One ingredient line. The search box keeps its own text until the Member searches.
function PasteRow({ row, onFood, onGrams, onRemove, onSearch }) {
  const { t, formatNumber } = useI18n();
  const units = useUnits();
  const ids = useId();
  const [query, setQuery] = useState(row.query);
  const needsCheck = rowNeedsCheck(row);

  // The chosen food is always in the list, even when a later search dropped it.
  const options =
    row.food && !row.candidates.some((candidate) => candidate.key === row.food.key)
      ? [row.food, ...row.candidates]
      : row.candidates;

  const sourceLabel = (food) =>
    food.source === 'usda' ? t('recipes.paste.fromUsda') : t('recipes.paste.inLibrary');

  const reasonText = row.reason ? t(`recipes.paste.reason.${row.reason}`) : null;

  return (
    <li data-needs-check={needsCheck ? 'true' : 'false'} className="paste-row">
      <p>
        <strong>{row.text}</strong>{' '}
        {needsCheck && <span className="field-error">{t('recipes.paste.checkThis')}</span>}
      </p>

      <div>
        <label htmlFor={`${ids}-food`}>{t('recipes.paste.matchLabel', { text: row.text })}</label>{' '}
        <select
          id={`${ids}-food`}
          value={row.food ? row.food.key : ''}
          onChange={(event) =>
            onFood(row.key, options.find((food) => food.key === event.target.value) ?? null)
          }
        >
          <option value="">{t('recipes.paste.noMatch')}</option>
          {options.map((food) => (
            <option key={food.key} value={food.key}>
              {food.name}
              {food.brand ? `, ${food.brand}` : ''} ({sourceLabel(food)})
            </option>
          ))}
        </select>
        {!row.food && <p>{t('recipes.paste.noMatchYet')}</p>}
        {row.food && row.status === 'unsure' && <p>{t('recipes.paste.guess')}</p>}
      </div>

      <div>
        <label htmlFor={`${ids}-search`}>{t('recipes.paste.searchLabel')}</label>{' '}
        <input
          id={`${ids}-search`}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />{' '}
        <button type="button" onClick={() => onSearch(row.key, query)}>
          {t('recipes.paste.searchButton')}
        </button>
        {row.searchFailed && <p role="alert">{t('recipes.paste.searchFailed')}</p>}
        {!row.searchFailed && row.query.trim() !== '' && row.candidates.length === 0 && (
          <p>{t('recipes.paste.searchEmpty')}</p>
        )}
      </div>

      <div>
        <label htmlFor={`${ids}-grams`}>
          {t('recipes.ingredients.gramsLabel', { name: row.name, unit: units.massUnit })}
        </label>{' '}
        <input
          id={`${ids}-grams`}
          type="text"
          inputMode="decimal"
          value={row.grams}
          onChange={(event) => onGrams(row.key, event.target.value)}
        />
        {row.approximate && <p>{t('recipes.paste.approximate')}</p>}
        {reasonText && <p>{reasonText}</p>}
      </div>

      <button type="button" className="btn-quiet" onClick={() => onRemove(row.key)}>
        {t('recipes.paste.remove', { name: row.name })}
      </button>
      {row.food && row.food.kcalPer100g != null && (
        <span>
          {' '}
          {t('recipes.paste.kcalPerBasis', {
            kcal: formatNumber(units.perBasis(row.food.kcalPer100g), { maximumFractionDigits: 0 }),
            basis: units.basisLabel,
          })}
        </span>
      )}
    </li>
  );
}
