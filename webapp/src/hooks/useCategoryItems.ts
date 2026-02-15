import { useState, useCallback } from "react";
import DataService from "../service/DataService";

export interface UseCategoryItemsOptions {
  selectedCategories: number[]; // Array for multi-category support
  requireAllCategories?: boolean; // AND vs OR logic (Phase 0 enhancement)
  filters?: {
    unreadOnly?: boolean;
    bookmarkedOnly?: boolean;
  };
  pageSize?: number;
  offset?: number; // Pagination offset (Phase 0 enhancement)
  dataService?: DataService;
}

/**
 * Generic hook for fetching items with multi-category support.
 * Handles items belonging to multiple categories with AND/OR filtering logic.
 *
 * @param options - Configuration for item fetching
 *   - selectedCategories: Array of category IDs to filter by
 *   - requireAllCategories: If true, items must be in ALL categories (AND logic)
 *   - filters: Additional filters for unread/bookmarked status
 *   - pageSize: Number of items per page
 *   - offset: Pagination offset
 *   - dataService: DataService instance (uses singleton if not provided)
 *
 * @returns { items, setItems, loading, fetchItems, hasMore }
 *   - items: Array of fetched items
 *   - setItems: Function to manually update items array
 *   - loading: Boolean indicating fetch in progress
 *   - fetchItems: Function to trigger fetch with current options
 *   - hasMore: Boolean indicating if more items are available
 *
 * @example
 * const { items, loading, fetchItems } = useCategoryItems({
 *   selectedCategories: [1001, 1002],
 *   requireAllCategories: false, // OR logic: items in ANY category
 *   filters: { unreadOnly: true },
 *   pageSize: 50,
 * });
 *
 * useEffect(() => {
 *   fetchItems();
 * }, [fetchItems]);
 */
export const useCategoryItems = ({
  selectedCategories,
  requireAllCategories = false,
  filters = {},
  pageSize = 50,
  offset = 0,
  dataService: providedDataService,
}: UseCategoryItemsOptions) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Use provided DataService or get singleton instance
  const ds = providedDataService || DataService.getInstance();

  const fetchItems = useCallback(async () => {
    // Don't fetch if no categories selected
    if (!selectedCategories || selectedCategories.length === 0) {
      setItems([]);
      setHasMore(false);
      return;
    }

    try {
      setLoading(true);

      // Note: Phase 0 will enhance getItemsDeferred to support:
      // - categoryIds (array parameter name change from selectedItemCategoryIds)
      // - requireAllCategories (AND vs OR logic)
      // - offset (pagination)
      // For now, use available API parameters
      const res = await ds.getItemsDeferred({
        size: pageSize,
        unreadOnly: filters.unreadOnly ?? false,
        bookmarkedOnly: filters.bookmarkedOnly ?? false,
        selectedItemCategoryIds: selectedCategories,
      });

      setItems(res);

      // Check if there might be more items
      setHasMore(res.length >= pageSize);
    } catch (error) {
      console.error("Error fetching items:", error);
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [selectedCategories, filters, pageSize, ds]);

  return { items, setItems, loading, fetchItems, hasMore };
};
