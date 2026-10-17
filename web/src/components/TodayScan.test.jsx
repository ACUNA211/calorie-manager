import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TodayScan from './TodayScan.jsx';
import { supabase } from '../lib/supabase.js';
import { lookupGtin } from '../lib/foods.js';
import { MetricProvider } from '../test/metricUnits.jsx';

// Scan on Today (ticket #27). The camera is replaced by a button that reads a code, the lookup
// is mocked, and the database is a fake that records each call.

vi.mock('../lib/supabase.js', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../lib/foods.js', async (importOriginal) => ({
  ...(await importOriginal()),
  lookupGtin: vi.fn(),
}));
// The real camera scanner needs a phone camera; this stand-in reads one fixed code.
vi.mock('./ScanPanel.jsx', () => ({
  default: ({ onCode, onCancel }) => (
    <div>
      <button type="button" onClick={() => onCode('036000291452')}>
        fake read
      </button>
      <button type="button" onClick={onCancel}>
        fake cancel
      </button>
    </div>
  ),
}));

const MEALS = [
  { id: 12, name: 'Lunch', time_of_day: '12:30:00', weekdays: [1, 2, 3, 4, 5, 6, 0] },
  { id: 13, name: 'Dinner', time_of_day: '18:30:00', weekdays: [1, 2, 3, 4, 5, 6, 0] },
];

// A Food Library food, as lookupGtin returns it.
function libraryFood(overrides = {}) {
  return {
    status: 'found',
    source: 'library',
    result: {
      key: 'library:7',
      source: 'library',
      id: 7,
      name: 'Oat milk',
      brand: null,
      kcalPer100g: 50,
      macros: { protein: 1, carbs: 7, fat: 1.5 },
      servingGrams: 250,
      servingLabel: '1 cup',
      ...overrides,
    },
  };
}

// The database: calorie_log inserts and deletes, foods read, and the Pantry functions.
function fakeBackend({ packageGrams = null, takeResult = 40, takeError = null } = {}) {
  const state = { inserts: [], deletes: [], rpcs: [] };
  supabase.from.mockImplementation((table) => ({
    insert: (row) => ({
      select: () => ({
        single: async () => {
          state.inserts.push(row);
          return { data: { ...row, id: 501, created_at: '2026-10-17T12:00:00Z' }, error: null };
        },
      }),
    }),
    delete: () => ({
      eq: (column, value) => ({
        select: async () => {
          state.deletes.push([table, column, value]);
          return { data: [{ id: value }], error: null };
        },
      }),
    }),
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { id: 7, name: 'Oat milk', package_grams: packageGrams, servings: [] },
          error: null,
        }),
      }),
    }),
  }));
  supabase.rpc.mockImplementation(async (name, args) => {
    state.rpcs.push([name, args]);
    if (name === 'pantry_take') {
      if (takeError) return { data: null, error: takeError };
      return { data: takeResult, error: null };
    }
    return { data: args?.p_grams ?? 1, error: null };
  });
  return state;
}

function renderScan(props = {}) {
  const onEaten = vi.fn();
  render(
    <TodayScan
      memberId={4}
      logDate="2026-10-17"
      todayKey="2026-10-17"
      meals={MEALS}
      weekday={6}
      online
      onEaten={onEaten}
      {...props}
    />,
    { wrapper: MetricProvider }
  );
  return { onEaten };
}

