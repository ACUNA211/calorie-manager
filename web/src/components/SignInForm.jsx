import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function SignInForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    // Server error text is English only, so show our translated message instead.
    if (signInError) setError(t('signIn.failed'));
  }

  return (
    <main>
      <h1>{t('signIn.heading')}</h1>
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? t('signIn.submitting') : t('signIn.submit')}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
