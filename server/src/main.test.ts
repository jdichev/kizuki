const mockServerStart = jest.fn();
const mockServerStop = jest.fn();
const mockUpdaterStart = jest.fn();
const mockUpdaterStop = jest.fn();

jest.mock("./server", () => ({
  __esModule: true,
  default: {
    start: mockServerStart,
    stop: mockServerStop,
  },
}));

jest.mock("./updater", () => ({
  __esModule: true,
  default: {
    start: mockUpdaterStart,
    stop: mockUpdaterStop,
  },
}));

jest.mock("forestconfig", () => ({
  __esModule: true,
  default: {
    dataServerPort: 4312,
  },
}));

import Main from "./main";

describe("Main", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockServerStart.mockReset().mockResolvedValue(undefined);
    mockServerStop.mockReset();
    mockUpdaterStart.mockReset();
    mockUpdaterStop.mockReset();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("starts the server immediately and delays updater start by 30 seconds", async () => {
    await Main.start();

    expect(mockServerStart).toHaveBeenCalledWith({ port: 4312 });
    expect(mockUpdaterStart).not.toHaveBeenCalled();

    jest.advanceTimersByTime(29_999);
    expect(mockUpdaterStart).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockUpdaterStart).toHaveBeenCalledTimes(1);
  });

  it("stops both the server and the updater", () => {
    Main.stop();

    expect(mockServerStop).toHaveBeenCalledTimes(1);
    expect(mockUpdaterStop).toHaveBeenCalledTimes(1);
  });
});
