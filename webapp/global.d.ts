// Data types

interface Feed {
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

interface FeedCategory {
  id?: number;
  title: string;
  text?: string;
  expanded?: boolean;
}

interface FeedReadStat {
  id: number;
  tile: string;
  unreadCount: number;
}

interface FeedCategoryReadStat {
  id: number;
  title: string;
  unreadCount: number;
}

interface ItemCategory {
  id?: number;
  title: string;
  text?: string;
  expanded?: boolean;
}

interface ItemCategoryReadStat {
  id: number;
  title: string;
  unreadCount: number;
}

type GroupingMode = "feed-categories" | "item-categories";

interface Item {
  id?: number;
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
  jsonContent?: {
    "yt-id"?: string;
  };
  content?: string;
}

// Components

interface HomeProps {
  topMenu: React.RefObject<HTMLDivElement | null>;
  topOptions?: React.RefObject<HTMLDivElement | null>;
}

interface ArticleProps {
  article?: Item;
  selectedFeedCategory?: FeedCategory;
  selectedFeed?: Feed;
  selectedItemCategory?: ItemCategory;
  topOptions?: React.RefObject<HTMLDivElement | null>;
}

interface ItemsTableProps {
  items: Item[];
  selectedItem: Item | undefined;
  selectItem: (
    e:
      | MouseEvent<HTMLAnchorElement, MouseEvent>
      | FocusEvent<HTMLAnchorElement, MouseEvent>,
    item: Item
  ) => void;
}

interface FormattedDateProps {
  pubDate: number;
}

interface FeedsProps {
  topMenu: React.RefObject<HTMLDivElement | null>;
}

interface FeedsTableProps {
  feeds: Feed[];
  removeFeed: (feedId: number) => void;
  sortField: "name" | "items" | null;
  sortDirection: "asc" | "desc";
  onSort: (field: "name" | "items") => void;
}

interface CategoriesMainProps {
  activeNav: string;
  feedCategories: FeedCategory[];
  categoryFeeds: {
    [key: string]: FeedCategory[];
  };
  selectedFeedCategory: FeedCategory | undefined;
  selectFeedCategory: function;
  selectedFeed: Feed | undefined;
  selectFeed: function;
  getTotalUnreadCount: function;
  getUnreadCountForFeedCategory: function;
  getUnreadCountForFeed: function;
}

interface ItemCategoriesNavProps {
  activeNav: string;
  itemCategories: ItemCategory[];
  selectedItemCategory: ItemCategory | undefined;
  selectItemCategory: function;
  getTotalUnreadCount: function;
  getUnreadCountForItemCategory: function;
}
