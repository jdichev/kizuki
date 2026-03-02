export interface Feed {
  id?: number;
  title: string;
  url: string;
  feedUrl: string;
  feedType?: string;
  error?: number;
  itemsCount?: number;
  feedCategoryId?: number;
  categoryTitle?: string;
  hidden?: boolean;
  updateFrequency?: number;
}

export interface FeedCategory {
  id?: number;
  title: string;
  text?: string;
  expanded?: boolean;
}

export interface FeedReadStat {
  id: number;
  tile: string;
  unreadCount: number;
}

export interface FeedCategoryReadStat {
  id: number;
  title: string;
  unreadCount: number;
}

export interface ItemCategory {
  id?: number;
  title: string;
  text?: string;
  expanded?: boolean;
}

export interface ItemCategoryReadStat {
  id: number;
  title: string;
  unreadCount: number;
}

export type GroupingMode = "feed-categories" | "item-categories";

export type View =
  | "start"
  | "sidebar"
  | "items"
  | "reader"
  | "confirm-mark-read"
  | "confirm-exit";

export type AllCategory = {
  id: -1;
  title: "All";
};

export type SidebarHeader = {
  id: string;
  title: string;
  isHeader: true;
};

export type SidebarCategory = (FeedCategory | ItemCategory | AllCategory) & {
  isHeader?: false;
};

export type SidebarEntry = SidebarHeader | SidebarCategory;

export interface Item {
  id?: number;
  title: string;
  read: 0 | 1 | number;
  bookmarked?: 0 | 1 | number;
  latestContentWordCount?: number;
  published: number;
  created?: number;
  feedTitle?: string;
  categoryTitle?: string;
  url?: string;
  comments?: string;
  feedId?: number;
  feedCategoryId?: number;
  itemCategoryId?: number;
  jsonContent?: {
    "yt-id"?: string;
  };
  content?: string;
  latest_content?: string;
}

export type UseTuiNavigationResult = {
  terminalHeight: number;
  terminalWidth: number;
  view: View;
  groupingMode: GroupingMode;
  categories: SidebarEntry[];
  items: Item[];
  selectedItem: Item | null;
  selectedCategory: SidebarCategory | null;
  activeIndex: number;
  scrollOffset: number;
  loading: boolean;
  contentHeight: number;
  listVisibleHeight: number;
};
