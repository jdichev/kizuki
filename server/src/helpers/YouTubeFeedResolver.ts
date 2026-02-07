import RssParser from "rss-parser";
import axios from "axios";
import pinoLib from "pino";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "YouTubeFeedResolver",
});

/**
 * Helper class to resolve RSS feeds for YouTube channels and videos.
 */
export class YouTubeFeedResolver {
  private rssParser: RssParser;

  constructor(rssParser: RssParser) {
    this.rssParser = rssParser;
  }

  /**
   * Check if a hostname belongs to YouTube or a YouTube short domain.
   */
  static isYouTubeHost(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    return (
      lower === "youtu.be" ||
      lower === "youtube.com" ||
      lower.endsWith(".youtube.com") ||
      lower === "youtube-nocookie.com" ||
      lower.endsWith(".youtube-nocookie.com")
    );
  }

  /**
   * Extract channel id from a URL pathname.
   */
  static extractChannelIdFromPath(pathname: string): string | null {
    const match = pathname.match(/\/channel\/(UC[\w-]{20,})/);
    return match ? match[1] : null;
  }

  /**
   * Extract YouTube handle from a pathname like /@handle
   */
  static extractHandle(pathname: string): string | null {
    const match = pathname.match(/\/(@[^/]+)/);
    return match ? match[1].slice(1) : null;
  }

  /**
   * Extract user or custom channel path segment.
   */
  static extractUserOrCustom(
    pathname: string
  ): { type: "user" | "c"; value: string } | null {
    const match = pathname.match(/\/(user|c)\/([^/]+)/);
    return match ? { type: match[1] as "user" | "c", value: match[2] } : null;
  }

  /**
   * Extract video id from common YouTube URL forms.
   */
  static extractVideoId(url: URL): string | null {
    const hostname = url.hostname.toLowerCase();

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId || null;
    }

    if (YouTubeFeedResolver.isYouTubeHost(hostname)) {
      if (url.pathname.startsWith("/watch")) {
        return url.searchParams.get("v");
      }

      const shortMatch = url.pathname.match(/\/(shorts|embed|v)\/([^/]+)/);
      return shortMatch ? shortMatch[2] : null;
    }

    return null;
  }

  /**
   * Extract channel id from HTML content.
   */
  static extractChannelIdFromHtml(html: string): string | null {
    const match = html.match(/"(channelId|externalId)":"(UC[\w-]{20,})"/);
    return match ? match[2] : null;
  }

  /**
   * Build YouTube feed URL for a channel.
   */
  static buildFeedUrl(channelId: string): string {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  }

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

  private static async isFeedResponse(url: string): Promise<boolean> {
    const feedContentTypes = [
      "application/x-rss+xml",
      "application/rss+xml",
      "application/atom+xml",
      "application/xml",
      "text/xml",
    ];
    const contentType = await YouTubeFeedResolver.getContentType(url);

    return typeof contentType === "string"
      ? feedContentTypes.includes(contentType)
      : false;
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
          pino.debug(e, "Failed to parse feed");
          resolve(null);
        });
    });
  }

  private async fetchHtml(url: string): Promise<string | null> {
    const res = await axios
      .get(url, {
        headers: {
          "Accept-Encoding": "gzip, deflate",
          "User-Agent": "Forest/1.0 (Feed Reader)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      })
      .catch((reason) => {
        pino.debug(reason, "Failed to fetch YouTube page");
      });

    if (!res || typeof res.data !== "string") {
      return null;
    }

    return res.data;
  }

  private async resolveChannelIdFromVideoUrl(
    videoUrl: string
  ): Promise<string | null> {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      videoUrl
    )}&format=json`;

    try {
      const res = await axios.get(oembedUrl, {
        headers: {
          "Accept-Encoding": "gzip, deflate",
          "User-Agent": "Forest/1.0 (Feed Reader)",
        },
      });

      const authorUrl = res.data?.author_url;
      if (typeof authorUrl !== "string") {
        return null;
      }

      const author = new URL(authorUrl);
      return this.resolveChannelIdFromUrl(author);
    } catch (error) {
      pino.debug({ error }, "Failed to resolve YouTube video author");
      return null;
    }
  }

  private async resolveChannelIdFromUrl(
    url: URL,
    html?: string
  ): Promise<string | null> {
    const fromPath = YouTubeFeedResolver.extractChannelIdFromPath(url.pathname);
    if (fromPath) {
      return fromPath;
    }

    const fromHtml = html
      ? YouTubeFeedResolver.extractChannelIdFromHtml(html)
      : null;
    if (fromHtml) {
      return fromHtml;
    }

    const videoId = YouTubeFeedResolver.extractVideoId(url);
    if (videoId) {
      const channelId = await this.resolveChannelIdFromVideoUrl(url.href);
      if (channelId) {
        return channelId;
      }
    }

    const handle = YouTubeFeedResolver.extractHandle(url.pathname);
    if (handle) {
      const handleUrl = new URL(`https://www.youtube.com/@${handle}`);
      const handleHtml = await this.fetchHtml(handleUrl.href);
      return handleHtml
        ? YouTubeFeedResolver.extractChannelIdFromHtml(handleHtml)
        : null;
    }

    const userOrCustom = YouTubeFeedResolver.extractUserOrCustom(url.pathname);
    if (userOrCustom) {
      const userUrl = new URL(
        `https://www.youtube.com/${userOrCustom.type}/${userOrCustom.value}`
      );
      const userHtml = await this.fetchHtml(userUrl.href);
      return userHtml
        ? YouTubeFeedResolver.extractChannelIdFromHtml(userHtml)
        : null;
    }

    if (!html && YouTubeFeedResolver.isYouTubeHost(url.hostname)) {
      const pageHtml = await this.fetchHtml(url.href);
      return pageHtml
        ? YouTubeFeedResolver.extractChannelIdFromHtml(pageHtml)
        : null;
    }

    return null;
  }

  /**
   * Resolve YouTube channel feeds from channel or video URLs.
   */
  async resolveFeeds(url: URL, html?: string): Promise<Feed[]> {
    try {
      if (!YouTubeFeedResolver.isYouTubeHost(url.hostname)) {
        return [];
      }

      const channelId = await this.resolveChannelIdFromUrl(url, html);
      if (!channelId) {
        return [];
      }

      const candidate = YouTubeFeedResolver.buildFeedUrl(channelId);
      if (candidate === url.href) {
        return [];
      }

      const isFeed = await YouTubeFeedResolver.isFeedResponse(candidate);
      if (!isFeed) {
        return [];
      }

      const feed = await this.loadFeedData(candidate);
      return feed ? [feed] : [];
    } catch (error) {
      pino.warn({ error }, "Failed to resolve YouTube feeds");
      return [];
    }
  }
}
