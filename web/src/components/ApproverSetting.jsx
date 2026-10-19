import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { loadApprovers, setMemberCanApprove } from '../lib/approvers.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

// Owner only (ticket #45): which Members may approve the Meal Plan. The Owner always may.
// The database checks the Owner role too.
export default function ApproverSetting() {
  const { t } = useI18n();
  const [state, setState] = useState({ status: 'loading', members: [] });
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    loadApprovers(supabase)
      .then((members) => {
        if (active) setState({ status: 'ready', members });
      })
      .catch(() => {
        if (active) setState({ status: 'error', members: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleChange(member, allowed) {
    setError(false);
    setBusyId(member.id);
    try {
      await setMemberCanApprove(supabase, member.id, allowed);
      setState((current) => ({
        ...current,
        members: current.members.map((m) => (m.id === member.id ? { ...m, allowed } : m)),
      }));
    } catch {
      setError(true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="approvers-heading">
      <h3 id="approvers-heading">{t('approve.heading')}</h3>
      <p>{t('approve.hint')}</p>
      {state.status === 'loading' && <p>{t('approve.loading')}</p>}
      {state.status === 'error' && <p role="alert">{t('approve.loadError')}</p>}
      {state.status === 'ready' && state.members.length === 0 && <p>{t('approve.none')}</p>}
      {state.members.map((member) => (
        <label key={member.id}>
          <input
            type="checkbox"
            checked={member.allowed}
            disabled={busyId === member.id}
            onChange={(event) => handleChange(member, event.target.checked)}
          />{' '}
          {t('approve.allow', { name: member.name })}
        </label>
      ))}
      {error && <p role="alert">{t('approve.saveError')}</p>}
    </section>
  );
}
