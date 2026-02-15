/**
 * Shared custom hooks for managing common UI patterns across components.
 * These hooks encapsulate cross-cutting concerns like loading states,
 * polling, pagination, URL synchronization, and keyboard navigation.
 */

export { useMinimumLoadingState } from "./useMinimumLoadingState";
export { useReadStatPolling, POLLING_INTERVAL_MS } from "./useReadStatPolling";
export {
  useInfiniteScroll,
  SCROLL_DEBOUNCE_MS,
  BOTTOM_SCROLL_OFFSET,
} from "./useInfiniteScroll";
export { useUrlSync } from "./useUrlSync";
export { useKeyboardNavigation } from "./useKeyboardNavigation";
