import { formatDateTime } from "./date.js";

describe("formatDateTime", () => {
  it("should handle second-precision timestamps", () => {
    // 1709328000 = 2024-03-01 21:20
    const { dateStr, timeStr } = formatDateTime(1709328000);
    expect(dateStr).toBe("01/03/2024");
    expect(timeStr).toBe("21:20");
  });

  it("should handle millisecond-precision timestamps", () => {
    const { dateStr, timeStr } = formatDateTime(1709328000000);
    expect(dateStr).toBe("01/03/2024");
    expect(timeStr).toBe("21:20");
  });
});
