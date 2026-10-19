import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InviteLanding from './InviteLanding.jsx';
import { supabase } from '../lib/supabase.js';
import { ActingMemberContext } from '../lib/actingMember.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: { signUp: vi.fn(), signInWithPassword: vi.fn() },
  },
}));

// Answers the peek and accept calls with the given results.
function mockRpc({ peek, accept }) {
  supabase.rpc.mockImplementation(async (name) => {
    if (name === 'peek_invite') return { data: peek, error: null };
    return accept;
  });
}

const validPeek = [{ household_name: 'Acuna home', status: 'valid' }];
const signedIn = { id: 'user-1', email: 'ana@example.com' };

function renderLanding(props) {
  return render(<InviteLanding token="tok" user={null} onJoined={vi.fn()} {...props} />, {
    wrapper: I18nProvider,
  });
}

describe('InviteLanding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  // Vitest runs without globals here, so Testing Library does not clean up on its own.
  afterEach(() => {
    cleanup();
  });

  it.each([
    ['revoked', 'This invite link was revoked. Ask the Owner for a new one.'],
    ['expired', 'This invite link has expired. Ask the Owner for a new one.'],
    ['used', 'This invite link has already been used. Ask the Owner for a new one.'],
  ])('shows a clear message for a %s link and offers no form', async (status, message) => {
    mockRpc({ peek: [{ household_name: 'Acuna home', status }] });

    renderLanding({ user: null });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the not-found message for an unknown link', async () => {
    mockRpc({ peek: [] });

    renderLanding({ user: null });

    expect(await screen.findByRole('alert')).toHaveTextContent('does not exist');
  });

  it('shows the Household name and a sign-up form to someone signed out', async () => {
    mockRpc({ peek: validPeek });

    renderLanding({ user: null });

    expect(
      await screen.findByRole('heading', {
        name: 'You are invited to join Acuna home as a Member.',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('asks to check email when sign-up needs confirmation', async () => {
    mockRpc({ peek: validPeek });
    supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });

    renderLanding({ user: null });

    await userEvent.type(await screen.findByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'secret-pass',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Check your email');
  });

  it('switches to sign-in for someone who already has an account', async () => {
    mockRpc({ peek: validPeek });
    supabase.auth.signInWithPassword.mockResolvedValue({ error: null });

    renderLanding({ user: null });

    await userEvent.click(await screen.findByRole('button', { name: 'I already have an account' }));
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'secret-pass',
    });
  });

  it('joins a signed-in person with the typed name, then reports it', async () => {
    mockRpc({ peek: validPeek, accept: { data: 7, error: null } });
    const onJoined = vi.fn();

    renderLanding({ user: signedIn, onJoined });

    await userEvent.type(await screen.findByLabelText('Your name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Join Household' }));

    await waitFor(() => expect(onJoined).toHaveBeenCalledTimes(1));
    expect(supabase.rpc).toHaveBeenCalledWith('accept_invite', {
      p_token: 'tok',
      p_display_name: 'Ana',
    });
  });

  it('refreshes the acting Member after joining, before reporting it', async () => {
    mockRpc({ peek: validPeek, accept: { data: 7, error: null } });
    const order = [];
    const refresh = vi.fn(async () => order.push('refresh'));
    const onJoined = vi.fn(() => order.push('joined'));

    render(
      <ActingMemberContext.Provider value={{ refresh }}>
        <InviteLanding token="tok" user={signedIn} onJoined={onJoined} />
      </ActingMemberContext.Provider>,
      { wrapper: I18nProvider }
    );

    await userEvent.type(await screen.findByLabelText('Your name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Join Household' }));

    await waitFor(() => expect(onJoined).toHaveBeenCalledTimes(1));
    expect(order).toEqual(['refresh', 'joined']);
  });

  it('shows the matching message and does not join when the join is refused', async () => {
    mockRpc({
      peek: validPeek,
      accept: { data: null, error: { message: 'already_in_household' } },
    });
    const onJoined = vi.fn();

    renderLanding({ user: signedIn, onJoined });

    await userEvent.type(await screen.findByLabelText('Your name'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Join Household' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already belong to a Household');
    expect(onJoined).not.toHaveBeenCalled();
  });
});
