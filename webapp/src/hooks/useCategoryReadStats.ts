import { useState, useCallback } from "react";

export interface UseCategoryReadStatsOptions {
  statsFetcher: () => Promise<ItemCategoryReadStat[]>;
  onError?: (error: Error) => void;
}

/**
 * Generic hook for tracking category read statistics.
 * Fetches and caches read/unread counts for categories.
 * Typically used with periodic polling via useReadStatPolling.
 *
 * @param options - Configuration for stats fetching
 *   - statsFetcher: Async function that returns ItemCategoryReadStat array
 *   - onError: Optional error handler callback
 *
 * @returns { stats, setStats, updateStats, lastUpdated, isLoading, isStale, getUnreadCount, getTotalUnreadCount, getStatForCategory }
 *   - stats: Array of category read statistics
 *   - setStats: Function to manually set stats
 *   - updateStats: Function to trigger stats update via fetcher
 *   - lastUpdated: Timestamp of last successful fetch
 *   - isLoading: Boolean indicating fetch in progress
 *   - isStale: Boolean indicating if stats need refresh (> 5 minutes old)
 *   - getUnreadCount: Get unread count for a specific category
 *   - getTotalUnreadCount: Get total unread count across all categories
 *   - getStatForCategory: Get complete stat object for a category
 *
 * @example
 * const ds = DataService.getInstance();
 * const { stats, updateStats } = useCategoryReadStats({
 *   statsFetcher: () => ds.getItemCategoryReadStats(),
 * });
 *
 * // Manually update stats
 * const handleMarkAsRead = useCallback(async () => {
 *   await markItemsAsRead(selectedItems);
 *   await updateStats(); // Refresh stats after mark
 * }, []);
 *
 * // Or use with useReadStatPolling for automatic updates
 * useReadStatPolling(updateStats, 60000);
 */
export const useCategoryReadStats = ({
  statsFetcher,
  onError,
}: UseCategoryReadStatsOptions) => {
  const [stats, setStats] = useState<ItemCategoryReadStat[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isStale = useCallback(() => {
    if (!lastUpdated) return true;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return lastUpdated < fiveMinutesAgo;
  }, [lastUpdated]);

  const updateStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const newStats = await statsFetcher();
      setStats(newStats);
      setLastUpdated(Date.now());
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Error fetching category read stats:", err);
      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [statsFetcher, onError]);

  /**
   * Get unread count for a specific category
   */
  const getUnreadCount = useCallback(
    (categoryId: number): number => {
      const stat = stats.find((s) => s.id === categoryId);
      return stat?.unreadCount ?? 0;
    },
    [stats]
  );

  /**
   * Get total unread count across all categories
   */
  const getTotalUnreadCount = useCallback((): number => {
    return stats.reduce((sum, stat) => sum + stat.unreadCount, 0);
  }, [stats]);

  /**
   * Get stats for a specific category
   */
  const getStatForCategory = useCallback(
    (categoryId: number): ItemCategoryReadStat | undefined => {
      return stats.find((s) => s.id === categoryId);
    },
    [stats]
  );

  return {
    stats,
    setStats,
    updateStats,
    lastUpdated,
    isLoading,
    isStale: isStale(),
    getUnreadCount,
    getTotalUnreadCount,
    getStatForCategory,
  };
};
