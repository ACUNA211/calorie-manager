import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadShoppingList, readCachedList, untickLine, writeCachedList } from '../lib/shopping.js';
import {
  addedDate,
  splitList,
  tickOptions,
  UNDO_MS,
  withQueued,
  withTicked,
} from '../lib/shoppingLogic.js';
import { useOfflineShopping } from '../lib/useOfflineShopping.js';
import ShoppingAddForm from './ShoppingAddForm.jsx';
import ShoppingScan from './ShoppingScan.jsx';
import Toast from './Toast.jsx';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';
import './ShoppingPage.css';

// The Household's one Shopping list. Approving the Meal Plan adds a line for what the Pantry
// lacks, in the unit stores sell in; every Member sees the same lines, grouped by store section,
// each with the date it was added. Each open line has two ticks: Bought adds its amount to the
// Pantry, Have it says the needed amount is already there. A ticked line moves to Done and stays
// there; Undo on the toast takes the latest tick back for a few seconds. Any Member can add a line
// by hand. With no signal, ticks and adds are kept on the phone (the queue of ticket 34) and sent
// when it is back online; a line ticked twice, by two Members, still adds to the Pantry once.
export default function ShoppingPage() {
  const { t, formatDate } = useI18n();
  const units = useUnits();
  const [state, setState] = useState({ status: 'loading', lines: [] });
  // The toast: { id, text, undo } where undo is an async function or null. Only the latest tick can be undone.
  const [toast, setToast] = useState(null);
  const toastIds = useRef(0);
  const shopping = useOfflineShopping({ client: supabase });
  const { version } = shopping;

  // Loads the list again after the queue sent something. With no answer, the last list seen online
  // opens instead, so the phone can still tick and add.
  useEffect(() => {
    let active = true;
    loadShoppingList(supabase)
      .then((lines) => {
        writeCachedList(lines);
        if (active) setState({ status: 'ready', lines });
      })
      .catch(() => {
        const cached = readCachedList();
        if (active) {
          setState(cached ? { status: 'ready', lines: cached } : { status: 'error', lines: [] });
        }
      });
    return () => {
      active = false;
    };
  }, [version]);

  function showToast(text, undo) {
    toastIds.current += 1;
    setToast({ id: toastIds.current, text, undo });
  }

  function setTicked(lineId, purchased) {
    setState((current) => ({ ...current, lines: withTicked(current.lines, lineId, purchased) }));
  }

  // One call per tick (the buttons and the scan both use it). The line moves to Done at once and
  // goes back if the call fails. `grams` is a scanned package weight. Resolves true when the tick
  // was made or kept on the phone, false when it failed.
  async function tick(line, kind, grams = null) {
    setTicked(line.id, true);
    try {
      const outcome = await shopping.tick(line.id, kind, grams);
      if (outcome.queued) {
        showToast(t('shopping.toast.queued', { name: line.name }), async () => {
          shopping.cancelTick(line.id);
          setTicked(line.id, false);
        });
        return true;
      }
      const result = outcome.result;
      if (!result.applied) {
        setToast(null);
        return true;
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
      return true;
    } catch {
      setTicked(line.id, false);
      showToast(t('shopping.toast.tickFailed'), null);
      return false;
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

  // Adds a line by hand; the form shows whether it was sent or kept on the phone.
  async function addLine(fields) {
    const outcome = await shopping.add(fields);
    if (!outcome.queued) {
      const lines = await loadShoppingList(supabase).catch(() => null);
      if (lines) {
        writeCachedList(lines);
        setState({ status: 'ready', lines });
      }
    }
    return outcome;
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
        {line.pending ? (
          <p className="small shopping-pending">{t('shopping.offline.notSynced')}</p>
        ) : null}
        {date ? (
          <p className="mute small shopping-date">
            {t('shopping.added', { date: formatDate(date) })}
          </p>
        ) : null}
        {line.purchased || line.pending ? null : (
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

  const { open, done } = splitList(withQueued(state.lines, shopping.items));
  const failed = shopping.items.filter((item) => item.status === 'failed');

  return (
    <section>
      <h2>{t('shopping.heading')}</h2>
      <p className="mute small">{t('shopping.intro')}</p>
      {shopping.online ? null : <p className="small mute">{t('shopping.offline.notice')}</p>}
      {failed.map((item) => (
        <p role="alert" key={item.clientId}>
          {t('shopping.offline.failed', {
            name: item.row.name ?? t('shopping.offline.aTick'),
            error: item.error ?? '',
          })}{' '}
          <button type="button" onClick={() => shopping.retry(item.clientId)}>
            {t('shopping.offline.retry')}
          </button>{' '}
          <button type="button" onClick={() => shopping.discard(item.clientId)}>
            {t('shopping.offline.discard')}
          </button>
        </p>
      ))}
      {state.status === 'loading' && <p>{t('shopping.loading')}</p>}
      {state.status === 'error' && <p role="alert">{t('shopping.loadError')}</p>}
      {state.status === 'ready' && state.lines.length === 0 && <p>{t('shopping.empty')}</p>}
      {state.status === 'ready' && state.lines.length > 0 && open.length === 0 && (
        <p>{t('shopping.allDone')}</p>
      )}
      <ShoppingScan
        lines={withQueued(state.lines, shopping.items)}
        online={shopping.online}
        onTick={(line, grams) => tick(line, 'bought', grams)}
      />
      <ShoppingAddForm online={shopping.online} onAdd={addLine} />
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
