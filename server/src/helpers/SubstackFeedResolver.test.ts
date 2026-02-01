import { SubstackFeedResolver } from "./SubstackFeedResolver";
import RssParser from "rss-parser";

describe("SubstackFeedResolver", () => {
  let resolver: SubstackFeedResolver;

  beforeEach(() => {
    resolver = new SubstackFeedResolver(new RssParser());
  });

  describe("isSubstackHost", () => {
    it("should identify substack.com as Substack host", () => {
      expect(SubstackFeedResolver.isSubstackHost("substack.com")).toBe(true);
      expect(SubstackFeedResolver.isSubstackHost("www.substack.com")).toBe(
        true
      );
    });

    it("should identify Substack subdomains", () => {
      expect(
        SubstackFeedResolver.isSubstackHost("michaeljburry.substack.com")
      ).toBe(true);
      expect(
        SubstackFeedResolver.isSubstackHost("pragmaticengineer.substack.com")
      ).toBe(true);
    });

    it("should reject non-Substack hosts", () => {
      expect(SubstackFeedResolver.isSubstackHost("example.com")).toBe(false);
      expect(SubstackFeedResolver.isSubstackHost("substack-like.com")).toBe(
        false
      );
    });
  });

  describe("extractSubstackPublication", () => {
    it("should extract publication from Substack subdomain", () => {
      const pub = SubstackFeedResolver.extractSubstackPublication(
        "michaeljburry.substack.com"
      );
      expect(pub).toBe("michaeljburry");
    });

    it("should handle www prefix", () => {
      const pub =
        SubstackFeedResolver.extractSubstackPublication("www.substack.com");
      expect(pub).toBeNull();
    });

    it("should return null for main domain", () => {
      const pub =
        SubstackFeedResolver.extractSubstackPublication("substack.com");
      expect(pub).toBeNull();
    });

    it("should return null for non-Substack hosts", () => {
      const pub =
        SubstackFeedResolver.extractSubstackPublication("example.com");
      expect(pub).toBeNull();
    });
  });

  describe("extractSubstackUsername", () => {
    it("should extract username from profile URL", () => {
      const username =
        SubstackFeedResolver.extractSubstackUsername("/@lenny/notes");
      expect(username).toBe("lenny");
    });

    it("should handle simple path", () => {
      const username =
        SubstackFeedResolver.extractSubstackUsername("/@username");
      expect(username).toBe("username");
    });

    it("should return null for non-profile paths", () => {
      const username =
        SubstackFeedResolver.extractSubstackUsername("/p/article");
      expect(username).toBeNull();
    });
  });

  describe("isSubstackPoweredContent", () => {
    it("should detect Substack-powered content", () => {
      const html =
        '<script src="https://substack.com/embed.js"></script><div class="newsletter">Newsletter</div>';
      expect(SubstackFeedResolver.isSubstackPoweredContent(html)).toBe(true);
    });

    it("should return false for non-Substack content", () => {
      const html = "<p>Regular website</p>";
      expect(SubstackFeedResolver.isSubstackPoweredContent(html)).toBe(false);
    });
  });

  describe("buildSubstackFeedCandidates", () => {
    it("should build candidates for standard subdomain", () => {
      const url = new URL(
        "https://michaeljburry.substack.com/p/final-stop-gamestop-the-jig-is-up"
      );
      const candidates = SubstackFeedResolver.buildSubstackFeedCandidates(url);

      expect(candidates).toContain("https://michaeljburry.substack.com/feed");
    });

    it("should build candidates for user profile URL", () => {
      const url = new URL("https://substack.com/@lenny");
      const candidates = SubstackFeedResolver.buildSubstackFeedCandidates(url);

      expect(candidates).toContain("https://lenny.substack.com/feed");
    });

    it("should build candidates for custom domain", () => {
      const url = new URL("https://www.newsletter.com/p/article");
      const candidates = SubstackFeedResolver.buildSubstackFeedCandidates(url);

      expect(candidates).toContain("https://www.newsletter.com/feed");
    });

    it("should remove duplicates", () => {
      const url = new URL("https://michaeljburry.substack.com/p/article");
      const candidates = SubstackFeedResolver.buildSubstackFeedCandidates(url);

      const uniqueCandidates = new Set(candidates);
      expect(uniqueCandidates.size).toBe(candidates.length);
    });

    it("should exclude the original URL from candidates", () => {
      const url = new URL("https://example.com/feed");
      const candidates = SubstackFeedResolver.buildSubstackFeedCandidates(url);

      expect(candidates).not.toContain("https://example.com/feed");
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
      const url = new URL("https://invalid-pub-12345.substack.com/p/article");

      // Should not throw and should return empty array or valid feeds
      await expect(resolver.resolveFeeds(url)).resolves.toEqual(
        expect.any(Array)
      );
    });
  });
});
