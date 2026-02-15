/**
 * Organizes flat ItemCategory array into semantic 2-level hierarchies
 * based on ID ranges defined in the database seed data
 */

export interface ParentCategory {
  id: number; // Negative IDs for synthetic parent categories
  title: string;
  description: string;
  expanded?: boolean;
}

export interface CategoryHierarchy {
  parentCategories: ParentCategory[];
  childrenByParent: Map<number, ItemCategory[]>;
}

/**
 * ID range mappings corresponding to database seed data
 * Parent categories use negative IDs: -1, -2, -3, etc.
 * Allows extensibility for new parent categories
 *
 * Note: Object.entries() preserves insertion order, so "Uncategorized" appears last
 */
export const CATEGORY_RANGES: Record<
  string,
  { id: number; min: number; max: number; title: string; description: string }
> = {
  "1-99": {
    id: -2,
    min: 1,
    max: 99,
    title: "General News & Lifestyle",
    description:
      "News, politics, business, science, health, sports, entertainment, and lifestyle",
  },
  "100-199": {
    id: -3,
    min: 100,
    max: 199,
    title: "AI & Data Science",
    description:
      "Artificial intelligence, machine learning, generative AI, and data engineering",
  },
  "200-299": {
    id: -4,
    min: 200,
    max: 299,
    title: "Software Engineering",
    description:
      "Software development, web, mobile, DevOps, game development, and open source",
  },
  "300-499": {
    id: -5,
    min: 300,
    max: 499,
    title: "Infrastructure & Security",
    description:
      "Cloud computing, networking, blockchain, cybersecurity, and cryptography",
  },
  "500-699": {
    id: -6,
    min: 500,
    max: 699,
    title: "Hardware & Consumer Tech",
    description:
      "Semiconductors, robotics, AR/VR, wearables, and space technology",
  },
  uncategorized: {
    id: -1,
    min: 0,
    max: 0,
    title: "Uncategorized",
    description: "Items without a specific category",
  },
};

/**
 * Transforms flat ItemCategory array into 2-level hierarchy
 * Sorts by ID within each group instead of alphabetically by title
 * Parent categories are created as real categories with negative IDs
 *
 * @param categories - Flat array of ItemCategories from the database
 * @returns CategoryHierarchy with parent categories and grouped children
 */
export const buildCategoryHierarchy = (
  categories: ItemCategory[]
): CategoryHierarchy => {
  const parentCategories: ParentCategory[] = [];
  const childrenByParent = new Map<number, ItemCategory[]>();

  // Sort categories by ID before grouping
  const sortedCategories = [...categories]
    .filter((cat) => cat.id !== undefined)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  // Initialize parent categories and groupings based on defined ranges
  Object.entries(CATEGORY_RANGES).forEach(
    ([rangeKey, { id, min, max, title, description }]) => {
      parentCategories.push({
        id,
        title,
        description,
        expanded: false, // Start collapsed by default
      });

      // Filter categories that fall within this range
      const childrenInRange = sortedCategories.filter(
        (cat) => (cat.id ?? 0) >= min && (cat.id ?? 0) <= max
      );

      if (childrenInRange.length > 0) {
        childrenByParent.set(id, childrenInRange);
      }
    }
  );

  return { parentCategories, childrenByParent };
};

/**
 * Flattens hierarchy back to single array for backward compatibility
 * Useful when the component needs to pass all categories to child components
 *
 * @param hierarchy - CategoryHierarchy with parent and child mappings
 * @returns Flat array of all ItemCategories in ID order
 */
export const flattenCategoryHierarchy = (
  hierarchy: CategoryHierarchy
): ItemCategory[] => {
  const flattened: ItemCategory[] = [];

  // Iterate through parent categories in order to maintain ID-based ordering
  hierarchy.parentCategories.forEach((parent) => {
    const children = hierarchy.childrenByParent.get(parent.id);
    if (children) {
      flattened.push(...children);
    }
  });

  return flattened;
};

/**
 * Find which parent range a category ID falls into
 * Returns the parent ID (negative number) or undefined if not found
 *
 * @param categoryId - The ItemCategory ID to find
 * @returns Parent category ID or undefined
 */
export const getParentRangeForCategoryId = (
  categoryId: number | undefined
): number | undefined => {
  if (categoryId === undefined) return undefined;
  return Object.values(CATEGORY_RANGES).find(
    ({ min, max }) => categoryId >= min && categoryId <= max
  )?.id;
};

/**
 * Get all categories within a specific parent
 * Useful for expanding/collapsing a parent and showing its children
 *
 * @param hierarchy - The CategoryHierarchy
 * @param parentId - The parent category ID (negative number)
 * @returns Array of ItemCategories in that parent
 */
export const getCategoriesForParent = (
  hierarchy: CategoryHierarchy,
  parentId: number
): ItemCategory[] => {
  return hierarchy.childrenByParent.get(parentId) || [];
};

/**
 * Check if a parent category has any unread items
 * Used for displaying unread counts at the group level
 *
 * @param parentId - The parent category ID (negative number)
 * @param stats - Array of ItemCategoryReadStats
 * @returns Total unread count for this parent's children
 */
export const getUnreadCountForParent = (
  parentId: number,
  stats: ItemCategoryReadStat[]
): number => {
  const range = Object.values(CATEGORY_RANGES).find((r) => r.id === parentId);
  if (!range) return 0;

  const { min, max } = range;
  return stats
    .filter((stat) => stat.id >= min && stat.id <= max)
    .reduce((sum, stat) => sum + stat.unreadCount, 0);
};
