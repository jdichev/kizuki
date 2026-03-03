/* eslint-disable react/no-danger */
import FormattedDate from "./FormattedDate";

export default function ItemsTable({
  items,
  selectedItem,
  selectItem,
}: ItemsTableProps) {
  return items.length ? (
    <table className="table">
      <tbody>
        {items.map((item: Item) => {
          return (
            <tr
              key={item.id}
              className={selectedItem?.id === item.id ? "selected-item" : ""}
            >
              <td className={item.read === 0 ? "item-unread" : "item-read"}>
                <a
                  data-testid="item-link"
                  href="/"
                  aria-label={item.title}
                  className="text-decoration-none"
                  onClick={(e) => selectItem(e, item)}
                  onFocus={(e) => selectItem(e, item)}
                  id={`item-${item.id}`}
                >
                  <span
                    dangerouslySetInnerHTML={{ __html: item.title }}
                    className="item-list-title"
                  />
                  <br />
                  <small className="item-list-details">
                    {item.feedTitle ? item.feedTitle : "NO_TITLE"},&nbsp;
                    <FormattedDate pubDate={item.published} />
                    ,&nbsp;
                    {item.url?.includes("youtube.com") ||
                    item.url?.includes("youtu.be")
                      ? "vid"
                      : `${item.latestContentWordCount || 0} words`}
                  </small>
                </a>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : (
    <pre data-testid="items-message">No items yet in this category</pre>
  );
}
