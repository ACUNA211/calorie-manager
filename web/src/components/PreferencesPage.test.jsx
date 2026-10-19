import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import PreferencesPage from './PreferencesPage.jsx';
import { supabase } from '../lib/supabase.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

const user = { id: 'user-1' };

// A fake client. members answers both lookups (own Member by user, Household by Member id).
function fakeClient({
  householdRow = null,
  memberRow = null,
  loadError = null,
  upsertError = null,
} = {}) {
  const upserts = { household_preferences: vi.fn(), member_preferences: vi.fn() };
  supabase.from.mockImplementation((table) => {
    if (table === 'members') {
      return {
        select: (columns) => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: columns === 'id' ? { id: 5 } : { household_id: 9 },
              error: null,
            }),
          }),
        }),
      };
    }
    const row = table === 'household_preferences' ? householdRow : memberRow;
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            loadError ? { data: null, error: loadError } : { data: row, error: null },
        }),
      }),
      upsert: async (payload) => {
        upserts[table](payload);
        return { error: upsertError };
      },
    };
  });
  return upserts;
}

const householdRow = {
  household_id: 9,
  cuisines: ['italian', 'thai'],
  weeknight_minutes: 30,
  weekend_minutes: null,
  equipment: ['oven'],
  repeat_frequency: 'sometimes',
  leftovers_tolerance: 'plenty',
  budget_feel: 'tight',
};
const memberRow = {
  member_id: 5,
  favourites: ['tacos'],
  dislikes: ['olives'],
  hard_foods: ['cilantro'],
  hard_food_groups: ['shellfish'],
  hard_diets: ['halal'],
};

const renderPage = () => render(<PreferencesPage user={user} />, { wrapper: I18nProvider });

describe('PreferencesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it('shows the stored Household and Member Preferences', async () => {
    fakeClient({ householdRow, memberRow });
    renderPage();

    expect(await screen.findByLabelText('Cuisines you like')).toHaveValue('italian, thai');
    expect(screen.getByLabelText(/Cooking time on weeknights/)).toHaveValue('30');
    expect(screen.getByLabelText('Oven')).toBeChecked();
    expect(screen.getByLabelText('Stovetop')).not.toBeChecked();
    expect(screen.getByLabelText('How many leftovers are fine')).toHaveValue('plenty');
    expect(screen.getByLabelText('Favourite foods')).toHaveValue('tacos');
    expect(screen.getByLabelText('Foods to never serve')).toHaveValue('cilantro');
    expect(screen.getByLabelText('Shellfish')).toBeChecked();
    expect(screen.getByLabelText('Halal')).toBeChecked();
    expect(screen.getByLabelText('Vegan')).not.toBeChecked();
  });

  it('saves Household Preferences', async () => {
    const upserts = fakeClient({ householdRow });
    renderPage();

    const cuisines = await screen.findByLabelText('Cuisines you like');
    await userEvent.clear(cuisines);
    await userEvent.type(cuisines, 'greek, thai');
    await userEvent.click(screen.getByLabelText('Air fryer'));
    await userEvent.selectOptions(screen.getByLabelText('Budget feel'), 'relaxed');
    await userEvent.click(screen.getByRole('button', { name: 'Save Household Preferences' }));

    expect(await screen.findByText('Household Preferences saved.')).toBeInTheDocument();
    expect(upserts.household_preferences).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 9,
        cuisines: ['greek', 'thai'],
        weeknight_minutes: 30,
        equipment: ['oven', 'air_fryer'],
        budget_feel: 'relaxed',
      })
    );
    expect(upserts.member_preferences).not.toHaveBeenCalled();
  });

  it('saves Member Preferences with Hard rules from the fixed lists', async () => {
    const upserts = fakeClient({ memberRow });
    renderPage();

    await screen.findByLabelText('Favourite foods');
    await userEvent.click(screen.getByLabelText('Peanuts'));
    await userEvent.click(screen.getByLabelText('Vegetarian'));
    await userEvent.click(screen.getByLabelText('Halal'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Member Preferences' }));

    expect(await screen.findByText('Member Preferences saved.')).toBeInTheDocument();
    expect(upserts.member_preferences).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: 5,
        hard_foods: ['cilantro'],
        hard_food_groups: ['shellfish', 'peanuts'],
        hard_diets: ['vegetarian'],
      })
    );
  });

  it('shows a problem and saves nothing when a cooking time is not a number', async () => {
    const upserts = fakeClient();
    renderPage();

    const weeknight = await screen.findByLabelText(/Cooking time on weeknights/);
    await userEvent.type(weeknight, 'soon');
    await userEvent.click(screen.getByRole('button', { name: 'Save Household Preferences' }));

    expect(await screen.findByText('Enter a whole number of minutes.')).toBeInTheDocument();
    expect(upserts.household_preferences).not.toHaveBeenCalled();
  });

  it('says so when saving fails', async () => {
    fakeClient({ upsertError: new Error('nope') });
    renderPage();

    await screen.findByLabelText('Favourite foods');
    await userEvent.click(screen.getByRole('button', { name: 'Save Member Preferences' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Try again.')
    );
  });

  it('says so when Preferences cannot be loaded', async () => {
    fakeClient({ loadError: new Error('down') });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load Preferences.');
  });

  it('shows the page in Spanish', async () => {
    window.localStorage.setItem('calorieManager.locale', 'es');
    fakeClient({ householdRow, memberRow });
    renderPage();

    expect(await screen.findByText('Reglas firmes')).toBeInTheDocument();
    expect(screen.getByLabelText('Mariscos')).toBeChecked();
  });
});
