import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import SignInForm from './components/SignInForm.jsx';
import Home from './components/Home.jsx';
import HouseholdPage from './components/HouseholdPage.jsx';
import TargetsPage from './components/TargetsPage.jsx';
import MealTimesPage from './components/MealTimesPage.jsx';
import InviteLanding from './components/InviteLanding.jsx';
import { readInviteToken } from './lib/invites.js';
import LanguageSwitch from './i18n/LanguageSwitch.jsx';
import LoggingForSwitch from './components/LoggingForSwitch.jsx';
import { useI18n } from './i18n/I18nProvider.jsx';

export default function App() {
  const { t } = useI18n();
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [inviteToken, setInviteToken] = useState(() => readInviteToken(window.location.search));

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
  else if (inviteToken)
    body = (
      <InviteLanding
        token={inviteToken}
        user={session?.user ?? null}
        onJoined={() => {
          window.history.replaceState(null, '', window.location.pathname);
          setInviteToken(null);
        }}
      />
    );
  else if (!session) body = <SignInForm />;
  else
    body = (
      <>
        <Home user={session.user} />
        <HouseholdPage user={session.user} />
        <TargetsPage user={session.user} />
        <MealTimesPage user={session.user} />
      </>
    );

  return (
    <>
      <LanguageSwitch />
      <LoggingForSwitch />
      {body}
    </>
  );
}
