import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Generic URL parameter synchronization hook.
 * Manages reading and writing URL search parameters.
 *
 * @param location - Result from useLocation()
 * @param navigate - Result from useNavigate()
 * @returns { updateUrl, readParams } - Methods to sync URL state
 *
 * @example
 * const location = useLocation();
 * const navigate = useNavigate();
 * const { updateUrl, readParams } = useUrlSync(location, navigate);
 *
 * // Read current parameters
 * const { category } = readParams(['category']);
 *
 * // Update URL with new parameters
 * updateUrl([{ key: 'category', value: 123 }]);
 *
 * // Clear a parameter
 * updateUrl([{ key: 'category' }]);
 */
export const useUrlSync = (
  location: ReturnType<typeof useLocation>,
  navigate: ReturnType<typeof useNavigate>
) => {
  const updateUrl = useCallback(
    (updates: { key: string; value?: number | string }[]) => {
      const params = new URLSearchParams(location.search);

      updates.forEach(({ key, value }) => {
        if (value !== undefined) {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
      });

      const search = params.toString();
      const nextUrl = `${location.pathname}${search ? `?${search}` : ""}`;
      const currentUrl = `${location.pathname}${location.search}`;

      if (nextUrl !== currentUrl) {
        navigate(nextUrl, { replace: true });
      }
    },
    [location.pathname, location.search, navigate]
  );

  const readParams = useCallback(
    (keys: string[]): Record<string, string | null> => {
      const params = new URLSearchParams(location.search);
      return Object.fromEntries(keys.map((key) => [key, params.get(key)]));
    },
    [location.search]
  );

  return { updateUrl, readParams };
};
