import { MACRO_KEYS } from '../lib/recipeTotals.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';

// Per-serving calories and macros for a Recipe, from recipeTotals(). A value that is null
// is unknown (a food lacks it), and is shown as such rather than as zero.
export default function RecipeTotals({ totals, hasIngredients }) {
  const { t, formatNumber } = useI18n();
  const units = useUnits();

  if (!hasIngredients) {
    return (
      <section aria-labelledby="recipe-totals-heading">
        <h3 id="recipe-totals-heading">{t('recipes.totals.heading')}</h3>
        <p>{t('recipes.totals.none')}</p>
      </section>
    );
  }

  const kcal = totals.kcal.perServing;
  const rows = MACRO_KEYS.map((key) => {
    const macro = totals.macros[key];
    const value = macro ? macro.perServing : null;
    // Sodium is in milligrams; the macros are grams, shown in the Member's units.
    let text;
    if (value === null) text = t('recipes.unknown');
    else if (key === 'sodium') {
      text = t('recipes.totals.milligrams', {
        value: formatNumber(value, { maximumFractionDigits: 1 }),
      });
    } else text = t('recipes.totals.grams', { value: units.formatMass(value) });
    return { key, text, unknown: value === null };
  });

  return (
    <section aria-labelledby="recipe-totals-heading">
      <h3 id="recipe-totals-heading">{t('recipes.totals.heading')}</h3>
      <p>
        <strong>{t('recipes.totals.kcal')}: </strong>
        <span>
          {kcal === null
            ? t('recipes.unknown')
            : t('recipes.totals.kcalValue', {
                value: formatNumber(kcal, { maximumFractionDigits: 0 }),
              })}
        </span>
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            <strong>{t(`recipes.totals.${row.key}`)}: </strong>
            <span>{row.text}</span>
          </li>
        ))}
      </ul>
      {rows.some((row) => row.unknown) && <p>{t('recipes.totals.unknownHint')}</p>}
      <p>
        {t('recipes.totals.weight', {
          grams: units.formatMass(totals.totalGrams),
        })}
      </p>
    </section>
  );
}
