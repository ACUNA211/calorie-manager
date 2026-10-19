import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/I18nProvider.jsx';
import { isStandalone } from '../lib/installHint.js';
import {
  configuredVapidKey,
  currentSubscription,
  disableNotifications,
  enableNotifications,
  IOS_WEB_PUSH_URL,
  pushStatus,
  sendTestNotification,
} from '../lib/push.js';

// Notifications (ticket 54): allow Web Push on this device, turn it off, and send a test.
// The subscription belongs to this device and the signed-in Member (migration 043).
export default function NotificationsSetting() {
  const { t } = useI18n();
  const vapidKey = configuredVapidKey();
  const status = pushStatus({
    win: window,
    vapidKey,
    standalone: isStandalone(window.navigator, window),
  });
  // null while checking whether this device already has a subscription.
  const [subscribed, setSubscribed] = useState(status === 'ready' ? null : false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    let active = true;
    currentSubscription(window.navigator.serviceWorker)
      .then((subscription) => active && setSubscribed(Boolean(subscription)))
      .catch(() => active && setSubscribed(false));
    return () => {
      active = false;
    };
  }, [status]);

  async function run(action) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch {
      setMessage({ key: 'notifications.saveError', alert: true });
    } finally {
      setBusy(false);
    }
  }

  const turnOn = () =>
    run(async () => {
      const result = await enableNotifications({ win: window, client: supabase, vapidKey });
      setDenied(result === 'denied');
      setSubscribed(result === 'on');
    });

  const turnOff = () =>
    run(async () => {
      await disableNotifications({ win: window, client: supabase });
      setSubscribed(false);
    });

  const sendTest = () =>
    run(async () => {
      const totals = await sendTestNotification(supabase, {
        title: t('notifications.testTitle'),
        body: t('notifications.testBody'),
      });
      if (totals.sent > 0) {
        setMessage({ key: 'notifications.testSent', values: { count: totals.sent } });
      } else if (totals.removed > 0) {
        setSubscribed(false);
        setMessage({ key: 'notifications.testRemoved', alert: true });
      } else if (totals.failed > 0) {
        setMessage({ key: 'notifications.testFailed', alert: true });
      } else {
        setMessage({ key: 'notifications.testNone', alert: true });
      }
    });

  let body;
  if (status === 'ready' && denied) {
    body = <p>{t('notifications.denied')}</p>;
  } else if (status === 'ready') {
    body =
      subscribed === null ? (
        <p className="mute">{t('notifications.checking')}</p>
      ) : (
        <>
          <p>{t(subscribed ? 'notifications.on' : 'notifications.off')}</p>
          {subscribed ? (
            <>
              <button type="button" disabled={busy} onClick={sendTest}>
                {t('notifications.sendTest')}
              </button>{' '}
              <button type="button" className="btn-quiet" disabled={busy} onClick={turnOff}>
                {t('notifications.turnOff')}
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={turnOn}>
              {t('notifications.turnOn')}
            </button>
          )}
        </>
      );
  } else if (status === 'needsInstall') {
    body = (
      <>
        <p>{t('notifications.needsInstall')}</p>
        <p>
          <a href={IOS_WEB_PUSH_URL} target="_blank" rel="noreferrer">
            {t('notifications.needsInstallSource')}
          </a>
        </p>
      </>
    );
  } else {
    body = <p>{t(`notifications.${status === 'denied' ? 'denied' : status}`)}</p>;
  }

  return (
    <>
      <p className="mute">{t('notifications.intro')}</p>
      {body}
      {message && <p role={message.alert ? 'alert' : 'status'}>{t(message.key, message.values)}</p>}
    </>
  );
}
