import { describe, expect, it, vi } from 'vitest';
import {
  configuredVapidKey,
  disableNotifications,
  enableNotifications,
  pushStatus,
  sendTestNotification,
  subscriptionToRow,
  urlBase64ToUint8Array,
} from './push.js';

const subscription = (overrides = {}) => ({
  endpoint: 'https://push.example/abc',
  toJSON() {
    return { endpoint: this.endpoint, keys: { p256dh: 'pk', auth: 'ak' }, ...overrides };
  },
  unsubscribe: vi.fn(async () => true),
});

function fakeWindow({ permission = 'default', existing = null, requestResult = 'granted' } = {}) {
  const pushManager = {
    getSubscription: vi.fn(async () => existing),
    subscribe: vi.fn(async () => subscription()),
  };
  return {
    pushManager,
    Notification: { permission, requestPermission: vi.fn(async () => requestResult) },
    PushManager: function PushManager() {},
    navigator: {
      userAgent: 'TestAgent',
      serviceWorker: { ready: Promise.resolve({ pushManager }) },
    },
  };
}

describe('pushStatus', () => {
  const base = { vapidKey: 'key', standalone: false };

  it('needs the VAPID public key first', () => {
    expect(pushStatus({ ...base, vapidKey: '', win: fakeWindow() })).toBe('notConfigured');
  });

  it('is ready when the browser supports push and has not blocked it', () => {
    expect(pushStatus({ ...base, win: fakeWindow() })).toBe('ready');
  });

  it('reports a blocked permission', () => {
    expect(pushStatus({ ...base, win: fakeWindow({ permission: 'denied' }) })).toBe('denied');
  });

  it('asks an iPhone outside the Home Screen to install first', () => {
    const win = { navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' } };
    expect(pushStatus({ ...base, win })).toBe('needsInstall');
  });

  it('calls other browsers without push unsupported', () => {
    const win = { navigator: { userAgent: 'Mozilla/5.0 (X11; Linux)' } };
    expect(pushStatus({ ...base, win })).toBe('unsupported');
  });
});

describe('subscriptionToRow', () => {
  it('maps a PushSubscription to the save_push_subscription arguments', () => {
    expect(subscriptionToRow(subscription(), 'Agent/1')).toEqual({
      p_endpoint: 'https://push.example/abc',
      p_p256dh: 'pk',
      p_auth: 'ak',
      p_user_agent: 'Agent/1',
    });
  });

  it('refuses a subscription without https or keys', () => {
    expect(subscriptionToRow(subscription({ endpoint: 'http://x' }), '')).toBeNull();
    expect(subscriptionToRow(subscription({ keys: {} }), '')).toBeNull();
    expect(subscriptionToRow(null, '')).toBeNull();
  });
});

describe('keys', () => {
  it('decodes a base64url key to bytes', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID-_8'))).toEqual([1, 2, 3, 251, 255]);
  });

  it('reads the configured key from the build env', () => {
    expect(configuredVapidKey({ VITE_VAPID_PUBLIC_KEY: ' abc ' })).toBe('abc');
    expect(configuredVapidKey({})).toBe('');
  });
});

describe('enableNotifications', () => {
  it('asks permission, subscribes and saves the subscription', async () => {
    const win = fakeWindow();
    const client = { rpc: vi.fn(async () => ({ error: null })) };
    const result = await enableNotifications({ win, client, vapidKey: 'AQID' });
    expect(result).toBe('on');
    expect(win.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
    expect(client.rpc).toHaveBeenCalledWith(
      'save_push_subscription',
      expect.objectContaining({ p_endpoint: 'https://push.example/abc', p_user_agent: 'TestAgent' })
    );
  });

  it('saves nothing when the Member says no', async () => {
    const win = fakeWindow({ requestResult: 'denied' });
    const client = { rpc: vi.fn() };
    expect(await enableNotifications({ win, client, vapidKey: 'AQID' })).toBe('denied');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('throws when saving fails', async () => {
    const client = { rpc: vi.fn(async () => ({ error: new Error('nope') })) };
    await expect(
      enableNotifications({ win: fakeWindow(), client, vapidKey: 'AQID' })
    ).rejects.toThrow('nope');
  });
});

describe('disableNotifications', () => {
  it('unsubscribes and deletes the saved row', async () => {
    const existing = subscription();
    const win = fakeWindow({ existing });
    const eq = vi.fn(async () => ({ error: null }));
    const client = { from: vi.fn(() => ({ delete: () => ({ eq }) })) };
    await disableNotifications({ win, client });
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(client.from).toHaveBeenCalledWith('push_subscriptions');
    expect(eq).toHaveBeenCalledWith('endpoint', 'https://push.example/abc');
  });
});

describe('sendTestNotification', () => {
  it('returns the totals from send-push', async () => {
    const invoke = vi.fn(async () => ({ data: { sent: 2, removed: 1 }, error: null }));
    const totals = await sendTestNotification({ functions: { invoke } }, { title: 'T', body: 'B' });
    expect(totals).toEqual({ sent: 2, removed: 1, failed: 0 });
    expect(invoke).toHaveBeenCalledWith('send-push', {
      body: { title: 'T', body: 'B', url: '/', tag: 'test' },
    });
  });
});
