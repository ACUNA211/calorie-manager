import { ROUTES, pathFor } from '../../lib/routes.js';
import { useI18n } from '../../i18n/I18nProvider.jsx';

const ICONS = {
  today: <circle cx="12" cy="12" r="8" />,
  week: <path d="M4 6h16v14H4zM4 11h16M9 3v5M15 3v5" />,
  foods: <path d="M6 3v8a3 3 0 0 0 3 3v7M9 3v6M12 3v8a3 3 0 0 1-3 3M17 21V3c-2 1-3 4-3 8h3" />,
  pantry: <path d="M4 8l8-4 8 4v12H4zM4 8l8 4 8-4M12 12v8" />,
  recipes: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM8 4v13M11 9h5M11 13h5" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
};

// The bottom tab bar: icon plus label for each screen, the open one marked.
export default function TabBar({ current, onNavigate }) {
  const { t } = useI18n();

  return (
    <nav className="tabbar" aria-label={t('shell.navLabel')}>
      {ROUTES.map((route) => (
        <a
          key={route}
          href={pathFor(route)}
          className="tab"
          aria-current={route === current ? 'page' : undefined}
          onClick={(event) => {
            if (event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNavigate(route);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[route]}
          </svg>
          <span>{t(`shell.tabs.${route}`)}</span>
        </a>
      ))}
    </nav>
  );
}
