import { useCallback, useRef, useEffect } from "react";

export const SCROLL_DEBOUNCE_MS = 500;
export const BOTTOM_SCROLL_OFFSET = 10; // pixels from bottom before triggering load

interface UseInfiniteScrollOptions {
  onLoadMore: () => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
  debounceMs?: number;
}

/**
 * Handles scroll-based pagination.
 * Detects when user scrolls near bottom (loads more) or to top (refreshes).
 *
 * @param options - Configuration object with callbacks and debounce delay
 * @returns { handleScroll } - Scroll event handler to attach to scrollable element
 *
 * @example
 * const { handleScroll } = useInfiniteScroll({
 *   onLoadMore: () => setSize(prev => prev + 50),
 *   onRefresh: () => showItems(),
 *   debounceMs: 500,
 * });
 *
 * return <div onScroll={handleScroll}>...</div>;
 */
export const useInfiniteScroll = ({
  onLoadMore,
  onRefresh,
  debounceMs = SCROLL_DEBOUNCE_MS,
}: UseInfiniteScrollOptions) => {
  const debounceTimer = useRef<number | null>(null);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = window.setTimeout(() => {
        const scrollTarget = e.target as HTMLDivElement;

        // Check if scrolled to bottom
        const isAtBottom =
          Math.ceil(scrollTarget.scrollTop + scrollTarget.offsetHeight) >=
          scrollTarget.scrollHeight - BOTTOM_SCROLL_OFFSET;

        // Check if scrolled to top
        const isAtTop = scrollTarget.scrollTop === 0;

        if (isAtBottom) {
          onLoadMore();
        }

        if (isAtTop && onRefresh) {
          onRefresh();
        }
      }, debounceMs);
    },
    [onLoadMore, onRefresh, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return { handleScroll };
};
