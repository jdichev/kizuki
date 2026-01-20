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
      selectedFeedCategory?: FeedCategory | undefined;
      selectedFeed?: Feed | undefined;
    } = {
      size: 50,
      unreadOnly: false,
      selectedFeedCategory: undefined,
      selectedFeed: undefined,
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
      selectedFeedCategory?: FeedCategory | undefined;
      selectedFeed?: Feed | undefined;
    } = {
      size: 50,
      unreadOnly: false,
      selectedFeedCategory: undefined,
      selectedFeed: undefined,
    }
  ): Promise<Item[]> {
    const query = new URLSearchParams();

    if (params.size > 0) {
      query.set("size", JSON.stringify(params.size));
    }

    query.set("unread", JSON.stringify(params.unreadOnly));

    if (params.selectedFeedCategory) {
      query.set("cid", JSON.stringify(params.selectedFeedCategory.id));
    }

    if (params.selectedFeed) {
      query.set("fid", JSON.stringify(params.selectedFeed.id));
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
  }) {
    const query = new URLSearchParams();

    if (params.feed) {
      query.set("fid", JSON.stringify(params.feed.id));
    } else if (!params.feed && params.feedCategory) {
      query.set("cid", JSON.stringify(params.feedCategory.id));
    }

    const queryString = query.toString();

    const response = await fetch(
      `${this.makeUrl("/itemsread")}?${
        params.feed || params.feedCategory ? queryString : ""
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
}
