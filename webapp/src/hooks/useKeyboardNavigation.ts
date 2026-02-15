import { useEffect } from "react";
import { KEYBOARD_SHORTCUTS } from "../config/navigationConfig";

interface KeyboardHandlers {
  NEXT?: () => void | Promise<void>;
  PREV?: () => void | Promise<void>;
  LEFT?: () => void | Promise<void>;
  RIGHT?: () => void | Promise<void>;
  OPEN?: () => void | Promise<void>;
  TOGGLE_UNREAD?: () => void | Promise<void>;
  MARK_READ?: () => void | Promise<void>;
}

/**
 * Handles keyboard navigation with configurable shortcuts.
 * Provides a centralized way to bind keyboard handlers with consistent shortcuts.
 *
 * @param handlers - Object mapping action names to handler functions
 *
 * @example
 * useKeyboardNavigation({
 *   NEXT: () => selectNextItem(),
 *   PREV: () => selectPreviousItem(),
 *   OPEN: () => visitSite(),
 *   MARK_READ: async () => {
 *     await markAllRead();
 *     setArticle(undefined);
 *   },
 * });
 */
export const useKeyboardNavigation = (handlers: KeyboardHandlers) => {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Create a reverse mapping: keystroke → action name
      const keyToAction: Record<string, string> = {};

      Object.entries(KEYBOARD_SHORTCUTS).forEach(([action, keys]) => {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        keyArray.forEach((key) => {
          keyToAction[key] = action;
        });
      });

      const action = keyToAction[e.code];

      if (action && handlers[action as keyof KeyboardHandlers]) {
        e.preventDefault();
        const handler = handlers[action as keyof KeyboardHandlers];
        if (handler) {
          await handler();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlers]);
};
