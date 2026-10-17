import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App.jsx';
import { supabase } from './lib/supabase.js';

// Replace the real Supabase client with a small in-memory fake so the test
// never talks to the network.
vi.mock('./lib/supabase.js', () => {
  const listeners = [];
  const auth = {
    session: null,
    getSession: vi.fn(async () => ({ data: { session: auth.session }, error: null })),
    onAuthStateChange: vi.fn((callback) => {
      listeners.push(callback);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(async () => {
      auth.session = null;
      listeners.forEach((cb) => cb('SIGNED_OUT', null));
      return { error: null };
    }),
  };
  return { supabase: { auth } };
});

describe('signed-in / signed-out switch', () => {
  beforeEach(() => {
    supabase.auth.session = null;
  });

  it('shows the sign-in form when signed out, "Hi, <email>" when signed in, and returns to the form on sign-out', async () => {
    supabase.auth.session = { user: { email: 'sergio@example.com' } };

    render(<App />);

    expect(await screen.findByText('Hi, sergio@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    );
    expect(screen.queryByText(/^Hi, /)).not.toBeInTheDocument();
  });
});
