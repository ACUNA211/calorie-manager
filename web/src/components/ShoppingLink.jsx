import { useI18n } from '../i18n/I18nProvider.jsx';
import { pathFor } from '../lib/routes.js';

// A link to the Shopping list that moves within the app (no page reload). App's location
// hook listens to popstate, so pushing a history entry and firing it opens the screen.
export default function ShoppingLink() {
  const { t } = useI18n();
  const path = pathFor('shopping');
  return (
    <p className="shopping-link">
      <a
        href={path}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          window.history.pushState(null, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
          window.scrollTo?.(0, 0);
        }}
      >
        {t('shopping.open')}
      </a>
    </p>
  );
}
