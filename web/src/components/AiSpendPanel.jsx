import { useEffect, useState } from 'react';
import { loadAiSpend } from '../lib/aiSpend.js';
import { isAtOrOverCap } from '../../../supabase/functions/_shared/cap.ts';
import { useI18n } from '../i18n/I18nProvider.jsx';

const AI_PROVIDERS = ['anthropic', 'typesafe', 'google', 'openai'];

// The Owner's view of this month's AI spend per provider, against the Household cap.
export default function AiSpendPanel({ client }) {
  const { t } = useI18n();
  const [state, setState] = useState({ status: 'loading', capUsd: null, rows: [] });

  useEffect(() => {
    let active = true;
    loadAiSpend(client)
      .then((data) => {
        if (active) setState({ status: 'ready', ...data });
      })
      .catch(() => {
        if (active) setState({ status: 'error', capUsd: null, rows: [] });
      });
    return () => {
      active = false;
    };
  }, [client]);

  if (state.status === 'loading') return <p>{t('aiSpend.loading')}</p>;
  if (state.status === 'error') return <p>{t('aiSpend.loadError')}</p>;

  return (
    <section aria-labelledby="ai-spend-heading">
      <h3 id="ai-spend-heading">{t('aiSpend.heading')}</h3>
      {state.rows.length === 0 ? (
        <p>{t('aiSpend.noSpend')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{t('aiSpend.columns.provider')}</th>
              <th scope="col">{t('aiSpend.columns.spent')}</th>
              <th scope="col">{t('aiSpend.columns.cap')}</th>
              <th scope="col">{t('aiSpend.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => {
              const limitReached = isAtOrOverCap(row.spendUsd, state.capUsd);
              return (
                <tr key={row.provider}>
                  <td>
                    {AI_PROVIDERS.includes(row.provider)
                      ? t(`aiSpend.providers.${row.provider}`)
                      : row.provider}
                  </td>
                  <td>{t('aiSpend.usd', { amount: row.spendUsd.toFixed(2) })}</td>
                  <td>{t('aiSpend.usd', { amount: state.capUsd.toFixed(2) })}</td>
                  <td>{limitReached ? t('aiSpend.status.limit') : t('aiSpend.status.ok')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
