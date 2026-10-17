import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import SignInForm from './components/SignInForm.jsx';
import Home from './components/Home.jsx';
import HouseholdPage from './components/HouseholdPage.jsx';
import TargetsPage from './components/TargetsPage.jsx';
import LanguageSwitch from './i18n/LanguageSwitch.jsx';
import { useI18n } from './i18n/I18nProvider.jsx';

export default function App() {
  const { t } = useI18n();
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setChecked(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setChecked(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  let body;
  if (!checked) body = <p>{t('app.loading')}</p>;
  else if (!session) body = <SignInForm />;
  else
    body = (
      <>
        <Home user={session.user} />
        <HouseholdPage user={session.user} />
        <TargetsPage user={session.user} />
      </>
    );

  return (
    <>
      <LanguageSwitch />
      {body}
    </>
  );
}
