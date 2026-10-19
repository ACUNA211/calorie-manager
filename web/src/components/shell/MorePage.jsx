import Home from '../Home.jsx';
import HouseholdPage from '../HouseholdPage.jsx';
import TargetsPage from '../TargetsPage.jsx';
import MealTimesPage from '../MealTimesPage.jsx';
import LanguageSwitch from '../../i18n/LanguageSwitch.jsx';

// More: the language switch, the account, and the settings-like panels that have no tab of
// their own yet (the Settings screen, ticket 91, will replace this).
export default function MorePage({ user }) {
  return (
    <>
      <LanguageSwitch />
      <Home user={user} />
      <HouseholdPage user={user} />
      <TargetsPage user={user} />
      <MealTimesPage user={user} />
    </>
  );
}
