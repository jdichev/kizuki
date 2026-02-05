import { ServiceUsageClient } from "@google-cloud/service-usage";
import pinoLib from "pino";
import SettingsManager from "./SettingsManager";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "GoogleServiceUsageManager",
});

/**
 * GoogleServiceUsageManager handles Google Cloud Service Usage API interactions.
 * Monitors enabled APIs, quota limits, and service status.
 * Implements singleton pattern for efficient resource management.
 */
export default class GoogleServiceUsageManager {
  private static instance: GoogleServiceUsageManager;
  private settingsManager: SettingsManager;
  private serviceUsageClient: ServiceUsageClient | null = null;

  private constructor() {
    this.settingsManager = SettingsManager.getInstance();
    this.initializeServiceUsageClient();
  }

  /**
   * Get singleton instance of GoogleServiceUsageManager
   */
  public static getInstance(): GoogleServiceUsageManager {
    if (!GoogleServiceUsageManager.instance) {
      GoogleServiceUsageManager.instance = new GoogleServiceUsageManager();
    }
    return GoogleServiceUsageManager.instance;
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
   * Reinitialize the Service Usage client
   */
  public refresh(): void {
    pino.info("Refreshing Service Usage client");
    this.initializeServiceUsageClient();
  }

  /**
   * Check if Service Usage client is properly configured
   */
  public isConfigured(): boolean {
    return this.serviceUsageClient !== null;
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
}
