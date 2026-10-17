import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import SignInForm from './components/SignInForm.jsx';
import Home from './components/Home.jsx';

export default function App() {
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

  if (!checked) return <p>Loading…</p>;
  return session ? <Home user={session.user} /> : <SignInForm />;
}
