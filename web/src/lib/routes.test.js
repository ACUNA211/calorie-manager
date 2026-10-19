import { describe, it, expect } from 'vitest';
import {
  ROUTES,
  dayFromSearch,
  pathFor,
  resolveRoute,
  routeFromPath,
  todayPathForDay,
} from './routes.js';

describe('routes', () => {
  it('has the six screens in tab order', () => {
    expect(ROUTES).toEqual(['today', 'week', 'foods', 'pantry', 'recipes', 'more']);
  });

  it('maps each route to a path and back', () => {
    for (const route of ROUTES) expect(routeFromPath(pathFor(route))).toBe(route);
  });

  it('accepts the Preferences path without making it a tab', () => {
    expect(routeFromPath('/preferences')).toBe('preferences');
    expect(ROUTES).not.toContain('preferences');
  });

  it('ignores a trailing slash', () => {
    expect(routeFromPath('/week/')).toBe('week');
  });

  it('returns null for the root and for unknown paths', () => {
    expect(routeFromPath('/')).toBeNull();
    expect(routeFromPath('/nope')).toBeNull();
    expect(routeFromPath('/week/extra')).toBeNull();
    expect(routeFromPath(undefined)).toBeNull();
  });

  it('falls back to Today for the root and unknown paths', () => {
    expect(resolveRoute('/')).toBe('today');
    expect(resolveRoute('/nope')).toBe('today');
    expect(resolveRoute('/pantry')).toBe('pantry');
  });

  it('reads a valid ?day= and ignores bad ones', () => {
    expect(dayFromSearch('?day=2026-10-18')).toBe('2026-10-18');
    expect(dayFromSearch('?day=2026-02-30')).toBeNull();
    expect(dayFromSearch('?day=tomorrow')).toBeNull();
    expect(dayFromSearch('')).toBeNull();
    expect(dayFromSearch('?invite=abc')).toBeNull();
  });

  it('builds the Today path for a day', () => {
    const path = todayPathForDay('2026-10-18');
    expect(path).toBe('/today?day=2026-10-18');
    expect(dayFromSearch(path.slice(path.indexOf('?')))).toBe('2026-10-18');
  });
});
