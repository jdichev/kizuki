import RssParser from "rss-parser";
import axios from "axios";
import pinoLib from "pino";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "MediumFeedResolver",
});

/**
 * Helper class to resolve RSS feeds for Medium.com and other blogging platforms
 */
export class MediumFeedResolver {
  private rssParser: RssParser;

  constructor(rssParser: RssParser) {
    this.rssParser = rssParser;
  }

  /**
   * Check if a hostname belongs to Medium.com or its subdomains
   */
  static isMediumHost(hostname: string): boolean {
    return hostname === "medium.com" || hostname.endsWith(".medium.com");
  }

  /**
   * Extract Medium handle (@username) from URL pathname
   */
  static extractMediumHandle(pathname: string): string | null {
    const match = pathname.match(/\/(@[^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract Medium publication name from URL pathname
   * Filters out reserved Medium segments to avoid false positives
   */
  static extractMediumPublication(pathname: string): string | null {
    const [firstSegment] = pathname.split("/").filter(Boolean);
    if (!firstSegment || firstSegment.startsWith("@")) {
      return null;
    }

    const reservedSegments = new Set([
      "p",
      "tag",
      "tags",
      "topic",
      "topics",
      "m",
      "me",
      "about",
      "membership",
      "follow",
      "search",
      "notifications",
      "settings",
      "apps",
      "creators",
      "upgrade",
      "signin",
      "login",
    ]);

    if (reservedSegments.has(firstSegment.toLowerCase())) {
      return null;
    }

    return firstSegment;
  }

  /**
   * Build Medium feed URL candidates from a given URL
   * Supports subdomain format, handle format, publication format, and custom domains
   */
  static buildMediumFeedCandidates(
    url: URL,
    isMediumCustomDomain: boolean
  ): string[] {
    const candidates: string[] = [];
    const hostname = url.hostname.toLowerCase();
    const originalUrl = url.href;

    // Subdomain format: subdomain.medium.com/feed
    if (hostname.endsWith(".medium.com") && hostname !== "medium.com") {
      const subdomain = hostname.split(".")[0];
      if (subdomain && subdomain !== "www") {
        candidates.push(`https://${subdomain}.medium.com/feed`);
      }
    }

    // Handle and publication formats on main Medium domain
    if (hostname === "medium.com" || hostname === "www.medium.com") {
      const handle = MediumFeedResolver.extractMediumHandle(url.pathname);
      if (handle) {
        candidates.push(`https://medium.com/feed/${handle}`);
      }

      const publication = MediumFeedResolver.extractMediumPublication(
        url.pathname
      );
      if (publication) {
        candidates.push(`https://medium.com/feed/${publication}`);
      }
    }

    // Custom domain fallback
    if (isMediumCustomDomain && !MediumFeedResolver.isMediumHost(hostname)) {
      candidates.push(`${url.origin}/feed`);
    }

    // Remove duplicates and exclude the original URL
    return [...new Set(candidates)].filter(
      (candidate) => candidate !== originalUrl
    );
  }

  /**
   * Check if content appears to be hosted on Medium (detects custom domains)
   */
  static isMediumPoweredContent(html: string): boolean {
    return /medium\.com|cdn-client\.medium\.com|mediumcdn/i.test(html);
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
    const contentType = await MediumFeedResolver.getContentType(url);

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
   * Resolve special platform feeds (Medium, custom domains, etc.)
   * Returns valid feeds or empty array on failure
   */
  async resolveFeeds(url: URL, html?: string): Promise<Feed[]> {
    try {
      const isMediumCustomDomain = html
        ? MediumFeedResolver.isMediumPoweredContent(html)
        : false;

      const candidates = MediumFeedResolver.buildMediumFeedCandidates(
        url,
        isMediumCustomDomain
      ).filter((candidate) => candidate !== url.href);

      if (!candidates.length) {
        return [];
      }

      const checkedFeeds = await Promise.all(
        candidates.map(async (candidate) => {
          const isFeed = await MediumFeedResolver.isFeedResponse(candidate);
          if (!isFeed) {
            return null;
          }
          return this.loadFeedData(candidate);
        })
      );

      return checkedFeeds.filter((feed): feed is Feed => !!feed);
    } catch (error) {
      pino.warn({ error }, "Failed to resolve special platform feeds");
      return [];
    }
  }
}
