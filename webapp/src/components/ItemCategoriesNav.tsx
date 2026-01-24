export default function ItemCategoriesNav({
  activeNav,
  itemCategories,
  selectedItemCategory,
  selectItemCategory,
  getTotalUnreadCount,
  getUnreadCountForItemCategory,
}: ItemCategoriesNavProps) {
  return (
    <nav
      id="sidebar-menu"
      data-activenav={activeNav === "categories" ? "true" : "false"}
    >
      <ul className="list-unstyled fw-normal small">
        <li className={!selectedItemCategory ? "feedcategory-selected" : ""}>
          <button
            id="item-category-all"
            type="button"
            className="btn btn-sm btn-link text-decoration-none text-truncate"
            onClick={(e) => selectItemCategory(undefined, e)}
            onDoubleClick={(e) => selectItemCategory(undefined, e)}
          >
            <i className="bi bi-asterisk" /> <span>All</span>
            <span className="menu-marker">{getTotalUnreadCount()}</span>
          </button>
        </li>

        {itemCategories.map((itemCategory) => {
          return (
            <li
              key={itemCategory.id}
              className={
                itemCategory.id === selectedItemCategory?.id
                  ? "feedcategory-selected"
                  : ""
              }
            >
              <button
                id={`item-category-${itemCategory.id}`}
                type="button"
                className="btn btn-sm btn-link text-decoration-none text-truncate"
                onClick={(e) => selectItemCategory(itemCategory, e)}
                onDoubleClick={(e) => selectItemCategory(itemCategory, e)}
                title={`${itemCategory.title} ${getUnreadCountForItemCategory(
                  itemCategory.id
                )}`}
              >
                {/* <i className="bi bi-tag" /> */}
                <span> {itemCategory.title}</span>
                <span className="menu-marker">
                  {getUnreadCountForItemCategory(itemCategory.id)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
