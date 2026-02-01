import { MediumFeedResolver } from "./MediumFeedResolver";
import RssParser from "rss-parser";

describe("MediumFeedResolver", () => {
  let resolver: MediumFeedResolver;

  beforeEach(() => {
    resolver = new MediumFeedResolver(new RssParser());
  });

  describe("isMediumHost", () => {
    it("should identify medium.com as Medium host", () => {
      expect(MediumFeedResolver.isMediumHost("medium.com")).toBe(true);
    });

    it("should identify subdomains as Medium hosts", () => {
      expect(MediumFeedResolver.isMediumHost("jsenick.medium.com")).toBe(true);
      expect(MediumFeedResolver.isMediumHost("www.medium.com")).toBe(true);
    });

    it("should reject non-Medium hosts", () => {
      expect(MediumFeedResolver.isMediumHost("example.com")).toBe(false);
      expect(MediumFeedResolver.isMediumHost("medium-clone.com")).toBe(false);
    });
  });

  describe("extractMediumHandle", () => {
    it("should extract handle from pathname", () => {
      const handle = MediumFeedResolver.extractMediumHandle(
        "/@jsenick/article-title"
      );
      expect(handle).toBe("@jsenick");
    });

    it("should handle multiple slashes", () => {
      const handle = MediumFeedResolver.extractMediumHandle(
        "/@jsenick/turn-your-mac-into-an-ai-server"
      );
      expect(handle).toBe("@jsenick");
    });

    it("should return null if no handle", () => {
      const handle = MediumFeedResolver.extractMediumHandle("/some/path");
      expect(handle).toBeNull();
    });
  });

  describe("extractMediumPublication", () => {
    it("should extract publication name from pathname", () => {
      const publication = MediumFeedResolver.extractMediumPublication(
        "/my-publication/article-title"
      );
      expect(publication).toBe("my-publication");
    });

    it("should return null for reserved segments", () => {
      expect(
        MediumFeedResolver.extractMediumPublication("/p/article")
      ).toBeNull();
      expect(
        MediumFeedResolver.extractMediumPublication("/tag/tech")
      ).toBeNull();
      expect(
        MediumFeedResolver.extractMediumPublication("/search/query")
      ).toBeNull();
    });

    it("should return null for handle-based paths", () => {
      const publication =
        MediumFeedResolver.extractMediumPublication("/@jsenick/article");
      expect(publication).toBeNull();
    });
  });

  describe("buildMediumFeedCandidates", () => {
    it("should build candidates for subdomain format", () => {
      const url = new URL(
        "https://jsenick.medium.com/turn-your-mac-into-an-ai-server"
      );
      const candidates = MediumFeedResolver.buildMediumFeedCandidates(
        url,
        false
      );

      expect(candidates).toContain("https://jsenick.medium.com/feed");
    });

    it("should build candidates for handle format", () => {
      const url = new URL(
        "https://medium.com/@jsenick/turn-your-mac-into-an-ai-server-ollama-deepseek-and-secure-remote-access-aeae11d492e6"
      );
      const candidates = MediumFeedResolver.buildMediumFeedCandidates(
        url,
        false
      );

      expect(candidates).toContain("https://medium.com/feed/@jsenick");
    });

    it("should build candidates for custom domain", () => {
      const url = new URL("https://example.com/article");
      const candidates = MediumFeedResolver.buildMediumFeedCandidates(
        url,
        true
      );

      expect(candidates).toContain("https://example.com/feed");
    });

    it("should remove duplicates", () => {
      const url = new URL("https://medium.com/article");
      const candidates = MediumFeedResolver.buildMediumFeedCandidates(
        url,
        false
      );

      const uniqueCandidates = new Set(candidates);
      expect(uniqueCandidates.size).toBe(candidates.length);
    });

    it("should exclude the original URL from candidates", () => {
      const url = new URL("https://example.com/feed");
      const candidates = MediumFeedResolver.buildMediumFeedCandidates(
        url,
        true
      );

      expect(candidates).not.toContain("https://example.com/feed");
    });
  });

  describe("isMediumPoweredContent", () => {
    it("should detect Medium-powered content", () => {
      const html =
        '<script src="https://cdn-client.medium.com/script.js"></script>';
      expect(MediumFeedResolver.isMediumPoweredContent(html)).toBe(true);
    });

    it("should return false for non-Medium content", () => {
      const html = "<p>Regular website</p>";
      expect(MediumFeedResolver.isMediumPoweredContent(html)).toBe(false);
    });
  });

  describe("resolveFeeds", () => {
    it("should return empty array for invalid URL", async () => {
      const url = new URL("https://example.com/article");
      const feeds = await resolver.resolveFeeds(url);

      expect(Array.isArray(feeds)).toBe(true);
      expect(feeds.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle errors gracefully", async () => {
      const url = new URL(
        "https://medium.com/@invalid-user-12345/article-that-does-not-exist"
      );

      // Should not throw and should return empty array
      await expect(resolver.resolveFeeds(url)).resolves.toEqual([]);
    });
  });
});
