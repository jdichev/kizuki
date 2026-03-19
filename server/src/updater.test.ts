const INTERVAL_MS = 10 * 60_000;
const DRIFT_THRESHOLD_MS = 30_000;

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockFeedUpdaterState = {
  isUpdateInProgress: false,
};

const mockItemCategorizerState = {
  isCategorizationInProgress: false,
};

const mockUpdateItems = jest.fn(async () => undefined);
const mockCategorize = jest.fn(
  async () => [] as Array<{ name: string; items: Item[] }>
);
const mockSetNextScheduledAt = jest.fn((_: number | null) => undefined);

const mockFeedUpdaterInstance = {
  get isUpdateInProgress() {
    return mockFeedUpdaterState.isUpdateInProgress;
  },
  updateItems: mockUpdateItems,
};

const mockItemCategorizerInstance = {
  get isCategorizationInProgress() {
    return mockItemCategorizerState.isCategorizationInProgress;
  },
  categorize: mockCategorize,
};

jest.mock("pino", () => ({
  __esModule: true,
  default: jest.fn(() => mockLogger),
}));

jest.mock("./modules/FeedUpdater", () => {
  const MockFeedUpdater = jest.fn(() => mockFeedUpdaterInstance);
  (MockFeedUpdater as any).setNextScheduledAt = mockSetNextScheduledAt;

  return {
    __esModule: true,
    default: MockFeedUpdater,
  };
});

jest.mock("./modules/ItemCategorizer", () => ({
  __esModule: true,
  default: jest.fn(() => mockItemCategorizerInstance),
}));

import Updater from "./updater";

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("Updater", () => {
  let now: number;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.useFakeTimers();
    now = 1_700_000_000_000;
    dateNowSpy = jest.spyOn(Date, "now").mockImplementation(() => now);

    mockFeedUpdaterState.isUpdateInProgress = false;
    mockItemCategorizerState.isCategorizationInProgress = false;
    mockUpdateItems.mockReset().mockResolvedValue(undefined);
    mockCategorize.mockReset().mockResolvedValue([]);
    mockSetNextScheduledAt.mockReset();
    mockLogger.debug.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
  });

  afterEach(() => {
    Updater.stop();
    jest.clearAllTimers();
    dateNowSpy.mockRestore();
    jest.useRealTimers();
  });

  it("starts with an immediate update and schedules the next run", async () => {
    Updater.start();
    await flushPromises();

    expect(mockUpdateItems).toHaveBeenCalledTimes(1);
    expect(mockCategorize).toHaveBeenCalledTimes(1);
    expect(mockSetNextScheduledAt).toHaveBeenCalledWith(now + INTERVAL_MS);
  });

  it("skips a cycle when a feed update is already in progress", async () => {
    mockFeedUpdaterState.isUpdateInProgress = true;

    Updater.start();
    await flushPromises();

    expect(mockUpdateItems).not.toHaveBeenCalled();
    expect(mockCategorize).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Update already in progress, skipping this update cycle"
    );
  });

  it("skips categorization when categorization is already in progress", async () => {
    mockItemCategorizerState.isCategorizationInProgress = true;

    Updater.start();
    await flushPromises();

    expect(mockUpdateItems).toHaveBeenCalledTimes(1);
    expect(mockCategorize).not.toHaveBeenCalled();
  });

  it("continues scheduling after an update failure and retries on the next cycle", async () => {
    mockUpdateItems
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    Updater.start();
    await flushPromises();

    expect(mockUpdateItems).toHaveBeenCalledTimes(1);
    expect(mockCategorize).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();

    now += INTERVAL_MS;
    jest.advanceTimersByTime(INTERVAL_MS);
    await flushPromises();

    expect(mockUpdateItems).toHaveBeenCalledTimes(2);
    expect(mockCategorize).toHaveBeenCalledTimes(1);
  });

  it("resynchronizes the next schedule when timer drift is significant", async () => {
    Updater.start();
    await flushPromises();

    mockSetNextScheduledAt.mockClear();
    now += INTERVAL_MS + DRIFT_THRESHOLD_MS + 1_000;

    jest.advanceTimersByTime(INTERVAL_MS);
    await flushPromises();

    expect(mockUpdateItems).toHaveBeenCalledTimes(2);
    expect(mockSetNextScheduledAt).toHaveBeenLastCalledWith(now + INTERVAL_MS);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { drift: DRIFT_THRESHOLD_MS + 1_000 },
      "Significant drift detected; resynchronizing schedule"
    );
  });

  it("keeps the schedule anchored when drift is within threshold", async () => {
    Updater.start();
    await flushPromises();

    // The first nextAt was set to now + INTERVAL_MS at start
    const firstNextAt = now + INTERVAL_MS;

    mockSetNextScheduledAt.mockClear();
    mockLogger.warn.mockClear();

    // Simulate timer firing slightly early — within threshold (drift is negative/small)
    const smallDrift = -(DRIFT_THRESHOLD_MS / 2); // fires a bit early
    now += INTERVAL_MS + smallDrift;

    jest.advanceTimersByTime(INTERVAL_MS);
    await flushPromises();

    expect(mockUpdateItems).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ drift: expect.any(Number) }),
      "Significant drift detected; resynchronizing schedule"
    );
    // nextAt stays anchored: firstNextAt + INTERVAL_MS, not rebased from now
    expect(mockSetNextScheduledAt).toHaveBeenLastCalledWith(
      firstNextAt + INTERVAL_MS
    );
  });

  it("stops future scheduled runs when stopped", async () => {
    Updater.start();
    await flushPromises();

    mockUpdateItems.mockClear();
    mockCategorize.mockClear();

    Updater.stop();
    now += INTERVAL_MS * 2;
    jest.advanceTimersByTime(INTERVAL_MS * 2);
    await flushPromises();

    expect(mockUpdateItems).not.toHaveBeenCalled();
    expect(mockCategorize).not.toHaveBeenCalled();
    expect(mockSetNextScheduledAt).toHaveBeenLastCalledWith(null);
  });
});
