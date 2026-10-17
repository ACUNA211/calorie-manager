import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import InstallHint from './InstallHint.jsx';
import { DISMISSED_KEY, isIphoneSafari } from '../lib/installHint.js';
import { I18nProvider } from '../i18n/I18nProvider.jsx';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

function setUserAgent(value) {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

function setStandalone(value) {
  Object.defineProperty(window.navigator, 'standalone', { value, configurable: true });
}

describe('InstallHint', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    // Globals are off, so Testing Library does not clean up on its own.
    cleanup();
    // Remove the instance overrides so navigator goes back to its real values.
    delete window.navigator.userAgent;
    delete window.navigator.standalone;
    window.localStorage.clear();
  });

  it('shows the hint on iPhone Safari when the app is not installed', () => {
    setUserAgent(IPHONE_SAFARI);
    render(<InstallHint />, { wrapper: I18nProvider });

    expect(screen.getByRole('region', { name: 'Install hint' })).toHaveTextContent(
      'Add to Home Screen'
    );
  });

  it('hides the hint after it is dismissed and remembers that in localStorage', async () => {
    setUserAgent(IPHONE_SAFARI);
    const { unmount } = render(<InstallHint />, { wrapper: I18nProvider });

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));

    expect(screen.queryByRole('region', { name: 'Install hint' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBe('1');

    unmount();
    render(<InstallHint />, { wrapper: I18nProvider });
    expect(screen.queryByRole('region', { name: 'Install hint' })).not.toBeInTheDocument();
  });

  it('does not show when the app already runs from the Home Screen', () => {
    setUserAgent(IPHONE_SAFARI);
    setStandalone(true);
    render(<InstallHint />, { wrapper: I18nProvider });

    expect(screen.queryByRole('region', { name: 'Install hint' })).not.toBeInTheDocument();
  });

  it.each([
    ['Android Chrome', ANDROID_CHROME],
    ['iPhone Chrome', IPHONE_CHROME],
    ['desktop Safari', DESKTOP_SAFARI],
  ])('never shows on %s', (_name, userAgent) => {
    setUserAgent(userAgent);
    render(<InstallHint />, { wrapper: I18nProvider });

    expect(screen.queryByRole('region', { name: 'Install hint' })).not.toBeInTheDocument();
  });

  it('detects only iPhone Safari among the browsers tested', () => {
    expect(isIphoneSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIphoneSafari(IPHONE_CHROME)).toBe(false);
    expect(isIphoneSafari(ANDROID_CHROME)).toBe(false);
    expect(isIphoneSafari(DESKTOP_SAFARI)).toBe(false);
    expect(isIphoneSafari('')).toBe(false);
  });
});
