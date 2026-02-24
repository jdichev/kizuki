import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FieldValues, useForm } from "react-hook-form";
import DataService from "./service/DataService";

const ds = DataService.getInstance();

export default function FeedOpmlOps() {
  const navigate = useNavigate();
  const formMethods = useForm({
    defaultValues: {
      useSingleCategoryFile: false,
      useSingleCategoryUrl: false,
    },
  });

  const [feedCategories, setFeedCategories] = useState<FeedCategory[]>([]);

  const useSingleCategoryFile = formMethods.watch("useSingleCategoryFile");
  const useSingleCategoryUrl = formMethods.watch("useSingleCategoryUrl");
  const importUrlRegistration = formMethods.register("importUrl");

  const [exportStatus, setExportStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const [opmlFilePreview, setOpmlFilePreview] = useState<{
    loading: boolean;
    checked: boolean;
    sourceExists: boolean;
    isValid: boolean;
    feedsCount: number;
    categoriesCount: number;
    newFeedsCount: number;
    error?: string;
  }>({
    loading: false,
    checked: false,
    sourceExists: false,
    isValid: false,
    feedsCount: 0,
    categoriesCount: 0,
    newFeedsCount: 0,
  });

  const [fileImportProgress, setFileImportProgress] = useState<{
    isImporting: boolean;
    processedFeeds: number;
    totalFeeds: number;
    error?: string;
  }>({
    isImporting: false,
    processedFeeds: 0,
    totalFeeds: 0,
  });

  const [urlImportProgress, setUrlImportProgress] = useState<{
    isImporting: boolean;
    processedFeeds: number;
    totalFeeds: number;
    error?: string;
  }>({
    isImporting: false,
    processedFeeds: 0,
    totalFeeds: 0,
  });

  useEffect(() => {
    const loadFeedCategories = async () => {
      const categories = await ds.getFeedCategories();
      categories.sort((a, b) => a.title.localeCompare(b.title));
      setFeedCategories(categories);
    };

    loadFeedCategories();
  }, []);

  const onSubmitFileImport = useCallback(async (data: FieldValues) => {
    const options: {
      filePath?: string;
      fileContent?: string;
      fileName?: string;
      opmlUrl?: string;
      targetCategoryId?: number;
    } = {};

    if (data.useSingleCategoryFile && data.targetCategoryIdFile) {
      options.targetCategoryId = parseInt(data.targetCategoryIdFile, 10);
    }

    const file = data.importFile?.[0] as (File & { path?: string }) | undefined;

    if (!file) {
      return;
    }

    setFileImportProgress({
      isImporting: true,
      processedFeeds: 0,
      totalFeeds: 0,
    });

    try {
      let startOptions = { ...options };

      if (file.path) {
        startOptions = { ...startOptions, filePath: file.path };
      } else {
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve((event.target?.result as string) || "");
          };
          reader.onerror = () => {
            reject(new Error("Failed to read OPML file"));
          };
          reader.readAsText(file);
        });

        startOptions = {
          ...startOptions,
          fileContent,
          fileName: file.name,
        };
      }

      const startResult = await ds.startOpmlImport(startOptions);
      const jobId = String(startResult.jobId || "");

      if (!jobId) {
        throw new Error("Failed to start OPML import");
      }

      while (true) {
        const progress = await ds.getOpmlImportProgress(jobId);
        const status = String(progress.status || "running");
        const processedFeeds = Number(progress.processedFeeds || 0);
        const totalFeeds = Number(progress.totalFeeds || 0);

        setFileImportProgress({
          isImporting: status === "running",
          processedFeeds,
          totalFeeds,
          error:
            status === "failed" ? progress.error || "Import failed" : undefined,
        });

        if (status !== "running") {
          break;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      }
    } catch (error: any) {
      setFileImportProgress({
        isImporting: false,
        processedFeeds: 0,
        totalFeeds: 0,
        error: error.message || "Import failed",
      });
    }
  }, []);

  const checkOpmlUrl = useCallback(async (rawOpmlUrl: string) => {
    const opmlUrl = rawOpmlUrl.trim();

    if (!opmlUrl) {
      setOpmlFilePreview({
        loading: false,
        checked: false,
        sourceExists: false,
        isValid: false,
        feedsCount: 0,
        categoriesCount: 0,
        newFeedsCount: 0,
      });
      return;
    }

    setOpmlFilePreview((current) => ({
      ...current,
      loading: true,
      checked: false,
      error: undefined,
    }));

    try {
      const result = await ds.previewOpmlImport({ opmlUrl });
      setOpmlFilePreview({
        loading: false,
        checked: true,
        sourceExists: !!result.sourceExists,
        isValid: !!result.isValid,
        feedsCount: Number(result.feedsCount || 0),
        categoriesCount: Number(result.categoriesCount || 0),
        newFeedsCount: Number(result.newFeedsCount || 0),
        error: result.error,
      });
    } catch (error: any) {
      setOpmlFilePreview({
        loading: false,
        checked: true,
        sourceExists: false,
        isValid: false,
        feedsCount: 0,
        categoriesCount: 0,
        newFeedsCount: 0,
        error: error.message || "Failed to validate OPML file",
      });
    }
  }, []);

  const onSubmitUrlImport = useCallback(async (data: FieldValues) => {
    const opmlUrl = (data.importUrl || "").trim();
    if (!opmlUrl) {
      return;
    }

    const options: {
      opmlUrl: string;
      targetCategoryId?: number;
    } = {
      opmlUrl,
    };

    if (data.useSingleCategoryUrl && data.targetCategoryIdUrl) {
      options.targetCategoryId = parseInt(data.targetCategoryIdUrl, 10);
    }

    setUrlImportProgress({
      isImporting: true,
      processedFeeds: 0,
      totalFeeds: 0,
    });

    try {
      const startResult = await ds.startOpmlImport(options);
      const jobId = String(startResult.jobId || "");

      if (!jobId) {
        throw new Error("Failed to start OPML import");
      }

      while (true) {
        const progress = await ds.getOpmlImportProgress(jobId);
        const status = String(progress.status || "running");
        const processedFeeds = Number(progress.processedFeeds || 0);
        const totalFeeds = Number(progress.totalFeeds || 0);

        setUrlImportProgress({
          isImporting: status === "running",
          processedFeeds,
          totalFeeds,
          error:
            status === "failed" ? progress.error || "Import failed" : undefined,
        });

        if (status !== "running") {
          break;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 500);
        });
      }
    } catch (error: any) {
      setUrlImportProgress({
        isImporting: false,
        processedFeeds: 0,
        totalFeeds: 0,
        error: error.message || "Import failed",
      });
    }
  }, []);

  return (
    <>
      <nav id="main-sidebar" data-activenav="true">
        <ul>
          <li>
            <button
              type="button"
              className="btn btn-link text-decoration-none"
              onClick={() => navigate("/feeds/add")}
            >
              <i className="bi bi-plus-square" />
              <span>Add feed</span>
            </button>
          </li>
          <li className="feed-selected">
            <button type="button" className="btn btn-link text-decoration-none">
              <i className="bi bi-file-earmark-arrow-up" />
              <span>OPML</span>
            </button>
          </li>
        </ul>
      </nav>

      <main id="main-content">
        <div id="feed-panel">
          <div id="panel-single-column">
            <section className="form-section">
              <form onSubmit={formMethods.handleSubmit(onSubmitFileImport)}>
                <h3>Import OPML file</h3>

                <div className="mb-3">
                  <label htmlFor="importFile" className="form-label">
                    Choose OPML file
                  </label>

                  <input
                    className="form-control"
                    type="file"
                    id="importFile"
                    required
                    {...formMethods.register("importFile")}
                  />
                </div>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="useSingleCategoryFile"
                    {...formMethods.register("useSingleCategoryFile")}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="useSingleCategoryFile"
                  >
                    Import all feeds into one existing category
                  </label>
                </div>

                <div className="mb-3" hidden={!useSingleCategoryFile}>
                  <label htmlFor="targetCategoryIdFile" className="form-label">
                    Existing category
                  </label>

                  <select
                    className="form-select"
                    id="targetCategoryIdFile"
                    required={!!useSingleCategoryFile}
                    {...formMethods.register("targetCategoryIdFile")}
                  >
                    <option value="">Select category</option>
                    {feedCategories.map((feedCategory) => {
                      return (
                        <option key={feedCategory.id} value={feedCategory.id}>
                          {feedCategory.title}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  id="opmlImportSubmit"
                  disabled={fileImportProgress.isImporting}
                >
                  {fileImportProgress.isImporting
                    ? "Importing..."
                    : "Import from OPML file"}
                </button>

                {fileImportProgress.isImporting && (
                  <p>
                    Imported {fileImportProgress.processedFeeds} of{" "}
                    {fileImportProgress.totalFeeds} feeds...
                  </p>
                )}

                {!fileImportProgress.isImporting &&
                  !fileImportProgress.error &&
                  fileImportProgress.totalFeeds > 0 && (
                    <p>
                      Imported {fileImportProgress.processedFeeds} of{" "}
                      {fileImportProgress.totalFeeds} feeds.
                    </p>
                  )}

                {fileImportProgress.error && <p>{fileImportProgress.error}</p>}
              </form>
            </section>

            <section className="form-section">
              <form onSubmit={formMethods.handleSubmit(onSubmitUrlImport)}>
                <h3>Import OPML from URL</h3>

                <div className="mb-3">
                  <label htmlFor="importUrl" className="form-label">
                    OPML URL
                  </label>

                  <input
                    className="form-control"
                    type="url"
                    id="importUrl"
                    placeholder="https://example.com/feeds.opml"
                    required
                    {...importUrlRegistration}
                    onBlur={(event) => {
                      importUrlRegistration.onBlur(event);
                      checkOpmlUrl(event.target.value || "");
                    }}
                  />

                  {opmlFilePreview.loading && <p>Checking OPML URL...</p>}

                  {opmlFilePreview.checked && (
                    <ul>
                      <li>
                        URL exists:{" "}
                        {opmlFilePreview.sourceExists ? "Yes" : "No"}
                      </li>
                      <li>
                        Valid OPML: {opmlFilePreview.isValid ? "Yes" : "No"}
                      </li>
                      <li>
                        Categories found: {opmlFilePreview.categoriesCount}
                      </li>
                      <li>Feeds found: {opmlFilePreview.feedsCount}</li>
                      <li>
                        New feeds (not added yet):{" "}
                        {opmlFilePreview.newFeedsCount}
                      </li>
                      {opmlFilePreview.error && (
                        <li>Error: {opmlFilePreview.error}</li>
                      )}
                    </ul>
                  )}
                </div>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="useSingleCategoryUrl"
                    {...formMethods.register("useSingleCategoryUrl")}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="useSingleCategoryUrl"
                  >
                    Import all feeds into one existing category
                  </label>
                </div>

                <div className="mb-3" hidden={!useSingleCategoryUrl}>
                  <label htmlFor="targetCategoryIdUrl" className="form-label">
                    Existing category
                  </label>

                  <select
                    className="form-select"
                    id="targetCategoryIdUrl"
                    required={!!useSingleCategoryUrl}
                    {...formMethods.register("targetCategoryIdUrl")}
                  >
                    <option value="">Select category</option>
                    {feedCategories.map((feedCategory) => {
                      return (
                        <option key={feedCategory.id} value={feedCategory.id}>
                          {feedCategory.title}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={urlImportProgress.isImporting}
                >
                  {urlImportProgress.isImporting
                    ? "Importing..."
                    : "Import from URL"}
                </button>

                {urlImportProgress.isImporting && (
                  <p>
                    Imported {urlImportProgress.processedFeeds} of{" "}
                    {urlImportProgress.totalFeeds} feeds...
                  </p>
                )}

                {!urlImportProgress.isImporting &&
                  !urlImportProgress.error &&
                  urlImportProgress.totalFeeds > 0 && (
                    <p>
                      Imported {urlImportProgress.processedFeeds} of{" "}
                      {urlImportProgress.totalFeeds} feeds.
                    </p>
                  )}

                {urlImportProgress.error && <p>{urlImportProgress.error}</p>}
              </form>
            </section>

            <section className="form-section">
              <div>
                <h3>Export OPML file</h3>
                <p>Download all your feeds in OPML format</p>

                {exportStatus.type && <div>{exportStatus.message}</div>}

                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={async () => {
                    try {
                      setExportStatus({ type: null, message: "" });
                      await ds.exportOpmlFile();
                      setExportStatus({
                        type: "success",
                        message: "OPML file exported successfully!",
                      });
                      setTimeout(() => {
                        setExportStatus({ type: null, message: "" });
                      }, 3000);
                    } catch (error) {
                      console.error("Export failed:", error);
                      setExportStatus({
                        type: "error",
                        message:
                          "Failed to export OPML file. Please try again.",
                      });
                      setTimeout(() => {
                        setExportStatus({ type: null, message: "" });
                      }, 5000);
                    }
                  }}
                >
                  Export OPML
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
