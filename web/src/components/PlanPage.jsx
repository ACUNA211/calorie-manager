import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  addCook,
  approvePlan,
  deleteCook,
  loadCanApprove,
  loadPlanValidation,
  loadPlanWeek,
  loadRecipeChoices,
  loadSlotMealTimes,
  movePortion,
  removePortion,
  setPortion,
} from '../lib/plan.js';
import {
  approveAction,
  buildPlanGrid,
  planMove,
  planPlacement,
  servingsMadeFor,
  stepServings,
} from '../lib/planLogic.js';
import { failuresForCell, failuresForDay, validatePlan } from '../lib/planValidator.js';
import { shiftWeek, weekEndKey, weekStartKey } from '../lib/weekLogic.js';
import { dateKey, parseDateKey } from '../lib/todayLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import ShoppingLink from './ShoppingLink.jsx';
import './PlanPage.css';

const LOADING = { key: null, status: 'loading', data: null };

// The week as the grid reads it: the plan plus every Meal Time of the Household (empty slots).
async function fetchWeek(start) {
  const [week, slots, validation] = await Promise.all([
    loadPlanWeek(supabase, start),
    loadSlotMealTimes(supabase),
    // Warnings are a bonus: if they cannot be read the grid still shows.
    Promise.resolve()
      .then(() => loadPlanValidation(supabase, start))
      .catch(() => null),
  ]);
  return { ...week, slots, validation: validation ?? null };
}

