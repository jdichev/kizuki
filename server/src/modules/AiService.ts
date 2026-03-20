import pinoLib from "pino";
import fs from "fs";
import os from "os";
import path from "path";

export type AiProvider = "google" | "ollama";

export type GenerateContentOptions = {
  prompt: string;
  model?: string;
  systemInstruction?: string;
};

export type AiQuotaStatus = {
  status: "healthy" | "warning" | "critical";
  hourlyRemaining: number;
  dailyRemaining: number;
  alerts: string[];
  recommendations: string[];
};

export type AiUsageMetrics = {
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
};

export interface AiService {
  getProvider(): AiProvider;
  refreshClient(): void;
  isConfigured(): boolean;
  validatePrerequisites(additionalModels?: string[]): Promise<void>;
  getDefaultModel(): string;
  getBackupModel(): string;
  getSummarizationModel(): string;
  generateContent(prompt: string, model?: string): Promise<string>;
  generateContentWithOptions(options: GenerateContentOptions): Promise<string>;
  summarizeArticle(htmlContent: string): Promise<string>;
  parseAiGroupsResponse(
    aiResponse: string,
    items: Item[]
  ): Array<{ name: string; items: Item[] }>;
  buildFeedDiscoveryPrompt(query: string, maxResults?: number): string;
  parseFeedDiscoveryResponse(
    aiResponse: string
  ): Array<{ title: string; feedUrl: string; url?: string }>;
  discoverFeedsFromQuery(
    query: string,
    maxResults?: number
  ): Promise<Array<{ title: string; feedUrl: string; url?: string }>>;
  getUsageMetrics(): AiUsageMetrics;
  getQuotaStatus(): AiQuotaStatus;
}

type BaseAiServiceOptions = {
  loggerName: string;
  provider: AiProvider;
  usageMetricsFileName: string;
};

export default abstract class BaseAiService implements AiService {
  private static readonly MAX_REQUESTS_PER_HOUR = 2;
  private static readonly MAX_REQUESTS_PER_DAY = 20;
  private static readonly HOUR_MS = 60 * 60 * 1000;
  private static readonly DAY_MS = 24 * 60 * 60 * 1000;
  private static readonly PREREQUISITE_CHECK_TTL_MS = 5 * 60 * 1000;

  protected readonly logger;
  private readonly provider: AiProvider;

  private rateLimitCacheFilePath: string;
  private rateLimitCache: {
    currentDate: string;
    requestTimestamps: number[];
  } = {
    currentDate: new Date().toISOString().split("T")[0],
    requestTimestamps: [],
  };

  private usageMetricsCacheFilePath: string;
  private lastModelUsed: string;
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

  private prerequisiteCache: {
    checkedAt: number;
    checkedModels: Set<string>;
    inFlightCheck: Promise<void> | null;
  } = {
    checkedAt: 0,
    checkedModels: new Set(),
    inFlightCheck: null,
  };

  protected constructor(options: BaseAiServiceOptions) {
    this.provider = options.provider;
    this.lastModelUsed = "";
    this.logger = pinoLib({
      level: process.env.LOG_LEVEL || "info",
      name: options.loggerName,
    });

    const storageDir = path.join(os.homedir(), ".forest");
    this.rateLimitCacheFilePath = path.join(storageDir, "ai-rate-limit.json");
    this.usageMetricsCacheFilePath = path.join(
      storageDir,
      options.usageMetricsFileName
    );

    this.loadRateLimitCache();
    this.loadUsageMetrics();
  }

  public getProvider(): AiProvider {
    return this.provider;
  }

  public abstract refreshClient(): void;

  public abstract isConfigured(): boolean;

  public abstract getDefaultModel(): string;

  public abstract getBackupModel(): string;

  public abstract getSummarizationModel(): string;

  protected abstract checkProviderPrerequisites(
    modelsToCheck: string[]
  ): Promise<void>;

  protected abstract requestContent(options: {
    prompt: string;
    model: string;
    systemInstruction?: string;
  }): Promise<string>;

  protected invalidatePrerequisitesCache(): void {
    this.prerequisiteCache = {
      checkedAt: 0,
      checkedModels: new Set(),
      inFlightCheck: null,
    };
  }

