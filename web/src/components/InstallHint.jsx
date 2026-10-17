import { useState } from 'react';
import { markHintDismissed, shouldShowInstallHint } from '../lib/installHint.js';
import { useI18n } from '../i18n/I18nProvider.jsx';

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export default function InstallHint() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => {
    return shouldShowInstallHint({
      userAgent: navigator.userAgent,
      navigator,
      win: window,
      storage: getStorage(),
    });
  });

  if (!visible) return null;

  function dismiss() {
    markHintDismissed(getStorage());
    setVisible(false);
  }

  return (
    <aside role="region" aria-label={t('installHint.label')} style={styles.box}>
      <p>{t('installHint.body')}</p>
      <button type="button" onClick={dismiss}>
        {t('installHint.dismiss')}
      </button>
    </aside>
  );
}

const styles = {
  box: {
    position: 'fixed',
    left: 16,
    right: 16,
    bottom: 16,
    padding: 12,
    borderRadius: 8,
    background: '#ffffff',
    color: '#1b1b1b',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    zIndex: 1000,
  },
};
