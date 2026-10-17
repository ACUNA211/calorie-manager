import { describe, expect, it, vi } from 'vitest';
import {
  FOOD_CACHE_LIMIT,
  addFoodsToCache,
  addItem,
  isNetworkError,
  itemsFor,
  jsonStore,
  makeClientId,
  queuedItem,
  queuedView,
  removeItem,
  searchCachedFoods,
  syncQueue,
  updateItem,
} from './offlineQueue.js';

// A Map-backed stand-in for localStorage. `failWrites` makes setItem throw, as a full or
// refused store does.
function fakeStorage({ failWrites = false } = {}) {
  const map = new Map();
  return {
    map,
    getItem: vi.fn((key) => (map.has(key) ? map.get(key) : null)),
    setItem: vi.fn((key, value) => {
      if (failWrites) throw new Error('QuotaExceededError');
      map.set(key, String(value));
    }),
  };
}

// A fake network. `script` lists one outcome per call: 'ok' (stored), 'network' (no answer),
// or 'refused' (the server answered with a database error code). Calls past the script succeed.
function fakeNetwork(script = []) {
  const stored = [];
  const calls = [];
  const send = vi.fn(async (row) => {
    calls.push(row);
    const outcome = script.length > 0 ? script.shift() : 'ok';
    if (outcome === 'network') throw new TypeError('Failed to fetch');
    if (outcome === 'refused') {
      throw Object.assign(new Error('new row violates row-level security policy'), {
        code: '42501',
      });
    }
    stored.push(row);
  });
  return { send, stored, calls };
}

function rowFor(clientId, extra = {}) {
  return {
    member_id: 4,
    log_date: '2026-10-17',
    meal_time_id: 1,
    log_time: null,
    food_id: 7,
    description: `Food ${clientId}`,
    servings: null,
    grams: 100,
    kcal: 100,
    protein_g: 5,
    carbs_g: 20,
    fat_g: 2,
    client_id: clientId,
    ...extra,
  };
}

