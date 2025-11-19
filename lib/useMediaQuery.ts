"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook using useSyncExternalStore (React 18).
 * - No hydration warnings (server falls back to defaultValue).
 * - Subscribes to matchMedia changes efficiently.
 * - Works with any custom query string.
 *
 * @param query        CSS media query string (e.g., "(max-width: 639px)")
 * @param defaultValue Value to use on the server (default: false)
 */
export default function useMediaQuery(query: string, defaultValue = false): boolean {
  // Create stable subscribe/getter functions when `query` changes.
  const subscribe = useMemo(() => {
    return (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      // Modern API
      mql.addEventListener?.("change", onStoreChange);
      // Fallback for older browsers (just in case)
      // @ts-ignore
      mql.addListener?.(onStoreChange);
      return () => {
        mql.removeEventListener?.("change", onStoreChange);
        // @ts-ignore
        mql.removeListener?.(onStoreChange);
      };
    };
  }, [query]);

  const getSnapshot = useMemo(() => {
    return () =>
      typeof window !== "undefined" ? window.matchMedia(query).matches : defaultValue;
  }, [query, defaultValue]);

  const getServerSnapshot = useMemo(() => {
    return () => defaultValue;
  }, [defaultValue]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ------------------------------------------------------------------ */
/* Optional: Tailwind-aligned helpers                                  */
/* Update to match your tailwind.config.js if customized.               */
/* ------------------------------------------------------------------ */
export const screens = {
  // Tailwind base (sm = 640px)
  smMax: "(max-width: 639px)",
  smUp: "(min-width: 640px)",
  mdUp: "(min-width: 768px)",
  lgUp: "(min-width: 1024px)",
  xlUp: "(min-width: 1280px)",
  "2xlUp": "(min-width: 1536px)",
};

/** Convenience hook for common checks */
export function useBreakpoints() {
  const isSm = useMediaQuery(screens.smMax);
  const isMdUp = useMediaQuery(screens.mdUp);
  const isLgUp = useMediaQuery(screens.lgUp);
  const isXlUp = useMediaQuery(screens.xlUp);
  return { isSm, isMdUp, isLgUp, isXlUp };
}
