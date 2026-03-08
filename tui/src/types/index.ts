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
  // Feed-level override: null/undefined means inherit category setting.
  autoSummarize?: number | null;
  effectiveAutoSummarize?: number;
}

export interface FeedCategory {
  id?: number;
  title: string;
  text?: string;
  expanded?: boolean;
  autoSummarize?: number;
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

export interface Item {
  id: number;
  title: string;
  read: 0 | 1 | number;
  bookmarked?: 0 | 1 | number;
  published: number;
  created?: number;
  feedTitle?: string;
  categoryTitle?: string;
  url?: string;
  comments?: string;
  feedId?: number;
  feedCategoryId?: number;
  effectiveAutoSummarize?: number;
  itemCategoryId?: number;
  latestContentWordCount?: number;
  jsonContent?: {
    "yt-id"?: string;
  };
  content?: string;
  latest_content?: string;
  summary?: string;
}

// TUI Specific Navigation Types
export type View =
  | "help"
  | "start"
  | "categories"
  | "items"
  | "reader"
  | "confirm-mark-read"
  | "confirm-exit";

export interface CategoryEntry {
  id: number | string;
  title: string;
  isHeader?: false;
  unreadCount?: number;
}

export interface CategoryHeader {
  id?: string;
  title: string;
  isHeader: true;
}

export type CategoriesEntry = CategoryEntry | CategoryHeader;

export interface UseTuiNavigationResult {
  terminalHeight: number;
  terminalWidth: number;
  view: View;
  groupingMode: GroupingMode;
  categories: CategoriesEntry[];
  items: Item[];
  selectedItem: Item | null;
  selectedCategory: CategoryEntry | null;
  activeIndex: number;
  scrollOffset: number;
  loading: boolean;
  contentHeight: number;
  listVisibleHeight: number;
  readerSplitEnabled: boolean;
  readerLatestContent: string | null;
  readerLatestLoading: boolean;
  readerLatestError: string | null;
  readerSummary: string | null;
  readerSummaryLoading: boolean;
  readerSummaryError: string | null;
  readerSummaryPending: boolean;
  unreadOnly: boolean;
  bookmarkedOnly: boolean;
  setView: (nextView: View) => void;
  toggleItemBookmark: (item: Item) => void;
  handleToggleBookmarkedOnly: () => void;
  handleToggleUnreadOnly: () => void;
  handleSummarize: (itemOverride?: Item) => Promise<void>;
  };

