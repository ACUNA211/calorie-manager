import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, useI18n } from './I18nProvider.jsx';
import LanguageSwitch from './LanguageSwitch.jsx';
import { LOCALE_KEY } from './locale.js';

// Shows the active language and one translated string, so the tests can read the result.
function Probe() {
  const { locale, t, formatDate } = useI18n();
  return (
    <p>
      {locale} | {t('home.signOut')} | {formatDate(new Date(2025, 9, 17))}
    </p>
  );
}

function setBrowserLanguages(languages) {
  Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true });
}

describe('I18nProvider and LanguageSwitch', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    delete window.navigator.languages;
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses the browser language when nothing is remembered', () => {
    setBrowserLanguages(['es-MX', 'en-US']);
    render(<Probe />, { wrapper: I18nProvider });

    expect(screen.getByText(/^es \|/)).toHaveTextContent('es | Cerrar sesión | vie, 17 oct');
    expect(document.documentElement.lang).toBe('es');
  });

  it('switches every string to the other language without reloading the page', async () => {
    setBrowserLanguages(['en-US']);
    render(
      <>
        <LanguageSwitch />
        <Probe />
      </>,
      { wrapper: I18nProvider }
    );

    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/^en \|/)).toHaveTextContent('en | Sign out | Fri, Oct 17');

    await userEvent.click(screen.getByRole('button', { name: 'Español' }));

    expect(screen.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/^es \|/)).toHaveTextContent('es | Cerrar sesión | vie, 17 oct');
    expect(document.documentElement.lang).toBe('es');
  });

  it('remembers the choice in localStorage and uses it on the next visit', async () => {
    setBrowserLanguages(['en-US']);
    const { unmount } = render(
      <>
        <LanguageSwitch />
        <Probe />
      </>,
      { wrapper: I18nProvider }
    );

    await userEvent.click(screen.getByRole('button', { name: 'Español' }));
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe('es');

    unmount();
    render(<Probe />, { wrapper: I18nProvider });
    expect(screen.getByText(/^es \|/)).toBeInTheDocument();
  });

  it('still switches language when localStorage is blocked', async () => {
    setBrowserLanguages(['en-US']);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    render(
      <>
        <LanguageSwitch />
        <Probe />
      </>,
      { wrapper: I18nProvider }
    );
    await userEvent.click(screen.getByRole('button', { name: 'Español' }));

    expect(screen.getByText(/^es \|/)).toBeInTheDocument();
  });
});
