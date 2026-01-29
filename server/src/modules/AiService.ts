import { GoogleGenAI } from "@google/genai";
import pinoLib from "pino";
import fs from "fs";
import path from "path";
import os from "os";
import SettingsManager from "./SettingsManager";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "AiService",
});

/**
 * AiService handles AI operations such as preparing and sending prompts to Gemini AI.
 * Uses SettingsManager for API key configuration.
 * Implements singleton pattern for efficient resource management.
 * Enforces rate limiting: 2 requests/hour and 20 requests/day (persisted on disk).
 */
export default class AiService {
  private static instance: AiService;
  private settingsManager: SettingsManager;
  private aiClient: GoogleGenAI | null = null;
  private static readonly DEFAULT_MODEL = "gemini-3-flash-preview";
  private static readonly BACKUP_MODEL = "models/gemma-3-27b-it";

  // Rate limiting: 2 requests per hour, 20 requests per day
  private static readonly MAX_REQUESTS_PER_HOUR = 2;
  private static readonly MAX_REQUESTS_PER_DAY = 20;
  private static readonly HOUR_MS = 60 * 60 * 1000;
  private static readonly DAY_MS = 24 * 60 * 60 * 1000;

  private rateLimitCacheFilePath: string;
  private rateLimitCache: {
    currentDate: string;
    requestTimestamps: number[];
  } = {
    currentDate: new Date().toISOString().split("T")[0],
    requestTimestamps: [],
  };

  private constructor() {
    this.settingsManager = SettingsManager.getInstance();
    const storageDir = path.join(os.homedir(), ".forest");
    this.rateLimitCacheFilePath = path.join(storageDir, "ai-rate-limit.json");
    this.loadRateLimitCache();
    this.initializeClient();
  }

  /**
   * Get singleton instance of AiService
   */
  public static getInstance(): AiService {
    if (!AiService.instance) {
      AiService.instance = new AiService();
    }
    return AiService.instance;
  }

  /**
   * Initialize the Google GenAI client with the API key from settings
   */
  private initializeClient(): void {
    const apiKey = this.settingsManager.getSetting("GEMINI_API_KEY");

    if (!apiKey || apiKey.trim() === "") {
      pino.warn(
        "Gemini API key not configured. AI features will be unavailable."
      );
      this.aiClient = null;
      return;
    }

    try {
      this.aiClient = new GoogleGenAI({
        apiKey: apiKey,
      });
      pino.info("Google GenAI client initialized successfully");
    } catch (error) {
      pino.error({ error }, "Failed to initialize Google GenAI client");
      this.aiClient = null;
    }
  }

  /**
   * Reinitialize the client when API key changes
   */
  public refreshClient(): void {
    pino.info("Refreshing Google GenAI client");
    this.initializeClient();
  }

  /**
   * Check if AI service is properly configured
   */
  public isConfigured(): boolean {
    return this.aiClient !== null;
  }

  /**
   * Load rate limit cache from disk
   */
  private loadRateLimitCache(): void {
    try {
      if (fs.existsSync(this.rateLimitCacheFilePath)) {
        const fileContent = fs.readFileSync(
          this.rateLimitCacheFilePath,
          "utf-8"
        );
        this.rateLimitCache = JSON.parse(fileContent);
        pino.debug(
          { date: this.rateLimitCache.currentDate },
          "AI rate limit cache loaded"
        );
      } else {
        pino.debug("No existing AI rate limit cache found, starting fresh");
      }
    } catch (error) {
      pino.warn(
        { error },
        "Failed to load AI rate limit cache, starting fresh"
      );
      this.rateLimitCache = {
        currentDate: new Date().toISOString().split("T")[0],
        requestTimestamps: [],
      };
    }
  }

  /**
   * Save rate limit cache to disk
   */
  private saveRateLimitCache(): void {
    try {
      const storageDir = path.dirname(this.rateLimitCacheFilePath);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      fs.writeFileSync(
        this.rateLimitCacheFilePath,
        JSON.stringify(this.rateLimitCache, null, 2)
      );
    } catch (error) {
      pino.error({ error }, "Failed to save AI rate limit cache");
    }
  }

