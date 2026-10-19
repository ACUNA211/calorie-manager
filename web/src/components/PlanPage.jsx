import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadPlanWeek } from '../lib/plan.js';
import { buildPlanGrid } from '../lib/planLogic.js';
import { shiftWeek, weekEndKey, weekStartKey } from '../lib/weekLogic.js';
import { dateKey, parseDateKey } from '../lib/todayLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import './PlanPage.css';

const LOADING = { key: null, status: 'loading', data: null };

// The Plan grid for the Household, read only: Meal Times down the side, Sunday to Saturday
// across, each Cook coloured with the Portion each Member eats and its calories. Under the
// grid, each Member's total per day against their Planning band. A Member filter shows one
// Member or everyone; the week arrows move 7 days. Editing is ticket 40.
export default function PlanPage() {
  const { t, formatDate, formatNumber } = useI18n();
  const [todayKey] = useState(() => dateKey(new Date()));
  const [start, setStart] = useState(() => weekStartKey(todayKey));
  const [filter, setFilter] = useState('all');
  const [state, setState] = useState(LOADING);

  useEffect(() => {
    let active = true;
    loadPlanWeek(supabase, start)
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

  const current = state.key === start ? state : LOADING;
  const number = (value) => formatNumber(value, { maximumFractionDigits: 1 });
  const dayLabel = (key) => formatDate(parseDateKey(key));

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

    body = (
      <>
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
                      {row.cells.map((cell, index) => (
                        <td key={grid.days[index]}>
                          {cell.map((cook) => (
                            <div className={`plan-cook plan-cook-${cook.colour}`} key={cook.cookId}>
                              <strong>{cook.recipeName}</strong>
                              <ul>
                                {cook.portions.map((portion) => (
                                  <li key={portion.id}>
                                    {t('plan.portion', {
                                      name: portion.memberName,
                                      servings: number(portion.servings),
                                      kcal: number(portion.kcal),
                                    })}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </td>
                      ))}
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
                        </td>
                      ))}
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>
          </>
        )}
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
          onClick={() => setStart((value) => shiftWeek(value, -1))}
        >
          {'<'}
        </button>
        <p>{t('plan.range', { from: dayLabel(start), to: dayLabel(weekEndKey(start)) })}</p>
        <button
          type="button"
          aria-label={t('plan.nextWeek')}
          onClick={() => setStart((value) => shiftWeek(value, 1))}
        >
          {'>'}
        </button>
      </div>
      {body}
    </section>
  );
}
