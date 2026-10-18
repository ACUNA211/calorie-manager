import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  deleteMealTime,
  loadMealTimes,
  loadMemberId,
  loadMembers,
  loadTargets,
  saveMealTime,
  setWeekdays,
} from '../lib/mealTimes.js';
import {
  KINDS,
  WEEKDAYS,
  dayTotals,
  findOverlaps,
  missingSharerRanges,
  needsCalories,
  newSharerIds,
  normalizeTime,
  targetsFromRow,
  validateMealTime,
} from '../lib/mealTimesLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { formatDate, formatNumber } from '../i18n/format.js';

const NEW_MEAL_DEFAULTS = {
  id: null,
  name: '',
  time: '12:00',
  kind: 'planned',
  weekdays: [1, 2, 3, 4, 5],
  calMin: '',
  calMax: '',
  setCalories: '',
  createdBy: null,
  sharerIds: [],
  sharerRanges: {},
  existingSharerIds: [],
};

// Turns a stored Meal Time into an editor draft (numbers as strings, as typed).
function draftFromMeal(meal) {
  return {
    id: meal.id,
    name: meal.name,
    time: normalizeTime(meal.time_of_day),
    kind: meal.kind,
    weekdays: [...(meal.weekdays || [])],
    calMin: meal.cal_min == null ? '' : String(meal.cal_min),
    calMax: meal.cal_max == null ? '' : String(meal.cal_max),
    setCalories: meal.set_calories == null ? '' : String(meal.set_calories),
    createdBy: meal.createdBy,
    sharerIds: meal.sharers.map((sharer) => sharer.id),
    // The Members already sharing it: only the others need their own range on save.
    existingSharerIds: meal.sharers.map((sharer) => sharer.id),
    // Each new sharer's own range, as typed, by Member id.
    sharerRanges: {},
  };
}

// The names of the other Members sharing a Meal Time (the grid marks it as shared).
function sharedWithOthers(meal, viewerId) {
  return meal.sharers.filter((sharer) => sharer.id !== viewerId).map((sharer) => sharer.name);
}

