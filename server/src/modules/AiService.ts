import { GoogleGenAI } from "@google/genai";
import pinoLib from "pino";
import SettingsManager from "./SettingsManager";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "AiService",
});

/**
 * AiService handles AI operations such as preparing and sending prompts to Gemini AI.
 * Uses SettingsManager for API key configuration.
 * Implements singleton pattern for efficient resource management.
 * Enforces rate limiting of 15 Requests Per Minute (RPM).
 */
export default class AiService {
  private static instance: AiService;
  private settingsManager: SettingsManager;
  private aiClient: GoogleGenAI | null = null;
  private static readonly DEFAULT_MODEL = "gemini-3-flash-preview";

  // Rate limiting: 15 requests per minute
  private static readonly MAX_REQUESTS_PER_MINUTE = 15;
  private static readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute in milliseconds
  private requestTimestamps: number[] = [];

  private constructor() {
    this.settingsManager = SettingsManager.getInstance();
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
   * Check and enforce rate limit of 15 RPM
   * Removes timestamps older than 1 minute and checks if limit is reached
   * @returns true if request can proceed, false if rate limit exceeded
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < AiService.RATE_LIMIT_WINDOW_MS
    );

    // Check if we've hit the limit
    if (this.requestTimestamps.length >= AiService.MAX_REQUESTS_PER_MINUTE) {
      const oldestTimestamp = this.requestTimestamps[0];
      const timeUntilReset =
        AiService.RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp);
      pino.warn(
        {
          currentRequests: this.requestTimestamps.length,
          maxRequests: AiService.MAX_REQUESTS_PER_MINUTE,
          timeUntilResetMs: timeUntilReset,
        },
        "Rate limit exceeded"
      );
      return false;
    }

    // Add current timestamp
    this.requestTimestamps.push(now);
    pino.debug(
      {
        currentRequests: this.requestTimestamps.length,
        maxRequests: AiService.MAX_REQUESTS_PER_MINUTE,
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
    model: string = AiService.DEFAULT_MODEL
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

    // Check rate limit before making API call
    if (!this.checkRateLimit()) {
      const error = new Error(
        `Rate limit exceeded. Maximum ${AiService.MAX_REQUESTS_PER_MINUTE} requests per minute allowed.`
      );
      pino.error(error.message);
      throw error;
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
      model = AiService.DEFAULT_MODEL,
      systemInstruction,
    } = options;

    if (!this.isConfigured()) {
      throw new Error(
        "AI Service is not configured. Please set the Gemini API key in settings."
      );
    }

    // Check rate limit before making API call
    if (!this.checkRateLimit()) {
      throw new Error(
        `Rate limit exceeded. Maximum ${AiService.MAX_REQUESTS_PER_MINUTE} requests per minute allowed.`
      );
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
   * Prepare items for AI prompt as plain text
   * Converts an array of items into a formatted string where each line contains item ID and title
   * @param items Array of items from the data model
   * @returns Plain text string with format: "id: title" per line
   */
  public prepareItemsPrompt(items: Item[]): string {
    if (!items || items.length === 0) {
      return "";
    }

    return items
      .filter((item) => item.id !== undefined && item.title)
      .map((item) => `${item.id}: ${item.title}`)
      .join("\n");
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
