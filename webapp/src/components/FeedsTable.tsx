import { Link } from "react-router-dom";
import ms from "ms";

export default function FeedsTable({
  feeds,
  removeFeed,
  sortField,
  sortDirection,
  onSort,
}: FeedsTableProps) {
  const getSortIcon = (field: "name" | "items") => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  return (
    <table className="table table-striped table-borderless table-sm feeds-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>
            <a
              href="#"
              className="text-decoration-none text-reset"
              onClick={(e) => {
                e.preventDefault();
                onSort("name");
              }}
            >
              Feed {feeds.length}
              {getSortIcon("name")}
            </a>
          </th>
          <th>
            <a
              href="#"
              className="text-decoration-none text-reset"
              onClick={(e) => {
                e.preventDefault();
                onSort("items");
              }}
            >
              Items{getSortIcon("items")}
            </a>
          </th>
          <th>Errors</th>
          <th>Freq</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {feeds.map((feed) => {
          return feed.hidden ? null : (
            <tr key={feed.id}>
              <td>{feed.id}</td>
              <td data-testid="feed-edit-link">
                <Link
                  to={{
                    pathname: `/feeds/edit/${feed.id}`,
                  }}
                  className="text-decoration-none"
                >
                  {feed.title ? feed.title : "NO_TITLE"}
                </Link>
              </td>
              <td>{feed.itemsCount}</td>
              <td>{feed.error}</td>
              <td className="text-nowrap">
                {feed.updateFrequency && ms(feed.updateFrequency)}
              </td>
              <td>
                <a
                  data-testid="feed-delete-link"
                  href="/"
                  className="text-decoration-none"
                  onClick={(e) => {
                    e.preventDefault();
                    // @ts-ignore
                    removeFeed(feed.id);
                  }}
                >
                  <i className="bi bi-trash"></i>
                </a>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
