import AiService from "./AiService";
import SettingsManager from "./SettingsManager";

// Mock the @google/genai module
jest.mock("@google/genai");

describe("AiService", () => {
  let aiService: AiService;
  let settingsManager: SettingsManager;
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Get instances
    settingsManager = SettingsManager.getInstance();
    aiService = AiService.getInstance();

    // Setup mock for generateContent
    mockGenerateContent = jest.fn();

    // Mock the GoogleGenAI constructor and methods
    const { GoogleGenAI } = require("@google/genai");
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    }));
  });

  describe("isConfigured", () => {
    it("should return false when API key is not set", () => {
      settingsManager.setSetting("GEMINI_API_KEY", "");
      aiService.refreshClient();

      expect(aiService.isConfigured()).toBe(false);
    });

    it("should return true when API key is set", () => {
      settingsManager.setSetting("GEMINI_API_KEY", "test-api-key");
      aiService.refreshClient();

      expect(aiService.isConfigured()).toBe(true);
    });
  });

  describe("generateContent", () => {
    beforeEach(() => {
      settingsManager.setSetting("GEMINI_API_KEY", "test-api-key");
      aiService.refreshClient();
    });

    it("should throw error when service is not configured", async () => {
      settingsManager.setSetting("GEMINI_API_KEY", "");
      aiService.refreshClient();

      await expect(aiService.generateContent("test prompt")).rejects.toThrow(
        "AI Service is not configured"
      );
    });

    it("should throw error when prompt is empty", async () => {
      await expect(aiService.generateContent("")).rejects.toThrow(
        "Prompt cannot be empty"
      );
    });

    it("should successfully generate content with valid prompt", async () => {
      const mockResponse = {
        text: "This is a generated response from Gemini",
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.generateContent("Explain TypeScript");

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-flash-preview",
        contents: "Explain TypeScript",
      });
      expect(result).toBe("This is a generated response from Gemini");
    });

    it("should use custom model when provided", async () => {
      const mockResponse = {
        text: "Response from custom model",
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.generateContent(
        "Test prompt",
        "gemini-pro"
      );

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-pro",
        contents: "Test prompt",
      });
      expect(result).toBe("Response from custom model");
    });

    it("should handle API errors gracefully", async () => {
      mockGenerateContent.mockRejectedValue(new Error("API quota exceeded"));

      await expect(aiService.generateContent("Test prompt")).rejects.toThrow(
        "Failed to generate AI content: API quota exceeded"
      );
    });
  });

  describe("generateContentWithOptions", () => {
    beforeEach(() => {
      settingsManager.setSetting("geminiApiKey", "test-api-key");
      aiService.refreshClient();
    });

    it("should generate content with system instruction", async () => {
      const mockResponse = {
        text: "Response with system instruction",
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.generateContentWithOptions({
        prompt: "Summarize this article",
        systemInstruction: "You are a helpful assistant",
      });

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-flash-preview",
        contents: "Summarize this article",
        systemInstruction: "You are a helpful assistant",
      });
      expect(result).toBe("Response with system instruction");
    });

    it("should generate content without system instruction", async () => {
      const mockResponse = {
        text: "Response without system instruction",
      };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.generateContentWithOptions({
        prompt: "Test prompt",
      });

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: "gemini-3-flash-preview",
        contents: "Test prompt",
      });
      expect(result).toBe("Response without system instruction");
    });
  });

  describe("refreshClient", () => {
    it("should reinitialize client when API key changes", () => {
      settingsManager.setSetting("geminiApiKey", "old-key");
      aiService.refreshClient();
      expect(aiService.isConfigured()).toBe(true);

      settingsManager.setSetting("geminiApiKey", "");
      aiService.refreshClient();
      expect(aiService.isConfigured()).toBe(false);

      settingsManager.setSetting("geminiApiKey", "new-key");
      aiService.refreshClient();
      expect(aiService.isConfigured()).toBe(true);
    });
  });

  describe("getDefaultModel", () => {
    it("should return the default model name", () => {
      expect(aiService.getDefaultModel()).toBe("gemini-3-flash-preview");
    });
  });

  describe("singleton pattern", () => {
    it("should return the same instance", () => {
      const instance1 = AiService.getInstance();
      const instance2 = AiService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("prepareItemsPrompt", () => {
    it("should format items as plain text with id and title per line", () => {
      const items = [
        { id: 1, title: "First Article" },
        { id: 2, title: "Second Article" },
        { id: 3, title: "Third Article" },
      ] as Item[];

      const result = aiService.prepareItemsPrompt(items);

      expect(result).toBe(
        "1: First Article\n2: Second Article\n3: Third Article"
      );
    });

    it("should return empty string for empty array", () => {
      const result = aiService.prepareItemsPrompt([]);
      expect(result).toBe("");
    });

    it("should return empty string for null or undefined", () => {
      const result1 = aiService.prepareItemsPrompt(null as any);
      const result2 = aiService.prepareItemsPrompt(undefined as any);

      expect(result1).toBe("");
      expect(result2).toBe("");
    });

    it("should filter out items without id or title", () => {
      const items = [
        { id: 1, title: "Valid Item" },
        { id: undefined, title: "No ID" },
        { id: 2, title: "" },
        { id: 3, title: "Another Valid Item" },
      ] as Item[];

      const result = aiService.prepareItemsPrompt(items);

      expect(result).toBe("1: Valid Item\n3: Another Valid Item");
    });

    it("should handle items with special characters in titles", () => {
      const items = [
        { id: 1, title: 'Title with "quotes"' },
        { id: 2, title: "Title with: colons & symbols!" },
      ] as Item[];

      const result = aiService.prepareItemsPrompt(items);

      expect(result).toBe(
        '1: Title with "quotes"\n2: Title with: colons & symbols!'
      );
    });
  });
});
