import { useEffect, useCallback } from "react";

export const POLLING_INTERVAL_MS = 60000; // 60 seconds

/**
 * Manages periodic polling of read statistics.
 * Automatically polls at regular intervals while component is mounted.
 *
 * @param updateFn - Async function to call on each poll interval
 * @param intervalMs - Polling interval in milliseconds (default: 60s)
 *
 * @example
 * const updateStats = useCallback(async () => {
 *   const stats = await ds.getItemCategoryReadStats();
 *   setStats(stats);
 * }, []);
 *
 * useReadStatPolling(updateStats, 60000);
 */
export const useReadStatPolling = (
  updateFn: () => Promise<void>,
  intervalMs: number = POLLING_INTERVAL_MS
) => {
  useEffect(() => {
    const interval = setInterval(updateFn, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [updateFn, intervalMs]);
};
