import pinoLib from "pino";
import fs from "fs";
import os from "os";
import path from "path";

const pino = pinoLib({
  level: process.env.LOG_LEVEL || "info",
  name: "SettingsManager",
});

/**
 * SettingsManager handles application settings persistence.
 * Uses a hybrid approach: defines default settings and merges with file-loaded values.
 * Settings are cached in memory for fast access.
 */
export default class SettingsManager {
  private static instance: SettingsManager;
  private settings: { [key: string]: string };
  private settingsFilePath: string;

  // Default settings
  private static readonly DEFAULT_SETTINGS: { [key: string]: string } = {
    theme: "light",
    updateInterval: "3600000", // 1 hour in milliseconds
    maxConcurrentFeeds: "4",
  };

  private constructor() {
    this.settings = { ...SettingsManager.DEFAULT_SETTINGS };

    const tempInstance = process.env.NODE_ENV === "test";
    const storageDir = tempInstance
      ? path.join(os.tmpdir(), ".forest-temp")
      : path.join(os.homedir(), ".forest");

    // Ensure storage directory exists
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const settingsFileName = "settings.json";
    this.settingsFilePath = path.join(storageDir, settingsFileName);

    // Load existing settings from file if available
    if (fs.existsSync(this.settingsFilePath)) {
      try {
        const loadedSettings = JSON.parse(
          fs.readFileSync(this.settingsFilePath, "utf-8")
        );
        // Merge loaded settings with defaults (loaded settings override defaults)
        this.settings = { ...this.settings, ...loadedSettings };
        pino.debug("Settings loaded from disk");
      } catch (error) {
        pino.warn("Failed to load settings, using defaults");
      }
    } else {
      // Save defaults to file on first run
      this.saveSettings();
    }
  }

  /**
   * Gets the singleton instance of SettingsManager
   */
  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  /**
   * Gets a setting value by key.
   * Returns the latest value from in-memory cache.
   * @param key - The setting key
   * @returns The setting value or undefined if not found
   */
  public getSetting(key: string): string | undefined {
    return this.settings[key];
  }

  /**
   * Gets all settings as an object.
   * @returns A copy of all settings
   */
  public getAllSettings(): { [key: string]: string } {
    return { ...this.settings };
  }

  /**
   * Sets a setting value and persists to disk.
   * @param key - The setting key
   * @param value - The setting value (must be a string)
   */
  public setSetting(key: string, value: string): void {
    if (typeof value !== "string") {
      pino.warn(`Setting value for key "${key}" must be a string`);
      return;
    }
    this.settings[key] = value;
    this.saveSettings();
  }

  /**
   * Deletes a setting by key and persists to disk.
   * If the setting is a default, it resets to the default value.
   * @param key - The setting key to delete
   */
  public deleteSetting(key: string): void {
    if (key in SettingsManager.DEFAULT_SETTINGS) {
      // Reset to default
      this.settings[key] = SettingsManager.DEFAULT_SETTINGS[key];
      pino.debug(`Setting "${key}" reset to default value`);
    } else {
      // Remove non-default setting
      delete this.settings[key];
      pino.debug(`Setting "${key}" deleted`);
    }
    this.saveSettings();
  }

  /**
   * Persists current settings to disk.
   * @private
   */
  private saveSettings(): void {
    try {
      const settingsJson = JSON.stringify(this.settings, null, 2);
      fs.writeFileSync(this.settingsFilePath, settingsJson);
      pino.debug("Settings saved to disk");
    } catch (error) {
      pino.error(error, "Failed to save settings");
    }
  }
}
