import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadShoppingList } from '../lib/shopping.js';
import { addedDate, splitList } from '../lib/shoppingLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { useUnits } from '../lib/useUnits.jsx';
import './ShoppingPage.css';

// The Household's one Shopping list. Approving the Meal Plan adds a line for what the Pantry
// lacks, in the unit stores sell in; every Member sees the same lines, grouped by store section,
// each with the date it was added.
export default function ShoppingPage() {
  const { t, formatDate } = useI18n();
  const units = useUnits();
  const [state, setState] = useState({ status: 'loading', lines: [] });

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
    </section>
  );
}
