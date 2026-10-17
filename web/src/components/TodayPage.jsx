import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useActingMember } from '../lib/actingMember.jsx';
import { loadMealTimes } from '../lib/mealTimes.js';
import { loadTargets } from '../lib/targets.js';
import { deleteEntry, loadDay, restoreEntry, updateEntry } from '../lib/today.js';
import { useOfflineLog } from '../lib/useOfflineLog.js';
import {
  addDays,
  calorieBar,
  canLogOn,
  dateKey,
  entryValues,
  isFutureDay,
  macroBar,
  mealSections,
  mealsOnDay,
  restoreRow,
  sortEntries,
  sumEntries,
  targetView,
  weekdayOf,
} from '../lib/todayLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import DayBar from './DayBar.jsx';
import TodayMeals from './TodayMeals.jsx';
import LogFoodPanel from './LogFoodPanel.jsx';
import EditEntryPanel from './EditEntryPanel.jsx';
import Toast from './Toast.jsx';

const LOADING = { status: 'loading', entries: [] };

// The Today screen for the Member being acted for ("logging for"). It shows one day: the
// day bar, the day's Meal Times with what is logged to each, and Log food. Tapping an entry
// opens it for editing or deleting. Every log, change and delete shows a toast with Undo for
// a few seconds; only the latest change can be undone. Future days are read-only. Data is
// keyed by Member and day, so an old answer never shows for a new choice.
export default function TodayPage({ day: openDay = null }) {
  const { t, formatNumber } = useI18n();
  const { actingMemberId } = useActingMember();
  // Today is fixed when the screen opens; the day arrows move from it.
  const [todayKey] = useState(() => dateKey(new Date()));
  const [day, setDay] = useState(openDay?.key ?? todayKey);
  const [setup, setSetup] = useState({ memberId: null, status: 'loading' });
  const [dayState, setDayState] = useState({ key: null, status: 'loading', entries: [] });
  const [logOpen, setLogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // The toast: { id, text, undo } where undo is an async function, or null for a message only.
  const [toast, setToast] = useState(null);
  const toastIds = useRef(0);
  useEffect(() => {
    if (openDay) document.getElementById('today-heading')?.scrollIntoView?.({ block: 'start' });
  }, [openDay]);
  const offline = useOfflineLog({ client: supabase, memberId: actingMemberId });

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
  }, [actingMemberId, day, offline.version]);

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
  // Entries still on the phone (ticket #34) count in the day beside the saved ones.
  const entries = sortEntries([...currentDay.entries, ...offline.entriesFor(day)]);
  const weekday = weekdayOf(day);
  const totals = sumEntries(entries);
  const bar = calorieBar(totals.kcal, targets);
  const macros = macroBar(totals, targets);
  const sections = mealSections(meals, entries, weekday);
  const dayMeals = mealsOnDay(meals, weekday);
  const future = isFutureDay(day, todayKey);
  const logAllowed = canLogOn(day, todayKey);
  const editingEntry = editingId == null ? null : entries.find((e) => e.id === editingId) || null;

  // Changes the entries of the day on screen. A late answer for another day is ignored.
  function changeEntries(update) {
    setDayState((current) =>
      current.key === dayKey ? { ...current, entries: update(current.entries) } : current
    );
  }

  function showToast(text, undo) {
    toastIds.current += 1;
    setToast({ id: toastIds.current, text, undo });
  }

  function move(count) {
    setDay((current) => addDays(current, count));
    closePanels();
  }

  function closePanels() {
    setLogOpen(false);
    setEditingId(null);
    setToast(null);
  }

  // Runs the Undo of the latest change. If it fails, the toast says so and the day is left as it is.
  function undoToast() {
    const undo = toast?.undo;
    setToast(null);
    if (!undo) return;
    undo().catch(() => showToast(t('today.undo.failed'), null));
  }

  // Adds the saved row to the day at once, so the bar and the Meal Time list update.
  function handleLogged(row) {
    // A queued row is already on screen (from the queue), so it is not added to the day again.
    if (!row.pending) changeEntries((current) => sortEntries([...current, row]));
    const meal = meals.find((candidate) => Number(candidate.id) === Number(row.meal_time_id));
    const details = {
      kcal: formatNumber(row.kcal, { maximumFractionDigits: 0 }),
      meal: meal ? meal.name : t('today.otherTime'),
    };
    showToast(
      row.pending ? t('today.offline.queuedToast', details) : t('today.logged', details),
      row.pending
        ? async () => offline.discard(row.id)
        : async () => {
            await deleteEntry(supabase, row.id);
            changeEntries((current) => current.filter((entry) => entry.id !== row.id));
          }
    );
    setLogOpen(false);
  }

  // An edit is stored; Undo writes the old values back.
  function handleSaved(saved, before) {
    changeEntries((current) =>
      sortEntries(current.map((entry) => (entry.id === saved.id ? saved : entry)))
    );
    setEditingId(null);
    showToast(t('today.toast.changed'), async () => {
      const restored = await updateEntry(supabase, before.id, entryValues(before));
      changeEntries((current) =>
        sortEntries(current.map((entry) => (entry.id === restored.id ? restored : entry)))
      );
    });
  }

  // A delete is stored; Undo puts the entry back (see restoreRow).
  function handleDeleted(before) {
    changeEntries((current) => current.filter((entry) => entry.id !== before.id));
    setEditingId(null);
    showToast(t('today.toast.deleted'), async () => {
      const restored = await restoreEntry(supabase, restoreRow(before, actingMemberId));
      changeEntries((current) => sortEntries([...current, restored]));
    });
  }

  function openEdit(entry) {
    setLogOpen(false);
    setEditingId(entry.id);
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
          closePanels();
        }}
      />

      {missingMacros > 0 ? <p>{t('today.meals.missingMacros', { count: missingMacros })}</p> : null}

      {future ? <p>{t('today.futureReadOnly')}</p> : null}
      {logAllowed ? (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setLogOpen((open) => !open);
          }}
        >
          {t('today.log.button')}
        </button>
      ) : null}
      {toast ? (
        <Toast
          key={toast.id}
          message={toast.text}
          actionLabel={t('today.toast.undo')}
          onAction={toast.undo ? undoToast : undefined}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      {logAllowed && logOpen ? (
        <LogFoodPanel
          memberId={actingMemberId}
          logDate={day}
          todayKey={todayKey}
          meals={dayMeals}
          weekday={weekday}
          onLogged={handleLogged}
          offline={offline}
        />
      ) : null}

      {logAllowed && editingEntry ? (
        <EditEntryPanel
          key={editingEntry.id}
          entry={editingEntry}
          meals={meals}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      <TodayMeals
        sections={sections.sections}
        other={sections.other}
        onEdit={openEdit}
        onRetry={offline.retry}
        onDiscard={offline.discard}
      />
    </div>
  );
}
