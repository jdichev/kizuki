import axios from "axios";
import SettingsManager from "./SettingsManager";
import type { SettingsChangeEvent } from "./SettingsManager";
import BaseAiService from "./AiService";

type OllamaGenerateResponse = {
  response?: string;
};

export default class OllamaAiService extends BaseAiService {
  private static instance: OllamaAiService;
  private settingsManager: SettingsManager;
  private baseUrl: string = "http://127.0.0.1:11434";
  private defaultModel: string = "llama3.1:8b";
  private backupModel: string = "llama3.1:8b";
  private summarizationModel: string = "llama3.1:8b";

  private constructor() {
    super({
      loggerName: "OllamaAiService",
      provider: "ollama",
      usageMetricsFileName: "ollama-ai-usage-metrics.json",
    });

    this.settingsManager = SettingsManager.getInstance();
    this.refreshClient();
    this.settingsManager.addChangeListener((event: SettingsChangeEvent) => {
      if (
        event.key === "OLLAMA_BASE_URL" ||
        event.key === "OLLAMA_MODEL" ||
        event.key === "OLLAMA_BACKUP_MODEL" ||
        event.key === "OLLAMA_SUMMARIZATION_MODEL"
      ) {
        this.refreshClient();
      }
    });
  }

  public static getInstance(): OllamaAiService {
    if (!OllamaAiService.instance) {
      OllamaAiService.instance = new OllamaAiService();
    }
    return OllamaAiService.instance;
  }

  public refreshClient(): void {
    const configuredBaseUrl =
      this.settingsManager.getSetting("OLLAMA_BASE_URL");
    const configuredModel = this.settingsManager.getSetting("OLLAMA_MODEL");
    const configuredBackupModel = this.settingsManager.getSetting(
      "OLLAMA_BACKUP_MODEL"
    );
    const configuredSummarizationModel = this.settingsManager.getSetting(
      "OLLAMA_SUMMARIZATION_MODEL"
    );

    this.baseUrl =
      configuredBaseUrl && configuredBaseUrl.trim()
        ? configuredBaseUrl.trim().replace(/\/$/, "")
        : "http://127.0.0.1:11434";
    this.defaultModel =
      configuredModel && configuredModel.trim()
        ? configuredModel.trim()
        : "llama3.1:8b";
    this.backupModel =
      configuredBackupModel && configuredBackupModel.trim()
        ? configuredBackupModel.trim()
        : this.defaultModel;
    this.summarizationModel =
      configuredSummarizationModel && configuredSummarizationModel.trim()
        ? configuredSummarizationModel.trim()
        : this.defaultModel;

    this.logger.info(
      {
        baseUrl: this.baseUrl,
        defaultModel: this.defaultModel,
        backupModel: this.backupModel,
        summarizationModel: this.summarizationModel,
      },
      "Ollama AI service configuration refreshed"
    );
    this.invalidatePrerequisitesCache();
  }

  public isConfigured(): boolean {
    return (
      this.baseUrl.trim().length > 0 && this.defaultModel.trim().length > 0
    );
  }

  public getDefaultModel(): string {
    return this.defaultModel;
  }

  public getBackupModel(): string {
    return this.backupModel;
  }

  public getSummarizationModel(): string {
    return this.summarizationModel;
  }

  protected async checkProviderPrerequisites(
    modelsToCheck: string[]
  ): Promise<void> {
    let response;
    try {
      response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 10000,
      });
    } catch (error: unknown) {
      throw new Error(
        `Ollama endpoint is not reachable at ${this.baseUrl}. Ensure Ollama is running.`
      );
    }

    const modelEntries = Array.isArray(response.data?.models)
      ? response.data.models
      : [];

    const availableModels = new Set<string>();
    for (const entry of modelEntries) {
      const nameFromName =
        typeof entry?.name === "string" ? entry.name.trim() : "";
      const nameFromModel =
        typeof entry?.model === "string" ? entry.model.trim() : "";

      if (nameFromName) {
        availableModels.add(nameFromName);
      }
      if (nameFromModel) {
        availableModels.add(nameFromModel);
      }
    }

    const missingModels = modelsToCheck.filter((modelName) => {
      const trimmed = modelName?.trim();
      if (!trimmed) {
        return false;
      }
      return !availableModels.has(trimmed);
    });

    if (missingModels.length > 0) {
      throw new Error(
        `Required Ollama models are not available locally: ${missingModels.join(", ")}`
      );
    }
  }

  protected async requestContent(options: {
    prompt: string;
    model: string;
    systemInstruction?: string;
  }): Promise<string> {
    const response = await axios.post<OllamaGenerateResponse>(
      `${this.baseUrl}/api/generate`,
      {
        model: options.model,
        prompt: options.prompt,
        system: options.systemInstruction,
        stream: false,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 120000,
      }
    );

    return response.data.response || "";
  }
}
