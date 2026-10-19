import { useState } from 'react';
import HouseholdPage from '../HouseholdPage.jsx';
import TargetsPage from '../TargetsPage.jsx';
import MealTimesPage from '../MealTimesPage.jsx';
import NotificationsSetting from '../NotificationsSetting.jsx';
import LanguageSwitch from '../../i18n/LanguageSwitch.jsx';
import { supabase } from '../../lib/supabase.js';
import { useActingMember } from '../../lib/actingMember.jsx';
import { pathFor } from '../../lib/routes.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

// Settings (the "More" tab): everything that is set once and rarely changed. A list of
// sections; picking one opens it as a sub-page with a Back link. Weight entry stays on Week
// (ticket 91 decision: it is a repeated weigh-in tied to the week being viewed).
// Panels keep their own saving; this only groups them.

// Sections that open a sub-page in place.
const SUB_PAGES = [
  { id: 'household', Page: HouseholdPage },
  { id: 'targets', Page: TargetsPage },
  { id: 'mealTimes', Page: MealTimesPage },
];

// Sections that open their own screen. 'intake' is added by ticket 64.
const LINKS = ['plan', 'preferences', 'intake'];

export default function MorePage({ user, onNavigate }) {
  const { t } = useI18n();
  const { householdState } = useActingMember();
  const [section, setSection] = useState(null);

  const link = (route, content, className) => (
    <a
      href={pathFor(route)}
      className={className}
      onClick={(event) => {
        if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        onNavigate(route);
      }}
    >
      {content}
    </a>
  );

  const account = (
    <section aria-labelledby="settings-account">
      <h2 className="eyebrow" id="settings-account">
        {t('settings.account')}
      </h2>
      <p>{t('settings.signedInAs', { email: user.email })}</p>
      <button type="button" onClick={() => supabase.auth.signOut()}>
        {t('settings.signOut')}
      </button>
    </section>
  );

  const language = (
    <section aria-label={t('settings.language')}>
      <h2 className="eyebrow">{t('settings.language')}</h2>
      <LanguageSwitch />
    </section>
  );

  // No Household yet: open on "Create a Household" (HouseholdPage shows its create form).
  if (householdState === 'none') {
    return (
      <>
        <h1>{t('settings.createHousehold')}</h1>
        <p className="mute">{t('settings.createHouseholdHint')}</p>
        <HouseholdPage user={user} />
        {language}
        {account}
      </>
    );
  }

  const open = SUB_PAGES.find((page) => page.id === section);
  if (open) {
    return (
      <>
        <button type="button" className="btn-quiet" onClick={() => setSection(null)}>
          {t('settings.back')}
        </button>
        <h1>{t(`settings.${open.id}`)}</h1>
        <open.Page user={user} />
      </>
    );
  }

  return (
    <>
      <h1>{t('settings.heading')}</h1>
      <nav aria-label={t('settings.sections')}>
        <ul className="rows">
          {SUB_PAGES.map(({ id }) => (
            <li key={id}>
              <button type="button" className="row-button" onClick={() => setSection(id)}>
                {t(`settings.${id}`)}
                <span className="mute small"> {t(`settings.${id}Hint`)}</span>
              </button>
            </li>
          ))}
          {LINKS.map((route) => (
            <li key={route}>
              {link(
                route,
                <>
                  {t(`settings.${route}`)}
                  <span className="mute small"> {t(`settings.${route}Hint`)}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </nav>
      {/* Notifications: Web Push on this device (ticket 54); reminder choices come with ticket 56. */}
      <section aria-labelledby="settings-notifications">
        <h2 className="eyebrow" id="settings-notifications">
          {t('settings.notifications')}
        </h2>
        <NotificationsSetting />
      </section>
      {language}
      {account}
    </>
  );
}
