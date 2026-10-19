import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { currentUserId, loadHouseholdWeeks } from '../lib/sharing.js';
import { parseDateKey } from '../lib/todayLogic.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

const LOADING = { key: null, status: 'loading', adults: [] };

// The other adult Members of the Household for the week on screen. Each shows, per day, only
// whether it was on track or over, unless that Member shares everything; then it also shows
// their calories per day. The shared Meal Plan does not exist yet and will show here later.
export default function HouseholdDays({ start, todayKey }) {
  const { t, formatDate, formatNumber } = useI18n();
  const [loaded, setLoaded] = useState(LOADING);
  const requestKey = `${start}|${todayKey}`;

  useEffect(() => {
    let active = true;
    currentUserId(supabase)
      .then((userId) => (userId ? loadHouseholdWeeks(supabase, userId, start, todayKey) : []))
      .then((adults) => {
        if (active) setLoaded({ key: requestKey, status: 'ready', adults });
      })
      .catch(() => {
        if (active) setLoaded({ key: requestKey, status: 'error', adults: [] });
      });
    return () => {
      active = false;
    };
  }, [start, todayKey, requestKey]);

  const view = loaded.key === requestKey ? loaded : LOADING;

  return (
    <section aria-labelledby="household-days-heading" className="household-days">
      <h3 id="household-days-heading">{t('sharing.daysHeading')}</h3>
      {view.status === 'loading' ? <p>{t('sharing.loading')}</p> : null}
      {view.status === 'error' ? <p role="alert">{t('sharing.loadError')}</p> : null}
      {view.status === 'ready' && view.adults.length === 0 ? <p>{t('sharing.noAdults')}</p> : null}
      {view.status === 'ready' && view.adults.length > 0 ? (
        <ul>
          {view.adults.map((adult) => (
            <li key={adult.id}>
              <strong>{adult.name}</strong>
              {adult.shared ? <span> ({t('sharing.sharedAll')})</span> : null}
              <ol>
                {adult.days.map((day) => (
                  <li key={day.key}>
                    <span>{formatDate(parseDateKey(day.key))}: </span>
                    <span>{t(`sharing.status.${day.status}`)}</span>
                    {adult.shared && day.kcal != null ? (
                      <span>
                        {' '}
                        {t('sharing.kcal', {
                          kcal: formatNumber(day.kcal, { maximumFractionDigits: 0 }),
                        })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
