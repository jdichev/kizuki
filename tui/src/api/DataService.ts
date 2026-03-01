import { Feed, FeedCategory, Item, FeedReadStat, FeedCategoryReadStat, ItemCategory, ItemCategoryReadStat } from "../types/index.js";

// Node.js compatible DataService for TUI
export default class DataService {
  private static instance: DataService;
  private readonly baseUrl: string;

  constructor() {
    // TUI usually runs on the same machine as the server
    this.baseUrl = "http://localhost:3031";
  }

  private makeUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  public static getInstance(): DataService {
    if (this.instance === undefined) {
      this.instance = new DataService();
    }

    return this.instance;
  }

  public async getFeedCategories(): Promise<FeedCategory[]> {
    const response = await fetch(this.makeUrl("/categories"));
    return await response.json();
  }

  public async getFeedCategoryReadStats(): Promise<FeedCategoryReadStat[]> {
    const response = await fetch(this.makeUrl("/categories/readstats"));
    return await response.json();
  }

  public async getItemCategories(): Promise<ItemCategory[]> {
    try {
      const response = await fetch(this.makeUrl("/item-categories"));
      if (!response.ok) return [];
      const categories = await response.json();
      return Array.isArray(categories) ? categories : [];
    } catch (error) {
      return [];
    }
  }

  public async getItemCategoryReadStats(): Promise<ItemCategoryReadStat[]> {
    try {
      const response = await fetch(this.makeUrl("/item-categories/readstats"));
      if (!response.ok) return [];
      const stats = await response.json();
      return Array.isArray(stats) ? stats : [];
    } catch (error) {
      return [];
    }
  }

  public async getFeedReadStats(): Promise<FeedReadStat[]> {
    const response = await fetch(this.makeUrl("/feeds/readstats"));
    return await response.json();
  }

  public async getItems(
    params: {
      size: number;
      unreadOnly: boolean;
      bookmarkedOnly: boolean;
      searchQuery?: string;
      selectedFeedCategory?: FeedCategory | undefined;
      selectedFeed?: Feed | undefined;
      selectedItemCategoryIds?: number[] | undefined;
    } = {
      size: 50,
      unreadOnly: false,
      bookmarkedOnly: false,
      searchQuery: "",
      selectedFeedCategory: undefined,
      selectedFeed: undefined,
      selectedItemCategoryIds: undefined,
    }
  ): Promise<Item[]> {
    const query = new URLSearchParams();

    if (params.size > 0) query.set("size", JSON.stringify(params.size));
    if (params.unreadOnly) query.set("unread", "true");
    if (params.bookmarkedOnly) query.set("bookmarked", "true");
    if (params.searchQuery?.trim()) query.set("q", params.searchQuery.trim());
    if (params.selectedFeedCategory) query.set("cid", JSON.stringify(params.selectedFeedCategory.id));
    if (params.selectedFeed) query.set("fid", JSON.stringify(params.selectedFeed.id));
    if (params.selectedItemCategoryIds?.length) query.set("icids", JSON.stringify(params.selectedItemCategoryIds));

    const response = await fetch(`${this.makeUrl("/items")}?${query.toString()}`);
    if (response.ok) {
      return await response.json();
    }
    return [];
  }

  public async getItem(itemId: number | undefined): Promise<Item | undefined> {
    if (itemId === undefined) return undefined;
    const response = await fetch(this.makeUrl(`/items/${itemId}`));
    return await response.json();
  }

  public async markItemRead(item: Item) {
    const query = new URLSearchParams();
    query.set("id", JSON.stringify(item.id));
    const response = await fetch(this.makeUrl(`/item/read?${query.toString()}`));
    return await response.json();
  }

  public async toggleItemBookmark(item: Item) {
    const query = new URLSearchParams();
    query.set("id", JSON.stringify(item.id));
    const response = await fetch(this.makeUrl(`/item/bookmark?${query.toString()}`));
    return await response.json();
  }

  public async markItemsRead(params: {
    feed?: Feed;
    feedCategory?: FeedCategory;
    itemCategories?: ItemCategory[];
  }) {
    const query = new URLSearchParams();

    if (params.feed) {
      query.set("fid", JSON.stringify(params.feed.id));
    } else if (params.feedCategory) {
      query.set("cid", JSON.stringify(params.feedCategory.id));
    } else if (params.itemCategories && params.itemCategories.length > 0) {
      const ids = params.itemCategories.map((cat) => cat.id);
      query.set("icids", JSON.stringify(ids));
    }

    const queryString = query.toString();
    const response = await fetch(`${this.makeUrl("/itemsread")}?${queryString}`);
    return await response.json();
  }

  public async getFeeds(params: { selectedFeedCategory?: FeedCategory } = {}): Promise<Feed[]> {
    const query = new URLSearchParams();
    if (params.selectedFeedCategory) {
      query.set("cid", JSON.stringify(params.selectedFeedCategory.id));
    }
    const response = await fetch(`${this.makeUrl("/feeds")}?${query.toString()}`);
    return await response.json();
  }
}
