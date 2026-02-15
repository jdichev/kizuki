import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Manages loading state with a minimum display duration.
 * Ensures loading indicators don't flash too briefly.
 *
 * @param minDisplayMs - Minimum milliseconds to display loading state
 * @returns [loading state, { startLoading, stopLoading }]
 *
 * @example
 * const [loading, { startLoading, stopLoading }] = useMinimumLoadingState(500);
 *
 * const fetchData = async () => {
 *   startLoading();
 *   try {
 *     const data = await api.fetch();
 *     setData(data);
 *   } finally {
 *     stopLoading(); // Won't hide loading state for at least 500ms
 *   }
 * };
 */
export const useMinimumLoadingState = (minDisplayMs: number = 500) => {
  const [loading, setLoading] = useState(false);
  const loadingStartedAt = useRef<number | null>(null);
  const loadingHideTimer = useRef<number | null>(null);

  const startLoading = useCallback(() => {
    setLoading(true);
    loadingStartedAt.current = performance.now();
  }, []);

  const stopLoading = useCallback(() => {
    if (loadingHideTimer.current) {
      clearTimeout(loadingHideTimer.current);
      loadingHideTimer.current = null;
    }

    if (loadingStartedAt.current !== null) {
      const elapsed = performance.now() - loadingStartedAt.current;
      const remaining = Math.max(0, minDisplayMs - elapsed);

      loadingHideTimer.current = window.setTimeout(() => {
        setLoading(false);
        loadingStartedAt.current = null;
        loadingHideTimer.current = null;
      }, remaining);
    } else {
      setLoading(false);
    }
  }, [minDisplayMs]);

  useEffect(() => {
    return () => {
      if (loadingHideTimer.current) {
        clearTimeout(loadingHideTimer.current);
      }
    };
  }, []);

  return [loading, { startLoading, stopLoading }] as const;
};
