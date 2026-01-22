import serverConfig from "../config/serverConfig";

export default class SettingsService {
  private static instance: SettingsService;
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = `${serverConfig.protocol}//${serverConfig.hostname}:${serverConfig.port}`;
  }

  private makeUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  public static getInstance(): SettingsService {
    if (!this.instance) {
      this.instance = new SettingsService();
    }
    return this.instance;
  }

  /**
   * Gets all settings from the server
   * @returns Promise resolving to an object of all key-value settings
   */
  public async getSettings(): Promise<{ [key: string]: string }> {
    const response = await fetch(this.makeUrl("/settings"));
    if (!response.ok) {
      throw new Error(`Failed to fetch settings: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Gets a specific setting by key
   * @param key - The setting key to retrieve
   * @returns Promise resolving to the setting value or undefined if not found
   */
  public async getSetting(key: string): Promise<string | undefined> {
    const response = await fetch(this.makeUrl(`/settings/${key}`));
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch setting: ${response.statusText}`);
    }
    const data = await response.json();
    return data[key];
  }

  /**
   * Sets a setting value
   * @param key - The setting key
   * @param value - The setting value (must be a string)
   * @returns Promise resolving when the setting is saved
   */
  public async setSetting(key: string, value: string): Promise<void> {
    const response = await fetch(this.makeUrl("/settings"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, value }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save setting: ${response.statusText}`);
    }
  }

  /**
   * Deletes a setting by key
   * @param key - The setting key to delete
   * @returns Promise resolving when the setting is deleted
   */
  public async deleteSetting(key: string): Promise<void> {
    const response = await fetch(this.makeUrl(`/settings/${key}`), {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete setting: ${response.statusText}`);
    }
  }
}
