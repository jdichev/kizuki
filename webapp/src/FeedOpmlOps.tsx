import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FieldValues, useForm } from "react-hook-form";
import DataService from "./service/DataService";

const ds = DataService.getInstance();

export default function FeedOpmlOps() {
  const navigate = useNavigate();
  const formMethods = useForm();

  const [exportStatus, setExportStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const onSubmitFileImport = useCallback((data: FieldValues) => {
    const file = data.importFile[0];

    if (file.path) {
      ds.importOpmlFile({ filePath: file.path });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        ds.importOpmlFile({ fileContent: content, fileName: file.name });
      };
      reader.readAsText(file);
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
            <form onSubmit={formMethods.handleSubmit(onSubmitFileImport)}>
              <h3>Import OPML file</h3>

              <div>
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

              <button
                type="submit"
                className="btn btn-primary"
                id="opmlImportSubmit"
              >
                Import
              </button>

              <Link to="/feeds/add" className="btn btn-outline-secondary">
                Back
              </Link>
            </form>

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
                      message: "Failed to export OPML file. Please try again.",
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
          </div>
        </div>
      </main>
    </>
  );
}
