// Offline logging (ticket #34). Entries logged with no signal wait here, on the phone, until
// they can be sent. Everything in this file is pure or takes its storage as an argument, so
// the rules are tested with a fake store and a fake network (offlineQueue.test.js).
//
// Storage: localStorage, holding one JSON array of queued entries and one JSON object of
// Food Library results. The queue is a few dozen small rows at most and is read and written
// as a whole, so the synchronous API is simpler than IndexedDB and needs no loading step.
// If the browser refuses storage (private mode, full disk), saving throws and the caller
// tells the Member the entry could not be kept.
//
// Every queued entry carries a client_id (a uuid made on the phone). The server refuses a
// second row with the same client_id (migration 025), so a resend cannot log a food twice.

import { rankLibrary } from './foods.js';

export const QUEUE_KEY = 'calorie-manager.offline-log';
export const FOOD_CACHE_KEY = 'calorie-manager.offline-foods';
// Most Food Library results kept on the phone. Searches add to it and it never grows past this.
export const FOOD_CACHE_LIMIT = 2000;

// A uuid for a queued entry. crypto.randomUUID needs a secure context; the fallback builds a
// version-4 uuid from random bytes so the id is still a uuid when the page is served over http.
export function makeClientId(cryptoApi = globalThis.crypto) {
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// A JSON value kept under one key, either an array or a plain object (`shape`). Reads never
// throw: a missing, unreadable or wrong-shaped value reads as empty. Writes do throw, so a
// full or refused store is never silent.
export function jsonStore(storage, key, shape) {
  const empty = () => (shape === 'array' ? [] : {});
  const fits = (value) =>
    shape === 'array'
      ? Array.isArray(value)
      : value !== null && typeof value === 'object' && !Array.isArray(value);
  return {
    load() {
      try {
        const raw = storage.getItem(key);
        if (raw == null) return empty();
        const value = JSON.parse(raw);
        return fits(value) ? value : empty();
      } catch {
        return empty();
      }
    },
    save(value) {
      storage.setItem(key, JSON.stringify(value));
    },
  };
}

// The queue's stored items: { clientId, memberId, logDate, queuedAt, row, status, error }.
// status is 'queued' (waiting to be sent) or 'failed' (the server refused it; the Member must
// retry or discard it). `row` is the Calorie Log row exactly as it will be inserted.
export function queuedItem({ memberId, row, queuedAt }) {
  return {
    clientId: row.client_id,
    memberId,
    logDate: row.log_date,
    queuedAt,
    row,
    status: 'queued',
    error: null,
  };
}

// Pure list operations. Each returns a new array and leaves the old one as it was.
export function addItem(items, item) {
  if (items.some((existing) => existing.clientId === item.clientId)) return items;
  return [...items, item];
}

export function updateItem(items, clientId, patch) {
  return items.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item));
}

export function removeItem(items, clientId) {
  return items.filter((item) => item.clientId !== clientId);
}

// The queued entries of one Member on one day, in the order they were logged.
export function itemsFor(items, memberId, logDate) {
  return items.filter((item) => item.memberId === memberId && item.logDate === logDate);
}

// The screen's view of a queued entry: a Calorie Log row with `id` set to the client id and
// `pending` set to the status, so the day's totals, Meal Time sections and list can show it
// beside the saved entries. Its created_at is the time it was logged on the phone.
export function queuedView(item) {
  return {
    ...item.row,
    id: item.clientId,
    member_id: item.memberId,
    created_at: item.queuedAt,
    pending: item.status,
    error: item.error,
  };
}

// Whether an error from the database call means "no connection" (the request never got an
// answer), as opposed to a refusal. supabase-js reports a failed request with an empty code
// (or throws a TypeError), while the database refuses with a code such as '42501'.
export function isNetworkError(error) {
  return !(error && typeof error.code === 'string' && error.code !== '');
}

// Sends the queue in order, once. `store` is a jsonStore for the queue. `send(row)` stores one
// row and resolves when the server has it (including the case where a resend was already
// stored). Rules:
// - a network error stops the run; everything still queued waits for the next run;
// - any other error marks that entry 'failed' and stops the run, so later entries never jump
//   ahead of it; the Member retries or discards it (retry and discard are below);
// - an entry that was already 'failed' before the run also stops it, for the same reason.
// The store is re-read before each change, so entries queued during a run are kept.
// Returns { sent, stopped } with stopped 'network', 'failed' or null.
export async function syncQueue({ store, send }) {
  const result = { sent: 0, stopped: null };
  const snapshot = store.load();
  for (const item of snapshot) {
    if (item.status === 'failed') {
      result.stopped = 'failed';
      break;
    }
    try {
      await send(item.row);
    } catch (error) {
      if (isNetworkError(error)) {
        result.stopped = 'network';
        break;
      }
      const message = typeof error?.message === 'string' ? error.message : 'unknown';
      store.save(updateItem(store.load(), item.clientId, { status: 'failed', error: message }));
      result.stopped = 'failed';
      break;
    }
    store.save(removeItem(store.load(), item.clientId));
    result.sent += 1;
  }
  return result;
}

// ---- Food cache ------------------------------------------------------------------------

// Adds Food Library results to the cache (library results only; a USDA result is not kept
// because it cannot be logged without a connection). A food already there is replaced with
// the newer copy. Oldest entries go first when the cache is full.
export function addFoodsToCache(cache, results) {
  const byId = new Map(cache.map((food) => [food.id, food]));
  for (const result of results) {
    if (result.source !== 'library' || result.id == null) continue;
    byId.delete(result.id);
    byId.set(result.id, result);
  }
  const all = [...byId.values()];
  return all.length > FOOD_CACHE_LIMIT ? all.slice(all.length - FOOD_CACHE_LIMIT) : all;
}

// Searches the cached Food Library results, with the same matching and ranking as a search
// online (foods.js rankLibrary).
export function searchCachedFoods(cache, query) {
  return rankLibrary(cache, query);
}
