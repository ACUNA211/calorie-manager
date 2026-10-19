// The app's screens and how they map to URL paths. Pure, so it can be tested without a browser.

export const ROUTES = ['today', 'week', 'foods', 'pantry', 'recipes', 'more'];
// Screens with a path but no tab (opened from More).
export const EXTRA_ROUTES = ['plan', 'preferences', 'intake'];
export const DEFAULT_ROUTE = 'today';

export function pathFor(route) {
  return `/${route}`;
}

// The route a path belongs to, or null for "/" and unknown paths. A trailing slash is ignored.
export function routeFromPath(pathname) {
  const name = String(pathname ?? '').replace(/^\/+|\/+$/g, '');
  return ROUTES.includes(name) || EXTRA_ROUTES.includes(name) ? name : null;
}

// The route to show for a path: unknown paths fall back to Today.
export function resolveRoute(pathname) {
  return routeFromPath(pathname) ?? DEFAULT_ROUTE;
}

// Today can open on a given day: /today?day=2026-10-18. Anything that is not a real date is ignored.
export function dayFromSearch(search) {
  const value = new URLSearchParams(search ?? '').get('day');
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

export function todayPathForDay(dayKey) {
  return `${pathFor('today')}?day=${dayKey}`;
}