// Entry point. `memberId` is optional: when a page for another Member is passed in
// (ticket 07, logging for a Dependent) it is used as is; otherwise the signed-in Member is found.
export default function MealTimesPage({ user, memberId }) {
  const { t, locale } = useI18n();
  const userId = user?.id;
  const [state, setState] = useState({ status: 'loading' });
  const [editor, setEditor] = useState(null); // null, or { draft, confirmDelete }
  const [clash, setClash] = useState(null); // null, or { mode, draft?, meal?, weekday?, overlaps }
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (id) => {
    const [meals, targetRow, members] = await Promise.all([
      loadMealTimes(supabase, id),
      loadTargets(supabase, id),
      loadMembers(supabase),
    ]);
    return { meals, members, targets: targetsFromRow(targetRow) };
  }, []);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const id = memberId ?? (userId ? await loadMemberId(supabase, userId) : null);
        if (!active) return;
        if (!id) {
          setState({ status: 'noMember' });
          return;
        }
        const data = await refresh(id);
        if (active) setState({ status: 'ready', memberId: id, ...data });
      } catch {
        if (active) setState({ status: 'error' });
      }
    }
    start();
    return () => {
      active = false;
    };
  }, [memberId, userId, refresh]);

  // Runs a write, then reloads so the grid always shows what is stored.
  async function write(work) {
    if (state.status !== 'ready') return false;
    setBusy(true);
    setNotice('');
    try {
      await work(state.memberId);
      const data = await refresh(state.memberId);
      setState((current) => ({ ...current, ...data }));
      return true;
    } catch {
      setNotice(t('mealTimes.saveError'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'loading') return <p>{t('mealTimes.loading')}</p>;
  if (state.status === 'error') return <p role="alert">{t('mealTimes.loadError')}</p>;
  if (state.status === 'noMember') return <p>{t('mealTimes.noMember')}</p>;

  const { meals, members, targets } = state;
  const viewerId = state.memberId;

  // Tapping a cell: off turns the day off at once; on checks for a clash first.
  function handleToggle(meal, weekday) {
    const on = meal.weekdays.includes(weekday);
    if (on) {
      write((memberId) =>
        setWeekdays(
          supabase,
          memberId,
          meal.id,
          meal.weekdays.filter((day) => day !== weekday)
        )
      );
      return;
    }
    const overlaps = findOverlaps(meal, meals, [weekday]);
    if (overlaps.length > 0) {
      setClash({ mode: 'toggle', meal, weekday, overlaps });
      return;
    }
    applyToggle(meal, weekday, []);
  }

  function applyToggle(meal, weekday, replace) {
    setClash(null);
    write(async (memberId) => {
      await setWeekdays(supabase, memberId, meal.id, [...meal.weekdays, weekday]);
      for (const clashing of replace) {
        const kept = clashing.meal.weekdays.filter((day) => !clashing.weekdays.includes(day));
        await setWeekdays(supabase, memberId, clashing.meal.id, kept);
      }
    });
  }

  // Saving the editor: a clash on any of its days asks first.
  function handleSubmit(draft) {
    const overlaps = findOverlaps({ id: draft.id, time_of_day: draft.time }, meals, draft.weekdays);
    if (overlaps.length > 0) {
      setClash({ mode: 'save', draft, overlaps });
      return;
    }
    commitSave(draft, []);
  }

  async function commitSave(draft, replace) {
    setClash(null);
    const ok = await write(async (memberId) => {
      await saveMealTime(supabase, memberId, draft);
      for (const clashing of replace) {
        const kept = clashing.meal.weekdays.filter((day) => !clashing.weekdays.includes(day));
        await setWeekdays(supabase, memberId, clashing.meal.id, kept);
      }
    });
    if (ok) setEditor(null);
  }

  // The creator deletes the Meal Time for everyone; another sharer only stops sharing it.
  async function handleDelete(meal) {
    const ok = await write((current) => deleteMealTime(supabase, current, meal.id, meal.createdBy));
    if (ok) setEditor(null);
  }

  function resolveClash(replace) {
    if (!clash) return;
    if (clash.mode === 'toggle') {
      applyToggle(clash.meal, clash.weekday, replace ? clash.overlaps : []);
    } else {
      commitSave(clash.draft, replace ? clash.overlaps : []);
    }
  }

  const dayLabel = (day, style = 'short') =>
    formatDate(new Date(2024, 0, 7 + day), locale, { weekday: style });
  const cal = (value) => formatNumber(value, locale);

  const targetLine = targets.calorie_target
    ? t('mealTimes.targets.summary', {
        target: cal(targets.calorie_target),
        low: targets.band_low_pct,
        high: targets.band_high_pct,
      })
    : t('mealTimes.targets.none');

  return (
    <section aria-labelledby="meal-times-heading">
      <h2 id="meal-times-heading">{t('mealTimes.heading')}</h2>
      <p>{targetLine}</p>
      <p>{t('mealTimes.targets.readOnly')}</p>

      {meals.length === 0 ? (
        <p>{t('mealTimes.empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('mealTimes.grid.timeHeader')}</th>
                {WEEKDAYS.map((day) => (
                  <th scope="col" key={day}>
                    {dayLabel(day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meals.map((meal) => (
                <tr key={meal.id}>
                  <th scope="row">
                    <button type="button" onClick={() => setEditor({ draft: draftFromMeal(meal) })}>
                      {meal.name}
                    </button>{' '}
                    <span>{normalizeTime(meal.time_of_day)}</span>{' '}
                    <span>
                      {t(`mealTimes.kinds.${meal.kind}`)} ·{' '}
                      {needsCalories(meal)
                        ? t('mealTimes.calories.missing')
                        : meal.kind === 'set'
                          ? t('mealTimes.calories.set', { calories: cal(meal.set_calories) })
                          : meal.kind === 'if_room' && meal.cal_min == null
                            ? t('mealTimes.calories.upTo', { max: cal(meal.cal_max) })
                            : t('mealTimes.calories.range', {
                                min: cal(meal.cal_min),
                                max: cal(meal.cal_max),
                              })}
                    </span>
                    {sharedWithOthers(meal, viewerId).length > 0 && (
                      <span>
                        {' '}
                        {t('mealTimes.shared', {
                          names: sharedWithOthers(meal, viewerId).join(', '),
                        })}
                      </span>
                    )}
                  </th>
                  {WEEKDAYS.map((day) => {
                    const on = meal.weekdays.includes(day);
                    return (
                      <td key={day}>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={t('mealTimes.grid.toggleLabel', {
                            name: meal.name,
                            day: dayLabel(day, 'long'),
                          })}
                          disabled={busy}
                          onClick={() => handleToggle(meal, day)}
                        >
                          {on ? t('mealTimes.grid.on') : t('mealTimes.grid.off')}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{t('mealTimes.grid.totalsHeader')}</th>
                {WEEKDAYS.map((day) => {
                  const totals = dayTotals(meals, day, targets);
                  return (
                    <td key={day}>
                      <div>
                        {t('mealTimes.totals.range', {
                          floor: cal(totals.floor),
                          ceiling: cal(totals.ceiling),
                        })}
                      </div>
                      {totals.target > 0 && (
                        <div>
                          {t('mealTimes.totals.aim', {
                            low: cal(totals.aimLow),
                            high: cal(totals.aimHigh),
                          })}
                        </div>
                      )}
                      <div role={totals.status === 'over' ? 'alert' : undefined}>
                        {t(`mealTimes.totals.${totals.status}`)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {notice && <p role="alert">{notice}</p>}

      {clash && (
        <ClashPrompt
          clash={clash}
          busy={busy}
          onReplace={() => resolveClash(true)}
          onKeep={() => resolveClash(false)}
          onCancel={() => setClash(null)}
          dayLabel={dayLabel}
        />
      )}

      {editor ? (
        <MealTimeEditor
          key={editor.draft.id ?? 'new'}
          initial={editor.draft}
          memberId={viewerId}
          members={members}
          busy={busy}
          dayLabel={dayLabel}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          onCancel={() => {
            setClash(null);
            setEditor(null);
          }}
        />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            setEditor({
              draft: { ...NEW_MEAL_DEFAULTS, createdBy: viewerId, sharerIds: [viewerId] },
            })
          }
        >
          {t('mealTimes.addButton')}
        </button>
      )}
    </section>
  );
}

function ClashPrompt({ clash, busy, onReplace, onKeep, onCancel, dayLabel }) {
  const { t } = useI18n();
  const name = clash.mode === 'toggle' ? clash.meal.name : clash.draft.name.trim();
  return (
    <section role="alert" aria-label={t('mealTimes.clash.heading')}>
      {clash.overlaps.map((overlap) => (
        <p key={overlap.meal.id}>
          {t('mealTimes.clash.question', {
            name,
            other: overlap.meal.name,
            days: overlap.weekdays.map((day) => dayLabel(day, 'long')).join(', '),
          })}
        </p>
      ))}
      <button type="button" disabled={busy} onClick={onReplace}>
        {t('mealTimes.clash.replace')}
      </button>{' '}
      <button type="button" disabled={busy} onClick={onKeep}>
        {t('mealTimes.clash.keepBoth')}
      </button>{' '}
      <button type="button" disabled={busy} onClick={onCancel}>
        {t('mealTimes.clash.cancel')}
      </button>
    </section>
  );
}

function MealTimeEditor({
  initial,
  memberId,
  members,
  busy,
  dayLabel,
  onSubmit,
  onDelete,
  onCancel,
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState({});
  const [missingNames, setMissingNames] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = initial.id == null;
  const isCreator = isNew || initial.createdBy === memberId;

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  function toggleWeekday(day) {
    setDraft((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((d) => d !== day)
        : [...current.weekdays, day].sort((a, b) => a - b),
    }));
  }

  // A Member added as a sharer on this save gets an empty range of their own.
  const newSharers = members.filter((member) =>
    newSharerIds(draft.sharerIds, initial.existingSharerIds, memberId).includes(member.id)
  );

  function updateSharerRange(id, field, value) {
    setDraft((current) => ({
      ...current,
      sharerRanges: {
        ...current.sharerRanges,
        [id]: { ...current.sharerRanges[id], [field]: value },
      },
    }));
  }

  function toggleSharer(id) {
    setDraft((current) => ({
      ...current,
      sharerIds: current.sharerIds.includes(id)
        ? current.sharerIds.filter((sharerId) => sharerId !== id)
        : [...current.sharerIds, id],
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const result = validateMealTime(draft);
    const missing = missingSharerRanges(draft, initial.existingSharerIds, memberId);
    setErrors(result.errors);
    setMissingNames(
      members.filter((member) => missing.includes(member.id)).map((member) => member.display_name)
    );
    if (Object.keys(result.errors).length === 0 && missing.length === 0) onSubmit(draft);
  }

  const errorMessages = [...new Set(Object.values(errors))];

  return (
    <form onSubmit={handleSubmit} aria-labelledby="meal-time-form-heading">
      <h3 id="meal-time-form-heading">
        {isNew
          ? t('mealTimes.form.addHeading')
          : t('mealTimes.form.editHeading', { name: initial.name })}
      </h3>

      <label>
        {t('mealTimes.form.name')}
        <input type="text" value={draft.name} onChange={(e) => update('name', e.target.value)} />
      </label>

      <label>
        {t('mealTimes.form.time')}
        <input type="time" value={draft.time} onChange={(e) => update('time', e.target.value)} />
      </label>

      <fieldset>
        <legend>{t('mealTimes.form.kind')}</legend>
        {KINDS.map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="meal-time-kind"
              value={kind}
              checked={draft.kind === kind}
              onChange={() => update('kind', kind)}
            />{' '}
            {t(`mealTimes.kinds.${kind}`)}
          </label>
        ))}
        <p>{t(`mealTimes.kindHints.${draft.kind}`)}</p>
      </fieldset>

      <fieldset>
        <legend>{t('mealTimes.form.days')}</legend>
        {WEEKDAYS.map((day) => (
          <label key={day}>
            <input
              type="checkbox"
              checked={draft.weekdays.includes(day)}
              onChange={() => toggleWeekday(day)}
            />{' '}
            {dayLabel(day, 'long')}
          </label>
        ))}
      </fieldset>

      {members.length > 0 && (
        <fieldset>
          <legend>{t('mealTimes.form.sharers')}</legend>
          {members.map((member) => {
            const locked = member.id === draft.createdBy || member.id === memberId;
            return (
              <label key={member.id}>
                <input
                  type="checkbox"
                  checked={locked || draft.sharerIds.includes(member.id)}
                  disabled={locked}
                  onChange={() => toggleSharer(member.id)}
                />{' '}
                {member.display_name}
              </label>
            );
          })}
          <p>{t('mealTimes.form.sharersHint')}</p>
        </fieldset>
      )}

      {draft.kind === 'set' ? (
        <label>
          {t('mealTimes.form.setCalories')}
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="10"
            value={draft.setCalories}
            onChange={(e) => update('setCalories', e.target.value)}
          />
        </label>
      ) : (
        <>
          <label>
            {t('mealTimes.form.minCalories')}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="10"
              value={draft.calMin}
              onChange={(e) => update('calMin', e.target.value)}
            />
          </label>
          <label>
            {t('mealTimes.form.maxCalories')}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="10"
              value={draft.calMax}
              onChange={(e) => update('calMax', e.target.value)}
            />
          </label>
        </>
      )}

      {newSharers.map((member) => {
        const range = draft.sharerRanges[member.id] ?? {};
        const name = member.display_name;
        const rangeField = (field, label) => (
          <label>
            {label}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="10"
              value={range[field] ?? ''}
              onChange={(e) => updateSharerRange(member.id, field, e.target.value)}
            />
          </label>
        );
        return (
          <fieldset key={member.id}>
            <legend>{name}</legend>
            {draft.kind === 'set' ? (
              rangeField('setCalories', t('mealTimes.form.sharerSetCalories', { name }))
            ) : (
              <>
                {rangeField('calMin', t('mealTimes.form.sharerMinCalories', { name }))}
                {rangeField('calMax', t('mealTimes.form.sharerMaxCalories', { name }))}
              </>
            )}
          </fieldset>
        );
      })}

      {(errorMessages.length > 0 || missingNames.length > 0) && (
        <ul role="alert">
          {errorMessages.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
          {missingNames.map((name) => (
            <li key={name}>{t('mealTimes.errors.sharerRangeMissing', { name })}</li>
          ))}
        </ul>
      )}

      <div>
        <button type="submit" disabled={busy}>
          {t('mealTimes.form.save')}
        </button>{' '}
        <button type="button" disabled={busy} onClick={onCancel}>
          {t('mealTimes.form.cancel')}
        </button>{' '}
        {!isNew &&
          (confirmDelete ? (
            <>
              <span>
                {isCreator
                  ? t('mealTimes.form.confirmDelete', { name: initial.name })
                  : t('mealTimes.form.confirmLeave', { name: initial.name })}
              </span>{' '}
              <button type="button" disabled={busy} onClick={() => onDelete(initial)}>
                {isCreator
                  ? t('mealTimes.form.confirmDeleteButton')
                  : t('mealTimes.form.confirmLeaveButton')}
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>
              {isCreator ? t('mealTimes.form.delete') : t('mealTimes.form.leave')}
            </button>
          ))}
      </div>
    </form>
  );
}
