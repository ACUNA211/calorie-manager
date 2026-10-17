import { useI18n } from '../i18n/I18nProvider.jsx';
import { normalizeTime } from '../lib/mealTimesLogic.js';

// The day's Meal Times, each with its calorie range and what is logged to it, then the
// entries logged at another time. `sections` and `other` come from mealSections(). Tapping
// an entry calls onEdit with it. An entry still on the phone (`pending`, ticket #34) is marked
// "not synced" and cannot be edited; a failed one offers Try again and Discard through
// onRetry and onDiscard, each called with the entry's id.
export default function TodayMeals({ sections, other, onEdit, onRetry, onDiscard }) {
  const { t, formatNumber } = useI18n();
  const number = (value) => formatNumber(value, { maximumFractionDigits: 0 });

  return (
    <section aria-labelledby="today-meals-heading">
      <h2 id="today-meals-heading">{t('today.meals.heading')}</h2>
      {sections.length === 0 && other.entries.length === 0 ? <p>{t('today.meals.empty')}</p> : null}

      {sections.map(({ meal, entries, kcal }) => (
        <article key={meal.id}>
          <h3>
            {meal.name} {normalizeTime(meal.time_of_day)}
          </h3>
          <p>{calorieRangeText(meal, t, number)}</p>
          <p>{t('today.meals.sectionKcal', { kcal: number(kcal) })}</p>
          <EntryList entries={entries} onEdit={onEdit} onRetry={onRetry} onDiscard={onDiscard} />
        </article>
      ))}

      {other.entries.length > 0 ? (
        <article>
          <h3>{t('today.otherTime')}</h3>
          <p>{t('today.meals.sectionKcal', { kcal: number(other.kcal) })}</p>
          <EntryList
            entries={other.entries}
            onEdit={onEdit}
            onRetry={onRetry}
            onDiscard={onDiscard}
          />
        </article>
      ) : null}
    </section>
  );
}

// The Member's own range for the Meal Time, in the words its kind uses.
function calorieRangeText(meal, t, number) {
  if (meal.kind === 'set') {
    return meal.set_calories == null
      ? ''
      : t('today.meals.set', { kcal: number(meal.set_calories) });
  }
  if (meal.cal_max == null) return '';
  return t('today.meals.range', {
    min: number(meal.cal_min ?? 0),
    max: number(meal.cal_max),
  });
}

function EntryList({ entries, onEdit, onRetry, onDiscard }) {
  const { t, formatNumber } = useI18n();
  if (entries.length === 0) return <p>{t('today.meals.nothing')}</p>;
  return (
    <ul>
      {entries.map((entry) => {
        const label = t('today.meals.entry', {
          description: entry.description,
          kcal: formatNumber(entry.kcal, { maximumFractionDigits: 0 }),
        });
        if (!entry.pending) {
          return (
            <li key={entry.id}>
              <button type="button" onClick={() => onEdit(entry)}>
                {label}
              </button>
            </li>
          );
        }
        return (
          <li key={entry.id}>
            <span>{label}</span>{' '}
            {entry.pending === 'failed' ? (
              <>
                <span role="alert">{t('today.offline.failed')}</span>{' '}
                <button type="button" onClick={() => onRetry(entry.id)}>
                  {t('today.offline.retry')}
                </button>{' '}
                <button type="button" onClick={() => onDiscard(entry.id)}>
                  {t('today.offline.discard')}
                </button>
              </>
            ) : (
              <span>{t('today.offline.notSynced')}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
