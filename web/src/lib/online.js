// Whether the phone says it has a connection, and a hook that follows it. navigator.onLine
// can say "online" on a network with no route out (or "offline" when it is wrong), so the
// logging code also treats a failed request as "no connection"; this only decides what to
// show and when to try sending.
import { useEffect, useState } from 'react';

export function isOnline(nav = globalThis.navigator) {
  return nav?.onLine !== false;
}

// True while the browser reports a connection; updates on the window's online and offline events.
export function useOnline() {
  const [online, setOnline] = useState(() => isOnline());
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
