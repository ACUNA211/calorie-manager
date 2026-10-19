import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// Runs public/push-sw.js against a fake service worker scope.
const source = readFileSync(resolve(process.cwd(), 'public/push-sw.js'), 'utf8');

function load(clients = {}) {
  const handlers = {};
  const showNotification = vi.fn(async () => {});
  const scope = {
    registration: { showNotification },
    location: { origin: 'https://app.example' },
    addEventListener: (type, fn) => {
      handlers[type] = fn;
    },
  };
  new Function('self', 'clients', source)(scope, clients);
  return { handlers, showNotification };
}

function pushEvent(data) {
  const waits = [];
  return {
    event: { data: { json: () => data, text: () => 'plain' }, waitUntil: (p) => waits.push(p) },
    waits,
  };
}

describe('push-sw.js', () => {
  it('shows the notification it is sent, with an app path to open', async () => {
    const { handlers, showNotification } = load();
    const { event, waits } = pushEvent({
      title: 'Plan ready',
      body: 'Open it',
      url: '/plan',
      tag: 'draft',
    });
    handlers.push(event);
    await Promise.all(waits);
    expect(showNotification).toHaveBeenCalledWith(
      'Plan ready',
      expect.objectContaining({ body: 'Open it', tag: 'draft', data: { url: '/plan' } })
    );
  });

  it('still shows something for an unreadable message and ignores off-site URLs', async () => {
    const { handlers, showNotification } = load();
    const waits = [];
    handlers.push({
      data: {
        json: () => {
          throw new Error('not json');
        },
        text: () => 'hello',
      },
      waitUntil: (p) => waits.push(p),
    });
    await Promise.all(waits);
    expect(showNotification).toHaveBeenCalledWith(
      'Calorie Manager',
      expect.objectContaining({ body: 'hello', data: { url: '/' } })
    );

    const second = pushEvent({ title: 'x', url: 'https://evil.example' });
    handlers.push(second.event);
    await Promise.all(second.waits);
    expect(showNotification).toHaveBeenLastCalledWith(
      'x',
      expect.objectContaining({ data: { url: '/' } })
    );
  });

  it('on tap, focuses an open window and sends it to the page', async () => {
    const navigate = vi.fn(async () => {});
    const win = {
      focus: vi.fn(async function () {
        return { navigate };
      }),
    };
    const { handlers } = load({ matchAll: vi.fn(async () => [win]), openWindow: vi.fn() });
    const waits = [];
    const close = vi.fn();
    handlers.notificationclick({
      notification: { close, data: { url: '/plan' } },
      waitUntil: (p) => waits.push(p),
    });
    await Promise.all(waits);
    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('https://app.example/plan');
  });

  it('on tap with no open window, opens one', async () => {
    const openWindow = vi.fn(async () => {});
    const { handlers } = load({ matchAll: vi.fn(async () => []), openWindow });
    const waits = [];
    handlers.notificationclick({
      notification: { close: vi.fn(), data: { url: '/' } },
      waitUntil: (p) => waits.push(p),
    });
    await Promise.all(waits);
    expect(openWindow).toHaveBeenCalledWith('https://app.example/');
  });
});
