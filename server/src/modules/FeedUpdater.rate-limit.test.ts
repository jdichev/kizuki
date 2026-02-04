import FeedUpdater from "./FeedUpdater";

// Mock dependencies
jest.mock("./MixedDataModel", () => {
  const mockInsertFeed = jest.fn();
  const mockGetFeedByUrl = jest.fn();
  const mockInsertItem = jest.fn();

  return {
    __esModule: true,
    default: {
      getInstance: jest.fn(() => ({
        insertFeed: mockInsertFeed,
        getFeedByUrl: mockGetFeedByUrl,
        insertItem: mockInsertItem,
      })),
    },
  };
});

const mockFetchFeed = jest.fn();
jest.mock(
  "fetch-feed",
  () => ({
    fetchFeed: (...args: any[]) => mockFetchFeed(...args),
  }),
  { virtual: true }
);

describe("FeedUpdater - Domain Rate Limiting", () => {
  let feedUpdater: FeedUpdater;
  const callTimes = new Map<string, number[]>();

  beforeEach(() => {
    jest.clearAllMocks();
    callTimes.clear();
    feedUpdater = new FeedUpdater();

    // Mock fetchFeed to track call times per domain
    mockFetchFeed.mockImplementation((url: string) => {
      const domain = new URL(url).hostname;
      const now = Date.now();

      if (!callTimes.has(domain)) {
        callTimes.set(domain, []);
      }
      callTimes.get(domain)!.push(now);

      // Return a valid feed response
      return Promise.resolve(
        JSON.stringify({
          title: `Feed from ${domain}`,
          links: [`https://${domain}`],
          items: [],
        })
      );
    });
  });

  describe("extractDomain", () => {
    it("should extract domain from valid URLs", async () => {
      const feed = {
        id: 1,
        feedUrl: "https://example.com/feed.xml",
        title: "Test",
      };

      const feedUpdaterAny = feedUpdater as any;
      await feedUpdaterAny.loadFeedData(feed);

      expect(callTimes.has("example.com")).toBe(true);
    });

    it("should handle URLs with subdomains", async () => {
      const feed = {
        id: 1,
        feedUrl: "https://blog.example.com/feed.xml",
        title: "Test",
      };

      const feedUpdaterAny = feedUpdater as any;
      await feedUpdaterAny.loadFeedData(feed);

      expect(callTimes.has("blog.example.com")).toBe(true);
    });

    it("should handle URLs with ports", async () => {
      const feed = {
        id: 1,
        feedUrl: "https://example.com:8080/feed.xml",
        title: "Test",
      };

      const feedUpdaterAny = feedUpdater as any;
      await feedUpdaterAny.loadFeedData(feed);

      expect(callTimes.has("example.com")).toBe(true);
    });
  });

  describe("rate limiting behavior", () => {
    it("should delay requests to the same domain by at least 1 second", async () => {
      const feeds = [
        { id: 1, feedUrl: "https://youtube.com/feed1.xml", title: "Feed 1" },
        { id: 2, feedUrl: "https://youtube.com/feed2.xml", title: "Feed 2" },
        { id: 3, feedUrl: "https://youtube.com/feed3.xml", title: "Feed 3" },
      ];

      // Call loadFeedData sequentially to test the rate limiting
      const feedUpdaterAny = feedUpdater as any;
      for (const feed of feeds) {
        await feedUpdaterAny.loadFeedData(feed);
      }

      const youtubeTimes = callTimes.get("youtube.com")!;
      expect(youtubeTimes).toHaveLength(3);

      // Check that each request is at least 1000ms apart
      for (let i = 1; i < youtubeTimes.length; i++) {
        const timeDiff = youtubeTimes[i] - youtubeTimes[i - 1];
        expect(timeDiff).toBeGreaterThanOrEqual(999); // Allow 1ms margin
      }
    });

    it("should allow parallel requests to different domains", async () => {
      const feeds = [
        { id: 1, feedUrl: "https://youtube.com/feed.xml", title: "YouTube" },
        { id: 2, feedUrl: "https://reddit.com/feed.xml", title: "Reddit" },
        { id: 3, feedUrl: "https://twitter.com/feed.xml", title: "Twitter" },
      ];

      const startTime = Date.now();
      const feedUpdaterAny = feedUpdater as any;
      await Promise.all(feeds.map((feed) => feedUpdaterAny.loadFeedData(feed)));
      const endTime = Date.now();

      // All three should complete in roughly the same time (not 3 seconds)
      // Allow some margin for execution time
      expect(endTime - startTime).toBeLessThan(500);

      expect(callTimes.get("youtube.com")).toHaveLength(1);
      expect(callTimes.get("reddit.com")).toHaveLength(1);
      expect(callTimes.get("twitter.com")).toHaveLength(1);
    });

    it("should handle mixed domains with proper rate limiting", async () => {
      const feeds = [
        { id: 1, feedUrl: "https://youtube.com/feed1.xml", title: "YT 1" },
        { id: 2, feedUrl: "https://reddit.com/feed.xml", title: "Reddit" },
        { id: 3, feedUrl: "https://youtube.com/feed2.xml", title: "YT 2" },
        { id: 4, feedUrl: "https://twitter.com/feed.xml", title: "Twitter" },
        { id: 5, feedUrl: "https://youtube.com/feed3.xml", title: "YT 3" },
      ];

      const startTime = Date.now();
      const feedUpdaterAny = feedUpdater as any;

      // Process sequentially to test rate limiting
      for (const feed of feeds) {
        await feedUpdaterAny.loadFeedData(feed);
      }

      const endTime = Date.now();

      // YouTube should have 3 calls with delays between them
      const youtubeTimes = callTimes.get("youtube.com")!;
      expect(youtubeTimes).toHaveLength(3);

      // Check delays between YouTube requests
      for (let i = 1; i < youtubeTimes.length; i++) {
        const timeDiff = youtubeTimes[i] - youtubeTimes[i - 1];
        expect(timeDiff).toBeGreaterThanOrEqual(999); // Allow 1ms margin
      }

      // Other domains should have 1 call each
      expect(callTimes.get("reddit.com")).toHaveLength(1);
      expect(callTimes.get("twitter.com")).toHaveLength(1);

      // Total time should be ~2 seconds (2 delays for YouTube)
      expect(endTime - startTime).toBeGreaterThanOrEqual(1998);
      expect(endTime - startTime).toBeLessThan(2500);
    });

    it("should not delay the first request to a domain", async () => {
      const feed = {
        id: 1,
        feedUrl: "https://example.com/feed.xml",
        title: "First",
      };

      const startTime = Date.now();
      const feedUpdaterAny = feedUpdater as any;
      await feedUpdaterAny.loadFeedData(feed);
      const endTime = Date.now();

      // First request should be immediate (no delay)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should track domain request times independently", async () => {
      // Request from domain A
      const feedUpdaterAny = feedUpdater as any;
      await feedUpdaterAny.loadFeedData({
        id: 1,
        feedUrl: "https://domainA.com/feed.xml",
        title: "A1",
      });

      // Wait 500ms
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Request from domain B (should not wait)
      const startTimeB = Date.now();
      await feedUpdaterAny.loadFeedData({
        id: 2,
        feedUrl: "https://domainB.com/feed.xml",
        title: "B1",
      });
      const endTimeB = Date.now();

      expect(endTimeB - startTimeB).toBeLessThan(100);

      // Another request from domain A (should wait ~500ms more to reach 1000ms)
      await feedUpdaterAny.loadFeedData({
        id: 3,
        feedUrl: "https://domainA.com/feed2.xml",
        title: "A2",
      });

      const domainATimes = callTimes.get("domaina.com")!;
      expect(domainATimes).toHaveLength(2);
      const actualDelay = domainATimes[1] - domainATimes[0];
      expect(actualDelay).toBeGreaterThanOrEqual(999);
    });
  });

  describe("error handling", () => {
    it("should handle invalid URLs gracefully", async () => {
      mockFetchFeed.mockImplementationOnce(() => {
        return Promise.resolve(JSON.stringify({ items: [] }));
      });

      const feed = {
        id: 1,
        feedUrl: "not-a-valid-url",
        title: "Invalid",
      };

      const feedUpdaterAny = feedUpdater as any;
      const result = await feedUpdaterAny.loadFeedData(feed);

      // Should still work (falls back to using full URL as domain)
      expect(result.feed).toEqual(feed);
    });
  });
});
