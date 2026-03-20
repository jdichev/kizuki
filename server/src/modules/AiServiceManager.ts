import SettingsManager from "./SettingsManager";
import type { SettingsChangeEvent } from "./SettingsManager";
import type { AiProvider, AiService } from "./AiService";
import GoogleAiService from "./GoogleAiService";
import OllamaAiService from "./OllamaAiService";

export default class AiServiceManager {
  private static instance: AiServiceManager;
  private settingsManager: SettingsManager;
  private provider: AiProvider = "google";

  private constructor() {
    this.settingsManager = SettingsManager.getInstance();
    this.provider = this.resolveProvider();
    this.settingsManager.addChangeListener((event: SettingsChangeEvent) => {
      if (event.key === "AI_PROVIDER") {
        this.provider = this.resolveProvider();
      }
    });
  }

  public static getInstance(): AiServiceManager {
    if (!AiServiceManager.instance) {
      AiServiceManager.instance = new AiServiceManager();
    }
    return AiServiceManager.instance;
  }

  public getActiveProvider(): AiProvider {
    return this.provider;
  }

  public getActiveService(): AiService {
    return this.getService(this.provider);
  }

  public getService(provider: AiProvider): AiService {
    if (provider === "ollama") {
      return OllamaAiService.getInstance();
    }
    return GoogleAiService.getInstance();
  }

  private resolveProvider(): AiProvider {
    const rawProvider =
      this.settingsManager.getSetting("AI_PROVIDER")?.trim().toLowerCase() ||
      "google";
    return rawProvider === "ollama" ? "ollama" : "google";
  }
}
