import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationsSetting from './NotificationsSetting.jsx';
import { I18nProvider } from '../i18n/I18nProvider.jsx';
import * as push from '../lib/push.js';

vi.mock('../lib/supabase.js', () => ({
  supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock('../lib/push.js', async (importOriginal) => ({
  ...(await importOriginal()),
  configuredVapidKey: vi.fn(() => 'AQID'),
  currentSubscription: vi.fn(async () => null),
  enableNotifications: vi.fn(async () => 'on'),
  disableNotifications: vi.fn(async () => {}),
  sendTestNotification: vi.fn(async () => ({ sent: 1, removed: 0, failed: 0 })),
}));

const originals = {};
function supportPush(permission = 'default') {
  for (const name of ['PushManager', 'Notification']) originals[name] = window[name];
  window.PushManager = function PushManager() {};
  window.Notification = { permission };
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
}

function renderSetting() {
  return render(
    <I18nProvider>
      <NotificationsSetting />
    </I18nProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  push.configuredVapidKey.mockReturnValue('AQID');
  push.currentSubscription.mockResolvedValue(null);
  for (const name of Object.keys(originals)) {
    if (originals[name] === undefined) delete window[name];
    else window[name] = originals[name];
  }
  delete navigator.serviceWorker;
});

describe('NotificationsSetting', () => {
  it('turns notifications on from a tap, then offers Send test', async () => {
    supportPush();
    renderSetting();

    await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }));
    expect(push.enableNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ vapidKey: 'AQID' })
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Send test' }));
    expect(push.sendTestNotification).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Test sent to 1 device(s).');
  });

  it('says so when no device is subscribed for the test', async () => {
    supportPush();
    push.currentSubscription.mockResolvedValue({ endpoint: 'https://push.example/x' });
    push.sendTestNotification.mockResolvedValue({ sent: 0, removed: 0, failed: 0 });
    renderSetting();

    await userEvent.click(await screen.findByRole('button', { name: 'Send test' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No device is subscribed yet');
  });

  it("shows the Home Screen note with Apple's source link on an iPhone browser tab", () => {
    supportPush();
    delete window.PushManager;
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'
    );
    renderSetting();

    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WebKit/ })).toHaveAttribute(
      'href',
      push.IOS_WEB_PUSH_URL
    );
  });

  it('explains a missing push key and offers no button', () => {
    push.configuredVapidKey.mockReturnValue('');
    renderSetting();
    expect(screen.getByText(/push key/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows an error when turning on fails', async () => {
    supportPush();
    push.enableNotifications.mockRejectedValue(new Error('x'));
    renderSetting();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
