import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import HouseholdPage from './HouseholdPage.jsx';
import { ActingMemberProvider, useActingMember } from '../lib/actingMember.jsx';
import {
  addDependent,
  createHousehold,
  loadHousehold,
  removeDependent,
  renameDependent,
} from '../lib/households.js';
import { createInvite } from '../lib/invites.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));
vi.mock('../lib/sharing.js', () => ({
  currentUserId: vi.fn(async () => null),
  loadHouseholdWeeks: vi.fn(async () => []),
  loadOwnSharing: vi.fn(async () => null),
  setShareEverything: vi.fn(),
}));
vi.mock('../lib/households.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadHousehold: vi.fn(),
  createHousehold: vi.fn(),
  addDependent: vi.fn(),
  renameDependent: vi.fn(),
  removeDependent: vi.fn(),
}));
vi.mock('../lib/invites.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createInvite: vi.fn(),
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

  it('tells the acting Member about a new Household without a reload', async () => {
    const created = {
      id: 9,
      name: 'Casa',
      myRole: 'owner',
      myMemberId: 5,
      members: [{ id: 5, display_name: 'Sergio', role: 'owner' }],
    };
    let exists = false;
    loadHousehold.mockImplementation(async () => (exists ? created : null));
    createHousehold.mockImplementation(async () => {
      exists = true;
      return 9;
    });

    // Stands in for Today, Week and Meal Times, which read the acting Member.
    function ActingProbe() {
      const { actingMemberId } = useActingMember();
      return <p data-testid="acting">{actingMemberId === null ? 'none' : actingMemberId}</p>;
    }

    render(
      <ActingMemberProvider>
        <ActingProbe />
        <HouseholdPage user={user} />
      </ActingMemberProvider>,
      { wrapper: I18nProvider }
    );

    await screen.findByRole('heading', { name: 'You are not in a Household yet' });
    expect(screen.getByTestId('acting')).toHaveTextContent('none');

    await userEvent.type(screen.getByLabelText('Household name'), 'Casa');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sergio');
    await userEvent.click(screen.getByRole('button', { name: 'Create Household' }));

    await waitFor(() => expect(screen.getByTestId('acting')).toHaveTextContent('5'));
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

describe('HouseholdPage invite link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('lets the Owner create an invite link and copies it', async () => {
    loadHousehold.mockResolvedValue({
      id: 7,
      name: 'Acuna home',
      myRole: 'owner',
      members: [{ id: 1, display_name: 'Sergio', role: 'owner' }],
    });
    createInvite.mockResolvedValue({ token: 'abc123', expires_at: '2026-10-24T00:00:00Z' });
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    await userEvent.click(await screen.findByRole('button', { name: 'Invite' }));

    expect(createInvite).toHaveBeenCalledWith(expect.anything(), 7);
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\?invite=abc123$/));
    expect(await screen.findByRole('status')).toHaveTextContent('Invite link copied.');
  });

  it('shows the link to copy by hand when copying fails', async () => {
    loadHousehold.mockResolvedValue({ id: 7, name: 'Acuna home', myRole: 'owner', members: [] });
    createInvite.mockResolvedValue({ token: 'abc123', expires_at: '2026-10-24T00:00:00Z' });
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    await userEvent.click(await screen.findByRole('button', { name: 'Invite' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Could not copy automatically.');
    expect(screen.getByRole('textbox', { name: 'Invite link' }).value).toMatch(/\?invite=abc123$/);
  });

  it('does not offer invites to a plain Member', async () => {
    loadHousehold.mockResolvedValue({
      id: 7,
      name: 'Acuna home',
      myRole: 'member',
      members: [{ id: 2, display_name: 'Ana', role: 'member' }],
    });

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    expect(await screen.findByRole('heading', { name: 'Acuna home' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
  });
});

describe('HouseholdPage Dependents', () => {
  const ownerHousehold = {
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

  beforeEach(() => {
    vi.clearAllMocks();
    loadHousehold.mockResolvedValue(ownerHousehold);
  });

  afterEach(() => {
    cleanup();
  });

  it('lists the Dependents with a name box for each, for the Owner', async () => {
    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    expect(await screen.findByLabelText('Name for Lucia')).toHaveValue('Lucia');
    expect(screen.queryByLabelText('Name for Ana')).not.toBeInTheDocument();
  });

  it('does not show the Dependents editor to a plain Member', async () => {
    loadHousehold.mockResolvedValue({ ...ownerHousehold, myRole: 'member' });

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    expect(await screen.findByRole('heading', { name: 'Acuna home' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dependents' })).not.toBeInTheDocument();
  });

  it('adds a Dependent, trimmed, then reloads the list', async () => {
    addDependent.mockResolvedValue(9);
    loadHousehold.mockResolvedValueOnce(ownerHousehold).mockResolvedValueOnce({
      ...ownerHousehold,
      members: [...ownerHousehold.members, { id: 9, display_name: 'Mateo', role: 'dependent' }],
    });

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    await userEvent.type(await screen.findByLabelText("Dependent's name"), '  Mateo  ');
    await userEvent.click(screen.getByRole('button', { name: 'Add Dependent' }));

    await waitFor(() => expect(screen.getByLabelText('Name for Mateo')).toBeInTheDocument());
    expect(addDependent).toHaveBeenCalledWith(expect.anything(), 'Mateo');
  });

  it('refuses a blank name without calling the database', async () => {
    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    await userEvent.type(await screen.findByLabelText("Dependent's name"), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Add Dependent' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a name.');
    expect(addDependent).not.toHaveBeenCalled();
  });

  it('shows an error when adding fails', async () => {
    addDependent.mockRejectedValue(new Error('boom'));

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    await userEvent.type(await screen.findByLabelText("Dependent's name"), 'Mateo');
    await userEvent.click(screen.getByRole('button', { name: 'Add Dependent' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add the Dependent.');
  });

  it('renames a Dependent', async () => {
    renameDependent.mockResolvedValue(undefined);

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    const box = await screen.findByLabelText('Name for Lucia');
    await userEvent.clear(box);
    await userEvent.type(box, 'Luci');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(renameDependent).toHaveBeenCalledWith(expect.anything(), 3, 'Luci'));
    expect(loadHousehold).toHaveBeenCalledTimes(2);
  });

  it('removes a Dependent only after confirmation', async () => {
    removeDependent.mockResolvedValue(undefined);
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    render(<HouseholdPage user={user} />, { wrapper: I18nProvider });

    await screen.findByLabelText('Name for Lucia');
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(removeDependent).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(removeDependent).toHaveBeenCalledWith(expect.anything(), 3));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Lucia'));
    confirm.mockRestore();
  });
});
