import { useMemo, useState } from "react";
import DataService from "./service/DataService";

const ds = DataService.getInstance();

export default function ItemsSearch() {
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const hasQuery = queryText.trim().length > 0;

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedQuery = queryText.trim();
    if (!normalizedQuery) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await ds.searchItems(normalizedQuery, 200);
      setResults(res);
    } finally {
      setLoading(false);
    }
  };

  const resultText = useMemo(() => {
    if (loading) {
      return "Searching...";
    }

    if (!hasQuery) {
      return "Enter a search term to find matching items.";
    }

    return `${results.length} result${results.length === 1 ? "" : "s"}`;
  }, [loading, hasQuery, results.length]);

  return (
    <main id="main-content">
      <div id="table-panel">
        <h3>Item search</h3>
        <form onSubmit={onSearch}>
          <div>
            <label htmlFor="searchItems" className="form-label">
              Full-text search
            </label>
            <input
              id="searchItems"
              className="form-control"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search in item titles and content"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Search
          </button>
        </form>

        <p>{resultText}</p>

        <table className="table table-striped table-borderless table-sm feeds-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Feed</th>
              <th>Date</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.feedTitle || "-"}</td>
                <td>
                  {item.published
                    ? new Date(item.published).toLocaleString()
                    : "-"}
                </td>
                <td>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-decoration-none"
                    >
                      Open
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
