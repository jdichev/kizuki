
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

const mockDataModel = {
  getFeeds: jest.fn(),
  insertItem: jest.fn(),
  insertFeed: jest.fn(),
  getFeedByUrl: jest.fn(),
};

jest.mock("./MixedDataModel", () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => mockDataModel),
  },
}));

const mockFetchFeed = jest.fn();
jest.mock(
  "fetch-feed",
  () => ({
    fetchFeed: (...args: any[]) => mockFetchFeed(...args),
  }),
  { virtual: true }
);

const FeedUpdater = require("./FeedUpdater").default as typeof import("./FeedUpdater").default;

describe("FeedUpdater - Frequency Gating", () => {
  let feedUpdater: InstanceType<typeof FeedUpdater>;

  const makeFeed = (id: number, feedUrl: string): Feed => ({
    id,
    feedUrl,
    title: `Feed ${id}`,
    url: feedUrl,
  });

  const setFrequencyCache = (
    entries: Array<{ id: number; frequency: number; lastUpdate?: number }>
  ) => {
    const feedUpdaterAny = feedUpdater as any;
    const lastUpdateTimes: Record<string, number> = {};
    const feedFrequencies: Record<string, number> = {};

    for (const entry of entries) {
      feedFrequencies[String(entry.id)] = entry.frequency;
      if (entry.lastUpdate !== undefined) {
        lastUpdateTimes[String(entry.id)] = entry.lastUpdate;
      }
    }

    feedUpdaterAny.feedsProcCache = {
      lastUpdateTimes,
      feedFrequencies,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    feedUpdater = new FeedUpdater();

    mockFetchFeed.mockImplementation((feedUrl: string) => {
      if (feedUrl.includes("low")) {
        return Promise.resolve(
          JSON.stringify({
            title: "low",
            links: [feedUrl],
            items: [
              {
                title: "single",
                published: 1_700_000_000,
              },
            ],
          })
        );
      }

      return Promise.resolve(
        JSON.stringify({
          title: "high",
          links: [feedUrl],
          items: [
            {
              title: "a",
              published: 1_700_000_000,
            },
            {
              title: "b",
              published: 1_700_003_600,
            },
          ],
        })
      );
    });
  });

  it("includes new feeds with no cached frequency data", () => {
    const feedUpdaterAny = feedUpdater as any;
    setFrequencyCache([]);

    const feeds = [makeFeed(1, "https://new-feed.example.com/rss")];
    const filtered = feedUpdaterAny.filterByFrequency(feeds);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });

  it("includes high-frequency feeds every cycle (<= 1 day)", () => {
    const now = Date.now();
    const feedUpdaterAny = feedUpdater as any;
    const feeds = [
      makeFeed(1, "https://high-a.example.com/rss"),
      makeFeed(2, "https://high-b.example.com/rss"),
    ];

    setFrequencyCache([
      { id: 1, frequency: ONE_DAY_MS, lastUpdate: now },
      { id: 2, frequency: ONE_DAY_MS - 1, lastUpdate: now },
    ]);

    const filtered = feedUpdaterAny.filterByFrequency(feeds);

    expect(filtered.map((f: Feed) => f.id).sort()).toEqual([1, 2]);
  });

  it("treats frequency > 1 day as low-frequency and gates by 1 hour", () => {
    const baseNow = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(baseNow);
    const feedUpdaterAny = feedUpdater as any;

    const feeds = [makeFeed(10, "https://low.example.com/rss")];

    setFrequencyCache([
      {
        id: 10,
        frequency: ONE_DAY_MS + 1,
        lastUpdate: baseNow - (ONE_HOUR_MS - 1),
      },
    ]);

    const filtered = feedUpdaterAny.filterByFrequency(feeds);

    expect(filtered).toHaveLength(0);
    nowSpy.mockRestore();
  });

  it("includes low-frequency feeds exactly at the 1-hour boundary", () => {
    const baseNow = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(baseNow);
    const feedUpdaterAny = feedUpdater as any;

    const feeds = [makeFeed(11, "https://low.example.com/rss")];

    setFrequencyCache([
      {
        id: 11,
        frequency: ONE_DAY_MS + 1,
        lastUpdate: baseNow - ONE_HOUR_MS,
      },
    ]);

    const filtered = feedUpdaterAny.filterByFrequency(feeds);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(11);
    nowSpy.mockRestore();
  });

  it("includes low-frequency feeds when last update is missing", () => {
    const feedUpdaterAny = feedUpdater as any;
    const feeds = [makeFeed(12, "https://low.example.com/rss")];

    setFrequencyCache([
      {
        id: 12,
        frequency: ONE_DAY_MS + 1,
      },
    ]);

    const filtered = feedUpdaterAny.filterByFrequency(feeds);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(12);
  });

  it("checks low-frequency feeds not more than once per hour across update cycles", async () => {
    let now = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => now);

    const highFeed = makeFeed(20, "https://high.example.com/rss");
    const lowFeed = makeFeed(21, "https://low.example.com/rss");
    mockDataModel.getFeeds.mockResolvedValue([highFeed, lowFeed]);

    await feedUpdater.updateItems();

    const firstPassCallsByUrl = mockFetchFeed.mock.calls.reduce(
      (acc: Record<string, number>, [url]) => {
        acc[url] = (acc[url] || 0) + 1;
        return acc;
      },
      {}
    );

    expect(firstPassCallsByUrl[highFeed.feedUrl]).toBe(1);
    expect(firstPassCallsByUrl[lowFeed.feedUrl]).toBe(1);

    now += 30 * 60 * 1000;
    await feedUpdater.updateItems();

    const secondPassCallsByUrl = mockFetchFeed.mock.calls.reduce(
      (acc: Record<string, number>, [url]) => {
        acc[url] = (acc[url] || 0) + 1;
        return acc;
      },
      {}
    );

    expect(secondPassCallsByUrl[highFeed.feedUrl]).toBe(2);
    expect(secondPassCallsByUrl[lowFeed.feedUrl]).toBe(1);

    now += 30 * 60 * 1000;
    await feedUpdater.updateItems();

    const thirdPassCallsByUrl = mockFetchFeed.mock.calls.reduce(
      (acc: Record<string, number>, [url]) => {
        acc[url] = (acc[url] || 0) + 1;
        return acc;
      },
      {}
    );

    expect(thirdPassCallsByUrl[highFeed.feedUrl]).toBe(3);
    expect(thirdPassCallsByUrl[lowFeed.feedUrl]).toBe(2);

    nowSpy.mockRestore();
  });

  it("computeFrequency returns 1 week for sparse history", () => {
    const feedUpdaterClassAny = FeedUpdater as any;
    const frequency = feedUpdaterClassAny.computeFrequency([1_700_000_000_000]);

    expect(frequency).toBe(ONE_WEEK_MS);
  });

  it("computeFrequency returns 1 hour when average interval computes to 0", () => {
    const feedUpdaterClassAny = FeedUpdater as any;
    const sameTimestamp = 1_700_000_000_000;
    const frequency = feedUpdaterClassAny.computeFrequency([
      sameTimestamp,
      sameTimestamp,
      sameTimestamp,
    ]);

    expect(frequency).toBe(ONE_HOUR_MS);
  });

  it("applies domain throttling only to the feeds that pass frequency gating", async () => {
    const feedUpdaterAny = feedUpdater as any;
    const now = Date.now();

    const eligibleA = makeFeed(30, "https://same-domain.example.com/a.xml");
    const eligibleB = makeFeed(31, "https://same-domain.example.com/b.xml");
    const ineligible = makeFeed(32, "https://same-domain.example.com/c.xml");

    setFrequencyCache([
      { id: 30, frequency: ONE_HOUR_MS, lastUpdate: now },
      { id: 31, frequency: ONE_HOUR_MS, lastUpdate: now },
      {
        id: 32,
        frequency: ONE_DAY_MS + 1,
        lastUpdate: now - (ONE_HOUR_MS - 1),
      },
    ]);

    mockDataModel.getFeeds.mockResolvedValue([
      eligibleA,
      eligibleB,
      ineligible,
    ]);

    const callTimes: number[] = [];
    mockFetchFeed.mockImplementation(async (url: string) => {
      if (url.includes("same-domain.example.com")) {
        callTimes.push(Date.now());
      }
      return JSON.stringify({
        title: "x",
        links: [url],
        items: [],
      });
    });

    await feedUpdater.updateItems();

    const sameDomainCalls = mockFetchFeed.mock.calls
      .map((args) => args[0] as string)
      .filter((url) => url.includes("same-domain.example.com"));

    expect(sameDomainCalls).toHaveLength(2);
    expect(sameDomainCalls).toContain(eligibleA.feedUrl);
    expect(sameDomainCalls).toContain(eligibleB.feedUrl);
    expect(sameDomainCalls).not.toContain(ineligible.feedUrl);

    // Only assert spacing if runtime timing captured both calls
    if (callTimes.length === 2) {
      expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(650);
    }

    expect(feedUpdaterAny.isUpdateInProgress).toBe(false);
  });
});
