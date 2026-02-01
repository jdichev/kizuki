import { ServiceUsageClient } from "@google-cloud/service-usage";
import { GoogleGenAI } from "@google/genai";
import pinoLib from "pino";
import fs from "fs";
import path from "path";
import os from "os";
import SettingsManager from "./SettingsManager";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "GoogleAiService",
});

/**
 * GoogleAiService handles AI operations such as preparing and sending prompts to Gemini AI.
 * Uses SettingsManager for API key configuration.
 * Implements singleton pattern for efficient resource management.
 * Enforces rate limiting: 2 requests/hour and 20 requests/day (persisted on disk).
 */
export default class GoogleAiService {
  private static instance: GoogleAiService;
  private settingsManager: SettingsManager;
  private aiClient: GoogleGenAI | null = null;
  private serviceUsageClient: ServiceUsageClient | null = null;
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

  // Usage metrics tracking
  private usageMetricsCacheFilePath: string;
  private usageMetrics: {
    lastUpdated: string;
    totalRequests: number;
    totalTokensUsed: number;
    quotaLimits: Map<string, number>;
    quotaUsage: Map<string, number>;
  } = {
    lastUpdated: new Date().toISOString(),
    totalRequests: 0,
    totalTokensUsed: 0,
    quotaLimits: new Map(),
    quotaUsage: new Map(),
  };

  private constructor() {
    this.settingsManager = SettingsManager.getInstance();
    const storageDir = path.join(os.homedir(), ".forest");
    this.rateLimitCacheFilePath = path.join(storageDir, "ai-rate-limit.json");
    this.usageMetricsCacheFilePath = path.join(
      storageDir,
      "google-ai-usage-metrics.json"
    );
    this.loadRateLimitCache();
    this.loadUsageMetrics();
    this.initializeClient();
    this.initializeServiceUsageClient();
  }

  /**
   * Get singleton instance of GoogleAiService
   */
  public static getInstance(): GoogleAiService {
    if (!GoogleAiService.instance) {
      GoogleAiService.instance = new GoogleAiService();
    }
    return GoogleAiService.instance;
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
    this.initializeServiceUsageClient();
  }

  /**
   * Check if AI service is properly configured
   */
  public isConfigured(): boolean {
    return this.aiClient !== null;
  }

  /**
   * Initialize the Service Usage client for monitoring quotas and usage
   */
  private initializeServiceUsageClient(): void {
    try {
      const credentials = this.settingsManager.getSetting(
        "GOOGLE_APPLICATION_CREDENTIALS"
      );
      if (credentials) {
        this.serviceUsageClient = new ServiceUsageClient({
          keyFilename: credentials,
        });
        pino.info("Service Usage client initialized for quota monitoring");
      } else {
        pino.debug(
          "GOOGLE_APPLICATION_CREDENTIALS not configured, Service Usage client skipped"
        );
      }
    } catch (error) {
      pino.warn(
        { error },
        "Failed to initialize Service Usage client for quota monitoring"
      );
      this.serviceUsageClient = null;
    }
  }

  /**
   * Load usage metrics from disk
   */
  private loadUsageMetrics(): void {
    try {
      if (fs.existsSync(this.usageMetricsCacheFilePath)) {
        const fileContent = fs.readFileSync(
          this.usageMetricsCacheFilePath,
          "utf-8"
        );
        const parsed = JSON.parse(fileContent);
        this.usageMetrics = {
          lastUpdated: parsed.lastUpdated,
          totalRequests: parsed.totalRequests || 0,
          totalTokensUsed: parsed.totalTokensUsed || 0,
          quotaLimits: new Map(parsed.quotaLimits || []),
          quotaUsage: new Map(parsed.quotaUsage || []),
        };
        pino.debug(
          { requests: this.usageMetrics.totalRequests },
          "Usage metrics loaded"
        );
      }
    } catch (error) {
      pino.warn({ error }, "Failed to load usage metrics, starting fresh");
      this.usageMetrics = {
        lastUpdated: new Date().toISOString(),
        totalRequests: 0,
        totalTokensUsed: 0,
        quotaLimits: new Map(),
        quotaUsage: new Map(),
      };
    }
  }

  /**
   * Save usage metrics to disk
   */
  private saveUsageMetrics(): void {
    try {
      const storageDir = path.dirname(this.usageMetricsCacheFilePath);
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      const metricsToSave = {
        lastUpdated: this.usageMetrics.lastUpdated,
        totalRequests: this.usageMetrics.totalRequests,
        totalTokensUsed: this.usageMetrics.totalTokensUsed,
        quotaLimits: Array.from(this.usageMetrics.quotaLimits.entries()),
        quotaUsage: Array.from(this.usageMetrics.quotaUsage.entries()),
      };
      fs.writeFileSync(
        this.usageMetricsCacheFilePath,
        JSON.stringify(metricsToSave, null, 2)
      );
    } catch (error) {
      pino.error({ error }, "Failed to save usage metrics");
    }
  }