// The Plan grid for the Household: Meal Times down the side, Sunday to Saturday across, each
// Cook coloured with the Portion each Member eats and its calories. Under the grid, each
// Member's total per day against their Planning band. A Member filter shows one Member or
// everyone; the week arrows move 7 days. Editing saves straight away: add a Cook, place it at a
// Meal Time (every Member who shares it gets a Portion sized from their remaining band), resize
// a Portion by quarter servings, move it, remove it, delete the Cook.
export default function PlanPage() {
  const { t, formatDate, formatNumber } = useI18n();
  const [todayKey] = useState(() => dateKey(new Date()));
  const [start, setStart] = useState(() => weekStartKey(todayKey));
  const [filter, setFilter] = useState('all');
  const [state, setState] = useState(LOADING);
  const [canApprove, setCanApprove] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [newCook, setNewCook] = useState({ recipeId: '', day: '' });
  const [editor, setEditor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchWeek(start)
      .then((data) => {
        if (active) setState({ key: start, status: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ key: start, status: 'error', data: null });
      });
    return () => {
      active = false;
    };
  }, [start]);

  useEffect(() => {
    let active = true;
    loadRecipeChoices(supabase)
      .then((list) => {
        if (active) setRecipes(list);
      })
      .catch(() => {
        if (active) setRecipes([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadCanApprove(supabase)
      .then((allowed) => {
        if (active) setCanApprove(allowed === true);
      })
      .catch(() => {
        if (active) setCanApprove(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const current = state.key === start ? state : LOADING;
  const number = (value) => formatNumber(value, { maximumFractionDigits: 2 });
  const dayLabel = (key) => formatDate(parseDateKey(key));

  // Runs one edit, then reads the week again so the grid shows what the database holds.
  async function save(action) {
    setBusy(true);
    setSaveError(null);
    try {
      await action();
      const data = await fetchWeek(start);
      setState({ key: start, status: 'ready', data });
      setEditor(null);
      setConfirmDelete(null);
    } catch {
      setSaveError(t('plan.saveError'));
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (current.status === 'error') {
    body = <p role="alert">{t('plan.loadError')}</p>;
  } else if (current.status !== 'ready') {
    body = <p>{t('plan.loading')}</p>;
  } else {
    const { data } = current;
    // A filter pointing at a Member who is not in the Household falls back to everyone.
    const memberId = data.members.some((member) => String(member.id) === filter)
      ? Number(filter)
      : null;
    const grid = buildPlanGrid(data, start, memberId);
    // Failures of the whole plan (ticket 41); the filter only limits which are shown.
    const failures =
      data.validation && data.plan
        ? validatePlan({ ...data, ...data.validation, days: grid.days }).failures.filter(
            (failure) => memberId == null || failure.memberId === memberId
          )
        : [];
    const warningText = (failure) => {
      const { params } = failure;
      return t(`plan.validation.${failure.code}`, {
        ...params,
        kcal: number(params.kcal ?? 0),
        min: params.min == null ? '' : number(params.min),
        max: params.max == null ? '' : number(params.max),
        low: params.low == null ? '' : number(params.low),
        high: params.high == null ? '' : number(params.high),
      });
    };
    const warningList = (list) =>
      list.length > 0 ? (
        <ul className="plan-warnings">
          {list.map((failure, index) => (
            <li key={`${failure.code}-${failure.portionId ?? index}-${failure.memberId}-${index}`}>
              {warningText(failure)}
            </li>
          ))}
        </ul>
      ) : null;

    const recipeId = newCook.recipeId || String(recipes[0]?.id ?? '');
    const cookDay = grid.days.includes(newCook.day)
      ? newCook.day
      : grid.days.includes(todayKey)
        ? todayKey
        : start;

    const portionsOf = (cookId) => data.portions.filter((portion) => portion.cookId === cookId);

    function placeCook(row, day, cookId) {
      const placements = planPlacement(data, cookId, row.mealTimes, day, memberId);
      return save(async () => {
        for (const placement of placements) {
          await setPortion(supabase, { cookId, eatDate: day, ...placement });
        }
      });
    }

    function moveCook(portions, form) {
      const target = grid.rows.find((row) => row.key === form.rowKey);
      const result = planMove(data, portions, target?.mealTimes ?? [], form.day);
      if (!result.ok) {
        setSaveError(t(`plan.moveError.${result.reason}`));
        return undefined;
      }
      return save(async () => {
        for (const move of result.moves) {
          await movePortion(supabase, move.portionId, move.mealTimeId, move.eatDate);
        }
      });
    }

    function resize(cookId, day, portion, direction) {
      return save(() =>
        setPortion(supabase, {
          cookId,
          memberId: portion.memberId,
          mealTimeId: portion.mealTimeId,
          eatDate: day,
          servings: stepServings(portion.servings, direction),
        })
      );
    }

    const approveKind = approveAction(data.plan, canApprove);

    body = (
      <>
        {grid.changedSinceApproval ? (
          <p className="plan-changed">{t('plan.changedSinceApproval')}</p>
        ) : null}

        {approveKind ? (
          <p className="plan-approve">
            <button
              type="button"
              disabled={busy}
              onClick={() => save(() => approvePlan(supabase, data.plan.id))}
            >
              {busy ? t('plan.approving') : t(`plan.${approveKind}Button`)}
            </button>
          </p>
        ) : null}

        <ShoppingLink />

        <form
          className="plan-addcook"
          onSubmit={(event) => {
            event.preventDefault();
            if (recipeId) save(() => addCook(supabase, start, Number(recipeId), cookDay));
          }}
        >
          <h3>{t('plan.addCookHeading')}</h3>
          {recipes.length === 0 ? (
            <p>{t('plan.noRecipes')}</p>
          ) : (
            <>
              <label>
                {t('plan.recipe')}
                <select
                  value={recipeId}
                  onChange={(event) =>
                    setNewCook((value) => ({ ...value, recipeId: event.target.value }))
                  }
                >
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={String(recipe.id)}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('plan.cookDay')}
                <select
                  value={cookDay}
                  onChange={(event) =>
                    setNewCook((value) => ({ ...value, day: event.target.value }))
                  }
                >
                  {grid.days.map((key) => (
                    <option key={key} value={key}>
                      {dayLabel(key)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={busy}>
                {t('plan.addCook')}
              </button>
            </>
          )}
        </form>

        {saveError ? <p role="alert">{saveError}</p> : null}

        {data.members.length > 1 ? (
          <label className="plan-filter">
            {t('plan.filterLabel')}
            <select
              value={memberId == null ? 'all' : String(memberId)}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">{t('plan.everyone')}</option>
              {data.members.map((member) => (
                <option key={member.id} value={String(member.id)}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {!grid.empty && data.validation && !failures.length ? (
          <p className="plan-valid">{t('plan.validation.allGood')}</p>
        ) : null}
        {!grid.empty && failures.length ? (
          <p className="plan-warning-count" role="status">
            {t('plan.validation.count', { count: failures.length })}
          </p>
        ) : null}

        {grid.empty ? (
          <p>{t('plan.empty')}</p>
        ) : (
          <>
            <p className="plan-status">{t(`plan.status.${grid.status}`)}</p>
            <div className="plan-scroll">
              <table className="plan-grid">
                <caption className="plan-sr">{t('plan.gridCaption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('plan.mealTime')}</th>
                    {grid.days.map((key) => (
                      <th
                        scope="col"
                        key={key}
                        aria-current={key === todayKey ? 'date' : undefined}
                      >
                        {dayLabel(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">
                        {row.name}
                        <span className="plan-time">{row.time}</span>
                        {row.shared ? (
                          <span className="plan-shared">{t('plan.shared')}</span>
                        ) : null}
                      </th>
                      {row.cells.map((cell, index) => {
                        const day = grid.days[index];
                        const editing =
                          editor && editor.rowKey === row.key && editor.day === day ? editor : null;
                        return (
                          <td key={day}>
                            {warningList(
                              failuresForCell(
                                failures,
                                row.mealTimes.map((meal) => meal.id),
                                day
                              )
                            )}
                            {cell.map((cook) => (
                              <div
                                className={`plan-cook plan-cook-${cook.colour}`}
                                key={cook.cookId}
                              >
                                <strong>{cook.recipeName}</strong>
                                <ul>
                                  {cook.portions.map((portion) => (
                                    <li key={portion.id}>
                                      <span>
                                        {t('plan.portion', {
                                          name: portion.memberName,
                                          servings: number(portion.servings),
                                          kcal: number(portion.kcal),
                                        })}
                                      </span>
                                      <span className="plan-portion-buttons">
                                        <button
                                          type="button"
                                          disabled={busy || portion.servings <= 0.25}
                                          aria-label={t('plan.smallerAria', {
                                            recipe: cook.recipeName,
                                            name: portion.memberName,
                                          })}
                                          onClick={() => resize(cook.cookId, day, portion, -1)}
                                        >
                                          {t('plan.smaller')}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          aria-label={t('plan.biggerAria', {
                                            recipe: cook.recipeName,
                                            name: portion.memberName,
                                          })}
                                          onClick={() => resize(cook.cookId, day, portion, 1)}
                                        >
                                          {t('plan.bigger')}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          aria-label={t('plan.removeAria', {
                                            recipe: cook.recipeName,
                                            name: portion.memberName,
                                          })}
                                          onClick={() =>
                                            save(() => removePortion(supabase, portion.id))
                                          }
                                        >
                                          {t('plan.remove')}
                                        </button>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                <button
                                  type="button"
                                  disabled={busy}
                                  aria-label={t('plan.moveAria', { recipe: cook.recipeName })}
                                  onClick={() =>
                                    setEditor({
                                      type: 'move',
                                      rowKey: row.key,
                                      day,
                                      cookId: cook.cookId,
                                      target: { rowKey: row.key, day },
                                    })
                                  }
                                >
                                  {t('plan.move')}
                                </button>
                                {editing?.type === 'move' && editing.cookId === cook.cookId ? (
                                  <div className="plan-editor">
                                    <label>
                                      {t('plan.moveDay')}
                                      <select
                                        value={editing.target.day}
                                        onChange={(event) =>
                                          setEditor({
                                            ...editing,
                                            target: { ...editing.target, day: event.target.value },
                                          })
                                        }
                                      >
                                        {grid.days.map((key) => (
                                          <option key={key} value={key}>
                                            {dayLabel(key)}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label>
                                      {t('plan.moveMeal')}
                                      <select
                                        value={editing.target.rowKey}
                                        onChange={(event) =>
                                          setEditor({
                                            ...editing,
                                            target: {
                                              ...editing.target,
                                              rowKey: event.target.value,
                                            },
                                          })
                                        }
                                      >
                                        {grid.rows.map((option) => (
                                          <option key={option.key} value={option.key}>
                                            {option.name} {option.time}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        moveCook(cook.portions, {
                                          rowKey: editing.target.rowKey,
                                          day: editing.target.day,
                                        })
                                      }
                                    >
                                      {t('plan.moveHere')}
                                    </button>
                                    <button type="button" onClick={() => setEditor(null)}>
                                      {t('plan.cancel')}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                            {editing?.type === 'add' ? (
                              <div className="plan-editor">
                                <label>
                                  {t('plan.pickCook')}
                                  <select
                                    value={editing.cookId}
                                    onChange={(event) =>
                                      setEditor({ ...editing, cookId: event.target.value })
                                    }
                                  >
                                    {data.cooks.map((cook) => (
                                      <option key={cook.id} value={String(cook.id)}>
                                        {t('plan.cookOption', {
                                          recipe: cook.recipeName,
                                          day: dayLabel(cook.cookDate),
                                        })}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => placeCook(row, day, Number(editing.cookId))}
                                >
                                  {t('plan.place')}
                                </button>
                                <button type="button" onClick={() => setEditor(null)}>
                                  {t('plan.cancel')}
                                </button>
                              </div>
                            ) : row.addable[index] && !editing ? (
                              <button
                                type="button"
                                className="plan-add"
                                disabled={busy}
                                aria-label={t('plan.addAria', {
                                  meal: row.name,
                                  day: dayLabel(day),
                                })}
                                onClick={() =>
                                  setEditor({
                                    type: 'add',
                                    rowKey: row.key,
                                    day,
                                    cookId: String(data.cooks[0].id),
                                  })
                                }
                              >
                                {t('plan.add')}
                              </button>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {grid.totals.map((member) => (
                    <tr key={member.memberId}>
                      <th scope="row">
                        {t('plan.dayTotal', { name: member.name })}
                        <span className="plan-time">
                          {member.bandLow == null
                            ? t('plan.noBand')
                            : t('plan.band', {
                                low: number(member.bandLow),
                                high: number(member.bandHigh),
                              })}
                        </span>
                      </th>
                      {member.days.map((day) => (
                        <td key={day.key} className={`plan-total plan-total-${day.state}`}>
                          <span>
                            {day.state === 'none'
                              ? t('plan.nothing')
                              : t('plan.kcal', { kcal: number(day.kcal) })}
                          </span>
                          {day.state === 'under' || day.state === 'in' || day.state === 'over' ? (
                            <span className="plan-state">{t(`plan.state.${day.state}`)}</span>
                          ) : null}
                          {warningList(failuresForDay(failures, member.memberId, day.key))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>
          </>
        )}

        {data.cooks.length > 0 ? (
          <section className="plan-cooks" aria-labelledby="plan-cooks-heading">
            <h3 id="plan-cooks-heading">{t('plan.cooksHeading')}</h3>
            <ul>
              {data.cooks.map((cook) => {
                const planned = portionsOf(cook.id).reduce((sum, p) => sum + p.servings, 0);
                return (
                  <li key={cook.id}>
                    <span>
                      {t('plan.cookSummary', {
                        recipe: cook.recipeName,
                        day: dayLabel(cook.cookDate),
                        made: number(
                          servingsMadeFor(
                            cook.servingsMade,
                            portionsOf(cook.id).map((p) => p.servings)
                          )
                        ),
                        planned: number(planned),
                      })}
                    </span>
                    {confirmDelete === cook.id ? (
                      <span className="plan-confirm">
                        {t('plan.deleteConfirm', { recipe: cook.recipeName })}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => save(() => deleteCook(supabase, cook.id))}
                        >
                          {t('plan.deleteYes')}
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)}>
                          {t('plan.keep')}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={t('plan.deleteCookAria', { recipe: cook.recipeName })}
                        onClick={() => setConfirmDelete(cook.id)}
                      >
                        {t('plan.deleteCook')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <section aria-labelledby="plan-heading">
      <h2 id="plan-heading">{t('plan.heading')}</h2>
      <div className="plan-weeknav">
        <button
          type="button"
          aria-label={t('plan.previousWeek')}
          onClick={() => {
            setEditor(null);
            setSaveError(null);
            setStart((value) => shiftWeek(value, -1));
          }}
        >
          {'<'}
        </button>
        <p>{t('plan.range', { from: dayLabel(start), to: dayLabel(weekEndKey(start)) })}</p>
        <button
          type="button"
          aria-label={t('plan.nextWeek')}
          onClick={() => {
            setEditor(null);
            setSaveError(null);
            setStart((value) => shiftWeek(value, 1));
          }}
        >
          {'>'}
        </button>
      </div>
      {body}
    </section>
  );
}