  /**
   * Check and enforce rate limits: 2 per hour and 20 per day
   * @returns true if request can proceed, false if rate limit exceeded
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];

    // Reset cache if date changed
    if (this.rateLimitCache.currentDate !== today) {
      pino.info("New day detected, resetting rate limit cache");
      this.rateLimitCache = {
        currentDate: today,
        requestTimestamps: [],
      };
    }

    // Remove timestamps older than 24 hours
    this.rateLimitCache.requestTimestamps =
      this.rateLimitCache.requestTimestamps.filter(
        (timestamp) => now - timestamp < AiService.DAY_MS
      );

    // Daily limit check
    if (
      this.rateLimitCache.requestTimestamps.length >=
      AiService.MAX_REQUESTS_PER_DAY
    ) {
      const oldestTimestamp = this.rateLimitCache.requestTimestamps[0];
      const timeUntilResetMs = AiService.DAY_MS - (now - oldestTimestamp);
      const timeUntilResetHours = Math.ceil(
        timeUntilResetMs / (60 * 60 * 1000)
      );

      pino.warn(
        {
          currentRequests: this.rateLimitCache.requestTimestamps.length,
          dailyLimit: AiService.MAX_REQUESTS_PER_DAY,
          timeUntilResetHours,
        },
        "Daily rate limit (20 requests/day) exceeded"
      );
      return false;
    }

    // Hourly limit check
    const oneHourAgo = now - AiService.HOUR_MS;
    const requestsInLastHour = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    ).length;

    if (requestsInLastHour >= AiService.MAX_REQUESTS_PER_HOUR) {
      const oldestHourlyTimestamp = this.rateLimitCache.requestTimestamps.find(
        (timestamp) => timestamp > oneHourAgo
      );
      const timeUntilHourlyResetMs = oldestHourlyTimestamp
        ? AiService.HOUR_MS - (now - oldestHourlyTimestamp)
        : AiService.HOUR_MS;

      pino.warn(
        {
          currentRequests: requestsInLastHour,
          hourlyLimit: AiService.MAX_REQUESTS_PER_HOUR,
          timeUntilResetMs: Math.ceil(timeUntilHourlyResetMs),
        },
        "Hourly rate limit (2 requests/hour) exceeded"
      );
      return false;
    }

    // Add current timestamp and persist
    this.rateLimitCache.requestTimestamps.push(now);
    this.saveRateLimitCache();

    pino.debug(
      {
        currentDailyRequests: this.rateLimitCache.requestTimestamps.length,
        dailyLimit: AiService.MAX_REQUESTS_PER_DAY,
        currentHourlyRequests: requestsInLastHour + 1,
        hourlyLimit: AiService.MAX_REQUESTS_PER_HOUR,
      },
      "Rate limit check passed"
    );
    return true;
  }

  /**
   * Generate content using Gemini AI
   * @param prompt The prompt to send to the AI
   * @param model Optional model override (defaults to gemini-3-flash-preview)
   * @returns The generated text response
   * @throws Error if service is not configured or API call fails
   */
  public async generateContent(
    prompt: string,
    modelParam: string = AiService.DEFAULT_MODEL
  ): Promise<string> {
    if (!this.isConfigured()) {
      const error = new Error(
        "AI Service is not configured. Please set the Gemini API key in settings."
      );
      pino.error(error.message);
      throw error;
    }

    if (!prompt || prompt.trim() === "") {
      const error = new Error("Prompt cannot be empty");
      pino.error(error.message);
      throw error;
    }

    let model = modelParam;
    // Check rate limit before making API call
    if (!this.checkRateLimit()) {
      pino.warn(
        { mainModel: modelParam, backupModel: AiService.BACKUP_MODEL },
        `Rate limit exceeded for main model. Falling back to backup model: ${AiService.BACKUP_MODEL}`
      );
      // Use backup model instead of throwing
      model = AiService.BACKUP_MODEL;
    }

    try {
      pino.debug(
        { model, promptLength: prompt.length },
        "Generating AI content"
      );

      const response = await this.aiClient!.models.generateContent({
        model: model,
        contents: prompt,
      });

      const text = response.text;

      if (!text) {
        throw new Error("AI response did not contain text");
      }

      pino.info(
        { responseLength: text.length },
        "AI content generated successfully"
      );

      return text;
    } catch (error) {
      pino.error({ error, model }, "Error calling Gemini API");
      throw new Error(
        `Failed to generate AI content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate content with structured options
   * @param options Configuration for content generation
   * @returns The generated text response
   */
  public async generateContentWithOptions(options: {
    prompt: string;
    model?: string;
    systemInstruction?: string;
  }): Promise<string> {
    const {
      prompt,
      model: modelParam = AiService.DEFAULT_MODEL,
      systemInstruction,
    } = options;

    if (!this.isConfigured()) {
      throw new Error(
        "AI Service is not configured. Please set the Gemini API key in settings."
      );
    }

    let model = modelParam;
    // Check rate limit before making API call
    if (!this.checkRateLimit()) {
      pino.warn(
        { mainModel: modelParam, backupModel: AiService.BACKUP_MODEL },
        `Rate limit exceeded for main model. Falling back to backup model: ${AiService.BACKUP_MODEL}`
      );
      // Use backup model instead of throwing
      model = AiService.BACKUP_MODEL;
    }

    try {
      pino.debug(
        { model, hasSystemInstruction: !!systemInstruction },
        "Generating AI content with options"
      );

      const contentConfig: any = {
        model: model,
        contents: prompt,
      };

      if (systemInstruction) {
        contentConfig.systemInstruction = systemInstruction;
      }

      const response =
        await this.aiClient!.models.generateContent(contentConfig);
      const text = response.text;

      if (!text) {
        throw new Error("AI response did not contain text");
      }

      pino.info(
        { responseLength: text.length },
        "AI content generated successfully with options"
      );
      return text;
    } catch (error) {
      pino.error({ error, model }, "Error calling Gemini API with options");
      throw new Error(
        `Failed to generate AI content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the current default model
   */
  public getDefaultModel(): string {
    return AiService.DEFAULT_MODEL;
  }

  /**
   * Summarize article content in up to 350 words
   * @param htmlContent The HTML content to summarize
   * @returns A plain text summary (abstract) of the content
   */
  public async summarizeArticle(htmlContent: string): Promise<string> {
    if (!htmlContent || htmlContent.trim() === "") {
      throw new Error("Content cannot be empty");
    }

    // Strip HTML tags to get plain text
    const plainText = htmlContent
      .replace(/<script[^>]*>.*?<\/script>/gi, "") // Remove script tags
      .replace(/<style[^>]*>.*?<\/style>/gi, "") // Remove style tags
      .replace(/<[^>]+>/g, " ") // Remove all HTML tags
      .replace(/&nbsp;/g, " ") // Replace non-breaking spaces
      .replace(/&amp;/g, "&") // Replace HTML entities
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    if (!plainText) {
      throw new Error("Content is empty after HTML stripping");
    }

    pino.debug(
      { originalLength: htmlContent.length, plainTextLength: plainText.length },
      "Stripped HTML from article content"
    );

    const prompt = `Please provide a concise summary (abstract) of the following article in up to 350 words. Focus on the key points, main ideas, and important details:\n\n${plainText}`;

    try {
      const summary = await this.generateContent(prompt);
      pino.info(
        { summaryLength: summary.length },
        "Article summarized successfully"
      );
      return summary;
    } catch (error) {
      pino.error({ error }, "Failed to summarize article");
      throw error;
    }
  }

  /**
   * Parse AI response containing categorized article IDs and group items accordingly
   * Expected format: "Category Name: id1, id2, id3"
   * @param aiResponse The AI-generated response with categories and article IDs
   * @param items Array of items to group
   * @returns Array of groups with name and associated items
   */
  public parseAiGroupsResponse(
    aiResponse: string,
    items: Item[]
  ): Array<{ name: string; items: Item[] }> {
    const groups: Array<{ name: string; items: Item[] }> = [];

    if (!aiResponse || aiResponse.trim() === "") {
      pino.warn("Empty AI response provided for parsing");
      return groups;
    }

    if (!items || items.length === 0) {
      pino.warn("No items provided for grouping");
      return groups;
    }

    // Create a map for quick item lookup by ID
    const itemsMap = new Map<string, Item>();
    items.forEach((item) => {
      if (item.id !== undefined && item.id !== null) {
        itemsMap.set(String(item.id), item);
      }
    });

    // Split response by newlines and process each line
    const lines = aiResponse.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }

      // Parse format: "Category Name: id1, id2, id3"
      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex === -1) {
        pino.debug(
          { line: trimmedLine },
          "Skipping line without colon separator"
        );
        continue;
      }

      const categoryName = trimmedLine.substring(0, colonIndex).trim();
      const idsString = trimmedLine.substring(colonIndex + 1).trim();

      if (!categoryName) {
        pino.debug(
          { line: trimmedLine },
          "Skipping line with empty category name"
        );
        continue;
      }

      // Parse article IDs (comma-separated)
      const articleIds = idsString
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== "");

      // Find matching items
      const groupItems: Item[] = [];
      const missingIds: string[] = [];

      for (const id of articleIds) {
        const item = itemsMap.get(id);
        if (item) {
          groupItems.push(item);
        } else {
          missingIds.push(id);
        }
      }

      if (missingIds.length > 0) {
        pino.debug(
          { category: categoryName, missingIds },
          "Some article IDs not found in items array"
        );
      }

      // Only add group if it has at least one item
      if (groupItems.length > 0) {
        groups.push({
          name: categoryName,
          items: groupItems,
        });
        pino.debug(
          { category: categoryName, itemCount: groupItems.length },
          "Group created successfully"
        );
      } else {
        pino.debug(
          { category: categoryName },
          "Skipping category with no matching items"
        );
      }
    }

    pino.info(
      { groupCount: groups.length, totalItems: items.length },
      "AI groups parsed successfully"
    );

    return groups;
  }
}