  /**
   * Fetch and update service metrics for configured Google Cloud services
   * Tracks enabled APIs and their status
   * @param projectId The Google Cloud project ID
   * @returns Object containing service metrics and status
   */
  public async fetchServiceMetrics(projectId: string): Promise<{
    servicesEnabled: string[];
    servicesCount: number;
    lastUpdated: string;
  } | null> {
    if (!this.serviceUsageClient) {
      pino.warn("Service Usage client not initialized");
      return null;
    }

    try {
      const request = {
        parent: `projects/${projectId}`,
        filter: "state:ENABLED",
      };

      const [services] = await this.serviceUsageClient.listServices(request);

      const enabledServices: string[] = [];

      if (services) {
        for (const service of services) {
          if (service.name) {
            enabledServices.push(service.name);

            // Track if this is the Gemini/GenerativeAI service
            if (
              service.name.includes("aiplatform") ||
              service.name.includes("generativelanguage")
            ) {
              pino.debug(
                { service: service.name },
                "AI service detected and enabled"
              );
            }
          }
        }
      }

      const lastUpdated = new Date().toISOString();
      this.usageMetrics.lastUpdated = lastUpdated;
      this.saveUsageMetrics();

      pino.info(
        {
          servicesCount: enabledServices.length,
          lastUpdated,
        },
        "Service metrics fetched successfully"
      );

      return {
        servicesEnabled: enabledServices,
        servicesCount: enabledServices.length,
        lastUpdated,
      };
    } catch (error) {
      pino.error({ error }, "Failed to fetch service metrics");
      return null;
    }
  }

  /**
   * Get quota status and warnings based on local tracking
   * @returns Object containing quota status and alerts
   */
  public getQuotaStatus(): {
    status: "healthy" | "warning" | "critical";
    hourlyRemaining: number;
    dailyRemaining: number;
    alerts: string[];
    recommendations: string[];
  } {
    const now = Date.now();
    const oneHourAgo = now - GoogleAiService.HOUR_MS;

    const requestsInLastHour = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    ).length;

