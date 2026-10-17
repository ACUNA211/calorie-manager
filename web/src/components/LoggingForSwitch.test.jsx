import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoggingForSwitch from './LoggingForSwitch.jsx';
import { ActingMemberProvider } from '../lib/actingMember.jsx';
import { loadHousehold } from '../lib/households.js';
import { supabase } from '../lib/supabase.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));
vi.mock('../lib/households.js', () => ({ loadHousehold: vi.fn() }));

const household = {
  id: 7,
  name: 'Acuna home',
  myRole: 'owner',
  myMemberId: 1,
  members: [
    { id: 1, display_name: 'Sergio', role: 'owner' },
    { id: 2, display_name: 'Ana', role: 'member' },
    { id: 3, display_name: 'Lucia', role: 'dependent' },
  ],
};

function renderSwitch() {
  return render(
    <I18nProvider>
      <ActingMemberProvider>
        <LoggingForSwitch />
      </ActingMemberProvider>
    </I18nProvider>
  );
}

describe('LoggingForSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  it('offers yourself and each Dependent, but not the other adults', async () => {
    loadHousehold.mockResolvedValue(household);

    renderSwitch();

    const picker = await screen.findByLabelText('Logging for');
    expect(picker).toHaveValue('1');
    const options = [...picker.querySelectorAll('option')].map((option) => option.textContent);
    expect(options).toEqual(['Sergio (you)', 'Lucia']);
    expect(supabase.auth.getSession).toHaveBeenCalled();
  });

  it('switches to a Dependent when picked', async () => {
    loadHousehold.mockResolvedValue(household);

    renderSwitch();

    const picker = await screen.findByLabelText('Logging for');
    await userEvent.selectOptions(picker, '3');

    expect(picker).toHaveValue('3');
  });

  it('shows nothing when the person has no Household', async () => {
    loadHousehold.mockResolvedValue(null);

    const { container } = renderSwitch();

    await waitFor(() => expect(loadHousehold).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('labels the picker in Spanish', async () => {
    window.localStorage.setItem('calorieManager.locale', 'es');
    loadHousehold.mockResolvedValue(household);

    renderSwitch();

    expect(await screen.findByLabelText('Registrando para')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sergio (tú)' })).toBeInTheDocument();
  });
});
