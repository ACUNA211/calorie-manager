// Web Push setup (ticket 54): allow notifications on this device, save the subscription,
// and ask the server to send a test. The pure decisions are exported on their own; the async
// steps take the browser objects and the Supabase client as arguments so tests can pass fakes.
//
// The VAPID public key is set by the user in web/.env as VITE_VAPID_PUBLIC_KEY (see
// .env.example). The private key never reaches the app: it lives in the send-push Edge
// Function's secrets.

// Apple: Web Push on iPhone and iPad works only for a web app added to the Home Screen (iOS and
// iPadOS 16.4 or later). Shown beside the install hint in Settings.
export const IOS_WEB_PUSH_URL =
  'https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/';

// The VAPID public key the build was given, or '' when the user has not set it.
export function configuredVapidKey(env = import.meta.env) {
  const key = env && env.VITE_VAPID_PUBLIC_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

// The key as the bytes PushManager.subscribe wants (it is stored as base64url).
export function urlBase64ToUint8Array(base64Url) {
  const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// What this device can do right now. Returns one of:
//   'notConfigured'  the VAPID public key is not set in this build
//   'needsInstall'   iPhone or iPad Safari outside the Home Screen app (no push there)
//   'unsupported'    the browser has no service worker, Push or Notification support
//   'denied'         the Member blocked notifications in the browser
//   'ready'          the Member can turn notifications on (or already has)
// `win` is the window, `vapidKey` the configured public key, `standalone` whether the app runs
// from the Home Screen.
export function pushStatus({ win, vapidKey, standalone }) {
  if (!vapidKey) return 'notConfigured';
  const nav = win && win.navigator;
  const hasPush =
    Boolean(nav && 'serviceWorker' in nav) && 'PushManager' in win && 'Notification' in win;
  if (!hasPush) {
    const ua = (nav && nav.userAgent) || '';
    return /iPhone|iPad|iPod/.test(ua) && !standalone ? 'needsInstall' : 'unsupported';
  }
  return win.Notification.permission === 'denied' ? 'denied' : 'ready';
}

// The arguments of the save_push_subscription database function (migration 043) for a
// PushSubscription. Returns null if the subscription lacks what the server needs.
export function subscriptionToRow(subscription, userAgent) {
  const json =
    subscription && typeof subscription.toJSON === 'function' ? subscription.toJSON() : null;
  const endpoint = json && json.endpoint;
  const keys = json && json.keys;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return null;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  return {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
  };
}

// This device's current subscription, or null.
export async function currentSubscription(serviceWorker) {
  const registration = await serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

// Asks permission (call this from a tap), subscribes this device and saves the subscription.
// Returns 'on', or 'denied' if the Member said no. Throws if saving fails.
export async function enableNotifications({ win, client, vapidKey }) {
  const permission = await win.Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const registration = await win.navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));
  const row = subscriptionToRow(subscription, win.navigator.userAgent);
  if (!row) throw new Error('The browser gave back an unusable subscription');
  const { error } = await client.rpc('save_push_subscription', row);
  if (error) throw error;
  return 'on';
}

// Turns notifications off on this device: unsubscribes and removes the saved row.
export async function disableNotifications({ win, client }) {
  const subscription = await currentSubscription(win.navigator.serviceWorker);
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await client.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}

// Asks the send-push Edge Function to notify the signed-in Member's own devices. Returns the
// totals { sent, removed, failed }.
export async function sendTestNotification(client, { title, body, url = '/' }) {
  const { data, error } = await client.functions.invoke('send-push', {
    body: { title, body, url, tag: 'test' },
  });
  if (error) throw error;
  return {
    sent: Number(data && data.sent) || 0,
    removed: Number(data && data.removed) || 0,
    failed: Number(data && data.failed) || 0,
  };
}
