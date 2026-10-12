import { useEffect, useState } from 'react';

// Re-renders the calling component every `intervalMs`, returning the current time.
// Timers are computed from timestamps, so they stay accurate even if the tab is throttled.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
