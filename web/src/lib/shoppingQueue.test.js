import { describe, expect, it } from 'vitest';
import { SHOPPING_QUEUE_KEY, addItem, jsonStore, queuedOp, syncQueue } from './offlineQueue.js';
import { sendShoppingOp } from './shopping.js';
import { queuedAdd, queuedTick } from './shoppingLogic.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

function phone() {
  const store = jsonStore(fakeStorage(), SHOPPING_QUEUE_KEY, 'array');
  return {
    store,
    queue(op) {
      store.save(addItem(store.load(), queuedOp({ ...op, queuedAt: '2026-10-19T09:00:00Z' })));
    },
  };
}

// A database that behaves like migrations 046 and 047: a tick on a line already ticked is not
// applied, and an add with a client_id it already has makes no second line.
function fakeDatabase() {
  const db = {
    pantry: 300,
    lines: new Map([[7, { id: 7, grams: 1000, purchased: false }]]),
    byClient: new Map(),
    nextId: 100,
    async rpc(name, args) {
      if (name === 'shopping_tick') {
        const line = db.lines.get(args.p_line_id);
        if (!line) return { data: null, error: { code: '42501', message: 'not in Household' } };
        if (line.purchased) return { data: { applied: false, line_id: line.id }, error: null };
        line.purchased = true;
        db.pantry += line.grams;
        return { data: { applied: true, line_id: line.id, pantry_grams: db.pantry }, error: null };
      }
      if (name === 'shopping_add_line') {
        const known = db.byClient.get(args.p_client_id);
        if (known) return { data: { line_id: known, created: false }, error: null };
        db.nextId += 1;
        db.byClient.set(args.p_client_id, db.nextId);
        db.lines.set(db.nextId, { id: db.nextId, grams: args.p_grams, purchased: false });
        return { data: { line_id: db.nextId, created: true }, error: null };
      }
      return { data: null, error: { code: 'XX000', message: 'unknown' } };
    },
  };
  return db;
}

describe('queue replay for the Shopping list', () => {
  it('two phones that ticked the same line offline add to the Pantry once', async () => {
    const db = fakeDatabase();
    const alice = phone();
    const dana = phone();
    alice.queue(queuedTick({ lineId: 7, kind: 'bought' }));
    dana.queue(queuedTick({ lineId: 7, kind: 'bought' }));
    const send = (row) => sendShoppingOp(db, row);
    expect(await syncQueue({ store: alice.store, send })).toEqual({ sent: 1, stopped: null });
    expect(await syncQueue({ store: dana.store, send })).toEqual({ sent: 1, stopped: null });
    expect(db.pantry).toBe(1300);
    expect(alice.store.load()).toEqual([]);
    expect(dana.store.load()).toEqual([]);
  });

  it('a tick replayed after its reply was lost changes nothing the second time', async () => {
    const db = fakeDatabase();
    const p = phone();
    p.queue(queuedTick({ lineId: 7, kind: 'bought' }));
    const send = (row) => sendShoppingOp(db, row);
    // The first send reaches the database but the phone never hears back.
    await send(p.store.load()[0].row);
    await syncQueue({ store: p.store, send });
    expect(db.pantry).toBe(1300);
  });

  it('ticking the same line twice on one phone queues one tick', () => {
    const p = phone();
    p.queue(queuedTick({ lineId: 7, kind: 'bought' }));
    p.queue(queuedTick({ lineId: 7, kind: 'have_it' }));
    expect(p.store.load()).toHaveLength(1);
    expect(p.store.load()[0].row.kind).toBe('bought');
  });

  it('a replayed add makes one line', async () => {
    const db = fakeDatabase();
    const p = phone();
    p.queue(queuedAdd({ clientId: 'c-1', name: 'Foil', text: 'one roll' }));
    const send = (row) => sendShoppingOp(db, row);
    await send(p.store.load()[0].row);
    await syncQueue({ store: p.store, send });
    expect(db.byClient.size).toBe(1);
    expect(db.lines.size).toBe(2);
  });

  it('sends adds and ticks in order and keeps the rest on a network error', async () => {
    const p = phone();
    p.queue(queuedAdd({ clientId: 'c-1', name: 'Foil' }));
    p.queue(queuedTick({ lineId: 7, kind: 'bought' }));
    const seen = [];
    const result = await syncQueue({
      store: p.store,
      send: async (row) => {
        seen.push(row.op);
        if (row.op === 'tick') throw new TypeError('Failed to fetch');
      },
    });
    expect(seen).toEqual(['add', 'tick']);
    expect(result).toEqual({ sent: 1, stopped: 'network' });
    expect(p.store.load().map((item) => item.row.op)).toEqual(['tick']);
  });

  it('a refused operation is marked failed and holds the queue', async () => {
    const db = fakeDatabase();
    const p = phone();
    p.queue(queuedTick({ lineId: 999, kind: 'bought' }));
    p.queue(queuedTick({ lineId: 7, kind: 'bought' }));
    const result = await syncQueue({ store: p.store, send: (row) => sendShoppingOp(db, row) });
    expect(result).toEqual({ sent: 0, stopped: 'failed' });
    expect(p.store.load()[0].status).toBe('failed');
    expect(db.pantry).toBe(300);
  });

  it('passes the item to the sender as a second argument', async () => {
    const p = phone();
    p.queue(queuedTick({ lineId: 7, kind: 'bought' }));
    let second;
    await syncQueue({
      store: p.store,
      send: async (row, item) => {
        second = item;
      },
    });
    expect(second.clientId).toBe('tick:7');
  });
});
