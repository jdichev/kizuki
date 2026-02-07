import { YouTubeFeedResolver } from "./YouTubeFeedResolver";

describe("YouTubeFeedResolver", () => {
  describe("isYouTubeHost", () => {
    it("should identify YouTube hosts", () => {
      expect(YouTubeFeedResolver.isYouTubeHost("youtube.com")).toBe(true);
      expect(YouTubeFeedResolver.isYouTubeHost("www.youtube.com")).toBe(true);
      expect(YouTubeFeedResolver.isYouTubeHost("m.youtube.com")).toBe(true);
      expect(YouTubeFeedResolver.isYouTubeHost("music.youtube.com")).toBe(true);
      expect(YouTubeFeedResolver.isYouTubeHost("youtu.be")).toBe(true);
    });

    it("should reject non-YouTube hosts", () => {
      expect(YouTubeFeedResolver.isYouTubeHost("example.com")).toBe(false);
      expect(YouTubeFeedResolver.isYouTubeHost("youtube-example.com")).toBe(
        false
      );
    });
  });

  describe("extractChannelIdFromPath", () => {
    it("should extract channel id from channel path", () => {
      const channelId = YouTubeFeedResolver.extractChannelIdFromPath(
        "/channel/UC1234567890123456789012"
      );
      expect(channelId).toBe("UC1234567890123456789012");
    });

    it("should return null when no channel id", () => {
      const channelId = YouTubeFeedResolver.extractChannelIdFromPath("/watch");
      expect(channelId).toBeNull();
    });
  });

  describe("extractHandle", () => {
    it("should extract handle from pathname", () => {
      const handle = YouTubeFeedResolver.extractHandle("/@devopstoolbox");
      expect(handle).toBe("devopstoolbox");
    });

    it("should return null when no handle", () => {
      const handle = YouTubeFeedResolver.extractHandle("/channel/UC123");
      expect(handle).toBeNull();
    });
  });

  describe("extractUserOrCustom", () => {
    it("should extract user path", () => {
      const res = YouTubeFeedResolver.extractUserOrCustom("/user/ForestApp");
      expect(res).toEqual({ type: "user", value: "ForestApp" });
    });

    it("should extract custom path", () => {
      const res = YouTubeFeedResolver.extractUserOrCustom("/c/ForestApp");
      expect(res).toEqual({ type: "c", value: "ForestApp" });
    });

    it("should return null when no user or custom", () => {
      const res = YouTubeFeedResolver.extractUserOrCustom("/watch");
      expect(res).toBeNull();
    });
  });

  describe("extractVideoId", () => {
    it("should extract video id from watch URL", () => {
      const url = new URL("https://www.youtube.com/watch?v=CrIkUwo8FiY");
      expect(YouTubeFeedResolver.extractVideoId(url)).toBe("CrIkUwo8FiY");
    });

    it("should extract video id from youtu.be URL", () => {
      const url = new URL("https://youtu.be/CrIkUwo8FiY");
      expect(YouTubeFeedResolver.extractVideoId(url)).toBe("CrIkUwo8FiY");
    });

    it("should extract video id from shorts URL", () => {
      const url = new URL("https://www.youtube.com/shorts/CrIkUwo8FiY");
      expect(YouTubeFeedResolver.extractVideoId(url)).toBe("CrIkUwo8FiY");
    });

    it("should return null when no video id", () => {
      const url = new URL("https://www.youtube.com/channel/UC123");
      expect(YouTubeFeedResolver.extractVideoId(url)).toBeNull();
    });
  });

  describe("extractChannelIdFromHtml", () => {
    it("should extract channel id from channelId field", () => {
      const html = '{"channelId":"UC1234567890123456789012"}';
      expect(YouTubeFeedResolver.extractChannelIdFromHtml(html)).toBe(
        "UC1234567890123456789012"
      );
    });

    it("should extract channel id from externalId field", () => {
      const html = '{"externalId":"UC1234567890123456789012"}';
      expect(YouTubeFeedResolver.extractChannelIdFromHtml(html)).toBe(
        "UC1234567890123456789012"
      );
    });

    it("should return null when no channel id found", () => {
      const html = "<html></html>";
      expect(YouTubeFeedResolver.extractChannelIdFromHtml(html)).toBeNull();
    });
  });

  describe("buildFeedUrl", () => {
    it("should build feed URL for channel id", () => {
      const feedUrl = YouTubeFeedResolver.buildFeedUrl(
        "UC1234567890123456789012"
      );
      expect(feedUrl).toBe(
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC1234567890123456789012"
      );
    });
  });
});
