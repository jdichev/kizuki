import { useState, useCallback } from "react";

interface UseFilterStateReturn {
  unreadOnly: boolean;
  bookmarkedOnly: boolean;
  showUnreadOnly: () => void;
  showBookmarkedOnly: () => void;
  clearFilters: () => void;
}

/**
 * Custom hook to manage unread and bookmarked filters with mutual exclusivity.
 * Only one filter can be active at a time.
 */
export function useFilterState(): UseFilterStateReturn {
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState<boolean>(false);

  const showUnreadOnly = useCallback(async () => {
    const nextUnreadOnly = !unreadOnly;
    setUnreadOnly(nextUnreadOnly);
    // Disable bookmarked filter when enabling unread filter
    if (nextUnreadOnly) {
      setBookmarkedOnly(false);
    }
  }, [unreadOnly]);

  const showBookmarkedOnly = useCallback(async () => {
    const nextBookmarkedOnly = !bookmarkedOnly;
    setBookmarkedOnly(nextBookmarkedOnly);
    // Disable unread filter when enabling bookmarked filter
    if (nextBookmarkedOnly) {
      setUnreadOnly(false);
    }
  }, [bookmarkedOnly]);

  const clearFilters = useCallback(() => {
    setUnreadOnly(false);
    setBookmarkedOnly(false);
  }, []);

  return {
    unreadOnly,
    bookmarkedOnly,
    showUnreadOnly,
    showBookmarkedOnly,
    clearFilters,
  };
}
