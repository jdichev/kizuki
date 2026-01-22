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
  id?: number | string | array;
  title: string;
  content?: string;
  "content:encoded"?: string;
  description?: string;
  link?: string;
  read?: 0 | 1;
  published?: number;
  feedTitle?: string;
  [pubDate: string]: string;
  [date: string]: string;
  [isoDate: string]: string;
  comments?: string;
}

// Module

declare module DataService {
  export function fn(): string;
}
