import request from "supertest";
import * as ArticleToMarkdown from "./modules/ArticleToMarkdown";
import MixedDataModel from "./modules/MixedDataModel";
import GoogleAiService from "./modules/GoogleAiService";

// Define mock objects
const mockDataModel = {
  getItemSummary: jest.fn(),
  updateItemSummary: jest.fn(),
  getItemLatestContent: jest.fn(),
  updateItemLatestContent: jest.fn(),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

const mockAiService = {
  isConfigured: jest.fn().mockReturnValue(true),
  summarizeArticle: jest.fn(),
  getSummarizationModel: jest.fn(() => "models/gemma-3-27b-it"),
  getInstance: jest.fn(),
};

// Mock the modules BEFORE importing server
jest.mock("./modules/ArticleToMarkdown", () => ({
  appendLatestContentSourceUrl: jest.fn((m, u) => m),
  convertArticleToMarkdown: jest.fn(),
}));

jest.mock("./modules/MixedDataModel", () => ({
  getInstance: jest.fn(() => mockDataModel),
}));

jest.mock("./modules/GoogleAiService", () => ({
  getInstance: jest.fn(() => mockAiService),
}));

// Mock other dependencies that server.ts might initialize
jest.mock("./modules/FeedUpdater", () => {
  return jest.fn().mockImplementation(() => ({}));
});
jest.mock("./modules/SettingsManager", () => ({
  getInstance: jest.fn(() => ({
    on: jest.fn(),
  })),
}));
jest.mock("./modules/GoogleServiceUsageManager", () => ({
  getInstance: jest.fn(() => ({})),
}));

// Now import server
import server from "./server";
import type { Application } from "express";

describe("API Error Propagation", function () {
  let app: Application;

  beforeAll(async () => {
    app = await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe("POST /api/retrieve-latest", function () {
    it("returns error field when retrieval fails but cached content exists", async () => {
      const url = "https://example.com/error-with-cache";
      mockDataModel.getItemLatestContent.mockResolvedValue(
        "Cached content that is long enough to be returned even on error."
      );
      (
        ArticleToMarkdown.convertArticleToMarkdown as jest.Mock
      ).mockRejectedValue(new Error("Network failure"));

      const response = await request(app)
        .post("/api/retrieve-latest")
        .send({ url, format: "markdown" });

      expect(response.status).toBe(200);
      expect(response.body.markdown).toContain("Cached content");
      expect(response.body.fromCache).toBe(true);
      expect(response.body.error).toBe("Network failure");
    });

    it("returns error field when retrieval fails and no cache exists", async () => {
      const url = "https://example.com/error-no-cache";
      mockDataModel.getItemLatestContent.mockResolvedValue(null);
      (
        ArticleToMarkdown.convertArticleToMarkdown as jest.Mock
      ).mockRejectedValue(new Error("Connection refused"));

      const response = await request(app)
        .post("/api/retrieve-latest")
        .send({ url, format: "markdown" });

      expect(response.status).toBe(200);
      expect(response.body.markdown).toBeNull();
      expect(response.body.fromCache).toBe(false);
      expect(response.body.error).toBe("Connection refused");
    });
  });

  describe("POST /api/summarize", function () {
    it("returns latestContentError when summarization succeeds but refresh failed", async () => {
      const url = "https://example.com/summarize-with-refresh-error";
      const longContent =
        "This is a very long piece of content that exceeds the minimum word count required for summarization. ".repeat(
          20
        );

      mockDataModel.getItemSummary.mockResolvedValue(null);
      mockDataModel.getItemLatestContent.mockResolvedValue(longContent);
      (
        ArticleToMarkdown.convertArticleToMarkdown as jest.Mock
      ).mockRejectedValue(new Error("Refresh failed"));
      mockAiService.summarizeArticle.mockResolvedValue("This is a summary.");

      const response = await request(app)
        .post("/api/summarize")
        .send({ url, format: "markdown", forceRefreshLatest: true });

      expect(response.status).toBe(200);
      expect(response.body.summary).toBe("This is a summary.");
      expect(response.body.latestContentError).toBe("Refresh failed");
    });

    it("prioritizes retrieval error over insufficient content error", async () => {
      const url = "https://example.com/short-content-error";
      const shortContent = "Too short.";

      mockDataModel.getItemSummary.mockResolvedValue(null);
      mockDataModel.getItemLatestContent.mockResolvedValue(null);
      (
        ArticleToMarkdown.convertArticleToMarkdown as jest.Mock
      ).mockRejectedValue(new Error("Critical fetch error"));

      const response = await request(app)
        .post("/api/summarize")
        .send({ url, format: "markdown", content: shortContent });

      expect(response.status).toBe(200);
      expect(response.body.skipped).toBe(true);
      expect(response.body.reason).toContain(
        "Failed to retrieve latest content: Critical fetch error"
      );
    });
  });
});

describe("Server Basic Endpoints", function () {
  it("sets no-cache headers on /api/summarize", async () => {
    const app = await server.start();
    const response = await request(app).post("/api/summarize").send({});

    expect(response.status).toBe(400);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["pragma"]).toBe("no-cache");
    expect(response.headers["expires"]).toBe("0");
  });

  it("sets no-cache headers on /api/retrieve-latest", async () => {
    const app = await server.start();
    const response = await request(app).post("/api/retrieve-latest").send({});

    expect(response.status).toBe(400);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["pragma"]).toBe("no-cache");
    expect(response.headers["expires"]).toBe("0");
  });
});