  public async validatePrerequisites(
    additionalModels: string[] = []
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        "AI Service is not configured. Please configure provider settings."
      );
    }

    const modelsToCheck = Array.from(
      new Set(
        [
          this.getDefaultModel(),
          this.getBackupModel(),
          this.getSummarizationModel(),
          ...additionalModels,
        ].filter((model) => Boolean(model && model.trim()))
      )
    );

    const now = Date.now();
    const hasFreshCache =
      this.prerequisiteCache.checkedAt > 0 &&
      now - this.prerequisiteCache.checkedAt <
        BaseAiService.PREREQUISITE_CHECK_TTL_MS;

    if (hasFreshCache) {
      const cacheCoversAllModels = modelsToCheck.every((model) =>
        this.prerequisiteCache.checkedModels.has(model)
      );
      if (cacheCoversAllModels) {
        return;
      }
    }

    if (this.prerequisiteCache.inFlightCheck) {
      await this.prerequisiteCache.inFlightCheck;
      return;
    }

    const checkPromise = this.checkProviderPrerequisites(modelsToCheck)
      .then(() => {
        this.prerequisiteCache.checkedAt = Date.now();
        this.prerequisiteCache.checkedModels = new Set(modelsToCheck);
      })
      .catch((error: unknown) => {
        this.prerequisiteCache.checkedAt = 0;
        this.prerequisiteCache.checkedModels = new Set();
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `AI prerequisites check failed for provider '${this.getProvider()}': ${message}`
        );
      })
      .finally(() => {
        this.prerequisiteCache.inFlightCheck = null;
      });

    this.prerequisiteCache.inFlightCheck = checkPromise;
    await checkPromise;
  }

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
        this.logger.debug(
          { requests: this.usageMetrics.totalRequests },
          "Usage metrics loaded"
        );
      }
    } catch (error) {
      this.logger.warn(
        { error },
        "Failed to load usage metrics, starting fresh"
      );
      this.usageMetrics = {
        lastUpdated: new Date().toISOString(),
        totalRequests: 0,
        totalTokensUsed: 0,
        quotaLimits: new Map(),
        quotaUsage: new Map(),
      };
    }
  }

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
      this.logger.error({ error }, "Failed to save usage metrics");
    }
  }

  public getQuotaStatus(): AiQuotaStatus {
    const now = Date.now();
    const oneHourAgo = now - BaseAiService.HOUR_MS;

    const requestsInLastHour = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    ).length;

    const requestsInLastDay = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => now - timestamp < BaseAiService.DAY_MS
    ).length;

    const hourlyRemaining =
      BaseAiService.MAX_REQUESTS_PER_HOUR - requestsInLastHour;
    const dailyRemaining =
      BaseAiService.MAX_REQUESTS_PER_DAY - requestsInLastDay;

    const alerts: string[] = [];
    const recommendations: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy";

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

  public getUsageMetrics(): AiUsageMetrics {
    const now = Date.now();
    const oneHourAgo = now - BaseAiService.HOUR_MS;

    const requestsInLastHour = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    ).length;

    const requestsInLastDay = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => now - timestamp < BaseAiService.DAY_MS
    ).length;

    return {
      totalRequests: this.usageMetrics.totalRequests,
      totalTokensUsed: this.usageMetrics.totalTokensUsed,
      requestsRemaining: {
        hourly: BaseAiService.MAX_REQUESTS_PER_HOUR - requestsInLastHour,
        daily: BaseAiService.MAX_REQUESTS_PER_DAY - requestsInLastDay,
      },
      quotaMetrics: {
        limits: Object.fromEntries(this.usageMetrics.quotaLimits),
        usage: Object.fromEntries(this.usageMetrics.quotaUsage),
      },
    };
  }

  private updateTokenMetrics(tokensUsed: number): void {
    this.usageMetrics.totalRequests++;
    this.usageMetrics.totalTokensUsed += tokensUsed;
    this.usageMetrics.lastUpdated = new Date().toISOString();
    this.saveUsageMetrics();

    this.logger.debug(
      {
        totalRequests: this.usageMetrics.totalRequests,
        totalTokensUsed: this.usageMetrics.totalTokensUsed,
      },
      "Token metrics updated"
    );
  }

  private loadRateLimitCache(): void {
    try {
      if (fs.existsSync(this.rateLimitCacheFilePath)) {
        const fileContent = fs.readFileSync(
          this.rateLimitCacheFilePath,
          "utf-8"
        );
        this.rateLimitCache = JSON.parse(fileContent);
        this.logger.debug(
          { date: this.rateLimitCache.currentDate },
          "AI rate limit cache loaded"
        );
      } else {
        this.logger.debug(
          "No existing AI rate limit cache found, starting fresh"
        );
      }
    } catch (error) {
      this.logger.warn(
        { error },
        "Failed to load AI rate limit cache, starting fresh"
      );
      this.rateLimitCache = {
        currentDate: new Date().toISOString().split("T")[0],
        requestTimestamps: [],
      };
    }
  }

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
      this.logger.error({ error }, "Failed to save AI rate limit cache");
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];

    if (this.rateLimitCache.currentDate !== today) {
      this.logger.info("New day detected, resetting rate limit cache");
      this.rateLimitCache = {
        currentDate: today,
        requestTimestamps: [],
      };
    }

    this.rateLimitCache.requestTimestamps =
      this.rateLimitCache.requestTimestamps.filter(
        (timestamp) => now - timestamp < BaseAiService.DAY_MS
      );

    if (
      this.rateLimitCache.requestTimestamps.length >=
      BaseAiService.MAX_REQUESTS_PER_DAY
    ) {
      const oldestTimestamp = this.rateLimitCache.requestTimestamps[0];
      const timeUntilResetMs = BaseAiService.DAY_MS - (now - oldestTimestamp);
      const timeUntilResetHours = Math.ceil(
        timeUntilResetMs / (60 * 60 * 1000)
      );

      this.logger.warn(
        {
          currentRequests: this.rateLimitCache.requestTimestamps.length,
          dailyLimit: BaseAiService.MAX_REQUESTS_PER_DAY,
          timeUntilResetHours,
        },
        `Daily rate limit (${BaseAiService.MAX_REQUESTS_PER_DAY} requests/day) exceeded`
      );
      return false;
    }

    const oneHourAgo = now - BaseAiService.HOUR_MS;
    const requestsInLastHour = this.rateLimitCache.requestTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    ).length;

    if (requestsInLastHour >= BaseAiService.MAX_REQUESTS_PER_HOUR) {
      const oldestHourlyTimestamp = this.rateLimitCache.requestTimestamps.find(
        (timestamp) => timestamp > oneHourAgo
      );
      const timeUntilHourlyResetMs = oldestHourlyTimestamp
        ? BaseAiService.HOUR_MS - (now - oldestHourlyTimestamp)
        : BaseAiService.HOUR_MS;

      this.logger.warn(
        {
          currentRequests: requestsInLastHour,
          hourlyLimit: BaseAiService.MAX_REQUESTS_PER_HOUR,
          timeUntilResetMs: Math.ceil(timeUntilHourlyResetMs),
        },
        `Hourly rate limit (${BaseAiService.MAX_REQUESTS_PER_HOUR} requests/hour) exceeded`
      );
      return false;
    }

    this.rateLimitCache.requestTimestamps.push(now);
    this.saveRateLimitCache();

    this.logger.debug(
      {
        currentDailyRequests: this.rateLimitCache.requestTimestamps.length,
        dailyLimit: BaseAiService.MAX_REQUESTS_PER_DAY,
        currentHourlyRequests: requestsInLastHour + 1,
        hourlyLimit: BaseAiService.MAX_REQUESTS_PER_HOUR,
      },
      "Rate limit check passed"
    );
    return true;
  }

  public async generateContent(
    prompt: string,
    modelParam: string = this.getDefaultModel()
  ): Promise<string> {
    if (!this.isConfigured()) {
      const error = new Error(
        "AI Service is not configured. Please configure provider settings."
      );
      this.logger.error(error.message);
      throw error;
    }

    if (!prompt || prompt.trim() === "") {
      const error = new Error("Prompt cannot be empty");
      this.logger.error(error.message);
      throw error;
    }

    await this.validatePrerequisites([modelParam]);

    let model = modelParam;
    if (!this.checkRateLimit()) {
      const backupModel = this.getBackupModel();
      this.logger.warn(
        { mainModel: modelParam, backupModel },
        `Rate limit exceeded for main model. Falling back to backup model: ${backupModel}`
      );
      model = backupModel;
    }

    try {
      this.logger.debug(
        { model, promptLength: prompt.length },
        "Generating AI content"
      );

      this.lastModelUsed = model;
      const text = await this.requestContent({
        prompt,
        model,
      });

      if (!text) {
        throw new Error("AI response did not contain text");
      }

      const estimatedTokens = Math.ceil((prompt.length + text.length) / 4);
      this.updateTokenMetrics(estimatedTokens);

      this.logger.info(
        { responseLength: text.length, estimatedTokens },
        "AI content generated successfully"
      );

      return text;
    } catch (error) {
      this.logger.error({ error, model }, "Error calling AI provider API");
      throw new Error(
        `Failed to generate AI content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public async generateContentWithOptions(
    options: GenerateContentOptions
  ): Promise<string> {
    const {
      prompt,
      model: modelParam = this.getDefaultModel(),
      systemInstruction,
    } = options;

    if (!this.isConfigured()) {
      throw new Error(
        "AI Service is not configured. Please configure provider settings."
      );
    }

    await this.validatePrerequisites([modelParam]);

    let model = modelParam;
    if (!this.checkRateLimit()) {
      const backupModel = this.getBackupModel();
      this.logger.warn(
        { mainModel: modelParam, backupModel },
        `Rate limit exceeded for main model. Falling back to backup model: ${backupModel}`
      );
      model = backupModel;
    }

    try {
      this.logger.debug(
        { model, hasSystemInstruction: !!systemInstruction },
        "Generating AI content with options"
      );

      this.lastModelUsed = model;
      const text = await this.requestContent({
        prompt,
        model,
        systemInstruction,
      });

      if (!text) {
        throw new Error("AI response did not contain text");
      }

      const estimatedTokens = Math.ceil(
        (prompt.length + (systemInstruction?.length || 0) + text.length) / 4
      );
      this.updateTokenMetrics(estimatedTokens);

      this.logger.info(
        { responseLength: text.length, estimatedTokens },
        "AI content generated successfully with options"
      );
      return text;
    } catch (error) {
      this.logger.error(
        { error, model },
        "Error calling AI provider API with options"
      );
      throw new Error(
        `Failed to generate AI content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public async summarizeArticle(htmlContent: string): Promise<string> {
    if (!htmlContent || htmlContent.trim() === "") {
      throw new Error("Content cannot be empty");
    }

    const plainText = htmlContent
      .replace(/<script[^>]*>.*?<\/script>/gi, "")
      .replace(/<style[^>]*>.*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    if (!plainText) {
      throw new Error("Content is empty after HTML stripping");
    }

    this.logger.debug(
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
      const summary = await this.generateContent(
        prompt,
        this.getSummarizationModel()
      );
      const result = `${summary}\n\n---\n*Summary generated using: ${this.lastModelUsed}*`;
      this.logger.info(
        { summaryLength: result.length, model: this.lastModelUsed },
        "Article summarized successfully"
      );
      return result;
    } catch (error) {
      this.logger.error({ error }, "Failed to summarize article");
      throw error;
    }
  }

  public parseAiGroupsResponse(
    aiResponse: string,
    items: Item[]
  ): Array<{ name: string; items: Item[] }> {
    const groups: Array<{ name: string; items: Item[] }> = [];

    if (!aiResponse || aiResponse.trim() === "") {
      this.logger.warn("Empty AI response provided for parsing");
      return groups;
    }

    if (!items || items.length === 0) {
      this.logger.warn("No items provided for grouping");
      return groups;
    }

    const itemsMap = new Map<string, Item>();
    items.forEach((item) => {
      if (item.id !== undefined && item.id !== null) {
        itemsMap.set(String(item.id), item);
      }
    });

    const lines = aiResponse.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        continue;
      }

      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex === -1) {
        this.logger.debug(
          { line: trimmedLine },
          "Skipping line without colon separator"
        );
        continue;
      }

      const categoryName = trimmedLine.substring(0, colonIndex).trim();
      const idsString = trimmedLine.substring(colonIndex + 1).trim();

      if (!categoryName) {
        this.logger.debug(
          { line: trimmedLine },
          "Skipping line with empty category name"
        );
        continue;
      }

      const articleIds = idsString
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id !== "");

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
        this.logger.debug(
          { category: categoryName, missingIds },
          "Some article IDs not found in items array"
        );
      }

      if (groupItems.length > 0) {
        groups.push({
          name: categoryName,
          items: groupItems,
        });
        this.logger.debug(
          { category: categoryName, itemCount: groupItems.length },
          "Group created successfully"
        );
      } else {
        this.logger.debug(
          { category: categoryName },
          "Skipping category with no matching items"
        );
      }
    }

    this.logger.info(
      { groupCount: groups.length, totalItems: items.length },
      "AI groups parsed successfully"
    );

    return groups;
  }

  public buildFeedDiscoveryPrompt(query: string, maxResults = 5): string {
    const cleanQuery = query.trim();
    const safeMaxResults = Math.max(1, Math.min(10, maxResults));

    return [
      "Find RSS/Atom feeds for this query:",
      cleanQuery,
      `Return at most ${safeMaxResults} results as JSON only.`,
      'Format: {"feeds":[{"title":"...","feedUrl":"https://...","url":"https://..."}]}',
      "If the query is a person name, also check whether they publish on Medium or Substack and include those feed URLs when relevant.",
      "Rules: include only likely valid feed URLs, use absolute https URLs when possible, no markdown, no prose.",
    ].join("\n");
  }

  public parseFeedDiscoveryResponse(
    aiResponse: string
  ): Array<{ title: string; feedUrl: string; url?: string }> {
    if (!aiResponse || aiResponse.trim() === "") {
      return [];
    }

    const normalized = aiResponse.trim();
    const parsedJson = this.parseFeedDiscoveryJson(normalized);
    if (parsedJson.length > 0) {
      return parsedJson;
    }

    return this.parseFeedDiscoveryLines(normalized);
  }

  public async discoverFeedsFromQuery(
    query: string,
    maxResults = 5
  ): Promise<Array<{ title: string; feedUrl: string; url?: string }>> {
    if (!query || query.trim() === "") {
      return [];
    }

    const prompt = this.buildFeedDiscoveryPrompt(query, maxResults);
    const aiResponse = await this.generateContent(prompt);
    const parsed = this.parseFeedDiscoveryResponse(aiResponse);

    const deduped: Array<{ title: string; feedUrl: string; url?: string }> = [];
    const seen = new Set<string>();

    for (const candidate of parsed) {
      const key = candidate.feedUrl.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(candidate);
      if (deduped.length >= Math.max(1, Math.min(10, maxResults))) {
        break;
      }
    }

    return deduped;
  }

  private parseFeedDiscoveryJson(
    aiResponse: string
  ): Array<{ title: string; feedUrl: string; url?: string }> {
    const direct = this.tryParseFeedJson(aiResponse);
    if (direct.length > 0) {
      return direct;
    }

    const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (!codeBlockMatch) {
      return [];
    }

    return this.tryParseFeedJson(codeBlockMatch[1]);
  }

  private tryParseFeedJson(
    jsonText: string
  ): Array<{ title: string; feedUrl: string; url?: string }> {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      const objectParsed = parsed as {
        feeds?: Array<Record<string, unknown>>;
      };
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(objectParsed?.feeds)
          ? objectParsed.feeds
          : [];

      const mapped: Array<{
        title: string;
        feedUrl: string;
        url?: string;
      } | null> = (list as Array<Record<string, unknown>>).map((entry) => {
        const feedUrl =
          typeof entry.feedUrl === "string"
            ? entry.feedUrl.trim()
            : typeof entry.xmlUrl === "string"
              ? entry.xmlUrl.trim()
              : "";
        const title =
          typeof entry.title === "string"
            ? entry.title.trim()
            : typeof entry.name === "string"
              ? entry.name.trim()
              : "";
        const url =
          typeof entry.url === "string"
            ? entry.url.trim()
            : typeof entry.siteUrl === "string"
              ? entry.siteUrl.trim()
              : undefined;

        if (!this.isHttpUrl(feedUrl)) {
          return null;
        }

        if (this.isHttpUrl(url)) {
          return {
            title: title || feedUrl,
            feedUrl,
            url,
          };
        }

        return {
          title: title || feedUrl,
          feedUrl,
        };
      });

      return mapped.filter(
        (entry): entry is { title: string; feedUrl: string; url?: string } => {
          return entry !== null;
        }
      );
    } catch {
      return [];
    }
  }

  private parseFeedDiscoveryLines(
    aiResponse: string
  ): Array<{ title: string; feedUrl: string; url?: string }> {
    const lines = aiResponse.split("\n");
    const results: Array<{ title: string; feedUrl: string; url?: string }> = [];

    for (const rawLine of lines) {
      const line = rawLine.replace(/^[-*\d.)\s]+/, "").trim();

      if (!line) {
        continue;
      }

      const parts = line
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length < 2) {
        continue;
      }

      const first = parts[0];
      const second = parts[1];
      const firstIsUrl = this.isHttpUrl(first);
      const secondIsUrl = this.isHttpUrl(second);

      if (firstIsUrl && !secondIsUrl) {
        results.push({
          title: second,
          feedUrl: first,
        });
        continue;
      }

      if (!firstIsUrl && secondIsUrl) {
        results.push({
          title: first,
          feedUrl: second,
        });
      }
    }

    return results;
  }

  private isHttpUrl(value?: string): boolean {
    if (!value) {
      return false;
    }

    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }
}
