import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import HouseholdPage from './HouseholdPage.jsx';
import { createHousehold, loadHousehold } from '../lib/households.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../lib/households.js', () => ({
  loadHousehold: vi.fn(),
  createHousehold: vi.fn(),
}));

const user = { id: 'user-1', email: 'sergio@example.com' };

describe('HouseholdPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  it('lists the Members with their roles', async () => {
    loadHousehold.mockResolvedValue({
      id: 7,
      name: 'Acuna home',
      members: [
        { id: 1, display_name: 'Sergio', role: 'owner' },
        { id: 2, display_name: 'Ana', role: 'member' },
        { id: 3, display_name: 'Lucia', role: 'dependent' },
      ],
    });

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    expect(await screen.findByRole('heading', { name: 'Acuna home' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Sergio (Owner)',
      'Ana (Member)',
      'Lucia (Dependent)',
    ]);
    expect(loadHousehold).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  it('offers Create Household to a person with no Household, then shows the new one', async () => {
    loadHousehold.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 9,
      name: 'Casa',
      members: [{ id: 5, display_name: 'Sergio', role: 'owner' }],
    });
    createHousehold.mockResolvedValue(9);

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    expect(
      await screen.findByRole('heading', { name: 'You are not in a Household yet' })
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Household name'), 'Casa');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sergio');
    await userEvent.click(screen.getByRole('button', { name: 'Create Household' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Casa' })).toBeInTheDocument());
    expect(createHousehold).toHaveBeenCalledWith(expect.anything(), {
      name: 'Casa',
      ownerName: 'Sergio',
    });
    expect(screen.getByRole('listitem')).toHaveTextContent('Sergio (Owner)');
  });

  it('shows an error and keeps the form when creating fails', async () => {
    loadHousehold.mockResolvedValue(null);
    createHousehold.mockRejectedValue(new Error('boom'));

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    await userEvent.type(await screen.findByLabelText('Household name'), 'Casa');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sergio');
    await userEvent.click(screen.getByRole('button', { name: 'Create Household' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the Household.');
    expect(screen.getByRole('button', { name: 'Create Household' })).toBeInTheDocument();
  });

  it('shows a load error when the Household cannot be read', async () => {
    loadHousehold.mockRejectedValue(new Error('network'));

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your Household.');
  });
});
