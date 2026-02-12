//

export default function CategoriesMain({
  activeNav,
  feedCategories,
  categoryFeeds,
  selectedFeedCategory,
  selectFeedCategory,
  selectedFeed,
  selectFeed,
  getTotalUnreadCount,
  getUnreadCountForFeedCategory,
  getUnreadCountForFeed,
}: CategoriesMainProps) {
  return (
    <nav
      id="sidebar-menu"
      data-activenav={activeNav === "categories" ? "true" : "false"}
    >
      <ul>
        <li className={!selectedFeedCategory ? "feedcategory-selected" : ""}>
          <button
            id="category-all"
            type="button"
            className="btn btn-link text-decoration-none"
            onClick={(e) => selectFeedCategory(null, e)}
          >
            <i className="bi bi-asterisk" /> <span>All</span>
            <span className="menu-marker">{getTotalUnreadCount()}</span>
          </button>
        </li>
        {feedCategories.map((feedCategory) => {
          return (
            <div key={feedCategory.id}>
              <li
                className={
                  feedCategory.id === selectedFeedCategory?.id && !selectedFeed
                    ? "feedcategory-selected"
                    : ""
                }
              >
                <button
                  id={`category-${feedCategory.id}`}
                  type="button"
                  className="btn btn-link text-decoration-none"
                  onClick={(e) => selectFeedCategory(feedCategory, e)}
                  // onDoubleClick={(e) => selectFeedCategory(feedCategory, e)}
                  title={`${feedCategory.title} ${getUnreadCountForFeedCategory(
                    feedCategory.id
                  )}`}
                >
                  {feedCategory.expanded ? (
                    <i className="bi bi-chevron-down categoryChevron" />
                  ) : (
                    <i className="bi bi-chevron-right categoryChevron" />
                  )}
                  <span> {feedCategory.title}</span>
                  <span className="menu-marker">
                    {getUnreadCountForFeedCategory(feedCategory.id)}
                  </span>
                </button>
              </li>

              {categoryFeeds[`${feedCategory.id}`] && feedCategory.expanded
                ? categoryFeeds[`${feedCategory.id}`].map((categoryFeed) => {
                    return (
                      <div key={categoryFeed.id}>
                        <li
                          className={
                            categoryFeed === selectedFeed
                              ? "feed-selected category-feed"
                              : "category-feed"
                          }
                        >
                          <button
                            id={`feed-${categoryFeed.id}`}
                            type="button"
                            className="btn btn-link text-decoration-none"
                            onClick={() => selectFeed(categoryFeed)}
                            title={`${
                              categoryFeed.title
                            } ${getUnreadCountForFeed(categoryFeed.id)}`}
                          >
                            <span>
                              {categoryFeed.title
                                ? categoryFeed.title
                                : "NO_TITLE"}
                            </span>

                            <span className="menu-marker">
                              {getUnreadCountForFeed(categoryFeed.id)}
                            </span>
                          </button>
                        </li>
                      </div>
                    );
                  })
                : ""}
            </div>
          );
        })}
      </ul>
    </nav>
  );
}
