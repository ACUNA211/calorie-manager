import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MorePage from './MorePage.jsx';
import { ActingMemberContext } from '../../lib/actingMember.jsx';
import { I18nProvider } from '../../i18n/I18nProvider.jsx';
import { supabase } from '../../lib/supabase.js';

// The panels have their own tests; here each is a labelled stub.
vi.mock('../HouseholdPage.jsx', () => ({ default: () => <p>household panel</p> }));
vi.mock('../TargetsPage.jsx', () => ({ default: () => <p>targets panel</p> }));
vi.mock('../MealTimesPage.jsx', () => ({ default: () => <p>meal times panel</p> }));
vi.mock('../../lib/supabase.js', () => ({ supabase: { auth: { signOut: vi.fn() } } }));

const user = { id: 'u1', email: 'sergio@example.com' };

function renderMore({ householdState = 'ready', onNavigate = vi.fn() } = {}) {
  render(
    <ActingMemberContext.Provider value={{ householdState }}>
      <MorePage user={user} onNavigate={onNavigate} />
    </ActingMemberContext.Provider>,
    { wrapper: I18nProvider }
  );
  return onNavigate;
}

describe('MorePage (Settings)', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('lists the sections, the email, Language and Sign out', () => {
    renderMore();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    const list = within(screen.getByRole('navigation', { name: 'Settings sections' }));
    for (const name of [/^Household/, /^Calorie Targets and units/, /^Meal Times/]) {
      expect(list.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(list.getByRole('link', { name: /^Meal Plan/ })).toHaveAttribute('href', '/plan');
    expect(list.getByRole('link', { name: /^Preferences/ })).toHaveAttribute(
      'href',
      '/preferences'
    );
    expect(list.getByRole('link', { name: /^Intake form/ })).toHaveAttribute('href', '/intake');
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Signed in as sergio@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
  });

  it('opens a section as a sub-page and goes back', async () => {
    renderMore();

    await userEvent.click(screen.getByRole('button', { name: /^Household/ }));
    expect(screen.getByText('household panel')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Settings sections' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(screen.queryByText('household panel')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^Calorie Targets/ }));
    expect(screen.getByText('targets panel')).toBeInTheDocument();
  });

  it('opens other screens through onNavigate', async () => {
    const onNavigate = renderMore();

    await userEvent.click(screen.getByRole('link', { name: /^Intake form/ }));
    expect(onNavigate).toHaveBeenCalledWith('intake');
  });

  it('switches language and signs out', async () => {
    renderMore();

    await userEvent.click(screen.getByRole('button', { name: 'Español' }));
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('opens on Create a Household when there is no Household', () => {
    renderMore({ householdState: 'none' });

    expect(screen.getByRole('heading', { name: 'Create a Household' })).toBeInTheDocument();
    expect(screen.getByText('household panel')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Settings sections' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
