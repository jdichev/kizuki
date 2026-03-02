export const ITEM_CATEGORY_RANGES = [
  { min: 100, max: 199, title: "AI & Data Science" },
  { min: 200, max: 299, title: "Software Engineering" },
  { min: 300, max: 499, title: "Infrastructure & Security" },
  { min: 500, max: 699, title: "Hardware & Consumer Tech" },
  { min: 1, max: 99, title: "General News & Lifestyle" },
];

export const MODE_ITEMS = [
  { title: "Feed Categories", value: "feed-categories" },
  { title: "Item Categories (AI)", value: "item-categories" },
] as const;
