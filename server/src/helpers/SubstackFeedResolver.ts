import RssParser from "rss-parser";
import axios from "axios";
import pinoLib from "pino";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "SubstackFeedResolver",
});

/**
 * Helper class to resolve RSS feeds for Substack.com publications
 */
export class SubstackFeedResolver {
  private rssParser: RssParser;

  constructor(rssParser: RssParser) {
    this.rssParser = rssParser;
  }

  /**
   * Check if a hostname belongs to Substack.com or its subdomains
   */
  static isSubstackHost(hostname: string): boolean {
    return (
      hostname === "substack.com" ||
      hostname === "www.substack.com" ||
      hostname.endsWith(".substack.com")
    );
  }

  /**
   * Extract Substack publication name from subdomain or URL path
   * Handles standard subdomains (name.substack.com)
   */
  static extractSubstackPublication(hostname: string): string | null {
    if (!SubstackFeedResolver.isSubstackHost(hostname)) {
      return null;
    }

    // For standard substack domains: name.substack.com -> name
    if (hostname.endsWith(".substack.com") && hostname !== "substack.com") {
      const subdomain = hostname.split(".")[0];
      if (subdomain && subdomain !== "www") {
        return subdomain;
      }
    }

    return null;
  }

  /**
   * Extract username from Substack profile URL (e.g., /@username)
   */
  static extractSubstackUsername(pathname: string): string | null {
    const match = pathname.match(/\/@([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Detect if content is hosted on Substack (checks for Substack indicators in HTML)
   */
  static isSubstackPoweredContent(html: string): boolean {
    return (
      /substack\.com|substack-powered|substack\.co/i.test(html) &&
      /newsletter|publication|writer/i.test(html)
    );
  }

  /**
   * Build Substack feed URL candidates from a given URL
   * Supports:
   * - Standard Substack domains: name.substack.com/feed
   * - Custom domains: domain.com/feed
   * - User profiles: @username -> username.substack.com/feed
   */
  static buildSubstackFeedCandidates(url: URL): string[] {
    const candidates: string[] = [];
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname;
    const originalUrl = url.href;

    // Standard Substack subdomain: name.substack.com/feed
    if (hostname.endsWith(".substack.com") && hostname !== "substack.com") {
      const publication =
        SubstackFeedResolver.extractSubstackPublication(hostname);
      if (publication) {
        candidates.push(`https://${publication}.substack.com/feed`);
      }
    }

    // Substack profile URL: substack.com/@username -> username.substack.com/feed
    if (hostname === "substack.com" || hostname === "www.substack.com") {
      const username = SubstackFeedResolver.extractSubstackUsername(pathname);
      if (username) {
        candidates.push(`https://${username}.substack.com/feed`);
      }
    }

    // Custom domain: domain.com/feed
    if (!SubstackFeedResolver.isSubstackHost(hostname)) {
      candidates.push(`${url.origin}/feed`);
    }

    // Remove duplicates and exclude the original URL
    return [...new Set(candidates)].filter(
      (candidate) => candidate !== originalUrl
    );
  }

  /**
   * Fetch and validate content type
   */
  private static async getContentType(
    url: string
  ): Promise<string | undefined> {
    const res = await axios
      .get(url, {
        headers: {
          "Accept-Encoding": "gzip, deflate",
          "User-Agent": "Forest/1.0 (Feed Reader)",
        },
      })
      .catch((reason) => {
        pino.debug(reason, "Failed to fetch content type");
      });

    const contentType = res
      ? res.headers["content-type"]?.split(";")[0].trim()
      : undefined;

    return contentType;
  }

  /**
   * Check if a URL responds with feed content type
   */
  private static async isFeedResponse(url: string): Promise<boolean> {
    const feedContentTypes = [
      "application/x-rss+xml",
      "application/rss+xml",
      "application/atom+xml",
      "application/xml",
      "text/xml",
    ];
    const contentType = await SubstackFeedResolver.getContentType(url);

    return typeof contentType === "string"
      ? feedContentTypes.includes(contentType)
      : false;
  }

  /**
   * Load feed data from a feed URL
   */
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
          pino.debug(e, "Failed to parse feed");
          resolve(null);
        });
    });
  }

  /**
   * Resolve Substack publication feeds
   * Returns valid feeds or empty array on failure
   */
  async resolveFeeds(url: URL): Promise<Feed[]> {
    try {
      const candidates = SubstackFeedResolver.buildSubstackFeedCandidates(
        url
      ).filter((candidate) => candidate !== url.href);

      if (!candidates.length) {
        return [];
      }

      const checkedFeeds = await Promise.all(
        candidates.map(async (candidate) => {
          const isFeed = await SubstackFeedResolver.isFeedResponse(candidate);
          if (!isFeed) {
            return null;
          }
          return this.loadFeedData(candidate);
        })
      );

      return checkedFeeds.filter((feed): feed is Feed => !!feed);
    } catch (error) {
      pino.warn({ error }, "Failed to resolve Substack feeds");
      return [];
    }
  }
}
