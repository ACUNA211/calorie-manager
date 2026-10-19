import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
// The Week screen has its own tests; here it is a stub that opens a day, to check the routing.
vi.mock('./components/WeekPage.jsx', () => ({
  default: ({ onOpenDay }) => (
    <button type="button" onClick={() => onOpenDay('2026-10-14')}>
      open day
    </button>
  ),
}));

// Today is stubbed too: it shows the day it was asked to open.
vi.mock('./components/TodayPage.jsx', () => ({
  default: ({ day }) => <p>today screen {day?.key ?? 'none'}</p>,
}));

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

// jsdom does not implement scrolling.
window.scrollTo = vi.fn();

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
    window.history.replaceState(null, '', '/');
  });

  it('shows the sign-in form when signed out, "Hi, <email>" when signed in, and returns to the form on sign-out', async () => {
    supabase.auth.session = { user: { email: 'sergio@example.com' } };

    renderApp();

    await userEvent.click(await screen.findByRole('link', { name: 'More' }));
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

    await userEvent.click(await screen.findByRole('link', { name: 'More' }));
    expect(await screen.findByText('Hi, sergio@example.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Español' }));

    expect(await screen.findByText('Hola, sergio@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Todavía no estás en un hogar' })
    ).toBeInTheDocument();
  });
});

describe('routes', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    supabase.auth.session = { user: { email: 'sergio@example.com' } };
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('lands on Today and marks its tab open', async () => {
    renderApp();

    expect(await screen.findByText('today screen none')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/today');
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Week' })).not.toHaveAttribute('aria-current');
  });

  it('has the six tabs, and the tab bar changes the screen and the URL', async () => {
    renderApp();
    await screen.findByText('today screen none');

    const names = within(screen.getByRole('navigation', { name: 'Main' }))
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(names).toEqual(['Today', 'Week', 'Foods', 'Pantry', 'Recipes', 'More']);

    await userEvent.click(screen.getByRole('link', { name: 'Week' }));
    expect(window.location.pathname).toBe('/week');
    expect(screen.getByRole('link', { name: 'Week' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('today screen none')).not.toBeInTheDocument();
  });

  it('opens on the path it was loaded at (reload keeps the screen)', async () => {
    window.history.replaceState(null, '', '/week');
    renderApp();

    expect(await screen.findByRole('button', { name: 'open day' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/week');
  });

  it('sends an unknown path to Today', async () => {
    window.history.replaceState(null, '', '/nowhere');
    renderApp();

    expect(await screen.findByText('today screen none')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/today');
  });

  it('goes back to the previous screen with the back button', async () => {
    renderApp();
    await screen.findByText('today screen none');
    await userEvent.click(screen.getByRole('link', { name: 'Week' }));

    window.history.back();

    expect(await screen.findByText('today screen none')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens Today on the day tapped in Week', async () => {
    window.history.replaceState(null, '', '/week');
    renderApp();

    await userEvent.click(await screen.findByRole('button', { name: 'open day' }));

    expect(await screen.findByText('today screen 2026-10-14')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/today');
    expect(window.location.search).toBe('?day=2026-10-14');
  });

  it('keeps the chosen day on reload', async () => {
    window.history.replaceState(null, '', '/today?day=2026-10-14');
    renderApp();

    expect(await screen.findByText('today screen 2026-10-14')).toBeInTheDocument();
  });

  it('shows no tab bar when signed out', async () => {
    supabase.auth.session = null;
    renderApp();

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});
