import Home from '../Home.jsx';
import HouseholdPage from '../HouseholdPage.jsx';
import TargetsPage from '../TargetsPage.jsx';
import MealTimesPage from '../MealTimesPage.jsx';
import { useI18n } from '../../i18n/I18nProvider.jsx';
import { pathFor } from '../../lib/routes.js';
import LanguageSwitch from '../../i18n/LanguageSwitch.jsx';

// More: the language switch, the account, and the settings-like panels that have no tab of
// their own yet (the Settings screen, ticket 91, will replace this).
export default function MorePage({ user }) {
  const { t } = useI18n();
  return (
    <>
      <a href={pathFor('preferences')}>{t('preferences.moreLink')}</a>
      <LanguageSwitch />
      <Home user={user} />
      <HouseholdPage user={user} />
      <TargetsPage user={user} />
      <MealTimesPage user={user} />
    </>
  );
}
