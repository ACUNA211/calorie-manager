import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useActingMember } from '../lib/actingMember.jsx';
import { loadMealTimes } from '../lib/mealTimes.js';
import { loadTargets } from '../lib/targets.js';
import { loadDay } from '../lib/today.js';
import {
  addDays,
  calorieBar,
  canLogOn,
  dateKey,
  isFutureDay,
  macroBar,
  mealSections,
  mealsOnDay,
  sumEntries,
  targetView,
  weekdayOf,
} from '../lib/todayLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import DayBar from './DayBar.jsx';
import TodayMeals from './TodayMeals.jsx';
import LogFoodPanel from './LogFoodPanel.jsx';

const LOADING = { status: 'loading', entries: [] };

// The Today screen for the Member being acted for ("logging for"). It shows one day: the
// day bar, the day's Meal Times with what is logged to each, and Log food. Future days are
// read-only. Data is keyed by Member and day, so an old answer never shows for a new choice.
export default function TodayPage() {
  const { t, formatNumber } = useI18n();
  const { actingMemberId } = useActingMember();
  // Today is fixed when the screen opens; the day arrows move from it.
  const [todayKey] = useState(() => dateKey(new Date()));
  const [day, setDay] = useState(todayKey);
  const [setup, setSetup] = useState({ memberId: null, status: 'loading' });
  const [dayState, setDayState] = useState({ key: null, status: 'loading', entries: [] });
  const [logOpen, setLogOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (actingMemberId == null) return undefined;
    let active = true;
    Promise.all([loadTargets(supabase, actingMemberId), loadMealTimes(supabase, actingMemberId)])
      .then(([targetRow, meals]) => {
        if (!active) return;
        setSetup({
          memberId: actingMemberId,
          status: 'ready',
          targets: targetView(targetRow),
          meals,
        });
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
    const key = `${actingMemberId}|${day}`;
    loadDay(supabase, actingMemberId, day)
      .then((entries) => {
        if (active) setDayState({ key, status: 'ready', entries });
      })
      .catch(() => {
        if (active) setDayState({ key, status: 'error', entries: [] });
      });
    return () => {
      active = false;
    };
  }, [actingMemberId, day]);

  if (actingMemberId == null) {
    return (
      <section aria-labelledby="today-heading">
        <h2 id="today-heading">{t('today.heading')}</h2>
        <p>{t('today.noMember')}</p>
      </section>
    );
  }

  const currentSetup = setup.memberId === actingMemberId ? setup : { status: 'loading' };
  const dayKey = `${actingMemberId}|${day}`;
  const currentDay = dayState.key === dayKey ? dayState : LOADING;

  if (currentSetup.status === 'error' || currentDay.status === 'error') {
    return (
      <section aria-labelledby="today-heading">
        <h2 id="today-heading">{t('today.heading')}</h2>
        <p role="alert">{t('today.loadError')}</p>
      </section>
    );
  }
  if (currentSetup.status !== 'ready' || currentDay.status !== 'ready') {
    return (
      <section aria-labelledby="today-heading">
        <h2 id="today-heading">{t('today.heading')}</h2>
        <p>{t('today.loading')}</p>
      </section>
    );
  }

  const { targets, meals } = currentSetup;
  const { entries } = currentDay;
  const weekday = weekdayOf(day);
  const totals = sumEntries(entries);
  const bar = calorieBar(totals.kcal, targets);
  const macros = macroBar(totals, targets);
  const sections = mealSections(meals, entries, weekday);
  const dayMeals = mealsOnDay(meals, weekday);
  const future = isFutureDay(day, todayKey);
  const logAllowed = canLogOn(day, todayKey);

  function move(count) {
    setDay((current) => addDays(current, count));
    setLogOpen(false);
    setNotice('');
  }

  // Adds the saved row to the day at once, so the bar and the Meal Time list update.
  function handleLogged(row) {
    setDayState((current) =>
      current.key === dayKey ? { ...current, entries: [...current.entries, row] } : current
    );
    const meal = meals.find((candidate) => Number(candidate.id) === Number(row.meal_time_id));
    setNotice(
      t('today.logged', {
        kcal: formatNumber(row.kcal, { maximumFractionDigits: 0 }),
        meal: meal ? meal.name : t('today.otherTime'),
      })
    );
    setLogOpen(false);
  }

  const missingMacros = totals.missingMacros;

  return (
    <div>
      <h2 id="today-heading">{t('today.heading')}</h2>
      <DayBar
        dateKey={day}
        todayKey={todayKey}
        bar={bar}
        macros={macros}
        onPrevious={() => move(-1)}
        onNext={() => move(1)}
        onToday={() => {
          setDay(todayKey);
          setLogOpen(false);
          setNotice('');
        }}
      />

      {missingMacros > 0 ? <p>{t('today.meals.missingMacros', { count: missingMacros })}</p> : null}

      {future ? <p>{t('today.futureReadOnly')}</p> : null}
      {logAllowed ? (
        <button type="button" onClick={() => setLogOpen((open) => !open)}>
          {t('today.log.button')}
        </button>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}

      {logAllowed && logOpen ? (
        <LogFoodPanel
          memberId={actingMemberId}
          logDate={day}
          todayKey={todayKey}
          meals={dayMeals}
          weekday={weekday}
          onLogged={handleLogged}
        />
      ) : null}

      <TodayMeals sections={sections.sections} other={sections.other} />
    </div>
  );
}
