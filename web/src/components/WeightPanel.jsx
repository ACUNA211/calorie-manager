import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { deleteWeight, loadWeight, saveWeight } from '../lib/weight.js';
import {
  MAX_KG,
  MIN_KG,
  buildTrend,
  checkWeightEntry,
  parseWeight,
  trendLayout,
  trendWindow,
} from '../lib/weightLogic.js';
import { parseDateKey } from '../lib/todayLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import WeightTrend from './WeightTrend.jsx';

const CHART = { width: 320, height: 140, pad: 12 };
const LOADING = { key: null, status: 'loading', entries: [] };

// The weight log for one Member, shown under the Week view: the 12-week trend that ends with
// the week on screen, a form to log a weight for a day, and the entries in that span, each
// with Edit and Delete. One weight per day: logging a day again replaces it.
export default function WeightPanel({ memberId, weekStart, todayKey }) {
  const { t, formatDate, formatNumber } = useI18n();
  const { startKey, endKey, fetchFromKey } = trendWindow(weekStart);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState(LOADING);
  const [form, setForm] = useState({ date: todayKey, weight: '', error: null });
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  // The state records which request it answers, so a new Member or week shows the loading
  // line until its own weights arrive.
  const requestKey = `${memberId}|${fetchFromKey}|${endKey}|${version}`;

  useEffect(() => {
    let active = true;
    loadWeight(supabase, memberId, fetchFromKey, endKey)
      .then((entries) => {
        if (active) setLoaded({ key: requestKey, status: 'ready', entries });
      })
      .catch(() => {
        if (active) setLoaded({ key: requestKey, status: 'error', entries: [] });
      });
    return () => {
      active = false;
    };
  }, [memberId, fetchFromKey, endKey, requestKey]);

  const view = loaded.key === requestKey ? loaded : LOADING;
  const trend = view.status === 'ready' ? buildTrend(view.entries, startKey, endKey) : null;
  const layout = trend ? trendLayout(trend, CHART) : null;
  const listed = trend ? [...trend.entries].reverse() : [];
  const bounds = { min: MIN_KG, max: MAX_KG };
  const number = (value) => formatNumber(value, { maximumFractionDigits: 1 });

  async function handleSave(event) {
    event.preventDefault();
    const check = checkWeightEntry({ date: form.date, weight: form.weight, todayKey });
    if (!check.ok) {
      setForm((current) => ({ ...current, error: { key: check.error } }));
      setNotice(null);
      return;
    }
    setBusy(true);
    try {
      await saveWeight(supabase, memberId, check.values.log_date, check.values.kg);
      setForm((current) => ({ ...current, weight: '', error: null }));
      setNotice('saved');
      setVersion((count) => count + 1);
    } catch {
      setNotice('saveError');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(entry) {
    const parsed = parseWeight(editing.weight);
    if (!parsed.ok) {
      setEditing((current) => ({ ...current, error: parsed.error }));
      return;
    }
    setBusy(true);
    try {
      await saveWeight(supabase, memberId, entry.log_date, parsed.value);
      setEditing(null);
      setNotice('saved');
      setVersion((count) => count + 1);
    } catch {
      setNotice('saveError');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(entry) {
    setBusy(true);
    try {
      await deleteWeight(supabase, entry.id);
      if (editing && editing.id === entry.id) setEditing(null);
      setNotice(null);
      setVersion((count) => count + 1);
    } catch {
      setNotice('deleteError');
    } finally {
      setBusy(false);
    }
  }

  const formErrorKey = form.error ? form.error.key : null;
  const editErrorKey = editing ? editing.error : null;

  return (
    <section aria-labelledby="weight-heading">
      <h3 id="weight-heading">{t('weight.heading')}</h3>

      {/* noValidate: the checks here give the messages, not the browser's own pop-ups. */}
      <form noValidate onSubmit={handleSave}>
        <label>
          {t('weight.dateLabel')}{' '}
          <input
            type="date"
            value={form.date}
            max={todayKey}
            onChange={(event) =>
              setForm((current) => ({ ...current, date: event.target.value, error: null }))
            }
          />
        </label>
        <label>
          {t('weight.weightLabel')}{' '}
          <input
            type="text"
            inputMode="decimal"
            value={form.weight}
            onChange={(event) =>
              setForm((current) => ({ ...current, weight: event.target.value, error: null }))
            }
          />
        </label>
        <button type="submit" disabled={busy}>
          {t('weight.save')}
        </button>
        <p>{t('weight.replaces')}</p>
        {formErrorKey ? <p role="alert">{t(formErrorKey, bounds)}</p> : null}
      </form>

      {notice === 'saved' ? <p role="status">{t('weight.saved')}</p> : null}
      {notice === 'saveError' ? <p role="alert">{t('weight.saveError')}</p> : null}
      {notice === 'deleteError' ? <p role="alert">{t('weight.deleteError')}</p> : null}

      {view.status === 'loading' ? <p>{t('weight.loading')}</p> : null}
      {view.status === 'error' ? <p role="alert">{t('weight.loadError')}</p> : null}

      {trend ? (
        <>
          <WeightTrend trend={trend} layout={layout} />
          <h4>{t('weight.entriesHeading')}</h4>
          {listed.length === 0 ? <p>{t('weight.none')}</p> : null}
          <ul>
            {listed.map((entry) => {
              const date = formatDate(parseDateKey(entry.log_date));
              if (editing && editing.id === entry.id) {
                return (
                  <li key={entry.id}>
                    <span>{date} </span>
                    <label>
                      {t('weight.weightLabel')}{' '}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editing.weight}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            weight: event.target.value,
                            error: null,
                          }))
                        }
                      />
                    </label>{' '}
                    <button type="button" disabled={busy} onClick={() => handleSaveEdit(entry)}>
                      {t('weight.save')}
                    </button>{' '}
                    <button type="button" onClick={() => setEditing(null)}>
                      {t('weight.cancel')}
                    </button>
                    {editErrorKey ? <p role="alert">{t(editErrorKey, bounds)}</p> : null}
                  </li>
                );
              }
              return (
                <li key={entry.id}>
                  <span>{t('weight.entry', { date, kg: number(entry.kg) })} </span>
                  <button
                    type="button"
                    aria-label={t('weight.editAria', { date })}
                    disabled={busy}
                    onClick={() =>
                      setEditing({ id: entry.id, weight: String(entry.kg), error: null })
                    }
                  >
                    {t('weight.edit')}
                  </button>{' '}
                  <button
                    type="button"
                    aria-label={t('weight.deleteAria', { date })}
                    disabled={busy}
                    onClick={() => handleDelete(entry)}
                  >
                    {t('weight.delete')}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
