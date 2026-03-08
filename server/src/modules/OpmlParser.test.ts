import opmlParser from "./OpmlParser";

describe("OpmlParser", () => {
  const validOpmlString = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>Test Feed Collection</title>
    </head>
    <body>
        <outline text="Tech" title="Tech">
            <outline text="Node.js Blog" title="Node.js Blog" xmlUrl="http://blog.nodejs.org/feed/" htmlUrl="https://nodejs.org/en/" type="rss" />
            <outline text="Rust Blog" title="Rust Blog" xmlUrl="http://blog.rust-lang.org/feed.xml" htmlUrl="https://blog.rust-lang.org/" type="rss" />
        </outline>
        <outline text="Design" title="Design">
            <outline text="CSS-Tricks" title="CSS-Tricks" xmlUrl="http://feeds.feedburner.com/CssTricks" htmlUrl="https://css-tricks.com" type="rss" />
        </outline>
    </body>
</opml>`;

  describe("load", () => {
    it("should parse OPML string and return categories and feeds", () => {
      const result = opmlParser.load(validOpmlString);

      expect(result).toHaveProperty("categories");
      expect(result).toHaveProperty("feeds");
    });

    it("should extract categories with title and text properties", () => {
      const result = opmlParser.load(validOpmlString);

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0]).toEqual({
        title: "Tech",
        text: "Tech",
      });
      expect(result.categories[1]).toEqual({
        title: "Design",
        text: "Design",
      });
    });

    it("should extract feeds with correct properties", () => {
      const result = opmlParser.load(validOpmlString);

      expect(result.feeds).toHaveLength(3);

      // Check first feed
      expect(result.feeds[0]).toEqual({
        categoryTitle: "Tech",
        title: "Node.js Blog",
        url: "https://nodejs.org/en/",
        feedUrl: "http://blog.nodejs.org/feed/",
        feedType: "rss",
      });

      // Check second feed
      expect(result.feeds[1]).toEqual({
        categoryTitle: "Tech",
        title: "Rust Blog",
        url: "https://blog.rust-lang.org/",
        feedUrl: "http://blog.rust-lang.org/feed.xml",
        feedType: "rss",
      });

      // Check third feed (from Design category)
      expect(result.feeds[2]).toEqual({
        categoryTitle: "Design",
        title: "CSS-Tricks",
        url: "https://css-tricks.com",
        feedUrl: "http://feeds.feedburner.com/CssTricks",
        feedType: "rss",
      });
    });

    it("should handle empty categories", () => {
      const opmlWithEmptyCategory = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>Test</title>
    </head>
    <body>
        <outline text="Empty" title="Empty">
        </outline>
    </body>
</opml>`;

      const result = opmlParser.load(opmlWithEmptyCategory);

      expect(result.categories).toHaveLength(1);
      expect(result.feeds).toHaveLength(0);
    });

    it("should extract feed attributes correctly", () => {
      const opmlWithFeed = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>Test</title>
    </head>
    <body>
        <outline text="Category" title="Category">
            <outline text="Feed Title" title="Feed Title" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com" type="atom" />
        </outline>
    </body>
</opml>`;

      const result = opmlParser.load(opmlWithFeed);

      expect(result.feeds[0].title).toBe("Feed Title");
      expect(result.feeds[0].feedUrl).toBe("https://example.com/feed.xml");
      expect(result.feeds[0].url).toBe("https://example.com");
      expect(result.feeds[0].feedType).toBe("atom");
      expect(result.feeds[0].categoryTitle).toBe("Category");
    });

    it("should handle multiple feeds in multiple categories", () => {
      const result = opmlParser.load(validOpmlString);

      const techFeeds = result.feeds.filter((f) => f.categoryTitle === "Tech");
      const designFeeds = result.feeds.filter(
        (f) => f.categoryTitle === "Design"
      );

      expect(techFeeds).toHaveLength(2);
      expect(designFeeds).toHaveLength(1);
    });

    it("should use outline text when category title is missing", () => {
      const textOnlyCategoryOpml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Text only category</title>
  </head>
  <body>
    <outline text="YT channels" type="category">
      <outline text="Some Feed" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com" type="rss" />
    </outline>
  </body>
</opml>`;

      const result = opmlParser.load(textOnlyCategoryOpml);

      expect(result.categories[0]).toEqual({
        title: "YT channels",
        text: "YT channels",
      });
      expect(result.feeds[0].categoryTitle).toBe("YT channels");
    });
  });
});
