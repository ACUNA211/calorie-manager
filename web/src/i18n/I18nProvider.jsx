import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LOCALES, pickInitialLocale, storeLocale, translate } from './locale.js';
import { formatDate, formatNumber, DATE_SHORT } from './format.js';

const I18nContext = createContext(null);

function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getBrowserLanguages() {
  const { languages, language } = window.navigator;
  if (Array.isArray(languages) && languages.length > 0) return languages;
  return language ? [language] : [];
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() =>
    pickInitialLocale(getBrowserStorage(), getBrowserLanguages())
  );

  // Screen readers and hyphenation follow the page language.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // TODO(ticket 05+): store the choice on the Member (a preferred_locale column) so it
  // follows them across devices. Until then the browser remembers it on this device.
  const setLocale = useCallback((next) => {
    if (!LOCALES.includes(next)) return;
    storeLocale(getBrowserStorage(), next);
    setLocaleState(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      formatDate: (date, options = DATE_SHORT) => formatDate(date, locale, options),
      formatNumber: (number, options) => formatNumber(number, locale, options),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
