import { describe, expect, it, vi } from 'vitest';
import {
  currentUserId,
  loadHouseholdAdults,
  loadHouseholdWeeks,
  loadOwnSharing,
  setShareEverything,
} from './sharing.js';

// A small in-memory fake of the Supabase client: table rows with eq, neq, gte and lte filters,
// maybeSingle, and rpc calls answered by functions. Enough for the sharing reads and RPCs.
function fakeClient({ tables = {}, rpcs = {}, session = null }) {
  const rpc = vi.fn(async (name, args) => {
    try {
      return { data: rpcs[name] ? rpcs[name](args) : null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  });
  const from = vi.fn((table) => {
    const filters = [];
    const rows = () => (tables[table] || []).filter((row) => filters.every((keep) => keep(row)));
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (column, value) => {
        filters.push((row) => row[column] === value);
        return builder;
      },
      neq: (column, value) => {
        filters.push((row) => row[column] !== value);
        return builder;
      },
      gte: (column, value) => {
        filters.push((row) => row[column] >= value);
        return builder;
      },
      lte: (column, value) => {
        filters.push((row) => row[column] <= value);
        return builder;
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve, reject) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
    };
    return builder;
  });
  return {
    from,
    rpc,
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  };
}

const members = [
  {
    id: 1,
    household_id: 10,
    user_id: 'alice',
    role: 'owner',
    display_name: 'Alice',
    share_everything: false,
    created_at: '1',
  },
  {
    id: 2,
    household_id: 10,
    user_id: 'carl',
    role: 'member',
    display_name: 'Carl',
    share_everything: false,
    created_at: '2',
  },
  {
    id: 3,
    household_id: 10,
    user_id: 'dan',
    role: 'member',
    display_name: 'Dan',
    share_everything: true,
    created_at: '3',
  },
  {
    id: 4,
    household_id: 10,
    user_id: null,
    role: 'dependent',
    display_name: 'Kid',
    share_everything: false,
    created_at: '4',
  },
  {
    id: 5,
    household_id: 20,
    user_id: 'eve',
    role: 'owner',
    display_name: 'Eve',
    share_everything: false,
    created_at: '5',
  },
];

const tables = {
  members,
  member_settings: [{ member_id: 3, calorie_target: 2000, band_low_pct: 90, band_high_pct: 100 }],
  calorie_log: [
    { member_id: 3, log_date: '2026-10-11', kcal: 1800, protein_g: 130, carbs_g: 200, fat_g: 60 },
    { member_id: 3, log_date: '2026-10-14', kcal: 2100, protein_g: 100, carbs_g: 220, fat_g: 70 },
  ],
};

const rpcs = {
  member_day_flags: ({ p_member_id: memberId }) =>
    memberId === 2
      ? [
          { day_key: '2026-10-11', is_over: false },
          { day_key: '2026-10-14', is_over: true },
        ]
      : [],
  set_share_everything: () => null,
};

describe('sharing reads and the switch', () => {
  it("reads the signed-in adult's own switch, or null with no Member", async () => {
    const client = fakeClient({ tables });
    await expect(loadOwnSharing(client, 'alice')).resolves.toEqual({
      memberId: 1,
      shareEverything: false,
    });
    await expect(loadOwnSharing(client, 'nobody')).resolves.toBeNull();
    await expect(loadOwnSharing(fakeClient({ tables }), 'dan')).resolves.toEqual({
      memberId: 3,
      shareEverything: true,
    });
  });

  it('turns the switch on and off through the RPC', async () => {
    const client = fakeClient({ tables, rpcs });
    await setShareEverything(client, true);
    await setShareEverything(client, false);
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'set_share_everything', { p_share: true });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'set_share_everything', { p_share: false });
  });

  it('throws when the RPC refuses the change', async () => {
    const client = fakeClient({
      tables,
      rpcs: {
        set_share_everything: () => {
          throw new Error('denied');
        },
      },
    });
    await expect(setShareEverything(client, true)).rejects.toThrow('denied');
  });

  it('reads the signed-in user id from the session', async () => {
    await expect(currentUserId(fakeClient({ session: { user: { id: 'alice' } } }))).resolves.toBe(
      'alice'
    );
    await expect(currentUserId(fakeClient({ session: null }))).resolves.toBeNull();
  });
});

describe('loadHouseholdAdults', () => {
  it('lists the other adults of the Household, not the caller, not Dependents, not other Households', async () => {
    const result = await loadHouseholdAdults(fakeClient({ tables }), 'alice');
    expect(result).toEqual({
      myMemberId: 1,
      members: [
        { id: 2, name: 'Carl', shareEverything: false },
        { id: 3, name: 'Dan', shareEverything: true },
      ],
    });
  });

  it('returns null when the caller has no Member', async () => {
    await expect(loadHouseholdAdults(fakeClient({ tables }), 'nobody')).resolves.toBeNull();
  });
});

describe('loadHouseholdWeeks', () => {
  it('gives a Member who does not share only their day flags, never their Calorie Log', async () => {
    const client = fakeClient({ tables, rpcs });
    const weeks = await loadHouseholdWeeks(client, 'alice', '2026-10-11', '2026-10-17');
    const carl = weeks.find((adult) => adult.id === 2);

    expect(carl.shared).toBe(false);
    expect(carl.days.map((day) => day.status)).toEqual([
      'onTrack',
      'nothing',
      'nothing',
      'over',
      'nothing',
      'nothing',
      'nothing',
    ]);
    expect(carl.days.every((day) => day.kcal === null)).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('member_day_flags', {
      p_member_id: 2,
      p_start: '2026-10-11',
      p_end: '2026-10-17',
    });
  });

  it('gives a Member who shares everything their calories per day, from the full Week view', async () => {
    const client = fakeClient({ tables, rpcs });
    const weeks = await loadHouseholdWeeks(client, 'alice', '2026-10-11', '2026-10-17');
    const dan = weeks.find((adult) => adult.id === 3);

    expect(dan.shared).toBe(true);
    expect(dan.days[0]).toEqual({ key: '2026-10-11', status: 'onTrack', kcal: 1800 });
    expect(dan.days[3]).toEqual({ key: '2026-10-14', status: 'over', kcal: 2100 });
    expect(dan.days[1]).toEqual({ key: '2026-10-12', status: 'nothing', kcal: null });
    // Dan's flags are never asked for: his full week already came back.
    expect(client.rpc.mock.calls.map((call) => call[1].p_member_id)).toEqual([2]);
  });

  it('returns nobody when the caller has no Member', async () => {
    await expect(
      loadHouseholdWeeks(fakeClient({ tables }), 'nobody', '2026-10-11', '2026-10-17')
    ).resolves.toEqual([]);
  });
});
