import { useCallback, useEffect, useState } from 'react';

function read() {
  return { pathname: window.location.pathname, search: window.location.search };
}

// A tiny history-based router: the current path and query, and a navigate() that pushes a new
// history entry (or replaces the current one). The back button and reload work because the
// URL is the source of truth.
export function useLocation() {
  const [location, setLocation] = useState(read);

  useEffect(() => {
    const onChange = () => setLocation(read());
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (replace) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
    setLocation(read());
    window.scrollTo?.(0, 0);
  }, []);

  return { ...location, navigate };
}
