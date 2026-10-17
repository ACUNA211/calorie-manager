import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import TargetsPage from './TargetsPage.jsx';
import { supabase } from '../lib/supabase.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn() } }));

const user = { id: 'user-1' };

// A fake client: members returns memberRow; member_settings returns settingsRow on load
// and records upserts.
function fakeClient({
  settingsRow = null,
  memberRow = { id: 5 },
  loadError = null,
  upsertError = null,
} = {}) {
  const upsert = vi.fn(async () => ({ error: upsertError }));
  supabase.from.mockImplementation((table) => {
    if (table === 'members') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: memberRow, error: null }) }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            loadError ? { data: null, error: loadError } : { data: settingsRow, error: null },
        }),
      }),
      upsert,
    };
  });
  return { upsert };
}

const storedRow = {
  calorie_target: 2000,
  protein_floor_g: 120,
  carb_low_g: 150,
  carb_high_g: 220,
  fat_low_g: null,
  fat_high_g: null,
  band_low_pct: 90,
  band_high_pct: 100,
};

function renderScreen(props = {}) {
  return render(<TargetsPage user={user} {...props} />, { wrapper: I18nProvider });
}

describe('TargetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  it('shows the stored Targets and the Planning band in calories', async () => {
    fakeClient({ settingsRow: storedRow });

    renderScreen({ memberId: 5 });

    expect(await screen.findByLabelText(/Calorie Target/)).toHaveValue('2000');
    expect(screen.getByLabelText(/Protein floor/)).toHaveValue('120');
    expect(screen.getByLabelText('Carbs low')).toHaveValue('150');
    expect(screen.getByLabelText('Fat low')).toHaveValue('');
    expect(screen.getByText('Aim: 1,800–2,000')).toBeInTheDocument();
  });

  it('shows the band in Spanish with the Spanish number format', async () => {
    window.localStorage.setItem('calorieManager.locale', 'es');
    fakeClient({ settingsRow: storedRow });

    renderScreen({ memberId: 5 });

    expect(await screen.findByText('Meta: 1800–2000')).toBeInTheDocument();
  });

  it('saves edited Targets, leaving empty carbs and fat as null', async () => {
    const { upsert } = fakeClient({ settingsRow: storedRow });

    renderScreen({ memberId: 5 });

    const calorie = await screen.findByLabelText(/Calorie Target/);
    await userEvent.clear(calorie);
    await userEvent.type(calorie, '1900');
    await userEvent.click(screen.getByRole('button', { name: 'Save Targets' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Targets saved.');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: 5,
        calorie_target: 1900,
        protein_floor_g: 120,
        carb_low_g: 150,
        carb_high_g: 220,
        fat_low_g: null,
        fat_high_g: null,
        band_low_pct: 90,
        band_high_pct: 100,
      }),
      { onConflict: 'member_id' }
    );
    expect(screen.getByText('Aim: 1,710–1,900')).toBeInTheDocument();
  });

  it('clears a Target when its field is emptied and saved', async () => {
    const { upsert } = fakeClient({ settingsRow: storedRow });

    renderScreen({ memberId: 5 });

    const protein = await screen.findByLabelText(/Protein floor/);
    await userEvent.clear(protein);
    await userEvent.click(screen.getByRole('button', { name: 'Save Targets' }));

    await waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(upsert.mock.calls[0][0].protein_floor_g).toBeNull();
  });

  it('refuses a band whose low end is above the high end, and does not save', async () => {
    const { upsert } = fakeClient({ settingsRow: storedRow });

    renderScreen({ memberId: 5 });

    const bandLow = await screen.findByLabelText('Band low (%)');
    await userEvent.clear(bandLow);
    await userEvent.type(bandLow, '100');
    const bandHigh = screen.getByLabelText('Band high (%)');
    await userEvent.clear(bandHigh);
    await userEvent.type(bandHigh, '90');
    await userEvent.click(screen.getByRole('button', { name: 'Save Targets' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The band's low end cannot be above its high end."
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('refuses negative grams with a message next to the field', async () => {
    const { upsert } = fakeClient({ settingsRow: storedRow });

    renderScreen({ memberId: 5 });

    const fatLow = await screen.findByLabelText('Fat low');
    await userEvent.type(fatLow, '-4');
    await userEvent.click(screen.getByRole('button', { name: 'Save Targets' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Grams cannot be negative.');
    expect(fatLow).toHaveAttribute('aria-invalid', 'true');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('shows an error when saving fails', async () => {
    fakeClient({ settingsRow: storedRow, upsertError: new Error('down') });

    renderScreen({ memberId: 5 });

    await userEvent.click(await screen.findByRole('button', { name: 'Save Targets' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your Targets.');
  });

  it("finds the signed-in person's own Member when no memberId is given", async () => {
    fakeClient({ settingsRow: null, memberRow: { id: 9 } });

    renderScreen();

    await screen.findByLabelText(/Calorie Target/);
    expect(supabase.from).toHaveBeenCalledWith('members');
    expect(supabase.from).toHaveBeenCalledWith('member_settings');
  });

  it('shows a load error when the Targets cannot be read', async () => {
    fakeClient({ loadError: new Error('network') });

    renderScreen({ memberId: 5 });

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your Targets.');
  });
});
