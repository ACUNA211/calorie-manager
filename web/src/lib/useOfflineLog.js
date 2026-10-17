// The React side of offline logging (ticket #34): holds the queue on screen, sends it when the
// phone is back online, and keeps a copy of the Food Library results it has seen so a food can
// be logged with no signal. The rules live in offlineQueue.js; this file only wires them up.
//
// `version` goes up after a run that sent something, so the day on screen reloads from the
// server and the synced rows replace the queued ones.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOnline } from './online.js';
import { insertQueuedEntry } from './today.js';
import {
  FOOD_CACHE_KEY,
  QUEUE_KEY,
  addFoodsToCache,
  addItem,
  itemsFor,
  jsonStore,
  queuedItem,
  queuedView,
  removeItem,
  searchCachedFoods,
  syncQueue,
  updateItem,
} from './offlineQueue.js';

// How often a phone that is online but failing to reach the server tries again.
export const RETRY_MS = 30000;

// The phone's localStorage. Where the browser refuses it, the returned store reads as empty
// and refuses to write, so logging offline reports an error instead of losing the entry.
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

// `client` is the Supabase client, `memberId` the Member being acted for. `storage` defaults to
// the phone's localStorage; tests pass a fake.
export function useOfflineLog({ client, memberId, storage }) {
  const online = useOnline();
  const store = useMemo(() => storage ?? browserStorage(), [storage]);
  const queue = useMemo(() => jsonStore(store, QUEUE_KEY, 'array'), [store]);
  const foodCache = useMemo(() => jsonStore(store, FOOD_CACHE_KEY, 'array'), [store]);
  const [items, setItems] = useState(() => queue.load());
  const [version, setVersion] = useState(0);
  const running = useRef(false);

  // Applies a change to the queue: read, change, save, then show it.
  const change = useCallback(
    (update) => {
      const next = update(queue.load());
      queue.save(next);
      setItems(next);
    },
    [queue]
  );

  // One run over the queue. Runs never overlap; a run that starts while one is going does nothing.
  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const result = await syncQueue({
        store: queue,
        send: (row) => insertQueuedEntry(client, row),
      });
      if (result.sent > 0) setVersion((current) => current + 1);
    } catch {
      // A failed save inside the run leaves the queue as the store has it; the next run retries.
    } finally {
      setItems(queue.load());
      running.current = false;
    }
  }, [client, queue]);

  // Sends when the phone comes online, then again on a timer while it stays online.
  // The first run is a timeout, not a direct call, so the effect does not set state synchronously.
  useEffect(() => {
    if (!online) return undefined;
    const first = setTimeout(sync, 0);
    const timer = setInterval(sync, RETRY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [online, sync]);

  // Adds a row (with its client_id) to the queue. Throws if the phone will not store it.
  const enqueue = useCallback(
    (row) => {
      const item = queuedItem({ memberId, row, queuedAt: new Date().toISOString() });
      change((current) => addItem(current, item));
      return queuedView(item);
    },
    [change, memberId]
  );

  // Tries a failed entry again, and the rest of the queue behind it.
  const retry = useCallback(
    async (clientId) => {
      change((current) => updateItem(current, clientId, { status: 'queued', error: null }));
      await sync();
    },
    [change, sync]
  );

  // Drops a queued or failed entry (the failed one is shown with Discard), then sends what is left.
  const discard = useCallback(
    async (clientId) => {
      change((current) => removeItem(current, clientId));
      await sync();
    },
    [change, sync]
  );

  // The queued entries of one day, shaped like saved entries for the day's list.
  const entriesFor = useCallback(
    (day) => itemsFor(items, memberId, day).map(queuedView),
    [items, memberId]
  );

  // Keeps the Food Library results of an online search for offline use. A cache that cannot be
  // saved is not an error for the search itself.
  const rememberFoods = useCallback(
    (results) => {
      try {
        foodCache.save(addFoodsToCache(foodCache.load(), results));
      } catch {
        // Leave the cache as it was.
      }
    },
    [foodCache]
  );

  // Searches the foods kept on this phone.
  const searchOffline = useCallback(
    (query) => searchCachedFoods(foodCache.load(), query),
    [foodCache]
  );

  return {
    online,
    version,
    entriesFor,
    enqueue,
    retry,
    discard,
    rememberFoods,
    searchOffline,
  };
}
