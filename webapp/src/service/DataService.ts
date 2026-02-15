import serverConfig from "../config/serverConfig";

// main data service
export default class DataService {
  private static instance: DataService;
  private itemsPromiseReject: undefined | ((reason?: any) => void);
  private itemPromiseReject: undefined | ((reason?: any) => void);
  private lastItemId: undefined | number;
  private readonly baseUrl: string;

  constructor() {
    this.itemsPromiseReject = undefined;
    this.itemPromiseReject = undefined;
    this.lastItemId = undefined;
    this.baseUrl = `${serverConfig.protocol}//${serverConfig.hostname}:${serverConfig.port}`;
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
    const categories = await response.json();

    return Promise.resolve(categories);
  }

  public async getFeedCategoryReadStats(): Promise<FeedCategoryReadStat[]> {
    const response = await fetch(this.makeUrl("/categories/readstats"));
    const feedCategoryReadStats = response.json();

    return Promise.resolve(feedCategoryReadStats);
  }

  public async getItemCategories(): Promise<ItemCategory[]> {
    try {
      const response = await fetch(this.makeUrl("/item-categories"));
      if (!response.ok) {
        console.error("Failed to fetch item categories:", response.status);
        return [];
      }
      const categories = await response.json();
      return Promise.resolve(Array.isArray(categories) ? categories : []);
    } catch (error) {
      console.error("Error fetching item categories:", error);
      return [];
    }
  }

  public async getItemCategoryReadStats(): Promise<ItemCategoryReadStat[]> {
    try {
      const response = await fetch(this.makeUrl("/item-categories/readstats"));
      if (!response.ok) {
        console.error(
          "Failed to fetch item category read stats:",
          response.status
        );
        return [];
      }
      const itemCategoryReadStats = await response.json();
      return Promise.resolve(
        Array.isArray(itemCategoryReadStats) ? itemCategoryReadStats : []
      );
    } catch (error) {
      console.error("Error fetching item category read stats:", error);
      return [];
    }
  }

  public async getFeedReadStats(): Promise<FeedReadStat[]> {
    const response = await fetch(this.makeUrl("/feeds/readstats"));
    const feedReadStats = response.json();

    return Promise.resolve(feedReadStats);
  }

  private itemsTimeout: number = 0;
  private itemTimeout: number = 0;

  public async getItemsDeferred(
    params: {
      size: number;
      unreadOnly: boolean;
      bookmarkedOnly: boolean;
      selectedFeedCategory?: FeedCategory | undefined;
      selectedFeed?: Feed | undefined;
      selectedItemCategoryIds?: number[] | undefined;
    } = {
      size: 50,
      unreadOnly: false,
      bookmarkedOnly: false,
      selectedFeedCategory: undefined,
      selectedFeed: undefined,
      selectedItemCategoryIds: undefined,
    }
  ): Promise<Item[]> {
    this.itemsTimeout && clearTimeout(this.itemsTimeout);
    this.itemsPromiseReject &&
      this.itemsPromiseReject("Deferred call cancelled; new is scheduled");

    return new Promise((resolve, reject) => {
      this.itemsPromiseReject = reject;

      this.itemsTimeout = window.setTimeout(async () => {
        const res = await this.getItems(params);
        resolve(res);
      }, 350);
    });
  }

  public async getItems(
    params: {
      size: number;
      unreadOnly: boolean;
      bookmarkedOnly: boolean;
      selectedFeedCategory?: FeedCategory | undefined;
      selectedFeed?: Feed | undefined;
      selectedItemCategoryIds?: number[] | undefined;
    } = {
      size: 50,
      unreadOnly: false,
      bookmarkedOnly: false,
      selectedFeedCategory: undefined,
      selectedFeed: undefined,
      selectedItemCategoryIds: undefined,
    }
  ): Promise<Item[]> {
    const query = new URLSearchParams();

    if (params.size > 0) {
      query.set("size", JSON.stringify(params.size));
    }

    if (params.unreadOnly) {
      query.set("unread", "true");
    }

    if (params.bookmarkedOnly) {
      query.set("bookmarked", "true");
    }

    if (params.selectedFeedCategory) {
      query.set("cid", JSON.stringify(params.selectedFeedCategory.id));
    }

    if (params.selectedFeed) {
      query.set("fid", JSON.stringify(params.selectedFeed.id));
    }

    if (
      params.selectedItemCategoryIds &&
      params.selectedItemCategoryIds.length > 0
    ) {
      query.set("icids", JSON.stringify(params.selectedItemCategoryIds));
    }

    const queryString = query.toString();

    const response = await fetch(
      `${this.makeUrl("/items")}?${queryString}`,
      {}
    ).catch((reason) => {
      console.error(reason.code, reason.message, reason.name);
    });

    if (response) {
      const items = await response.json();
      return Promise.resolve(items);
    }

    return Promise.resolve([]);
  }

