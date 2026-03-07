import { countWordLikeTokens } from "./WordCount";

describe("countWordLikeTokens", () => {
  it("counts plain English words", () => {
    expect(countWordLikeTokens("Hello world from Forest")).toBe(4);
  });

  it("counts Chinese/Japanese/Korean text as word-like segments", () => {
    expect(
      countWordLikeTokens("今日は天気がいいです。明日も晴れるでしょう。")
    ).toBeGreaterThan(0);
  });

  it("strips HTML when requested", () => {
    expect(
      countWordLikeTokens("<p>Hello <strong>world</strong></p>", {
        stripHtml: true,
      })
    ).toBe(2);
  });
});
