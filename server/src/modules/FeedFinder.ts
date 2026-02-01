import RssParser from "rss-parser";
import isValidDomain from "is-valid-domain";
import axios from "axios";
import { JSDOM } from "jsdom";
import pinoLib from "pino";
import { MediumFeedResolver } from "../helpers/MediumFeedResolver";
import { SubstackFeedResolver } from "../helpers/SubstackFeedResolver";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "FeedFinder",
});

/**
 * check a site for feeds or return feed if url is a feed
 */
export default class FeedFinder {
  private rssParser: RssParser;

  private maxDepth = 2;

  private mediumFeedResolver: MediumFeedResolver;

  private substackFeedResolver: SubstackFeedResolver;

  constructor() {
    this.rssParser = new RssParser({
      xml2js: {
        emptyTag: "EMPTY_TAG",
      },
    });
    this.mediumFeedResolver = new MediumFeedResolver(this.rssParser);
    this.substackFeedResolver = new SubstackFeedResolver(this.rssParser);
  }

  private async loadFeedData(feedUrl: string): Promise<Feed | null> {
    return new Promise((resolve) => {
      this.rssParser
        .parseURL(feedUrl)
        .then(async (feedRes) => {
          const feed: Feed = {
            title: feedRes.title || "",
            feedUrl,
            url: feedRes.link || "",
          };

          resolve(feed);
        })
        .catch((e) => {
          pino.error(e);
          resolve(null);
        });
    });
  }

  static async getContentType(url: string): Promise<string | undefined> {
    const res = await axios.get(url).catch((reson) => {
      pino.error(reson);
    });

    // pino.debug(res?.headers);
    const contentType = res
      ? res.headers["content-type"]?.split(";")[0].trim()
      : undefined;

    return contentType;
  }

  static async isFeedResponse(url: string): Promise<boolean> {
    const feedContentTypes = [
      "application/x-rss+xml",
      "application/rss+xml",
      "application/atom+xml",
      "application/xml",
      "text/xml",
    ];
    const contentType = await FeedFinder.getContentType(url);

    return typeof contentType === "string"
      ? feedContentTypes.includes(contentType)
      : false;
  }

  public async checkFeed(url: string, depth = 0): Promise<Feed[]> {
    let resUrl: URL;

    // Check if URL is absolute by attempting to parse it
    let isAbsoluteUrl = false;
    try {
      new URL(url);
      isAbsoluteUrl = true;
    } catch {
      isAbsoluteUrl = false;
    }

    if (!isAbsoluteUrl) {
      if (!isValidDomain(url)) {
        return Promise.resolve([]);
      }
      resUrl = new URL("http://placeholder");
      resUrl.host = url;
    } else {
      resUrl = new URL(url);
    }

    const isFeedResponse = await FeedFinder.isFeedResponse(resUrl.href);
    pino.debug({ isFeedResponse }, "Feed response check complete");

    if (isFeedResponse) {
      const feedData = await this.loadFeedData(resUrl.href);
      return feedData ? [feedData] : [];
    }

    const specialFeeds = await this.mediumFeedResolver.resolveFeeds(resUrl);
    if (specialFeeds.length) {
      return specialFeeds;
    }

    const substackFeeds = await this.substackFeedResolver.resolveFeeds(resUrl);
    if (substackFeeds.length) {
      return substackFeeds;
    }

    if (depth < this.maxDepth) {
      const foundFeedUrls = await this.searchForFeeds(resUrl.href, depth + 1);

      return foundFeedUrls;
    }

    return Promise.resolve([]);
  }

  private async searchForFeeds(url: string, depth: number): Promise<Feed[]> {
    const res = await axios.get(url).catch((reason) => {
      pino.error(reason);
    });

    if (!res) {
      return [];
    }

    const body = res.data;

    const doc = new JSDOM(body);

    const queryRes = doc.window.document.querySelectorAll(`
      [type="application/rss+xml"][href],
      [type="application/atom+xml"][href],
      [href*="rss"],
      [href*="atom"],
      [href*="feed"]
    `);

    const foundUrls: string[] = [];
    queryRes.forEach((feedLink) => {
      const hrefValue = feedLink.getAttribute("href");

      if (hrefValue) {
        const resolvedUrl = new URL(hrefValue, url).href;
        foundUrls.push(resolvedUrl);
      }
    });

    let specialFeeds: Feed[] = [];
    try {
      specialFeeds = await this.mediumFeedResolver.resolveFeeds(
        new URL(url),
        body
      );
    } catch (error) {
      pino.warn(
        { error },
        "Failed to resolve special platform feeds from HTML"
      );
    }

    let substackFeeds: Feed[] = [];
    try {
      substackFeeds = await this.substackFeedResolver.resolveFeeds(
        new URL(url)
      );
    } catch (error) {
      pino.warn({ error }, "Failed to resolve Substack feeds from HTML");
    }

    if (foundUrls.length || specialFeeds.length || substackFeeds.length) {
      let combinedResult = await Promise.all(
        foundUrls.map(async (foundUrl) => {
          const checkedFeedData = await this.checkFeed(foundUrl, depth);
          return checkedFeedData;
        })
      );

      combinedResult = combinedResult.filter((elFiltered) => {
        return elFiltered !== undefined;
      });

      let finalArr: Feed[] = [];

      finalArr = finalArr.concat(
        specialFeeds,
        substackFeeds,
        ...combinedResult
      );

      const occurrenceArr: string[] = [];

      finalArr = finalArr.filter((feedDataItem) => {
        if (occurrenceArr.includes(feedDataItem.feedUrl)) {
          return false;
        }

        occurrenceArr.push(feedDataItem.feedUrl);
        return true;
      });

      return finalArr;
    }

    return Promise.resolve([]);
  }
}
