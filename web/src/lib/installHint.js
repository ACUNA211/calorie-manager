// Pure helpers for the one-time "Add to Home Screen" hint on iPhone Safari.

export const DISMISSED_KEY = 'calorieManager.installHintDismissed';

// True only for Safari on an iPhone or iPod touch. Excludes Chrome, Firefox,
// Edge, Opera and in-app browsers on iOS, which cannot add to the Home Screen
// the same way.
export function isIphoneSafari(userAgent) {
  const ua = String(userAgent || '');
  const isIphone = /iPhone|iPod/.test(ua);
  const isSafari = /Safari\//.test(ua);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|DuckDuckGo|GSA\//.test(ua);
  return isIphone && isSafari && !isOtherBrowser;
}

// True when the app already runs from the Home Screen.
export function isStandalone(navigator, win) {
  if (navigator && navigator.standalone === true) return true;
  return Boolean(
    win &&
    typeof win.matchMedia === 'function' &&
    win.matchMedia('(display-mode: standalone)').matches
  );
}

// localStorage can throw (private mode, blocked storage), so reads and writes are guarded.
export function isHintDismissed(storage) {
  if (!storage) return false;
  try {
    return storage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHintDismissed(storage) {
  if (!storage) return;
  try {
    storage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Storage is unavailable: the hint may show again next time, which is harmless.
  }
}

// Whether the hint should be visible now.
export function shouldShowInstallHint({ userAgent, navigator, win, storage }) {
  return isIphoneSafari(userAgent) && !isStandalone(navigator, win) && !isHintDismissed(storage);
}
