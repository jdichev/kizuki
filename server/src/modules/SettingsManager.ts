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
  private listeners = new Set<(event: SettingsChangeEvent) => void>();
  private settingsFilePath: string;

  // Default settings
  private static readonly DEFAULT_SETTINGS: { [key: string]: string } = {
    example: "test",
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
   * Subscribe to setting changes.
   * @param listener - Callback invoked when a setting changes
   * @returns Unsubscribe function
   */
  public addChangeListener(
    listener: (event: SettingsChangeEvent) => void
  ): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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

    const previousValue = this.settings[key];
    this.settings[key] = value;
    this.saveSettings();
    this.notifyChange({
      key,
      value,
      previousValue,
      operation: "set",
    });
  }

  /**
   * Deletes a setting by key and persists to disk.
   * If the setting is a default, it resets to the default value.
   * @param key - The setting key to delete
   */
  public deleteSetting(key: string): void {
    const previousValue = this.settings[key];

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

    this.notifyChange({
      key,
      value: this.settings[key],
      previousValue,
      operation: "delete",
    });
  }

  private notifyChange(event: SettingsChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        pino.warn({ error, key: event.key }, "Settings listener failed");
      }
    }
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

export type SettingsChangeEvent = {
  key: string;
  value: string | undefined;
  previousValue: string | undefined;
  operation: "set" | "delete";
};
