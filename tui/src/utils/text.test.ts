import { visualTruncate, cleanContent } from "./text.js";
import stringWidth from "string-width";

describe("visualTruncate", () => {
  it("should truncate Japanese text to exact visual width", () => {
    const input = "「データ不足」の壁を越える";
    const width = 10;
    const result = visualTruncate(input, width);
    expect(stringWidth(result)).toBe(width);
  });

  it("should truncate Hindi/Bengali text with grapheme clusters", () => {
    const input = "আসল বিজয়ী?";
    const width = 15;
    const result = visualTruncate(input, width);
    expect(stringWidth(result)).toBe(width);
  });

  it("should normalize multiple spaces into one", () => {
    const input = "Word1    Word2";
    const result = visualTruncate(input, 20);
    expect(result).toContain("Word1 Word2");
  });
});

describe("cleanContent", () => {
  it("should remove HTML tags", () => {
    const html = "<p>Hello <b>World</b></p>";
    expect(cleanContent(html)).toBe("Hello World");
  });

  it("should decode HTML entities", () => {
    const html = "It&#039;s a test";
    expect(cleanContent(html)).toBe("It's a test");
  });
});
