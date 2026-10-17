import { useI18n } from '../i18n/I18nProvider.jsx';
import { OFF_HOME_URL } from '../lib/off.js';

// The credit the Open Food Facts licence (ODbL) asks for, shown wherever an Open Food Facts
// food appears. The link goes to the Open Food Facts site.
export default function OffCredit() {
  const { t } = useI18n();
  return (
    <p className="off-credit">
      {t('off.creditBefore')}{' '}
      <a href={OFF_HOME_URL} target="_blank" rel="noreferrer">
        {t('off.creditName')}
      </a>
      {t('off.creditAfter')}
    </p>
  );
}