function itemFor(clientId, extra = {}) {
  return queuedItem({
    memberId: 4,
    row: rowFor(clientId, extra),
    queuedAt: '2026-10-17T08:00:00.000Z',
  });
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('makeClientId', () => {
  it('uses crypto.randomUUID when the browser has it', () => {
    const cryptoApi = { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    expect(makeClientId(cryptoApi)).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('builds a version 4 uuid from random bytes when randomUUID is missing', () => {
    const cryptoApi = {
      getRandomValues: (bytes) => {
        bytes.fill(0xff);
        return bytes;
      },
    };
    const id = makeClientId(cryptoApi);
    expect(id).toMatch(UUID_V4);
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('still makes a uuid with no crypto at all', () => {
    expect(makeClientId(undefined)).toMatch(UUID_V4);
  });

  it('gives a different id each time', () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeClientId()));
    expect(ids.size).toBe(50);
  });
});

describe('jsonStore', () => {
  it('reads an empty array when nothing is stored', () => {
    expect(jsonStore(fakeStorage(), 'k', 'array').load()).toEqual([]);
  });

  it('round-trips an array', () => {
    const storage = fakeStorage();
    const store = jsonStore(storage, 'k', 'array');
    store.save([{ a: 1 }]);
    expect(storage.map.get('k')).toBe('[{"a":1}]');
    expect(store.load()).toEqual([{ a: 1 }]);
  });

  it('round-trips a plain object for the object shape', () => {
    const store = jsonStore(fakeStorage(), 'k', 'object');
    store.save({ x: 2 });
    expect(store.load()).toEqual({ x: 2 });
    expect(jsonStore(fakeStorage(), 'k', 'object').load()).toEqual({});
  });

  it('reads as empty when the stored text is not valid JSON', () => {
    const storage = fakeStorage();
    storage.map.set('k', '{not json');
    expect(jsonStore(storage, 'k', 'array').load()).toEqual([]);
  });

  it('reads as empty when the stored value has the wrong shape', () => {
    const storage = fakeStorage();
    storage.map.set('k', '{"a":1}');
    expect(jsonStore(storage, 'k', 'array').load()).toEqual([]);
    storage.map.set('k', '[1,2]');
    expect(jsonStore(storage, 'k', 'object').load()).toEqual({});
    storage.map.set('k', 'null');
    expect(jsonStore(storage, 'k', 'object').load()).toEqual({});
  });

  it('reads as empty when the storage itself throws on read', () => {
    const storage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };
    expect(jsonStore(storage, 'k', 'array').load()).toEqual([]);
  });

  it('lets a failed write throw, so a refused save is never silent', () => {
    const store = jsonStore(fakeStorage({ failWrites: true }), 'k', 'array');
    expect(() => store.save([1])).toThrow('QuotaExceededError');
  });
});

describe('queuedItem and the list helpers', () => {
  it('builds a queued item keyed by the row client_id', () => {
    expect(itemFor('c-1')).toEqual({
      clientId: 'c-1',
      memberId: 4,
      logDate: '2026-10-17',
      queuedAt: '2026-10-17T08:00:00.000Z',
      row: rowFor('c-1'),
      status: 'queued',
      error: null,
    });
  });

  it('adds an item once: a second add with the same client id is ignored', () => {
    const first = [itemFor('c-1')];
    expect(addItem(first, itemFor('c-1', { kcal: 999 }))).toBe(first);
    expect(addItem([], itemFor('c-2'))).toHaveLength(1);
  });

  it('adds without changing the old list', () => {
    const before = [itemFor('c-1')];
    const after = addItem(before, itemFor('c-2'));
    expect(before).toHaveLength(1);
    expect(after.map((item) => item.clientId)).toEqual(['c-1', 'c-2']);
  });

  it('updates one item and leaves the others', () => {
    const items = [itemFor('c-1'), itemFor('c-2')];
    const next = updateItem(items, 'c-2', { status: 'failed', error: 'boom' });
    expect(next[0]).toBe(items[0]);
    expect(next[1]).toMatchObject({ clientId: 'c-2', status: 'failed', error: 'boom' });
    expect(items[1].status).toBe('queued');
  });

  it('removes one item by client id', () => {
    const items = [itemFor('c-1'), itemFor('c-2')];
    expect(removeItem(items, 'c-1').map((item) => item.clientId)).toEqual(['c-2']);
    expect(removeItem(items, 'missing')).toHaveLength(2);
  });

  it('picks out one Member and day, keeping the order logged', () => {
    const items = [
      itemFor('c-1'),
      queuedItem({ memberId: 9, row: rowFor('c-2'), queuedAt: 'x' }),
      itemFor('c-3', { log_date: '2026-10-18' }),
      itemFor('c-4'),
    ];
    expect(itemsFor(items, 4, '2026-10-17').map((item) => item.clientId)).toEqual(['c-1', 'c-4']);
    expect(itemsFor(items, 9, '2026-10-17')).toHaveLength(1);
    expect(itemsFor(items, 4, '2026-10-19')).toEqual([]);
  });
});

describe('queuedView', () => {
  it('shows a queued entry like a saved one, marked with its status', () => {
    expect(queuedView(itemFor('c-1'))).toMatchObject({
      id: 'c-1',
      client_id: 'c-1',
      member_id: 4,
      log_date: '2026-10-17',
      meal_time_id: 1,
      description: 'Food c-1',
      kcal: 100,
      created_at: '2026-10-17T08:00:00.000Z',
      pending: 'queued',
      error: null,
    });
  });

  it('carries the failed status through', () => {
    const failed = updateItem([itemFor('c-1')], 'c-1', { status: 'failed', error: 'x' });
    expect(queuedView(failed[0])).toMatchObject({ pending: 'failed', error: 'x' });
  });
});

describe('isNetworkError', () => {
  it('treats a request with no answer as a network error', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true);
    expect(isNetworkError({ message: 'no code at all' })).toBe(true);
    expect(isNetworkError(undefined)).toBe(true);
  });

  it('treats an error with a database code as a refusal', () => {
    expect(isNetworkError({ message: 'denied', code: '42501' })).toBe(false);
    expect(isNetworkError({ message: 'duplicate', code: '23505' })).toBe(false);
  });
});

