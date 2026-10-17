import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ActingMemberProvider,
  loggingForOptions,
  resolveActingId,
  useActingMember,
} from './actingMember.jsx';
import { loadHousehold } from './households.js';
import { supabase } from './supabase.js';

// The session is faked: one signed-in user, whose listener we can fire to sign in or out.
vi.mock('./supabase.js', () => {
  const listeners = [];
  const auth = {
    session: null,
    getSession: vi.fn(async () => ({ data: { session: auth.session } })),
    onAuthStateChange: vi.fn((callback) => {
      listeners.push(callback);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    emit(session) {
      auth.session = session;
      listeners.forEach((cb) => cb('SIGNED_IN', session));
    },
  };
  return { supabase: { auth } };
});
vi.mock('./households.js', () => ({ loadHousehold: vi.fn() }));

const household = {
  id: 7,
  name: 'Acuna home',
  myRole: 'owner',
  myMemberId: 1,
  members: [
    { id: 1, display_name: 'Sergio', role: 'owner' },
    { id: 2, display_name: 'Ana', role: 'member' },
    { id: 3, display_name: 'Lucia', role: 'dependent' },
    { id: 4, display_name: 'Mateo', role: 'dependent' },
  ],
};

describe('loggingForOptions', () => {
  it('lists yourself first, then each Dependent, and no other adults', () => {
    expect(loggingForOptions(household)).toEqual([
      { id: 1, name: 'Sergio', isSelf: true },
      { id: 3, name: 'Lucia', isSelf: false },
      { id: 4, name: 'Mateo', isSelf: false },
    ]);
  });

  it('is empty without a Household', () => {
    expect(loggingForOptions(null)).toEqual([]);
  });
});

describe('resolveActingId', () => {
  const options = loggingForOptions(household);

  it('keeps the chosen Member while they are an option', () => {
    expect(resolveActingId(options, 3)).toBe(3);
  });

  it('falls back to yourself when nothing is chosen or the choice is gone', () => {
    expect(resolveActingId(options, null)).toBe(1);
    expect(resolveActingId(options, 99)).toBe(1);
  });

  it('is null when there are no options', () => {
    expect(resolveActingId([], 3)).toBeNull();
  });
});

function Probe() {
  const { actingMemberId, actingName, actingIsDependent, setActingMemberId, refresh } =
    useActingMember();
  return (
    <div>
      <p data-testid="acting">{String(actingMemberId)}</p>
      <p data-testid="name">{actingName ?? ''}</p>
      <p data-testid="dependent">{String(actingIsDependent)}</p>
      <button type="button" onClick={() => setActingMemberId(3)}>
        pick Lucia
      </button>
      <button type="button" onClick={() => refresh()}>
        refresh
      </button>
    </div>
  );
}

describe('ActingMemberProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.session = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('acts as yourself by default, and as a Dependent once picked', async () => {
    supabase.auth.session = { user: { id: 'user-1' } };
    loadHousehold.mockResolvedValue(household);

    render(
      <ActingMemberProvider>
        <Probe />
      </ActingMemberProvider>
    );

    await waitFor(() => expect(screen.getByTestId('acting')).toHaveTextContent('1'));
    expect(screen.getByTestId('dependent')).toHaveTextContent('false');
    expect(loadHousehold).toHaveBeenCalledWith(supabase, 'user-1');

    await userEvent.click(screen.getByRole('button', { name: 'pick Lucia' }));

    expect(screen.getByTestId('acting')).toHaveTextContent('3');
    expect(screen.getByTestId('name')).toHaveTextContent('Lucia');
    expect(screen.getByTestId('dependent')).toHaveTextContent('true');
  });

  it('falls back to yourself when the picked Dependent is removed', async () => {
    supabase.auth.session = { user: { id: 'user-1' } };
    loadHousehold.mockResolvedValueOnce(household).mockResolvedValueOnce({
      ...household,
      members: household.members.filter((member) => member.id !== 3),
    });

    render(
      <ActingMemberProvider>
        <Probe />
      </ActingMemberProvider>
    );
    await waitFor(() => expect(screen.getByTestId('acting')).toHaveTextContent('1'));
    await userEvent.click(screen.getByRole('button', { name: 'pick Lucia' }));
    expect(screen.getByTestId('acting')).toHaveTextContent('3');

    await userEvent.click(screen.getByRole('button', { name: 'refresh' }));

    await waitFor(() => expect(screen.getByTestId('acting')).toHaveTextContent('1'));
    expect(screen.getByTestId('dependent')).toHaveTextContent('false');
  });

  it('acts as nobody while signed out, and forgets the choice on sign-out', async () => {
    render(
      <ActingMemberProvider>
        <Probe />
      </ActingMemberProvider>
    );

    await waitFor(() => expect(screen.getByTestId('acting')).toHaveTextContent('null'));
    expect(loadHousehold).not.toHaveBeenCalled();
  });

  it('shows no Dependent from the previous person after another person signs in', async () => {
    supabase.auth.session = { user: { id: 'user-1' } };
    loadHousehold.mockResolvedValueOnce(household).mockResolvedValueOnce(null);

    render(
      <ActingMemberProvider>
        <Probe />
      </ActingMemberProvider>
    );
    await waitFor(() => expect(screen.getByTestId('acting')).toHaveTextContent('1'));
    await userEvent.click(screen.getByRole('button', { name: 'pick Lucia' }));
    expect(screen.getByTestId('acting')).toHaveTextContent('3');

    act(() => supabase.auth.emit({ user: { id: 'user-2' } }));

    await waitFor(() => expect(screen.getByTestId('acting')).toHaveTextContent('null'));
    expect(screen.getByTestId('name')).toHaveTextContent('');
  });
});
