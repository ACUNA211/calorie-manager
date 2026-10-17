import { useEffect, useState } from 'react';
import { loadAiSpend } from '../lib/aiSpend.js';
import { isAtOrOverCap } from '../../../supabase/functions/_shared/cap.ts';
import { AI_SPEND_TEXT } from './AiSpendPanel.strings.js';

// The Owner's view of this month's AI spend per provider, against the Household cap.
export default function AiSpendPanel({ client }) {
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

  if (state.status === 'loading') return <p>{AI_SPEND_TEXT.loading}</p>;
  if (state.status === 'error') return <p>{AI_SPEND_TEXT.loadError}</p>;

  return (
    <section aria-labelledby="ai-spend-heading">
      <h3 id="ai-spend-heading">{AI_SPEND_TEXT.heading}</h3>
      {state.rows.length === 0 ? (
        <p>{AI_SPEND_TEXT.noSpend}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">{AI_SPEND_TEXT.columns.provider}</th>
              <th scope="col">{AI_SPEND_TEXT.columns.spent}</th>
              <th scope="col">{AI_SPEND_TEXT.columns.cap}</th>
              <th scope="col">{AI_SPEND_TEXT.columns.status}</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => {
              const limitReached = isAtOrOverCap(row.spendUsd, state.capUsd);
              return (
                <tr key={row.provider}>
                  <td>{AI_SPEND_TEXT.providers[row.provider] ?? row.provider}</td>
                  <td>${row.spendUsd.toFixed(2)}</td>
                  <td>${state.capUsd.toFixed(2)}</td>
                  <td>{limitReached ? AI_SPEND_TEXT.status.limit : AI_SPEND_TEXT.status.ok}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
