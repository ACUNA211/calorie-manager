import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { createHousehold, loadHousehold } from '../lib/households.js';
import { buildInviteUrl, createInvite } from '../lib/invites.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function HouseholdPage({ user }) {
  const { t } = useI18n();
  const [state, setState] = useState({ status: 'loading', household: null });

  useEffect(() => {
    let active = true;
    loadHousehold(supabase, user.id)
      .then((household) => {
        if (active) setState({ status: 'ready', household });
      })
      .catch(() => {
        if (active) setState({ status: 'error', household: null });
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  if (state.status === 'loading') return <p>{t('household.loading')}</p>;
  if (state.status === 'error') return <p role="alert">{t('household.loadError')}</p>;

  if (!state.household) {
    return (
      <CreateHousehold
        userId={user.id}
        onCreated={(household) => setState({ status: 'ready', household })}
      />
    );
  }

  return <MemberList household={state.household} />;
}

function MemberList({ household }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="household-heading">
      <h2 id="household-heading">{household.name}</h2>
      <h3>{t('household.membersHeading')}</h3>
      {household.members.length === 0 ? (
        <p>{t('household.noMembers')}</p>
      ) : (
        <ul>
          {household.members.map((member) => (
            <li key={member.id}>
              {member.display_name} <span>({t(`household.roles.${member.role}`)})</span>
            </li>
          ))}
        </ul>
      )}
      {household.myRole === 'owner' && <InviteLink householdId={household.id} />}
    </section>
  );
}

// Owner only: makes a single-use link (7 days) and copies it. The database checks the role too.
function InviteLink({ householdId }) {
  const { t, formatDate } = useI18n();
  const [state, setState] = useState({ status: 'idle', url: '', expiresAt: null });

  async function handleInvite() {
    setState({ status: 'busy', url: '', expiresAt: null });
    try {
      const { token, expires_at: expiresAt } = await createInvite(supabase, householdId);
      const url = buildInviteUrl(window.location, token);
      let copied = true;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        copied = false;
      }
      setState({ status: copied ? 'copied' : 'copyFailed', url, expiresAt });
    } catch {
      setState({ status: 'error', url: '', expiresAt: null });
    }
  }

  return (
    <div>
      <button type="button" onClick={handleInvite} disabled={state.status === 'busy'}>
        {state.status === 'busy' ? t('invite.owner.creating') : t('invite.owner.button')}
      </button>
      {state.status === 'copied' && (
        <p role="status">
          {t('invite.owner.copied', { date: formatDate(new Date(state.expiresAt)) })}
        </p>
      )}
      {state.status === 'copyFailed' && <p role="status">{t('invite.owner.copyFailed')}</p>}
      {state.url && (
        <input type="text" readOnly value={state.url} aria-label={t('invite.owner.linkLabel')} />
      )}
      {state.status === 'error' && <p role="alert">{t('invite.owner.createError')}</p>}
    </div>
  );
}

function CreateHousehold({ userId, onCreated }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await createHousehold(supabase, { name, ownerName });
      const household = await loadHousehold(supabase, userId);
      onCreated(household);
    } catch {
      setError(t('household.createError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="household-heading">
      <h2 id="household-heading">{t('household.noHouseholdTitle')}</h2>
      <p>{t('household.noHouseholdBody')}</p>
      <form onSubmit={handleSubmit}>
        <label>
          {t('household.householdNameLabel')}
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t('household.ownerNameLabel')}
          <input
            type="text"
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? t('household.creating') : t('household.createButton')}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
