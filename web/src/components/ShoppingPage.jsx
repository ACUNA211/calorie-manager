import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadShoppingList, tickLine, untickLine } from '../lib/shopping.js';
import { addedDate, splitList, tickOptions, UNDO_MS, withTicked } from '../lib/shoppingLogic.js';
import Toast from './Toast.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';
import './ShoppingPage.css';

// The Household's one Shopping list. Approving the Meal Plan adds a line for what the Pantry
// lacks, in the unit stores sell in; every Member sees the same lines, grouped by store section,
// each with the date it was added. Each open line has two ticks: Bought adds its amount to the
// Pantry, Have it says the needed amount is already there. A ticked line moves to Done and stays
// there; Undo on the toast takes the latest tick back for a few seconds.
export default function ShoppingPage() {
  const { t, formatDate } = useI18n();
  const units = useUnits();
  const [state, setState] = useState({ status: 'loading', lines: [] });
  // The toast: { id, text, undo } where undo is an async function or null. Only the latest tick can be undone.
  const [toast, setToast] = useState(null);
  const toastIds = useRef(0);

  useEffect(() => {
    let active = true;
    loadShoppingList(supabase)
      .then((lines) => {
        if (active) setState({ status: 'ready', lines });
      })
      .catch(() => {
        if (active) setState({ status: 'error', lines: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  function showToast(text, undo) {
    toastIds.current += 1;
    setToast({ id: toastIds.current, text, undo });
  }

  function setTicked(lineId, purchased) {
    setState((current) => ({ ...current, lines: withTicked(current.lines, lineId, purchased) }));
  }

  // One call per tick. The line moves to Done at once and goes back if the call fails.
  async function tick(line, kind) {
    setTicked(line.id, true);
    try {
      const result = await tickLine(supabase, line.id, kind);
      if (!result.applied) {
        setToast(null);
        return;
      }
      const key = kind === 'have_it' ? 'haveIt' : 'bought';
      const text =
        result.pantryGrams === null || line.foodId === null
          ? t('shopping.toast.plain', { name: line.name })
          : t(`shopping.toast.${key}`, {
              name: line.name,
              mass: units.formatMass(result.pantryGrams),
            });
      showToast(text, async () => {
        await untickLine(supabase, line.id);
        setTicked(line.id, false);
      });
    } catch {
      setTicked(line.id, false);
      showToast(t('shopping.toast.tickFailed'), null);
    }
  }

  function undoToast() {
    const undo = toast?.undo;
    setToast(null);
    if (!undo) return;
    undo().catch(() => showToast(t('shopping.toast.undoFailed'), null));
  }

  // "2 × 1 can (14.99 oz)", "1 × package (35.3 oz)" or a plain weight. A hand-added line keeps its text.
  function amountText(line) {
    if (line.measureKind === 'serving') {
      return t('shopping.measure.serving', {
        count: line.measureCount,
        label: line.measureLabel,
        mass: units.formatMass(line.grams / line.measureCount),
      });
    }
    if (line.measureKind === 'package') {
      return t('shopping.measure.package', {
        count: line.measureCount,
        mass: units.formatMass(line.grams / line.measureCount),
      });
    }
    if (line.grams !== null && line.source !== 'hand') return units.formatMass(line.grams);
    return line.text;
  }

  function renderLine(line) {
    const date = addedDate(line);
    const amount = amountText(line);
    return (
      <li className="shopping-line" key={line.id}>
        <p>
          <strong>{line.name}</strong>
          {amount ? (
            <>
              {' '}
              <span className="shopping-amount">
                {line.source === 'plan_extra' ? `${t('shopping.extra')} ` : ''}
                {amount}
              </span>
            </>
          ) : null}
        </p>
        {date ? (
          <p className="mute small shopping-date">
            {t('shopping.added', { date: formatDate(date) })}
          </p>
        ) : null}
        {line.purchased ? null : (
          <p className="shopping-ticks">
            {tickOptions(line).map((kind) => (
              <button
                type="button"
                key={kind}
                aria-label={t(kind === 'bought' ? 'shopping.boughtLabel' : 'shopping.haveItLabel', {
                  name: line.name,
                })}
                onClick={() => tick(line, kind)}
              >
                {t(kind === 'bought' ? 'shopping.bought' : 'shopping.haveIt')}
              </button>
            ))}
          </p>
        )}
      </li>
    );
  }

  const { open, done } = splitList(state.lines);

  return (
    <section>
      <h2>{t('shopping.heading')}</h2>
      <p className="mute small">{t('shopping.intro')}</p>
      {state.status === 'loading' && <p>{t('shopping.loading')}</p>}
      {state.status === 'error' && <p role="alert">{t('shopping.loadError')}</p>}
      {state.status === 'ready' && state.lines.length === 0 && <p>{t('shopping.empty')}</p>}
      {state.status === 'ready' && state.lines.length > 0 && open.length === 0 && (
        <p>{t('shopping.allDone')}</p>
      )}
      {open.map((group) => (
        <section key={group.section} className="store-section">
          <h3>{t(`pantry.sections.${group.key}`)}</h3>
          <ul className="rows">{group.lines.map(renderLine)}</ul>
        </section>
      ))}
      {done.length > 0 && (
        <section className="store-section shopping-done">
          <h3>{t('shopping.done')}</h3>
          <ul className="rows">{done.map(renderLine)}</ul>
        </section>
      )}
      {toast ? (
        <Toast
          key={toast.id}
          message={toast.text}
          actionLabel={t('shopping.toast.undo')}
          onAction={toast.undo ? undoToast : undefined}
          onDismiss={() => setToast(null)}
          durationMs={UNDO_MS}
        />
      ) : null}
    </section>
  );
}