  public async getItemDeferred(
    itemId: number | undefined
  ): Promise<Item | undefined> {
    if (this.lastItemId === itemId) {
      return Promise.reject("Item already requested");
    }

    this.itemTimeout && clearTimeout(this.itemTimeout);
    this.itemPromiseReject &&
      this.itemPromiseReject("Deferred item call cancelled; new is scheduled");

    this.lastItemId = itemId;
    return new Promise((resolve, reject) => {
      this.itemPromiseReject = reject;

      this.itemsTimeout = window.setTimeout(async () => {
        const res = await this.getItem(itemId);
        resolve(res);
      }, 350);
    });
  }

  public async getItem(itemId: number | undefined): Promise<Item | undefined> {
    const response = await fetch(this.makeUrl(`/items/${itemId}`));
    const item = await response.json();

    return Promise.resolve(item);
  }

  public async markItemsRead(params: {
    feed?: Feed;
    feedCategory?: FeedCategory;
    itemCategory?: ItemCategory;
  }) {
    const query = new URLSearchParams();

    if (params.feed) {
      query.set("fid", JSON.stringify(params.feed.id));
    } else if (params.feedCategory) {
      query.set("cid", JSON.stringify(params.feedCategory.id));
    } else if (params.itemCategory) {
      query.set("icid", JSON.stringify(params.itemCategory.id));
    }

    const queryString = query.toString();

    const response = await fetch(
      `${this.makeUrl("/itemsread")}?${
        params.feed || params.feedCategory || params.itemCategory
          ? queryString
          : ""
      }`
    );
    const result = response.json();

    return Promise.resolve(result);
  }

