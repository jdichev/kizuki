import React, { useState, useEffect } from "react";
import SettingsService from "./service/SettingsService";

const ss = SettingsService.getInstance();

export default function Settings() {
  const [settings, setSettings] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string>("");
  const [newValue, setNewValue] = useState<string>("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

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

  return (
    <>
      <nav id="sidebar-menu" />

      <main id="main-content">
        <div id="feed-panel" className="p-4">
          <div id="panel-single-column">
            <h3>Settings</h3>

            {loading && <p>Loading settings...</p>}

            {error && <div className="alert alert-warning mt-2">{error}</div>}

            {!loading && (
              <div className="mt-3">
                <table className="table table-striped table-hover">
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
                        <td colSpan={3} className="text-center text-muted">
                          No settings configured yet
                        </td>
                      </tr>
                    ) : (
                      Object.entries(settings).map(([key, value]) => (
                        <tr key={key}>
                          <td>
                            <code>{key}</code>
                          </td>
                          <td>
                            <code>{value}</code>
                          </td>
                          <td>
                            <button
                              onClick={() => handleDeleteSetting(key)}
                              disabled={savingKey === key}
                            >
                              {savingKey === key ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2"></span>
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-trash"></i> Delete
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-5">
              <form onSubmit={handleAddSetting}>
                <h3>Add new setting</h3>

                <div className="row g-3 mt-1">
                  <div className="col-md-5">
                    <label htmlFor="settingKey" className="form-label">
                      Setting Key
                    </label>
                    <input
                      type="text"
                      className="form-control input input-group-sm"
                      id="settingKey"
                      placeholder="e.g. myCustomSetting"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      disabled={savingKey !== null}
                    />
                  </div>
                  <div className="col-md-5">
                    <label htmlFor="settingValue" className="form-label">
                      Setting Value
                    </label>
                    <input
                      type="text"
                      className="form-control input input-group-sm"
                      id="settingValue"
                      placeholder="e.g. myValue"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      disabled={savingKey !== null}
                    />
                  </div>
                  <div className="col-md-2 d-flex align-items-end">
                    <button type="submit" disabled={savingKey !== null}>
                      {savingKey !== null ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Adding...
                        </>
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
