import { LOCALES } from './locale.js';
import { useI18n } from './I18nProvider.jsx';

// Switches every visible string at once; no reload needed.
export default function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div role="group" aria-label={t('language.label')} style={styles.group}>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={code === locale}
          onClick={() => setLocale(code)}
        >
          {t(`language.names.${code}`)}
        </button>
      ))}
    </div>
  );
}

const styles = {
  group: { display: 'flex', gap: 8, justifyContent: 'flex-end', padding: 8 },
};
