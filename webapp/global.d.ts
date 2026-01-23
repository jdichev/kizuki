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

interface Item {
  id?: number;
  title: string;
  read: 0 | 1 | number;
  published: number;
  created?: number;
  feedTitle?: string;
  categoryTitle?: string;
  url?: string;
  comments?: string;
  feed_id?: number;
  jsonContent?: {
    "yt-id"?: string;
  };
  content?: string;
}

// Components

interface HomeProps {
  topMenu: React.RefObject<HTMLDivElement>;
}

interface ArticleProps {
  article?: Item;
  selectedFeedCategory?: FeedCategory;
  selectedFeed?: Feed;
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
  topMenu: React.RefObject<HTMLDivElement>;
}

interface FeedsTableProps {
  feeds: Feed[];
  removeFeed: (feedId: number) => void;
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
