import LoggingForSwitch from '../LoggingForSwitch.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';

// The top bar: the open screen's title and the "Logging for" picker.
export default function TopBar({ route }) {
  const { t } = useI18n();

  return (
    <header className="topbar">
      <p className="topbar-title">{t(`shell.tabs.${route}`)}</p>
      <LoggingForSwitch />
    </header>
  );
}