// Opens the camera and reads the fixed code.
async function scanCode(user) {
  await user.click(screen.getByRole('button', { name: 'Scan' }));
  await user.click(screen.getByRole('button', { name: 'fake read' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('TodayScan', () => {
  it('shows Add to Pantry and Eaten after a scan of a known food', async () => {
    const user = userEvent.setup();
    fakeBackend();
    lookupGtin.mockResolvedValue(libraryFood());
    renderScan();
    await scanCode(user);
    expect(await screen.findByRole('button', { name: 'Add to Pantry' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Eaten' })).toBeEnabled();
    expect(screen.getByText('Food: Oat milk')).toBeInTheDocument();
  });

  it('Eaten logs one serving at the nearest Meal Time, takes it off the Pantry and reports it', async () => {
    const user = userEvent.setup();
    const state = fakeBackend({ takeResult: 40 });
    lookupGtin.mockResolvedValue(libraryFood());
    const { onEaten } = renderScan();
    await scanCode(user);
    await user.click(await screen.findByRole('button', { name: 'Eaten' }));

    await waitFor(() => expect(onEaten).toHaveBeenCalledTimes(1));
    expect(state.inserts[0]).toMatchObject({
      member_id: 4,
      log_date: '2026-10-17',
      grams: 250,
      servings: 1,
      kcal: 125,
      food_id: 7,
    });
    expect(state.rpcs).toContainEqual(['pantry_take', { p_food_id: 7, p_grams: 250 }]);
    const payload = onEaten.mock.calls[0][0];
    expect(payload.taken).toBe(40);
    expect(payload.pantryFailed).toBe(false);
    expect(payload.entry.id).toBe(501);
    expect(typeof payload.undo).toBe('function');
  });

  it('Eaten still logs when the food is not in the Pantry', async () => {
    const user = userEvent.setup();
    fakeBackend({ takeResult: 0 });
    lookupGtin.mockResolvedValue(libraryFood());
    const { onEaten } = renderScan();
    await scanCode(user);
    await user.click(await screen.findByRole('button', { name: 'Eaten' }));
    await waitFor(() => expect(onEaten).toHaveBeenCalledTimes(1));
    expect(onEaten.mock.calls[0][0]).toMatchObject({ taken: 0, pantryFailed: false });
  });

  it('Eaten keeps the log and flags the Pantry when its step fails', async () => {
    const user = userEvent.setup();
    fakeBackend({ takeError: { message: 'down' } });
    lookupGtin.mockResolvedValue(libraryFood());
    const { onEaten } = renderScan();
    await scanCode(user);
    await user.click(await screen.findByRole('button', { name: 'Eaten' }));
    await waitFor(() => expect(onEaten).toHaveBeenCalledTimes(1));
    expect(onEaten.mock.calls[0][0]).toMatchObject({ pantryFailed: true });
  });

  it('refuses an amount it cannot read and logs nothing', async () => {
    const user = userEvent.setup();
    const state = fakeBackend();
    lookupGtin.mockResolvedValue(libraryFood());
    const { onEaten } = renderScan();
    await scanCode(user);
    const amount = await screen.findByLabelText(/Amount/);
    await user.clear(amount);
    await user.type(amount, 'lots');
    await user.click(screen.getByRole('button', { name: 'Eaten' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter an amount above zero');
    expect(state.inserts).toHaveLength(0);
    expect(onEaten).not.toHaveBeenCalled();
  });

  it('Add to Pantry adds one package at its label weight', async () => {
    const user = userEvent.setup();
    const state = fakeBackend({ packageGrams: 425 });
    lookupGtin.mockResolvedValue(libraryFood());
    renderScan();
    await scanCode(user);
    await user.click(await screen.findByRole('button', { name: 'Add to Pantry' }));
    expect(await screen.findByText(/Added one package of Oat milk \(425 g\)/)).toBeInTheDocument();
    expect(state.rpcs).toContainEqual(['pantry_add', { p_food_id: 7, p_grams: 425 }]);
    expect(state.inserts).toHaveLength(0);
  });

  it('Add to Pantry asks once for the package weight when it is unknown, then saves it', async () => {
    const user = userEvent.setup();
    const state = fakeBackend({ packageGrams: null });
    lookupGtin.mockResolvedValue(libraryFood());
    renderScan();
    await scanCode(user);
    await user.click(await screen.findByRole('button', { name: 'Add to Pantry' }));
    await user.type(await screen.findByLabelText(/Package weight/), '330');
    await user.click(screen.getByRole('button', { name: 'Save weight and add' }));
    expect(await screen.findByText(/Added one package of Oat milk \(330 g\)/)).toBeInTheDocument();
    expect(state.rpcs).toContainEqual(['set_package_grams', { p_food_id: 7, p_grams: 330 }]);
    expect(state.rpcs).toContainEqual(['pantry_add', { p_food_id: 7, p_grams: 330 }]);
  });

  it('an Open Food Facts result shows both buttons disabled and a note', async () => {
    const user = userEvent.setup();
    fakeBackend();
    lookupGtin.mockResolvedValue({
      status: 'found',
      source: 'off',
      result: { source: 'off', name: 'Cereal Bar', id: null },
    });
    renderScan();
    await scanCode(user);
    expect(await screen.findByText(/Cereal Bar is from Open Food Facts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to Pantry' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eaten' })).toBeDisabled();
  });

  it('a code not found says so and offers to scan again', async () => {
    const user = userEvent.setup();
    fakeBackend();
    lookupGtin.mockResolvedValue({ status: 'notFound' });
    renderScan();
    await scanCode(user);
    expect(await screen.findByText(/No food found for 036000291452/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan again' })).toBeInTheDocument();
  });

  it('offline: the scan and both buttons are off, and it says why', () => {
    fakeBackend();
    renderScan({ online: false });
    expect(screen.getByText('Scanning needs a connection.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan' })).toBeDisabled();
  });
});
