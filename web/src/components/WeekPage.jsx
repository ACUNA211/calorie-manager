import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useActingMember } from '../lib/actingMember.jsx';
import { loadTargets } from '../lib/targets.js';
import { loadWeek } from '../lib/week.js';
import { buildWeek, shiftWeek, weekEndKey, weekStartKey } from '../lib/weekLogic.js';
import { dateKey, parseDateKey, targetView } from '../lib/todayLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';
import WeightPanel from './WeightPanel.jsx';

const LOADING = { key: null, status: 'loading', entries: [] };

// The Week view for the Member being acted for: each day (Sunday to Saturday) with its
// calories against the Calorie Target and Planning band, and its macros against their
// Targets, then the days under and the week's averages over logged days. Tapping a day
// calls onOpenDay with its key, so Today opens on that day. Week arrows move 7 days.
export default function WeekPage({ onOpenDay }) {
  const { t, formatDate, formatNumber } = useI18n();
  const units = useUnits();
  const { actingMemberId } = useActingMember();
  // Today is fixed when the screen opens; the week arrows move from its week.
  const [todayKey] = useState(() => dateKey(new Date()));
  const [start, setStart] = useState(() => weekStartKey(todayKey));
  const [setup, setSetup] = useState({ memberId: null, status: 'loading' });
  const [weekState, setWeekState] = useState(LOADING);

  useEffect(() => {
    if (actingMemberId == null) return undefined;
    let active = true;
    loadTargets(supabase, actingMemberId)
      .then((targetRow) => {
        if (active)
          setSetup({ memberId: actingMemberId, status: 'ready', targets: targetView(targetRow) });
      })
      .catch(() => {
        if (active) setSetup({ memberId: actingMemberId, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [actingMemberId]);

  useEffect(() => {
    if (actingMemberId == null) return undefined;
    let active = true;
    const key = `${actingMemberId}|${start}`;
    loadWeek(supabase, actingMemberId, start, weekEndKey(start))
      .then((entries) => {
        if (active) setWeekState({ key, status: 'ready', entries });
      })
      .catch(() => {
        if (active) setWeekState({ key, status: 'error', entries: [] });
      });
    return () => {
      active = false;
    };
  }, [actingMemberId, start]);

  if (actingMemberId == null) {
    return (
      <section aria-labelledby="week-heading">
        <h2 id="week-heading">{t('week.heading')}</h2>
        <p>{t('week.noMember')}</p>
      </section>
    );
  }

  const currentSetup = setup.memberId === actingMemberId ? setup : { status: 'loading' };
  const weekKey = `${actingMemberId}|${start}`;
  const currentWeek = weekState.key === weekKey ? weekState : LOADING;

  if (currentSetup.status === 'error' || currentWeek.status === 'error') {
    return (
      <section aria-labelledby="week-heading">
        <h2 id="week-heading">{t('week.heading')}</h2>
        <p role="alert">{t('week.loadError')}</p>
      </section>
    );
  }
  if (currentSetup.status !== 'ready' || currentWeek.status !== 'ready') {
    return (
      <section aria-labelledby="week-heading">
        <h2 id="week-heading">{t('week.heading')}</h2>
        <p>{t('week.loading')}</p>
      </section>
    );
  }

  const { targets } = currentSetup;
  const view = buildWeek(currentWeek.entries, start, targets, todayKey);
  const { summary } = view;
  const number = (value, digits = 0) => formatNumber(value, { maximumFractionDigits: digits });
  const range = {
    from: formatDate(parseDateKey(view.startKey)),
    to: formatDate(parseDateKey(view.endKey)),
  };

  return (
    <section aria-labelledby="week-heading">
      <h2 id="week-heading">{t('week.heading')}</h2>
      <div>
        <button
          type="button"
          aria-label={t('week.previousWeek')}
          onClick={() => setStart((current) => shiftWeek(current, -1))}
        >
          {'<'}
        </button>
        <p>{t('week.range', range)}</p>
        <button
          type="button"
          aria-label={t('week.nextWeek')}
          onClick={() => setStart((current) => shiftWeek(current, 1))}
        >
          {'>'}
        </button>
      </div>

      {targets.calorieTarget == null ? <p>{t('week.noTarget')}</p> : null}
      {summary.loggedCount === 0 ? <p>{t('week.summary.noLogged')}</p> : null}
      {targets.calorieTarget != null && summary.loggedCount > 0 ? (
        <p>{t('week.summary.under', { under: summary.underCount, logged: summary.loggedCount })}</p>
      ) : null}
      {summary.average.kcal != null ? (
        <>
          <p>{t('week.summary.average', { kcal: number(summary.average.kcal) })}</p>
          <p>
            {t('week.summary.averageMacros', {
              protein: units.formatMass(summary.average.protein),
              carbs: units.formatMass(summary.average.carbs),
              fat: units.formatMass(summary.average.fat),
            })}
          </p>
        </>
      ) : null}
      {summary.missingMacroDays > 0 ? (
        <p>{t('week.summary.missingMacros', { count: summary.missingMacroDays })}</p>
      ) : null}

      <ol>
        {view.days.map((day) => {
          const isToday = day.key === todayKey;
          return (
            <li key={day.key}>
              <button type="button" onClick={() => onOpenDay(day.key)}>
                <strong>
                  {formatDate(parseDateKey(day.key))}
                  {isToday ? ` (${t('week.todayTag')})` : ''}
                </strong>
                {day.logged ? (
                  <DayDetail day={day} number={number} />
                ) : (
                  <span> {t('week.day.empty')}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <WeightPanel memberId={actingMemberId} weekStart={start} todayKey={todayKey} />
    </section>
  );
}

// One logged day: calories against the Calorie Target, its band status, and its macros.
function DayDetail({ day, number }) {
  const { t } = useI18n();
  const units = useUnits();
  const target = day.bar.target;
  return (
    <span>
      {target == null ? (
        <span> {t('week.day.kcalNoTarget', { kcal: number(day.totals.kcal) })}</span>
      ) : (
        <span>
          {' '}
          {t('week.day.kcal', { kcal: number(day.totals.kcal), target: number(target) })}
        </span>
      )}
      <span> {t(`week.status.${day.bar.status}`)}</span>
      <span>
        {' '}
        {t('week.day.macros', {
          protein: units.formatMass(day.totals.protein),
          carbs: units.formatMass(day.totals.carbs),
          fat: units.formatMass(day.totals.fat),
        })}
      </span>
      {day.totals.missingMacros > 0 ? <span> {t('week.day.missingMacros')}</span> : null}
    </span>
  );
}