describe('syncQueue', () => {
  it('sends every queued entry in order and empties the queue', async () => {
    const store = jsonStore(fakeStorage(), 'q', 'array');
    store.save([itemFor('c-1'), itemFor('c-2'), itemFor('c-3')]);
    const network = fakeNetwork();

    const result = await syncQueue({ store, send: network.send });

    expect(result).toEqual({ sent: 3, stopped: null });
    expect(network.calls.map((row) => row.client_id)).toEqual(['c-1', 'c-2', 'c-3']);
    expect(store.load()).toEqual([]);
  });

  it('sends nothing when the queue is empty', async () => {
    const store = jsonStore(fakeStorage(), 'q', 'array');
    const network = fakeNetwork();
    expect(await syncQueue({ store, send: network.send })).toEqual({ sent: 0, stopped: null });
    expect(network.send).not.toHaveBeenCalled();
  });

  it('keeps the entry and the rest of the queue when the network drops', async () => {
    const store = jsonStore(fakeStorage(), 'q', 'array');
    store.save([itemFor('c-1'), itemFor('c-2'), itemFor('c-3')]);
    const network = fakeNetwork(['ok', 'network']);

    const result = await syncQueue({ store, send: network.send });

    expect(result).toEqual({ sent: 1, stopped: 'network' });
    expect(network.send).toHaveBeenCalledTimes(2);
    expect(store.load().map((item) => [item.clientId, item.status])).toEqual([
      ['c-2', 'queued'],
      ['c-3', 'queued'],
    ]);
  });

  it('marks a refused entry failed and sends nothing behind it', async () => {
    const store = jsonStore(fakeStorage(), 'q', 'array');
    store.save([itemFor('c-1'), itemFor('c-2'), itemFor('c-3')]);
    const network = fakeNetwork(['refused']);

    const result = await syncQueue({ store, send: network.send });

    expect(result).toEqual({ sent: 0, stopped: 'failed' });
    expect(network.send).toHaveBeenCalledTimes(1);
    const after = store.load();
    expect(after.map((item) => item.clientId)).toEqual(['c-1', 'c-2', 'c-3']);
    expect(after[0]).toMatchObject({
      status: 'failed',
      error: 'new row violates row-level security policy',
    });
    expect(after[1].status).toBe('queued');
  });

  it('stops at an entry that is already failed, until someone retries or discards it', async () => {
    const store = jsonStore(fakeStorage(), 'q', 'array');
    store.save([
      updateItem([itemFor('c-1')], 'c-1', { status: 'failed', error: 'x' })[0],
      itemFor('c-2'),
    ]);
    const network = fakeNetwork();

    expect(await syncQueue({ store, send: network.send })).toEqual({ sent: 0, stopped: 'failed' });
    expect(network.send).not.toHaveBeenCalled();
  });

  it('after a lost answer, the retry sends the same client_id again and the server keeps one copy', async () => {
    const store = jsonStore(fakeStorage(), 'q', 'array');
    store.save([itemFor('c-1')]);
    const serverRows = new Set();
    let attempts = 0;
    // The first attempt reaches the server, but the answer never gets back.
    const send = vi.fn(async (row) => {
      attempts += 1;
      if (attempts === 1) {
        serverRows.add(row.client_id);
        throw new TypeError('Failed to fetch');
      }
      // The retry is refused as a duplicate by the server; the sender reads that as stored.
      serverRows.add(row.client_id);
    });

    expect(await syncQueue({ store, send })).toEqual({ sent: 0, stopped: 'network' });
    expect(store.load()).toHaveLength(1);
    expect(await syncQueue({ store, send })).toEqual({ sent: 1, stopped: null });
    expect(store.load()).toEqual([]);
    expect(serverRows.size).toBe(1);
  });

  it('keeps an entry logged during a run queued for the next run, and sends each once', async () => {
    const store = jsonStore(fakeStorage(), 'q', 'array');
    store.save([itemFor('c-1')]);
    const send = vi.fn(async (row) => {
      if (row.client_id === 'c-1') {
        // The Member logs another food while the first one is being sent.
        store.save([...store.load(), itemFor('c-2')]);
      }
    });

    const result = await syncQueue({ store, send });

    expect(result).toEqual({ sent: 1, stopped: null });
    expect(send.mock.calls.map(([row]) => row.client_id)).toEqual(['c-1']);
    expect(store.load().map((item) => item.clientId)).toEqual(['c-2']);

    expect(await syncQueue({ store, send })).toEqual({ sent: 1, stopped: null });
    expect(send.mock.calls.map(([row]) => row.client_id)).toEqual(['c-1', 'c-2']);
    expect(store.load()).toEqual([]);
  });

  it('throws when the store refuses the update after a send, and leaves the entry queued', async () => {
    const storage = fakeStorage();
    const store = jsonStore(storage, 'q', 'array');
    store.save([itemFor('c-1')]);
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    const network = fakeNetwork();

    await expect(syncQueue({ store, send: network.send })).rejects.toThrow('QuotaExceededError');
    // The row was stored on the server, and the queue still lists it. A later run sends it
    // again, and the server refuses the copy as a duplicate, so it is logged once.
    expect(network.stored).toHaveLength(1);
    expect(store.load().map((item) => item.clientId)).toEqual(['c-1']);
  });

  it('sends in the order logged, even when the queue was loaded from storage', async () => {
    const store = jsonStore(fakeStorage(), 'q', 'array');
    store.save([itemFor('c-3'), itemFor('c-1'), itemFor('c-2')]);
    const network = fakeNetwork();

    await syncQueue({ store, send: network.send });
    expect(network.calls.map((row) => row.client_id)).toEqual(['c-3', 'c-1', 'c-2']);
  });
});

