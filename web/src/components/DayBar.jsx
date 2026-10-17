import { useI18n } from '../i18n/I18nProvider.jsx';
import { formatDate } from '../i18n/format.js';
import { parseDateKey } from '../lib/todayLogic.js';
import { useUnits } from '../lib/useUnits.jsx';

// The day's arrows and bar: calories eaten against the Calorie Target and the Planning band,
// then protein, carbs and fat against their Targets. `bar` and `macros` come from todayLogic.
export default function DayBar({ dateKey, todayKey, bar, macros, onPrevious, onNext, onToday }) {
  const { t, locale, formatNumber } = useI18n();
  const number = (value) => formatNumber(value, { maximumFractionDigits: 0 });
  const isToday = dateKey === todayKey;
  const label = formatDate(parseDateKey(dateKey), locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <section aria-labelledby="today-day-heading">
      <div>
        <button type="button" aria-label={t('today.previousDay')} onClick={onPrevious}>
          {'<'}
        </button>
        <h2 id="today-day-heading">
          {label}
          {isToday ? ` (${t('today.todayTag')})` : ''}
        </h2>
        <button type="button" aria-label={t('today.nextDay')} onClick={onNext}>
          {'>'}
        </button>
        {isToday ? null : (
          <button type="button" onClick={onToday}>
            {t('today.backToToday')}
          </button>
        )}
      </div>

      {bar.status === 'noTarget' ? (
        <p>{t('today.bar.noTarget')}</p>
      ) : (
        <div>
          <progress max="1" value={bar.fraction} />
          <p>
            {t('today.bar.eaten', {
              eaten: number(bar.eaten),
              target: number(bar.target),
            })}
          </p>
          <p>
            {bar.left < 0
              ? t('today.bar.over', { over: number(-bar.left) })
              : t('today.bar.left', { left: number(bar.left) })}
          </p>
          <p>{t('today.bar.aim', { low: number(bar.aimLow), high: number(bar.aimHigh) })}</p>
          <p>{t(`today.bar.status.${bar.status}`)}</p>
        </div>
      )}

      <ul>
        <MacroLine name={t('today.macro.protein')} status={macros.protein} kind="protein" />
        <MacroLine name={t('today.macro.carbs')} status={macros.carbs} kind="range" />
        <MacroLine name={t('today.macro.fat')} status={macros.fat} kind="range" />
      </ul>
    </section>
  );
}

// One macro: what has been eaten, against its Target when there is one.
function MacroLine({ name, status, kind }) {
  const { t } = useI18n();
  const { formatMass: mass } = useUnits();

  let detail;
  let state;
  if (status.status === 'noTarget') {
    detail = t('today.macro.eaten', { eaten: mass(status.eaten) });
    state = t('today.macro.noTarget');
  } else if (kind === 'protein') {
    detail = t('today.macro.floor', { eaten: mass(status.eaten), floor: mass(status.floor) });
    state =
      status.status === 'met'
        ? t('today.macro.met')
        : t('today.macro.toGo', { left: mass(status.left) });
  } else {
    detail = t('today.macro.range', {
      eaten: mass(status.eaten),
      low: mass(status.low),
      high: mass(status.high),
    });
    state = t(`today.macro.${status.status}`);
  }

  return (
    <li>
      <strong>{name}</strong> {detail}, {state}
    </li>
  );
}
