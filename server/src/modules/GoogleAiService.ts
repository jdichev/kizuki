import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import SettingsManager from "./SettingsManager";
import type { SettingsChangeEvent } from "./SettingsManager";
import BaseAiService from "./AiService";

/**
 * GoogleAiService handles AI operations such as preparing and sending prompts to Gemini AI.
 * Uses SettingsManager for API key configuration.
 * Implements singleton pattern for efficient resource management.
 * Enforces rate limiting: 2 requests/hour and 20 requests/day (persisted on disk).
 */
export default class GoogleAiService extends BaseAiService {
  private static instance: GoogleAiService;
  private settingsManager: SettingsManager;
  private aiClient: GoogleGenAI | null = null;
  private static readonly DEFAULT_MODEL = "gemini-3-flash-preview";
  private static readonly BACKUP_MODEL = "models/gemma-3-27b-it";
  private static readonly SUMMARIZATION_MODEL = "models/gemma-3-27b-it";

  private constructor() {
    super({
      loggerName: "GoogleAiService",
      provider: "google",
      usageMetricsFileName: "google-ai-usage-metrics.json",
    });

    this.settingsManager = SettingsManager.getInstance();
    this.initializeClient();
    this.settingsManager.addChangeListener((event: SettingsChangeEvent) => {
      if (event.key === "GEMINI_API_KEY") {
        this.refreshClient();
      }
    });
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
      this.logger.warn(
        "Gemini API key not configured. AI features will be unavailable."
      );
      this.aiClient = null;
      return;
    }

    try {
      this.aiClient = new GoogleGenAI({
        apiKey: apiKey,
      });
      this.logger.info("Google GenAI client initialized successfully");
    } catch (error) {
      this.logger.error({ error }, "Failed to initialize Google GenAI client");
      this.aiClient = null;
    }
  }

  /**
   * Reinitialize the client when API key changes
   */
  public refreshClient(): void {
    this.logger.info("Refreshing Google GenAI client");
    this.initializeClient();
    this.invalidatePrerequisitesCache();
  }

  /**
   * Check if AI service is properly configured
   */
  public isConfigured(): boolean {
    return this.aiClient !== null;
  }

  /**
   * Get the current default model
   */
  public getDefaultModel(): string {
    return GoogleAiService.DEFAULT_MODEL;
  }

  /**
   * Get the backup model (gemma)
   */
  public getBackupModel(): string {
    return GoogleAiService.BACKUP_MODEL;
  }

  /**
   * Get the model used for article summarization.
   */
  public getSummarizationModel(): string {
    return GoogleAiService.SUMMARIZATION_MODEL;
  }

  protected async checkProviderPrerequisites(
    modelsToCheck: string[]
  ): Promise<void> {
    const apiKey = this.settingsManager.getSetting("GEMINI_API_KEY")?.trim();

    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    try {
      const response = await axios.get(
        "https://generativelanguage.googleapis.com/v1beta/models",
        {
          params: { key: apiKey },
          timeout: 10000,
        }
      );

      const modelEntries = Array.isArray(response.data?.models)
        ? response.data.models
        : [];

      const availableModels = new Set<string>();
      for (const entry of modelEntries) {
        const modelName =
          typeof entry?.name === "string" ? entry.name.trim() : "";
        if (!modelName) {
          continue;
        }
        availableModels.add(modelName);
        if (modelName.startsWith("models/")) {
          availableModels.add(modelName.slice("models/".length));
        }
      }

      const missingModels = modelsToCheck.filter((modelName) => {
        if (!modelName || !modelName.trim()) {
          return false;
        }
        const trimmed = modelName.trim();
        return (
          !availableModels.has(trimmed) &&
          !availableModels.has(`models/${trimmed}`)
        );
      });

      if (missingModels.length > 0) {
        throw new Error(
          `Required Google models are not available: ${missingModels.join(", ")}`
        );
      }
    } catch (error: unknown) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;

      if (status === 400 || status === 401 || status === 403) {
        throw new Error("Invalid or unauthorized GEMINI_API_KEY");
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(String(error));
    }
  }

  protected async requestContent(options: {
    prompt: string;
    model: string;
    systemInstruction?: string;
  }): Promise<string> {
    if (!this.aiClient) {
      throw new Error("Google AI client is not configured");
    }

    const requestBody: {
      model: string;
      contents: string;
      systemInstruction?: string;
    } = {
      model: options.model,
      contents: options.prompt,
    };

    if (options.systemInstruction) {
      requestBody.systemInstruction = options.systemInstruction;
    }

    const response = await this.aiClient.models.generateContent(requestBody);
    return response.text || "";
  }
}