describe('food cache', () => {
  const library = (id, name, extra = {}) => ({
    key: `library:${id}`,
    source: 'library',
    id,
    name,
    nameEs: null,
    brand: null,
    kcalPer100g: 52,
    macros: { protein: 0.3, carbs: 14, fat: 0.2, fibre: null, sugars: null, sodium: null },
    servingGrams: null,
    servingLabel: null,
    ...extra,
  });
  const usda = (fdcId) => ({ key: `usda:${fdcId}`, source: 'usda', fdcId, name: 'USDA food' });

  it('keeps Food Library results and leaves USDA results out', () => {
    const cache = addFoodsToCache([], [library(1, 'Apple'), usda(99)]);
    expect(cache.map((food) => food.id)).toEqual([1]);
  });

  it('replaces a food already there with the newer copy, without duplicating it', () => {
    const first = addFoodsToCache([], [library(1, 'Apple')]);
    const second = addFoodsToCache(first, [library(1, 'Apple, raw')]);
    expect(second).toHaveLength(1);
    expect(second[0].name).toBe('Apple, raw');
  });

  it('drops the oldest foods when the cache is full', () => {
    const many = Array.from({ length: FOOD_CACHE_LIMIT }, (_, index) =>
      library(index + 1, `F${index}`)
    );
    const next = addFoodsToCache(many, [library(FOOD_CACHE_LIMIT + 1, 'Newest')]);
    expect(next).toHaveLength(FOOD_CACHE_LIMIT);
    expect(next[next.length - 1].name).toBe('Newest');
    expect(next[0].id).toBe(2);
  });

  it('searches the cached foods with the same matching as online (accents and any word)', () => {
    const cache = [
      library(1, 'Apples, raw'),
      library(2, 'Plátano', { nameEs: 'Plátano' }),
      library(3, 'Oats'),
    ];
    expect(searchCachedFoods(cache, 'apple').map((food) => food.id)).toEqual([1]);
    expect(searchCachedFoods(cache, 'platano').map((food) => food.id)).toEqual([2]);
    expect(searchCachedFoods(cache, '   ')).toEqual([]);
  });
});
