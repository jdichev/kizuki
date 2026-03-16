import axios from "axios";
import {
  appendLatestContentSourceUrl,
  convertArticleToMarkdown,
} from "./ArticleToMarkdown";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("ArticleToMarkdown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("appendLatestContentSourceUrl", () => {
    it("should append source URL footer at the bottom", () => {
      const result = appendLatestContentSourceUrl(
        "# Title\n\nBody text",
        "https://example.com/final"
      );

      expect(result).toBe(
        "# Title\n\nBody text\n\n---\n\nSource URL: https://example.com/final"
      );
    });

    it("should not append duplicate source URL footer", () => {
      const existing =
        "# Title\n\nBody text\n\n---\n\nSource URL: https://example.com/final";

      expect(
        appendLatestContentSourceUrl(existing, "https://example.com/other")
      ).toBe(existing);
    });
  });

  describe("convertArticleToMarkdown", () => {
    it("should append the final redirected source URL", async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: "User-agent: *\nAllow: /" } as any)
        .mockResolvedValueOnce({
          data: `
            <html>
              <head><title>Example</title></head>
              <body>
                <article>
                  <h1>Example Title</h1>
                  <p>Hello world from the article body.</p>
                </article>
              </body>
            </html>
          `,
          headers: { "content-type": "text/html; charset=utf-8" },
          request: {
            res: {
              responseUrl: "https://final.example.com/story",
            },
          },
          config: {
            url: "https://news.ycombinator.com/item?id=123",
          },
        } as any);

      const markdown = await convertArticleToMarkdown(
        "https://news.ycombinator.com/item?id=123"
      );

      expect(markdown).toContain("# Example");
      expect(markdown).toContain("Hello world from the article body.");
      expect(markdown).toContain("Source URL: https://final.example.com/story");
      expect(
        markdown.trim().endsWith("Source URL: https://final.example.com/story")
      ).toBe(true);
    });
  });
});
