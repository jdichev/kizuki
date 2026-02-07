declare module "node-opml-parser";
declare module "forestconfig";

// Data types

interface Feed {
  id?: number;
  title: string;
  url: string;
  feedUrl: string;
  feedType?: string;
  error?: number;
  feedCategoryId?: number;
  categoryTitle?: string;
  lastHash?: string;
  updateFrequency?: number;
  lastUpdate?: number;
  nextUpdate?: number;
}

interface FeedData {
  feed: Feed;
  items: Item[];
}

interface Category {
  id?: number;
  title: string;
  text?: string;
  expanded?: boolean;
}

// Alias for backwards compatibility
type FeedCategory = Category;

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

interface ItemCategoryReadStat {
  id: number;
  title: string;
  unreadCount: number;
}

interface Item {
  id?: number | string | array;
  title: string;
  content?: string;
  "content:encoded"?: string;
  description?: string;
  link?: string;
  read?: 0 | 1;
  bookmarked?: 0 | 1;
  published?: number;
  feedTitle?: string;
  categoryTitle?: string;
  [pubDate: string]: string;
  [date: string]: string;
  [isoDate: string]: string;
  comments?: string;
}

// Module

declare module DataService {
  export function fn(): string;
}
