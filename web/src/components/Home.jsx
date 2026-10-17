import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

export default function Home({ user }) {
  const { t } = useI18n();
  return (
    <main>
      <h1>{t('home.greeting', { email: user.email })}</h1>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        {t('home.signOut')}
      </button>
    </main>
  );
}
