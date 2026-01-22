import chunk from "lodash/chunk";
import pinoLib from "pino";
import ms from "ms";
import fs from "fs";
import os from "os";
import path from "path";
import MixedDataModel from "./MixedDataModel";
//@ts-ignore
import { fetchFeed } from "fetch-feed";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "FeedUpdater",
});

const dataModel = MixedDataModel.getInstance();

export default class FeedUpdater {
  // Time interval constants for scheduling
  private static readonly HOUR_LENGTH = 1000 * 60 * 60;
  private static readonly DAY_LENGTH = 1000 * 60 * 60 * 24;
  private static readonly WEEK_LENGTH = 1000 * 60 * 60 * 24 * 7;
  private static readonly HALF_DAY_LENGTH = 1000 * 60 * 60 * 12;
  private static readonly QUARTER_DAY_LENGTH = 1000 * 60 * 60 * 6;

  private chunkSize = 4;
  private feedsProcCacheFilePath: string;
  private updateInProgress: boolean = false;

  private feedsProcCache: {
    lastUpdateTimes: { [key: string]: number };
    feedFrequencies: { [key: string]: number };
  } = {
    lastUpdateTimes: {},
    feedFrequencies: {},
  };

  constructor() {
    const tempInstance = process.env.NODE_ENV === "test";
    const storageDir = tempInstance
      ? path.join(os.tmpdir(), ".forest-temp")
      : path.join(os.homedir(), ".forest");
    const cacheFileName = "feeds-proc-cache.json";
    this.feedsProcCacheFilePath = path.join(storageDir, cacheFileName);

    // Load existing cache if available
    if (fs.existsSync(this.feedsProcCacheFilePath)) {
      try {
        this.feedsProcCache = JSON.parse(
          fs.readFileSync(this.feedsProcCacheFilePath, "utf-8")
        );
        pino.debug("Feeds process cache loaded from disk");
      } catch (error) {
        pino.warn("Failed to load feeds process cache, starting fresh");
      }
    }
  }

  /**
   * Checks whether an update is currently in progress.
   * @returns {boolean} True if an update is in progress, false otherwise.
   */
  public get isUpdateInProgress(): boolean {
    return this.updateInProgress;
  }

  /**
   * Gets the update frequency for a feed.
   * @param {number | undefined} feedId - The feed ID.
   * @returns {number | undefined} The frequency in milliseconds or undefined if not set.
   */
  private getFeedFrequency(feedId: number | undefined): number | undefined {
    if (feedId === undefined) return undefined;
    return this.feedsProcCache.feedFrequencies[`${feedId}`];
  }

  /**
   * Gets the last update time for a feed.
   * @param {number | undefined} feedId - The feed ID.
   * @returns {number | undefined} The timestamp or undefined if not set.
   */
  private getFeedLastUpdateTime(
    feedId: number | undefined
  ): number | undefined {
    if (feedId === undefined) return undefined;
    return this.feedsProcCache.lastUpdateTimes[`${feedId}`];
  }

  /**
   * Sets the frequency and last update time for a feed.
   * @param {number | undefined} feedId - The feed ID.
   * @param {number} frequency - The frequency in milliseconds.
   * @param {number} lastUpdateTime - The last update timestamp.
   */
  private setFeedFrequencyData(
    feedId: number | undefined,
    frequency: number,
    lastUpdateTime: number
  ): void {
    if (feedId === undefined) return;
    this.feedsProcCache.feedFrequencies[`${feedId}`] = frequency;
    this.feedsProcCache.lastUpdateTimes[`${feedId}`] = lastUpdateTime;
  }

  /**
   * Persists the feeds process cache to disk.
   */
  private saveFeedsProcCache(): void {
    try {
      const cacheJson = JSON.stringify(this.feedsProcCache);
      fs.writeFileSync(this.feedsProcCacheFilePath, cacheJson);
    } catch (error) {
      pino.error(error, "Failed to save feeds process cache");
    }
  }

