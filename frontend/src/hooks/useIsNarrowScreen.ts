import { useSyncExternalStore } from 'react';

// Below the "sm" breakpoint of styles/tokens.css.
const QUERY = '(max-width: 479px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

/** True on phone-sized screens, where charts have room for fewer labels. */
export function useIsNarrowScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  );
}
