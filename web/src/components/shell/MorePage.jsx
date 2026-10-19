import Home from '../Home.jsx';
import HouseholdPage from '../HouseholdPage.jsx';
import TargetsPage from '../TargetsPage.jsx';
import MealTimesPage from '../MealTimesPage.jsx';
import LanguageSwitch from '../../i18n/LanguageSwitch.jsx';
import { pathFor } from '../../lib/routes.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

// More: the language switch, the account, and the settings-like panels that have no tab of
// their own yet (the Settings screen, ticket 91, will replace this).
export default function MorePage({ user, onNavigate }) {
  const { t } = useI18n();
  const link = (route, label) => (
    <a
      href={pathFor(route)}
      onClick={(event) => {
        if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onNavigate(route);
      }}
    >
      {label}
    </a>
  );
  return (
    <>
      {link('plan', t('plan.openLink'))}
      {link('preferences', t('preferences.moreLink'))}
      <LanguageSwitch />
      <Home user={user} />
      <HouseholdPage user={user} />
      <TargetsPage user={user} />
      <MealTimesPage user={user} />
    </>
  );
}
