import { useI18n } from '../i18n/I18nProvider.jsx';
import { normalizeTime } from '../lib/mealTimesLogic.js';

// The day's Meal Times, each with its calorie range and what is logged to it, then the
// entries logged at another time. `sections` and `other` come from mealSections(). Tapping
// an entry calls onEdit with it. An entry still on the phone (`pending`, ticket #34) is marked
// "not synced" and cannot be edited; a failed one offers Try again and Discard through
// onRetry and onDiscard, each called with the entry's id.
//
// Layout B (next meal first): the Meal Time that is due, `dueId`, is lifted into its own card
// with a button (`onLogDue`, called with the Meal Time) that opens Log food for it; the rest of
// the day follows as a compact list. `dueId` is null on days that have no meal due.
export default function TodayMeals({
  sections,
  other,
  dueId = null,
  onLogDue,
  onEdit,
  onRetry,
  onDiscard,
}) {
  const { t, formatNumber } = useI18n();
  const number = (value) => formatNumber(value, { maximumFractionDigits: 0 });
  const due = dueId == null ? null : sections.find(({ meal }) => meal.id === dueId) || null;
  const rest = due ? sections.filter((section) => section !== due) : sections;

  return (
    <>
      {due ? (
        <section className="meal-due" aria-labelledby="today-due-heading">
          <p className="eyebrow" id="today-due-heading">
            {t('layout.today.nextMeal')}
          </p>
          <div className="meal-head">
            <h3>{due.meal.name}</h3>
            <span className="num mute">{normalizeTime(due.meal.time_of_day)}</span>
          </div>
          <p className="mute small">{calorieRangeText(due.meal, t, number)}</p>
          <p className="num">{t('today.meals.sectionKcal', { kcal: number(due.kcal) })}</p>
          <EntryList
            entries={due.entries}
            onEdit={onEdit}
            onRetry={onRetry}
            onDiscard={onDiscard}
          />
          {onLogDue ? (
            <div className="actions">
              <button type="button" className="btn-primary" onClick={() => onLogDue(due.meal)}>
                {t('layout.today.logForMeal', { name: due.meal.name })}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="today-meals-heading">
        <h2 id="today-meals-heading">{t('today.meals.heading')}</h2>
        {sections.length === 0 && other.entries.length === 0 ? (
          <p>{t('today.meals.empty')}</p>
        ) : null}

        <div className="meal-list">
          {rest.map(({ meal, entries, kcal }) => (
            <article key={meal.id}>
              <div className="meal-head">
                <h3>{meal.name}</h3>
                <span className="num mute">{normalizeTime(meal.time_of_day)}</span>
              </div>
              <p className="mute small">{calorieRangeText(meal, t, number)}</p>
              <p className="num">{t('today.meals.sectionKcal', { kcal: number(kcal) })}</p>
              <EntryList
                entries={entries}
                onEdit={onEdit}
                onRetry={onRetry}
                onDiscard={onDiscard}
              />
            </article>
          ))}

          {other.entries.length > 0 ? (
            <article>
              <h3>{t('today.otherTime')}</h3>
              <p className="num">{t('today.meals.sectionKcal', { kcal: number(other.kcal) })}</p>
              <EntryList
                entries={other.entries}
                onEdit={onEdit}
                onRetry={onRetry}
                onDiscard={onDiscard}
              />
            </article>
          ) : null}
        </div>
      </section>
    </>
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
