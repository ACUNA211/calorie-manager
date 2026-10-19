import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import SignInForm from './components/SignInForm.jsx';
import TodayPage from './components/TodayPage.jsx';
import WeekPage from './components/WeekPage.jsx';
import FoodsPage from './components/FoodsPage.jsx';
import RecipesPage from './components/RecipesPage.jsx';
import PantryPage from './components/PantryPage.jsx';
import PlanPage from './components/PlanPage.jsx';
import InviteLanding from './components/InviteLanding.jsx';
import { readInviteToken } from './lib/invites.js';
import LanguageSwitch from './i18n/LanguageSwitch.jsx';
import TopBar from './components/shell/TopBar.jsx';
import TabBar from './components/shell/TabBar.jsx';
import PreferencesPage from './components/PreferencesPage.jsx';
import MorePage from './components/shell/MorePage.jsx';
import { useLocation } from './lib/useLocation.js';
import {
  dayFromSearch,
  pathFor,
  resolveRoute,
  routeFromPath,
  todayPathForDay,
} from './lib/routes.js';
import { useI18n } from './i18n/I18nProvider.jsx';

export default function App() {
  const { t } = useI18n();
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [inviteToken, setInviteToken] = useState(() => readInviteToken(window.location.search));
  const { pathname, search, navigate } = useLocation();
  // Bumped each time a day is opened from Week, so opening the same day again still refreshes Today.
  const [dayOpens, setDayOpens] = useState(0);
  const route = resolveRoute(pathname);
  const openDay = route === 'today' ? dayFromSearch(search) : null;

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

  // "/" and unknown paths land on Today once signed in.
  const signedIn = checked && !inviteToken && Boolean(session);
  useEffect(() => {
    if (signedIn && routeFromPath(pathname) === null) {
      navigate(pathFor('today'), { replace: true });
    }
  }, [signedIn, pathname, navigate]);

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
    return (
      <div className="app">
        <TopBar route={route} />
        <div className="screen">
          {route === 'today' && (
            <TodayPage
              key={`${openDay ?? ''}|${dayOpens}`}
              user={session.user}
              day={openDay ? { key: openDay, n: dayOpens } : null}
            />
          )}
          {route === 'week' && (
            <WeekPage
              user={session.user}
              onOpenDay={(key) => {
                setDayOpens((n) => n + 1);
                navigate(todayPathForDay(key));
              }}
            />
          )}
          {route === 'foods' && <FoodsPage />}
          {route === 'pantry' && <PantryPage user={session.user} />}
          {route === 'recipes' && <RecipesPage />}
          {route === 'plan' && <PlanPage />}
          {route === 'preferences' && <PreferencesPage user={session.user} />}
          {route === 'more' && (
            <MorePage user={session.user} onNavigate={(next) => navigate(pathFor(next))} />
          )}
        </div>
        <TabBar
          current={route === 'preferences' || route === 'plan' ? 'more' : route}
          onNavigate={(next) => navigate(pathFor(next))}
        />
      </div>
    );

  // Sign-in, invite and loading screens keep the language switch they always had.
  return (
    <>
      <LanguageSwitch />
      {body}
    </>
  );
}
