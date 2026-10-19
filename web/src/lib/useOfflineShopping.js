// The React side of offline ticking and adding on the Shopping list (ticket #48). It reuses the
// queue of ticket 34 (offlineQueue.js: items, jsonStore, syncQueue) under its own storage key and
// sends with shopping_tick / shopping_add_line. A tick or add made with no signal waits on the
// phone and goes out, in order, when the phone is back online.
//
// `tick(lineId, kind, grams)` is the one call for ticking a line: the page's buttons use it, and
// so can a scan (ticket 49) with the weight it found. `version` goes up after a run that sent
// something, so the list on screen reloads from the server.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOnline } from './online.js';
import {
  SHOPPING_QUEUE_KEY,
  addItem,
  isNetworkError,
  jsonStore,
  makeClientId,
  queuedOp,
  removeItem,
  syncQueue,
  updateItem,
} from './offlineQueue.js';
import { addHandLine, sendShoppingOp, tickLine } from './shopping.js';
import { queuedAdd, queuedTick } from './shoppingLogic.js';
import { RETRY_MS } from './useOfflineLog.js';

function browserStorage() {
  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // Fall through: the browser blocks storage.
  }
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('Storage is not available');
    },
  };
}

export function useOfflineShopping({ client, storage }) {
  const online = useOnline();
  const store = useMemo(() => storage ?? browserStorage(), [storage]);
  const queue = useMemo(() => jsonStore(store, SHOPPING_QUEUE_KEY, 'array'), [store]);
  const [items, setItems] = useState(() => queue.load());
  const [version, setVersion] = useState(0);
  const running = useRef(false);

  const change = useCallback(
    (update) => {
      const next = update(queue.load());
      queue.save(next);
      setItems(next);
    },
    [queue]
  );

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const result = await syncQueue({ store: queue, send: (row) => sendShoppingOp(client, row) });
      if (result.sent > 0) setVersion((current) => current + 1);
    } catch {
      // A failed save inside the run leaves the queue as the store has it; the next run retries.
    } finally {
      setItems(queue.load());
      running.current = false;
    }
  }, [client, queue]);

  useEffect(() => {
    if (!online) return undefined;
    const first = setTimeout(sync, 0);
    const timer = setInterval(sync, RETRY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [online, sync]);

  const enqueue = useCallback(
    (op) => {
      const item = queuedOp({ ...op, queuedAt: new Date().toISOString() });
      change((current) => addItem(current, item));
    },
    [change]
  );

  // Ticks a line. Returns { queued: false, result } when the database answered, or
  // { queued: true } when there is no connection and the tick was kept on the phone. A refusal
  // from the database is thrown. Throws too if the phone will not store a queued tick.
  const tick = useCallback(
    async (lineId, kind, grams = null) => {
      if (!online) {
        enqueue(queuedTick({ lineId, kind, grams }));
        return { queued: true };
      }
      try {
        return { queued: false, result: await tickLine(client, lineId, kind, grams) };
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        enqueue(queuedTick({ lineId, kind, grams }));
        return { queued: true };
      }
    },
    [client, enqueue, online]
  );

  // Adds a hand line. Same two outcomes as tick; the line's id is made here.
  const add = useCallback(
    async ({ name, foodId = null, grams = null, text = null }) => {
      const clientId = makeClientId();
      if (!online) {
        enqueue(queuedAdd({ clientId, name, foodId, grams, text }));
        return { queued: true };
      }
      try {
        return {
          queued: false,
          result: await addHandLine(client, { clientId, name, foodId, grams, text }),
        };
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        enqueue(queuedAdd({ clientId, name, foodId, grams, text }));
        return { queued: true };
      }
    },
    [client, enqueue, online]
  );

  // Takes a queued tick back before it was sent (Undo on the "kept on this phone" toast).
  const cancelTick = useCallback(
    (lineId) => change((current) => removeItem(current, `tick:${lineId}`)),
    [change]
  );

  const retry = useCallback(
    async (clientId) => {
      change((current) => updateItem(current, clientId, { status: 'queued', error: null }));
      await sync();
    },
    [change, sync]
  );

  const discard = useCallback(
    async (clientId) => {
      change((current) => removeItem(current, clientId));
      await sync();
    },
    [change, sync]
  );

  return { online, items, version, tick, add, cancelTick, retry, discard };
}
