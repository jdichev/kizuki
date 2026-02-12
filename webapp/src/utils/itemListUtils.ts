/**
 * Utility functions for managing item lists with filter state
 */

/**
 * Ensures a selected item remains in the list when a filter is active.
 * If unreadOnly is enabled and selectedItem is not in the current items list,
 * inserts it at its natural chronological position (based on published timestamp).
 * This prevents the selected item from disappearing when filters are applied.
 *
 * @param items - Current items array from the server
 * @param selectedItem - Currently selected item to preserve
 * @param unreadOnly - Whether the unread-only filter is active
 * @returns Items array with selectedItem inserted if needed
 */
export function ensureSelectedItemInList(
  items: Item[],
  selectedItem: Item | undefined,
  unreadOnly: boolean
): Item[] {
  // Only apply logic if unreadOnly filter is active and we have a selected item
  if (!unreadOnly || !selectedItem) {
    return items;
  }

  // Check if selectedItem is already in the list
  if (items.find((item) => item.id === selectedItem.id)) {
    return items;
  }

  // Insert selectedItem at its natural position based on published timestamp (DESC order)
  const insertIndex = items.findIndex(
    (item) => item.published < selectedItem.published
  );

  if (insertIndex === -1) {
    // Selected item is older than all items in list, add to end
    items.push(selectedItem);
  } else {
    // Insert at correct position to maintain DESC order
    items.splice(insertIndex, 0, selectedItem);
  }

  return items;
}