  /**
   * Calculates the rounded average of an array of numbers.
   * @param arr - Array of numbers to average
   * @returns The rounded average, or 0 if the array is empty
   */
  private static arrAvg(arr: number[]): number {
    return arr.length === 0
      ? 0
      : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  /**
   * Computes the average frequency between a series of timestamps.
   * Sorts the timestamps, calculates the time intervals between consecutive entries,
   * and returns the average interval.
   * Average interval is returned in milliseconds.
   * Average interval computed as 0 is reset to 1 hour.
   * Insufficient timestamps for frequency calculation resolves to one week.
   *
   * @param publishedTimes - Array of Unix timestamps in milliseconds (e.g., from Date.now())
   * @returns Average interval in milliseconds between consecutive timestamps, or 0 if insufficient data.
   *          Common reference values:
   *          - 1 hour = 3,600,000 ms
   *          - 1 day = 86,400,000 ms (see FeedUpdater.DAY_LENGTH)
   */
  private static computeFrequency(publishedTimes: number[]): number {
    if (publishedTimes.length < 2) {
      return FeedUpdater.WEEK_LENGTH;
    }

    const sortedPublishedTimes = publishedTimes.sort((a, b) => b - a);

    const reversed = [...sortedPublishedTimes].reverse();
    const timesBetweenA = reversed.map((pubTime, i) => {
      if (i === 0) return 0;

      return pubTime - reversed[i - 1];
    });

    const timesBetweenB = timesBetweenA.filter((pubTime) => {
      return pubTime !== 0;
    });

    let avg = FeedUpdater.arrAvg(timesBetweenB);

    // If frequency is 0, reset to 1 hour to prevent too frequent updates
    if (avg === 0) {
      avg = FeedUpdater.HOUR_LENGTH;
      pino.trace(
        { originalAvg: avg },
        "Average interval computed as 0, resetting to 1 hour"
      );
    }

    return avg;
  }

  /**
   * Adds a new feed to the system and processes its items.
   * @param {Feed} feedData - The feed data to add.
   * @returns {Promise<Feed>} A promise that resolves with the added feed.
   */
  public async addFeed(feedData: Feed) {
    pino.debug(feedData, "feed data");

    let feedResStr;
    let feedRes;

    try {
      feedResStr = await fetchFeed(feedData.feedUrl);
      feedRes = JSON.parse(feedResStr);
    } catch (error) {
      pino.error(error);
      throw error;
    }

    if (!feedRes || typeof feedRes !== "object") {
      const error = new Error("Invalid feed data: response is not an object");
      pino.error({ feedUrl: feedData.feedUrl }, error.message);
      throw error;
    }

    if (!Array.isArray(feedRes.items)) {
      const error = new Error("Invalid feed data: items is not an array");
      pino.error({ feedUrl: feedData.feedUrl }, error.message);
      throw error;
    }

    const feed: Feed = {
      title: feedRes.title || "NO_TITLE",
      feedUrl: feedData.feedUrl,
      url:
        Array.isArray(feedRes.links) && feedRes.links.length
          ? feedRes.links[0]
          : "",
      feedCategoryId: feedData.feedCategoryId,
    };

    try {
      pino.debug({ feed }, "Inserting feed into database");
      await dataModel.insertFeed(feed);
    } catch (error: any) {
      pino.error(
        { error, feedUrl: feedData.feedUrl },
        "Failed to insert feed into database"
      );
      throw error;
    }

    const feedFromDb = await dataModel.getFeedByUrl(feedData.feedUrl);

    await this.insertItems({
      feed: feedFromDb,
      items: feedRes.items as Item[],
    });

    pino.info(
      { feedId: feedFromDb.id, title: feedFromDb.title },
      "Feed added successfully"
    );

    return feed;
  }

  /**
   * Inserts items from a feed into the database.
   * @param {FeedData} feedData - The feed data containing items to insert.
   */
  private async insertItems(feedData: FeedData) {
    for (const individualItem of feedData.items) {
      await dataModel.insertItem(individualItem, feedData.feed.id);
    }

    pino.trace("FEED: %s - %s", feedData.feed.id, feedData.feed.title);
  }

  /**
   * Loads feed data from a given feed URL.
   * @param {Feed} feed - The feed to load data for.
   * @returns {Promise<FeedData>} A promise that resolves with the feed data.
   */
  private async loadFeedData(feed: Feed): Promise<FeedData> {
    let feedResStr;
    let feedRes;

    try {
      feedResStr = await fetchFeed(feed.feedUrl);
      feedRes = JSON.parse(feedResStr);
    } catch (error) {
      pino.error(`Error fetching feed ${feed.feedUrl}: ${error}`);
      return { feed, items: [] };
    }

    // Validate feed data structure
    if (!feedRes || typeof feedRes !== "object") {
      pino.warn(
        { feedUrl: feed.feedUrl },
        "Invalid feed data: response is not an object"
      );
      return { feed, items: [] };
    }

    if (!Array.isArray(feedRes.items)) {
      pino.warn(
        { feedUrl: feed.feedUrl },
        "Invalid feed data: items is not an array"
      );
      return { feed, items: [] };
    }

    return {
      feed,
      items: feedRes.items as Item[],
    };
  }

  /**
   * Updates the frequency data for a feed based on its items.
   * @param {FeedData} feedData - The feed data to update frequency for.
   */
  public updateFeedFrequencyData(feedData: FeedData) {
    // @ts-ignore
    const publishedTimes = feedData.items.map((item) => item.published * 1000);

    const avg = FeedUpdater.computeFrequency(publishedTimes);

    if (avg === 0) {
      pino.debug({ title: feedData.feed.title }, "Zero AVG time");
    }

    const now = Date.now();
    this.setFeedFrequencyData(feedData.feed.id, avg, now);
    this.saveFeedsProcCache();
  }

  private filterByFrequency(feeds: Feed[]): Feed[] {
    const ONE_DAY = ms("1d");
    const ONE_HOUR = ms("1h");
    const now = Date.now();

    return feeds.filter((feed) => {
      const frequency = this.getFeedFrequency(feed.id);
      const lastUpdateTime = this.getFeedLastUpdateTime(feed.id);

      // New feeds without frequency data should be included
      if (frequency === undefined) {
        return true;
      }

      // High-frequency feeds (updated <= 1 day) are always included
      if (frequency <= ONE_DAY) {
        return true;
      }

      // Low-frequency feeds (updated > 1 day) are only included if 1 hour has passed
      if (lastUpdateTime === undefined) {
        return true;
      }

      // Check if at least 1 hour has passed since the last update
      return now - lastUpdateTime >= ONE_HOUR;
    });
  }

  /**
   * Processes feed data in bulk by chunking the feeds.
   * @param {Feed[]} feeds - Array of feeds to process.
   * @returns {Promise<void>} Completes after processing and inserting all feed data.
   */
  private async processBulkFeedData(feeds: Feed[]): Promise<void> {
    const chunks = chunk(feeds, this.chunkSize);

    pino.trace(`Chunks num ${chunks.length}, ${this.chunkSize} feeds each`);

    for (const feedsChunk of chunks) {
      const chunkProcTimeStart = Date.now();

      const resultOfFeeds = await Promise.all(
        feedsChunk.map((feed) => {
          return this.loadFeedData(feed);
        })
      );

      const chunkProcTimeEnd = Date.now();

      pino.trace(
        "Time to fetch chunk %s",
        ms(chunkProcTimeEnd - chunkProcTimeStart)
      );

      const chunkInsertStart = Date.now();

      for (const individualData of resultOfFeeds) {
        await this.insertItems(individualData);
        this.updateFeedFrequencyData(individualData);
      }

      const chunkInsertEnd = Date.now();

      pino.trace(
        "Time to process data from chunk %s",
        ms(chunkInsertEnd - chunkInsertStart)
      );
    }
  }

  /**
   * Updates items for all feeds.
   */
  public async updateItems() {
    this.updateInProgress = true;
    try {
      const feeds = await dataModel.getFeeds();
      const feedsToUpdate = this.filterByFrequency(feeds);
      pino.info(
        `Updating ${feedsToUpdate.length} out of ${feeds.length} feeds`
      );

      const updateStart = Date.now();

      await this.processBulkFeedData(feedsToUpdate);

      const updateEnd = Date.now();

      pino.info("Crawl time %s", ms(updateEnd - updateStart));
    } finally {
      this.updateInProgress = false;
    }
  }
}
