import React, { useState, useEffect } from "react";
import SettingsService from "./service/SettingsService";
import SettingsSubNavigation from "./components/SettingsSubNavigation";

const ss = SettingsService.getInstance();

export default function Settings() {
  const [settings, setSettings] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string>("");
  const [newValue, setNewValue] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedSettings = await ss.getSettings();
      setSettings(loadedSettings);
    } catch (err) {
      setError(
        `Failed to load settings: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddSetting = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newKey.trim()) {
      setError("Setting key cannot be empty");
      return;
    }

    if (!newValue.trim()) {
      setError("Setting value cannot be empty");
      return;
    }

    try {
      setSavingKey(newKey);
      await ss.setSetting(newKey, newValue);
      setSettings({ ...settings, [newKey]: newValue });
      setNewKey("");
      setNewValue("");
      setError(null);
    } catch (err) {
      setError(
        `Failed to add setting: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteSetting = async (key: string) => {
    if (
      !window.confirm(`Are you sure you want to delete the setting "${key}"?`)
    ) {
      return;
    }

    try {
      setSavingKey(key);
      await ss.deleteSetting(key);
      const newSettings = { ...settings };
      delete newSettings[key];
      setSettings(newSettings);
      setError(null);
    } catch (err) {
      setError(
        `Failed to delete setting: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSavingKey(null);
    }
  };

  const isSensitiveSettingKey = (key: string) => {
    return key.toLowerCase().includes("key");
  };

  const getObfuscatedValue = (value: string) => {
    const maskLength = Math.min(12, Math.max(6, value.length));
    return "•".repeat(maskLength);
  };

  const handleCopySettingValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1600);
    } catch (err) {
      setError(
        `Failed to copy setting value: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  return (
    <>
      <SettingsSubNavigation activeSection="settings" />

      <main id="main-content">
        <div id="table-panel">
          <div>
            <h3>Settings</h3>

            {loading && <p>Loading settings...</p>}

            {error && <div>{error}</div>}

            {!loading && (
              <div>
                <table className="table table-striped table-borderless table-sm feeds-table">
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Value</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(settings).length === 0 ? (
                      <tr>
                        <td colSpan={3}>No settings configured yet</td>
                      </tr>
                    ) : (
                      Object.entries(settings).map(([key, value]) => (
                        <tr key={key}>
                          <td>
                            <code>{key}</code>
                          </td>
                          <td>
                            <code>
                              {isSensitiveSettingKey(key)
                                ? getObfuscatedValue(value)
                                : value}
                            </code>
                            {isSensitiveSettingKey(key) && (
                              <button
                                type="button"
                                className="btn btn-link text-decoration-none"
                                onClick={() =>
                                  handleCopySettingValue(key, value)
                                }
                                title="Copy setting value"
                              >
                                <i
                                  className={`bi ${
                                    copiedKey === key ? "bi-check2" : "bi-copy"
                                  }`}
                                ></i>
                              </button>
                            )}
                          </td>
                          <td>
                            <a
                              href="/"
                              className="text-decoration-none"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteSetting(key);
                              }}
                              title="Delete setting"
                            >
                              <i className="bi bi-trash"></i>
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <form onSubmit={handleAddSetting}>
                <h3>Add new setting</h3>

                <div>
                  <div>
                    <label htmlFor="settingKey" className="form-label">
                      Setting Key
                    </label>
                    <input
                      type="text"
                      className="form-control input"
                      id="settingKey"
                      placeholder="e.g. myCustomSetting"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      disabled={savingKey !== null}
                    />
                  </div>
                  <div>
                    <label htmlFor="settingValue" className="form-label">
                      Setting Value
                    </label>
                    <input
                      type="text"
                      className="form-control input"
                      id="settingValue"
                      placeholder="e.g. myValue"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      disabled={savingKey !== null}
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingKey !== null}
                    >
                      {savingKey !== null ? (
                        <>Adding...</>
                      ) : (
                        <>
                          <i className="bi bi-plus-circle"></i> Add Setting
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
