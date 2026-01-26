import SettingsManager from "./SettingsManager";
import fs from "fs";
import os from "os";
import path from "path";

jest.mock("fs");
jest.mock("os");

describe("SettingsManager", () => {
  const TEMP_DIR = "/tmp";
  const STORAGE_DIR = path.join(TEMP_DIR, ".forest-temp");
  const SETTINGS_PATH = path.join(STORAGE_DIR, "settings.json");

  const mockedFs = fs as jest.Mocked<typeof fs>;
  const mockedOs = os as jest.Mocked<typeof os>;

  beforeEach(() => {
    jest.clearAllMocks();
    (SettingsManager as any).instance = undefined;

    mockedOs.tmpdir.mockReturnValue(TEMP_DIR);
    mockedOs.homedir.mockReturnValue("/home/test-user");

    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockReturnValue("{}");
    mockedFs.writeFileSync.mockReturnValue(undefined as any);
    mockedFs.mkdirSync.mockReturnValue(undefined as any);
  });

  it("initializes with defaults when no settings file exists", () => {
    const manager = SettingsManager.getInstance();

    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(STORAGE_DIR, {
      recursive: true,
    });
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      SETTINGS_PATH,
      expect.any(String)
    );

    const savedSettings = mockedFs.writeFileSync.mock.calls[0][1] as string;
    expect(JSON.parse(savedSettings)).toEqual({ example: "test" });
    expect(manager.getAllSettings()).toEqual({ example: "test" });
  });

  it("loads existing settings from disk and merges defaults", () => {
    mockedFs.existsSync.mockImplementation((target) => {
      return target === STORAGE_DIR || target === SETTINGS_PATH;
    });
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ example: "custom", theme: "dark" })
    );

    const manager = SettingsManager.getInstance();

    expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
    expect(manager.getSetting("example")).toBe("custom");
    expect(manager.getSetting("theme")).toBe("dark");
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("persists string values when set", () => {
    const manager = SettingsManager.getInstance();
    mockedFs.writeFileSync.mockClear();

    manager.setSetting("theme", "dark");

    expect(manager.getSetting("theme")).toBe("dark");
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);

    const persisted = mockedFs.writeFileSync.mock.calls[0][1] as string;
    expect(JSON.parse(persisted)).toMatchObject({
      example: "test",
      theme: "dark",
    });
  });

  it("resets defaults and removes custom keys on delete", () => {
    const manager = SettingsManager.getInstance();

    manager.setSetting("example", "custom");
    manager.setSetting("custom", "value");
    mockedFs.writeFileSync.mockClear();

    manager.deleteSetting("example");
    manager.deleteSetting("custom");

    expect(manager.getSetting("example")).toBe("test");
    expect(manager.getSetting("custom")).toBeUndefined();
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(2);

    const lastSave = mockedFs.writeFileSync.mock.calls[1][1] as string;
    expect(JSON.parse(lastSave)).toEqual({ example: "test" });
  });

  it("returns the same singleton instance", () => {
    const instanceA = SettingsManager.getInstance();
    const instanceB = SettingsManager.getInstance();

    expect(instanceA).toBe(instanceB);
  });
});