    const requestsInLastDay = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => now - timestamp < GoogleAiService.DAY_MS
    ).length;

    const hourlyRemaining =
      GoogleAiService.MAX_REQUESTS_PER_HOUR - requestsInLastHour;
    const dailyRemaining =
      GoogleAiService.MAX_REQUESTS_PER_DAY - requestsInLastDay;

    const alerts: string[] = [];
    const recommendations: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy";

    // Check hourly quota
    if (hourlyRemaining <= 0) {
      alerts.push("Hourly quota exhausted");
      status = "critical";
      recommendations.push(
        "Wait at least 1 hour before making new AI requests"
      );
    } else if (hourlyRemaining <= 1) {
      alerts.push("Hourly quota nearly exhausted");
      status = "warning";
      recommendations.push("Limit AI requests - only 1 remaining this hour");
    }

    // Check daily quota
    if (dailyRemaining <= 0) {
      alerts.push("Daily quota exhausted");
      status = "critical";
      recommendations.push("Wait until tomorrow to make new AI requests");
    } else if (dailyRemaining <= 5) {
      if (status !== "critical") {
        status = "warning";
      }
      alerts.push("Daily quota running low");
      recommendations.push(`Only ${dailyRemaining} requests remaining today`);
    }

    // Token usage warning
    if (this.usageMetrics.totalTokensUsed > 1000000) {
      if (status === "healthy") {
        status = "warning";
      }
      recommendations.push(
        `High token usage detected: ${this.usageMetrics.totalTokensUsed.toLocaleString()} tokens used`
      );
    }

    return {
      status,
      hourlyRemaining,
      dailyRemaining,
      alerts,
      recommendations,
    };
  }

  /**
   * Get current usage metrics
   * @returns Current usage and rate limit information
   */
  public getUsageMetrics(): {
    totalRequests: number;
    totalTokensUsed: number;
    requestsRemaining: {
      hourly: number;
      daily: number;
    };
    quotaMetrics: {
      limits: Record<string, number>;
      usage: Record<string, number>;
    };
  } {
    const now = Date.now();
    const oneHourAgo = now - GoogleAiService.HOUR_MS;

    const requestsInLastHour = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    ).length;

    const requestsInLastDay = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => now - timestamp < GoogleAiService.DAY_MS
    ).length;

    return {
      totalRequests: this.usageMetrics.totalRequests,
      totalTokensUsed: this.usageMetrics.totalTokensUsed,
      requestsRemaining: {
        hourly: GoogleAiService.MAX_REQUESTS_PER_HOUR - requestsInLastHour,
        daily: GoogleAiService.MAX_REQUESTS_PER_DAY - requestsInLastDay,
      },
      quotaMetrics: {
        limits: Object.fromEntries(this.usageMetrics.quotaLimits),
        usage: Object.fromEntries(this.usageMetrics.quotaUsage),
      },
    };
  }

  /**
   * Update token usage metrics
   * @param tokensUsed Number of tokens used in the request
   */
  private updateTokenMetrics(tokensUsed: number): void {
    this.usageMetrics.totalRequests++;
    this.usageMetrics.totalTokensUsed += tokensUsed;
    this.usageMetrics.lastUpdated = new Date().toISOString();
    this.saveUsageMetrics();

    pino.debug(
      {
        totalRequests: this.usageMetrics.totalRequests,
        totalTokensUsed: this.usageMetrics.totalTokensUsed,
      },
      "Token metrics updated"
    );
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
        (timestamp) => now - timestamp < GoogleAiService.DAY_MS
      );

    // Daily limit check
    if (
      this.rateLimitCache.requestTimestamps.length >=
      GoogleAiService.MAX_REQUESTS_PER_DAY
    ) {
      const oldestTimestamp = this.rateLimitCache.requestTimestamps[0];
      const timeUntilResetMs = GoogleAiService.DAY_MS - (now - oldestTimestamp);
      const timeUntilResetHours = Math.ceil(
        timeUntilResetMs / (60 * 60 * 1000)
      );

      pino.warn(
        {
          currentRequests: this.rateLimitCache.requestTimestamps.length,
          dailyLimit: GoogleAiService.MAX_REQUESTS_PER_DAY,
          timeUntilResetHours,
        },
        "Daily rate limit (20 requests/day) exceeded"
      );
      return false;
    }

    // Hourly limit check
    const oneHourAgo = now - GoogleAiService.HOUR_MS;
    const requestsInLastHour = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    ).length;

    if (requestsInLastHour >= GoogleAiService.MAX_REQUESTS_PER_HOUR) {
      const oldestHourlyTimestamp = this.rateLimitCache.requestTimestamps.find(
        (timestamp) => timestamp > oneHourAgo
      );
      const timeUntilHourlyResetMs = oldestHourlyTimestamp
        ? GoogleAiService.HOUR_MS - (now - oldestHourlyTimestamp)
        : GoogleAiService.HOUR_MS;

      pino.warn(
        {
          currentRequests: requestsInLastHour,
          hourlyLimit: GoogleAiService.MAX_REQUESTS_PER_HOUR,
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
        dailyLimit: GoogleAiService.MAX_REQUESTS_PER_DAY,
        currentHourlyRequests: requestsInLastHour + 1,
        hourlyLimit: GoogleAiService.MAX_REQUESTS_PER_HOUR,
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
    modelParam: string = GoogleAiService.DEFAULT_MODEL
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
        { mainModel: modelParam, backupModel: GoogleAiService.BACKUP_MODEL },
        `Rate limit exceeded for main model. Falling back to backup model: ${GoogleAiService.BACKUP_MODEL}`
      );
      // Use backup model instead of throwing
      model = GoogleAiService.BACKUP_MODEL;
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

      // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil((prompt.length + text.length) / 4);
      this.updateTokenMetrics(estimatedTokens);

      pino.info(
        { responseLength: text.length, estimatedTokens },
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
      model: modelParam = GoogleAiService.DEFAULT_MODEL,
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
        { mainModel: modelParam, backupModel: GoogleAiService.BACKUP_MODEL },
        `Rate limit exceeded for main model. Falling back to backup model: ${GoogleAiService.BACKUP_MODEL}`
      );
      // Use backup model instead of throwing
      model = GoogleAiService.BACKUP_MODEL;
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

      // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
      const estimatedTokens = Math.ceil(
        (prompt.length + (systemInstruction?.length || 0) + text.length) / 4
      );
      this.updateTokenMetrics(estimatedTokens);

      pino.info(
        { responseLength: text.length, estimatedTokens },
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
    return GoogleAiService.DEFAULT_MODEL;
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

    const prompt = `
      Please provide a concise summary (abstract) of the following article in up to 240 words.
      The first sentence should be separated on its own line and answer the main questions of who, what(, and when, where if possible).
      Feel free to use lists or short tables if appropriate.
      Focus on the key points, main ideas, and important details:
      
      ${plainText}`;

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
