import { formatDateTime } from "./date.js";

describe("formatDateTime", () => {
  const expectedDayMonth = (timestampMs: number) =>
    new Date(timestampMs).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
    });

  const expectedTime = (timestampMs: number) =>
    new Date(timestampMs).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  it("should handle second-precision timestamps", () => {
    const timestampMs = 1709328000 * 1000;
    const { dateStr, timeStr } = formatDateTime(1709328000);
    expect(timeStr).toBe(expectedTime(timestampMs));
    expect(dateStr).toBe(expectedDayMonth(timestampMs));
    expect(dateStr).toContain("/");
    expect(dateStr).not.toContain("2024");
  });

  it("should handle millisecond-precision timestamps", () => {
    const timestampMs = 1709328000000;
    const { dateStr, timeStr, dateTimeStr } = formatDateTime(timestampMs);
    expect(timeStr).toBe(expectedTime(timestampMs));
    expect(dateStr).toBe(expectedDayMonth(timestampMs));
    expect(dateTimeStr).toBe(`${dateStr} ${timeStr}`);
  });
});