  public async markItemRead(item: Item) {
    const query = new URLSearchParams();

    query.set("id", JSON.stringify(item.id));

    const queryString = query.toString();

    const response = await fetch(this.makeUrl(`/item/read?${queryString}`));

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async toggleItemBookmark(item: Item) {
    const query = new URLSearchParams();

    query.set("id", JSON.stringify(item.id));

    const queryString = query.toString();

    const response = await fetch(this.makeUrl(`/item/bookmark?${queryString}`));

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async getFeeds(
    params: {
      selectedFeedCategory?: FeedCategory;
    } = {}
  ): Promise<Feed[]> {
    const query = new URLSearchParams();

    if (params.selectedFeedCategory) {
      query.set("cid", JSON.stringify(params.selectedFeedCategory.id));
    }

    const queryString = query.toString();

    const response = await fetch(`${this.makeUrl("/feeds")}?${queryString}`);
    const feeds = await response.json();

    return Promise.resolve(feeds);
  }

  public async getFeedById(feedId: number): Promise<Feed> {
    const query = new URLSearchParams();

    query.set("fid", JSON.stringify(feedId));

    const queryString = query.toString();

    const response = await fetch(`${this.makeUrl("/feeds")}?${queryString}`);

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async removeFeed(feedId: number): Promise<boolean> {
    const query = new URLSearchParams();

    query.set("fid", JSON.stringify(feedId));

    const queryString = query.toString();

    const response = await fetch(`${this.makeUrl("/feeds")}?${queryString}`, {
      method: "DELETE",
    });

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async updateFeed(feed: Feed): Promise<boolean> {
    const feedJson = JSON.stringify(feed);

    const response = await fetch(this.makeUrl("/feeds"), {
      method: "PUT",
      headers: {
        "Content-type": "application/json",
      },
      body: feedJson,
    });

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async checkFeed(feedUrl: string): Promise<Feed[]> {
    const encodedFeedUrl = encodeURIComponent(feedUrl);

    const result = await fetch(
      this.makeUrl(`/checkfeed?url=${encodedFeedUrl}`)
    );

    const resultJson = result.json();

    return Promise.resolve(resultJson);
  }

  public async checkFeedUrls(feedUrls: string[]) {
    const feedJson = JSON.stringify(feedUrls);
    const result = await fetch(this.makeUrl("/checkfeedurls"), {
      method: "POST",
      headers: {
        "Content-type": "application/json",
      },
      body: feedJson,
    });

    const resultJson = await result.json();

    return Promise.resolve(resultJson);
  }

  public async addFeed(feed: Feed) {
    const feedJson = JSON.stringify(feed);

    const response = await fetch(this.makeUrl("/feeds"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: feedJson,
    });

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async addFeedCategory(feedCategory: FeedCategory) {
    const feedCategoryJson = JSON.stringify(feedCategory);

    const response = await fetch(this.makeUrl("/categories"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: feedCategoryJson,
    });

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async removeFeedCategory(feedCategoryId: Number) {
    const query = new URLSearchParams();

    query.set("cid", JSON.stringify(feedCategoryId));

    const queryString = query.toString();

    const response = await fetch(
      `${this.makeUrl("/categories")}?${queryString}`,
      {
        method: "DELETE",
      }
    );

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async updateFeedCategory(feedCategory: FeedCategory) {
    const feedCategoryJson = JSON.stringify(feedCategory);

    const response = await fetch(this.makeUrl("/categories"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: feedCategoryJson,
    });

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async importOpmlFile(options: {
    filePath?: string;
    fileContent?: string;
    fileName?: string;
  }) {
    const body = JSON.stringify(options);

    const response = await fetch(this.makeUrl("/opml-import"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    const result = await response.json();

    return Promise.resolve(result);
  }

  public async exportOpmlFile() {
    try {
      const response = await fetch(this.makeUrl("/opml-export"));

      if (!response.ok) {
        throw new Error("Failed to export OPML");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "forest-feeds.opml";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting OPML:", error);
      throw error;
    }
  }

  // Item Categories Management Methods
  public async addItemCategory(itemCategory: ItemCategory): Promise<boolean> {
    const itemCategoryJson = JSON.stringify(itemCategory);

    const response = await fetch(this.makeUrl("/item-categories"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: itemCategoryJson,
    });

    const result = await response.json();

    return Promise.resolve(result.success || false);
  }

  public async updateItemCategory(
    itemCategory: ItemCategory
  ): Promise<boolean> {
    const itemCategoryJson = JSON.stringify(itemCategory);

    const response = await fetch(this.makeUrl("/item-categories"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: itemCategoryJson,
    });

    const result = await response.json();

    return Promise.resolve(result.success || false);
  }

  public async removeItemCategory(itemCategoryId: number): Promise<boolean> {
    const query = new URLSearchParams();

    query.set("id", JSON.stringify(itemCategoryId));

    const queryString = query.toString();

    const response = await fetch(
      `${this.makeUrl("/item-categories")}?${queryString}`,
      {
        method: "DELETE",
      }
    );

    const result = await response.json();

    return Promise.resolve(result.success || false);
  }

  public async getItemCategoryById(
    itemCategoryId: number
  ): Promise<ItemCategory | null> {
    try {
      const response = await fetch(
        this.makeUrl(`/item-categories/${itemCategoryId}`)
      );
      if (!response.ok) {
        console.error("Failed to fetch item category:", response.status);
        return null;
      }
      const category = await response.json();
      return Promise.resolve(category);
    } catch (error) {
      console.error("Error fetching item category:", error);
      return null;
    }
  }

  public async assignItemToCategory(
    itemId: number,
    itemCategoryId: number
  ): Promise<boolean> {
    const data = {
      itemId,
      itemCategoryId,
    };

    try {
      const response = await fetch(this.makeUrl("/items"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      return Promise.resolve(result.success || false);
    } catch (error) {
      console.error("Error updating item category:", error);
      return false;
    }
  }
}
