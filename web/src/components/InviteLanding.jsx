import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { acceptErrorKey, acceptInvite, peekInvite } from '../lib/invites.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

// Shown for a ?invite=<token> link. It checks the link, then either asks for an account
// (sign up or sign in) or, if the person is already signed in, asks for their name and joins.
// Sign-up exists only here: the rest of the app has no open sign-up.
export default function InviteLanding({ token, user, onJoined }) {
  const { t } = useI18n();
  const [state, setState] = useState({ status: 'loading', result: null });

  useEffect(() => {
    let active = true;
    peekInvite(supabase, token)
      .then((result) => {
        if (active) setState({ status: 'ready', result });
      })
      .catch(() => {
        if (active) setState({ status: 'error', result: null });
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (state.status === 'loading') return <p>{t('invite.landing.checking')}</p>;
  if (state.status === 'error') return <p role="alert">{t('invite.landing.loadError')}</p>;

  const { result } = state;
  // A link that does not exist, or is revoked, used or expired, joins nobody.
  if (!result || result.status !== 'valid') {
    const key = result ? result.status : 'notFound';
    return (
      <main>
        <p role="alert">{t(`invite.errors.${key}`)}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{t('invite.landing.invitedTo', { household: result.householdName })}</h1>
      {user ? <JoinForm token={token} onJoined={onJoined} /> : <AccountForm />}
    </main>
  );
}

function JoinForm({ token, onJoined }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await acceptInvite(supabase, token, name);
      onJoined();
    } catch (joinError) {
      setError(t(`invite.errors.${acceptErrorKey(joinError)}`));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        {t('invite.landing.nameLabel')}
        <input
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? t('invite.landing.joining') : t('invite.landing.join')}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function AccountForm() {
  const { t } = useI18n();
  const [mode, setMode] = useState('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const signingUp = mode === 'signUp';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    if (signingUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (signUpError) {
        setError(t('invite.landing.signUpFailed'));
      } else if (!data?.session) {
        // Email confirmation is on: the person confirms, then opens the link again.
        setNeedsConfirm(true);
      }
      // With a session, App's auth listener swaps this form for the join step.
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    // Server error text is English only, so show our translated message instead.
    if (signInError) setError(t('signIn.failed'));
  }

  if (needsConfirm) return <p role="status">{t('invite.landing.confirmEmail')}</p>;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <label>
          {t('signIn.email')}
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          {t('signIn.password')}
          <input
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {signingUp
            ? busy
              ? t('invite.landing.signUpSubmitting')
              : t('invite.landing.signUpSubmit')
            : busy
              ? t('invite.landing.signInSubmitting')
              : t('invite.landing.signInSubmit')}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      <button type="button" onClick={() => setMode(signingUp ? 'signIn' : 'signUp')}>
        {signingUp ? t('invite.landing.haveAccount') : t('invite.landing.createAccount')}
      </button>
    </>
  );
}
