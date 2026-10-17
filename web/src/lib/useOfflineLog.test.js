import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineLog } from './useOfflineLog.js';
import { insertQueuedEntry } from './today.js';
import { FOOD_CACHE_KEY, QUEUE_KEY } from './offlineQueue.js';

vi.mock('./today.js', () => ({ insertQueuedEntry: vi.fn() }));

// A Map-backed localStorage stand-in, so each test starts with a clean store.
function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

function rowFor(clientId) {
  return {
    member_id: 4,
    log_date: '2026-10-17',
    meal_time_id: 1,
    log_time: null,
    food_id: 7,
    description: `Food ${clientId}`,
    servings: null,
    grams: 100,
    kcal: 52,
    protein_g: 0.3,
    carbs_g: 14,
    fat_g: 0.2,
    client_id: clientId,
  };
}

const APPLE = {
  key: 'library:7',
  source: 'library',
  id: 7,
  name: 'Apples, raw',
  nameEs: null,
  brand: null,
  kcalPer100g: 52,
  macros: { protein: 0.3, carbs: 14, fat: 0.2, fibre: null, sugars: null, sodium: null },
  servingGrams: null,
  servingLabel: null,
};

describe('useOfflineLog', () => {
  let storage;
  const client = { fake: true };

  beforeEach(() => {
    storage = fakeStorage();
    insertQueuedEntry.mockReset();
    insertQueuedEntry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Vitest runs without globals, so Testing Library does not unmount between tests.
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setOnline(value) {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
  }

  function renderLog(memberId = 4) {
    return renderHook(({ id }) => useOfflineLog({ client, memberId: id, storage }), {
      initialProps: { id: memberId },
    });
  }

  it('queues an entry on the phone and shows it for its day', () => {
    setOnline(false);
    const { result } = renderLog();

    act(() => {
      result.current.enqueue(rowFor('c-1'));
    });

    expect(result.current.entriesFor('2026-10-17')).toEqual([
      expect.objectContaining({ id: 'c-1', pending: 'queued', description: 'Food c-1' }),
    ]);
    expect(result.current.entriesFor('2026-10-18')).toEqual([]);
    expect(JSON.parse(storage.map.get(QUEUE_KEY))).toHaveLength(1);
  });

  it('keeps the queue for a Member, not for the one acting now', () => {
    setOnline(false);
    const { result, rerender } = renderLog(4);
    act(() => {
      result.current.enqueue(rowFor('c-1'));
    });
    rerender({ id: 9 });
    expect(result.current.entriesFor('2026-10-17')).toEqual([]);
  });

  it('does not send anything while offline', async () => {
    setOnline(false);
    const { result } = renderLog();
    act(() => {
      result.current.enqueue(rowFor('c-1'));
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(insertQueuedEntry).not.toHaveBeenCalled();
  });

  it('sends the queue in order when the phone comes online, then clears it and bumps version', async () => {
    setOnline(false);
    const { result } = renderLog();
    act(() => {
      result.current.enqueue(rowFor('c-1'));
      result.current.enqueue(rowFor('c-2'));
    });
    const before = result.current.version;

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.version).toBe(before + 1));
    expect(insertQueuedEntry.mock.calls.map(([, row]) => row.client_id)).toEqual(['c-1', 'c-2']);
    expect(result.current.entriesFor('2026-10-17')).toEqual([]);
    expect(JSON.parse(storage.map.get(QUEUE_KEY))).toEqual([]);
  });

  it('shows a refused entry as failed, stops the queue, and retries it on request', async () => {
    setOnline(true);
    const refusal = Object.assign(new Error('denied'), { code: '42501' });
    insertQueuedEntry.mockRejectedValueOnce(refusal);
    const { result } = renderLog();

    act(() => {
      result.current.enqueue(rowFor('c-1'));
      result.current.enqueue(rowFor('c-2'));
    });
    await waitFor(() =>
      expect(result.current.entriesFor('2026-10-17')[0]).toMatchObject({ pending: 'failed' })
    );
    expect(result.current.entriesFor('2026-10-17')[1]).toMatchObject({ pending: 'queued' });
    expect(insertQueuedEntry).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.retry('c-1');
    });
    expect(insertQueuedEntry.mock.calls.map(([, row]) => row.client_id)).toEqual([
      'c-1',
      'c-1',
      'c-2',
    ]);
    expect(result.current.entriesFor('2026-10-17')).toEqual([]);
  });

  it('discards a failed entry and sends what is behind it', async () => {
    setOnline(true);
    insertQueuedEntry.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: '42501' }));
    const { result } = renderLog();
    act(() => {
      result.current.enqueue(rowFor('c-1'));
      result.current.enqueue(rowFor('c-2'));
    });
    await waitFor(() =>
      expect(result.current.entriesFor('2026-10-17')[0]).toMatchObject({ pending: 'failed' })
    );

    await act(async () => {
      await result.current.discard('c-1');
    });

    expect(result.current.entriesFor('2026-10-17')).toEqual([]);
    expect(insertQueuedEntry.mock.calls.map(([, row]) => row.client_id)).toEqual(['c-1', 'c-2']);
  });

  it('removes a queued entry when it is discarded (the Undo of an offline log)', async () => {
    setOnline(false);
    const { result } = renderLog();
    act(() => {
      result.current.enqueue(rowFor('c-1'));
    });
    await act(async () => {
      await result.current.discard('c-1');
    });
    expect(result.current.entriesFor('2026-10-17')).toEqual([]);
  });

  it('keeps an entry on the phone when a network drop stops the send, and sends it on the next try', async () => {
    setOnline(true);
    insertQueuedEntry.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderLog();
    act(() => {
      result.current.enqueue(rowFor('c-1'));
    });
    await waitFor(() => expect(insertQueuedEntry).toHaveBeenCalledTimes(1));
    expect(result.current.entriesFor('2026-10-17')).toEqual([
      expect.objectContaining({ pending: 'queued' }),
    ]);
    // Still queued, not failed: a network drop is not a refusal, so nothing asks the Member.
    await act(async () => {
      await result.current.retry('c-1');
    });
    expect(insertQueuedEntry).toHaveBeenCalledTimes(2);
    expect(result.current.entriesFor('2026-10-17')).toEqual([]);
  });

  it('says the queue could not be kept when the phone refuses storage', () => {
    setOnline(false);
    const refusing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const { result } = renderHook(() => useOfflineLog({ client, memberId: 4, storage: refusing }));
    expect(() => result.current.enqueue(rowFor('c-1'))).toThrow('QuotaExceededError');
    expect(result.current.entriesFor('2026-10-17')).toEqual([]);
  });

  it('keeps Food Library results on the phone and searches them when offline', () => {
    setOnline(true);
    const { result } = renderLog();
    act(() => {
      result.current.rememberFoods([APPLE, { source: 'usda', fdcId: 5, name: 'Apple USDA' }]);
    });
    expect(JSON.parse(storage.map.get(FOOD_CACHE_KEY))).toEqual([APPLE]);
    expect(result.current.searchOffline('apple')).toEqual([APPLE]);
    expect(result.current.searchOffline('oats')).toEqual([]);
  });

  it('does not fail when the food cache cannot be written', () => {
    setOnline(true);
    const refusing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const { result } = renderHook(() => useOfflineLog({ client, memberId: 4, storage: refusing }));
    expect(() => result.current.rememberFoods([APPLE])).not.toThrow();
  });
});
