import { supabase } from '../lib/supabase.js';

export default function Home({ user }) {
  return (
    <main>
      <h1>Hi, {user.email}</h1>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </main>
  );
}
