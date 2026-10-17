import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App.jsx';
import { supabase } from './lib/supabase.js';
import { I18nProvider } from './i18n/I18nProvider.jsx';

// The Household page is covered by its own tests; here it just loads as empty.
vi.mock('./lib/households.js', () => ({
  loadHousehold: vi.fn(async () => null),
  createHousehold: vi.fn(),
}));

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

function renderApp() {
  return render(<App />, { wrapper: I18nProvider });
}

describe('signed-in / signed-out switch', () => {
  // Globals are off, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    supabase.auth.session = null;
    window.localStorage.clear();
  });

  it('shows the sign-in form when signed out, "Hi, <email>" when signed in, and returns to the form on sign-out', async () => {
    supabase.auth.session = { user: { email: 'sergio@example.com' } };

    renderApp();

    expect(await screen.findByText('Hi, sergio@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    );
    expect(screen.queryByText(/^Hi, /)).not.toBeInTheDocument();
  });

  it('switches the signed-in screen to Spanish without a reload', async () => {
    supabase.auth.session = { user: { email: 'sergio@example.com' } };

    renderApp();

    expect(await screen.findByText('Hi, sergio@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Español' }));

    expect(await screen.findByText('Hola, sergio@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Todavía no estás en un hogar' })
    ).toBeInTheDocument();
  });
});
