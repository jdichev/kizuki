import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import DataService from "./service/DataService";
import UnifiedCategoriesView from "./components/UnifiedCategoriesView";
import TopNavMenu from "./components/TopNavMenu";
import { useFilterState } from "./hooks/useFilterState";

const ds = DataService.getInstance();

export default function FeedCategoriesRaw({ topMenu }: HomeProps) {
  const [items, setItems] = useState<Item[]>([]);

  const [feedCategories, setFeedCategories] = useState<FeedCategory[]>([]);

  const [feedReadStats, setFeedReadStats] = useState<FeedReadStat[]>([]);

  const [feedCategoryReadStats, setFeedCategoryReadStats] = useState<
    FeedCategoryReadStat[]
  >([]);

  const [size, setSize] = useState<number>(100);

  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const { unreadOnly, bookmarkedOnly, showUnreadOnly, showBookmarkedOnly } =
    useFilterState();

  const loadingStartedAt = useRef<number | null>(null);
  const loadingHideTimer = useRef<number | null>(null);
  const scrollDebounceTimer = useRef<number | null>(null);

  const [selectedFeedCategory, setSelectedFeedCategory] =
    useState<FeedCategory>();

  const [selectedFeed, setSelectedFeed] = useState<Feed>();

  const [categoryFeeds, setCategoryFeeds] = useState<{
    [key: string]: Feed[];
  }>({});

  const [activeNav, setActiveNav] = useState<string>("categories");

  const promptRef = useRef<HTMLDivElement>(null);

  const showFeedCategories = useCallback(async () => {
    const res = await ds.getFeedCategories();

    res.sort((a, b) => a.title.localeCompare(b.title));

    setFeedCategories(res);
  }, []);

  const updateFeedCategoryReadStats = useCallback(async () => {
    const res = await ds.getFeedCategoryReadStats();

    setFeedCategoryReadStats(res);
  }, []);

  const updateFeedReadStats = useCallback(async () => {
    const res = await ds.getFeedReadStats();

    setFeedReadStats(res);
  }, []);

  const showItems = useCallback(async () => {
    let res;

    try {
      // Fetch items using filter state
      res = await ds
        .getItemsDeferred({
          size,
          unreadOnly,
          bookmarkedOnly,
          selectedFeedCategory,
          selectedFeed,
        })
        .catch((e) => {
          console.log(e);
        });

      if (res) {
        setItems(res);
        updateFeedCategoryReadStats();
        updateFeedReadStats();
      }
    } finally {
      if (loadingHideTimer.current) {
        clearTimeout(loadingHideTimer.current);
        loadingHideTimer.current = null;
      }

      const minDisplayMs = 500;
      if (loadingStartedAt.current !== null) {
        const elapsed = performance.now() - loadingStartedAt.current;
        const remaining = Math.max(0, minDisplayMs - elapsed);

        loadingHideTimer.current = window.setTimeout(() => {
          setLoadingMore(false);
          loadingStartedAt.current = null;
          loadingHideTimer.current = null;
        }, remaining);
      } else {
        setLoadingMore(false);
      }
    }
  }, [
    size,
    selectedFeedCategory,
    selectedFeed,
    updateFeedCategoryReadStats,
    updateFeedReadStats,
  ]);

  useEffect(() => {
    showItems();
  }, [size, showItems]);

  useEffect(() => {
    showFeedCategories();
    updateFeedCategoryReadStats();
  }, [showFeedCategories, updateFeedCategoryReadStats]);

  useEffect(() => {
    const updatesInterval = setInterval(() => {
      updateFeedCategoryReadStats();
    }, 6e4);

    return () => {
      clearInterval(updatesInterval);
    };
  }, [showFeedCategories, updateFeedCategoryReadStats]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (["KeyW", "KeyK", "ArrowUp"].includes(e.code)) {
        e.preventDefault();
        if (activeNav === "categories") {
          selectPrevFeedOrCategory();
        }
      }

      if (["KeyS", "KeyJ", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
        if (activeNav === "categories") {
          selectNextFeedOrCategory();
        }
      }

      if (["KeyA", "KeyH", "ArrowLeft"].includes(e.code)) {
        if (selectedFeedCategory) {
          if (selectedFeedCategory.expanded) {
            setSelectedFeed(undefined);
          }

          setFeedCategories((prev) => {
            return prev.map((feedCategoryInner) => {
              if (feedCategoryInner.id === selectedFeedCategory.id) {
                feedCategoryInner.expanded = !feedCategoryInner.expanded;
              } else {
                feedCategoryInner.expanded = false;
              }

              return feedCategoryInner;
            });
          });

          await loadCategoryFeeds(selectedFeedCategory);
          await updateFeedReadStats();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  /**
   * Load more items
   */
  const loadMore = useCallback(() => {
    setLoadingMore(true);
    loadingStartedAt.current = performance.now();

    if (loadingHideTimer.current) {
      clearTimeout(loadingHideTimer.current);
      loadingHideTimer.current = null;
    }

    setSize((prevSize) => prevSize + Math.floor(prevSize / 2));
  }, []);

  useEffect(() => {
    return () => {
      if (loadingHideTimer.current) {
        clearTimeout(loadingHideTimer.current);
      }
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }
    };
  }, []);

  const loadCategoryFeeds = useCallback(
    async (feedCategory: FeedCategory | undefined) => {
      const feedIdStr = `${feedCategory?.id}`;

      if (!categoryFeeds[feedIdStr]) {
        const feeds = await ds.getFeeds({
          selectedFeedCategory: feedCategory,
        });

        setCategoryFeeds((prev) => {
          const next = { ...prev };

          next[feedIdStr] = feeds.sort((a, b) =>
            a.title.localeCompare(b.title)
          );

          return next;
        });
      }
    },
    [categoryFeeds]
  );

  /**
   * Select feed category, filtering items
   */
  const selectFeedCategory = useCallback(
    async (
      feedCategory: FeedCategory | undefined,
      e: React.MouseEvent<HTMLButtonElement, MouseEvent> | undefined
    ) => {
      // If clicking the chevron, only toggle expansion
      if (
        e &&
        (e.target as HTMLElement).classList.contains("categoryChevron")
      ) {
        setFeedCategories((prev) => {
          return prev.map((feedCategoryInner) => {
            if (feedCategoryInner.id === feedCategory?.id) {
              feedCategoryInner.expanded = !feedCategoryInner.expanded;
            } else {
              feedCategoryInner.expanded = false;
            }

            return feedCategoryInner;
          });
        });

        await loadCategoryFeeds(feedCategory);
      }

      // Normal selection logic
      setSelectedFeed(undefined);
      setSize(100);
      setSelectedFeedCategory(feedCategory);
      promptRef.current?.scrollTo(0, 0);
      setActiveNav("categories");

      document
        .getElementById(`category-${feedCategory ? feedCategory.id : "all"}`)
        ?.focus();

      await updateFeedReadStats();
    },
    [loadCategoryFeeds, setFeedCategories, updateFeedReadStats]
  );

  /**
   * Select a feed
   */
  const selectFeed = useCallback(
    (feed: Feed | undefined) => {
      setSize(100);
      setSelectedFeed(feed);
      promptRef.current?.scrollTo(0, 0);
      document.getElementById(`feed-${feed?.id}`)?.focus();
    },
    [setSize]
  );

  const selectNextFeedOrCategory = useCallback(() => {
    if (selectedFeedCategory?.expanded) {
      const feedIndex = categoryFeeds[`${selectedFeedCategory.id}`].findIndex(
        (categoryFeed) => {
          return categoryFeed.id === selectedFeed?.id;
        }
      );

      const newFeedIndex = feedIndex + 1;

      if (newFeedIndex < categoryFeeds[`${selectedFeedCategory.id}`].length) {
        selectFeed(categoryFeeds[`${selectedFeedCategory.id}`][newFeedIndex]);

        return;
      }
    }

    const index = feedCategories.findIndex((feedCategory) => {
      return feedCategory.id === selectedFeedCategory?.id;
    });

    const newIndex = index + 1;

    if (newIndex < feedCategories.length) {
      selectFeedCategory(feedCategories[newIndex], undefined);
    }
  }, [
    feedCategories,
    selectedFeedCategory,
    selectFeedCategory,
    categoryFeeds,
    selectedFeed,
    selectFeed,
  ]);

  const selectPrevFeedOrCategory = useCallback(() => {
    if (selectedFeedCategory?.expanded) {
      const feedIndex = categoryFeeds[`${selectedFeedCategory.id}`].findIndex(
        (categoryFeed) => {
          return categoryFeed.id === selectedFeed?.id;
        }
      );

      const newFeedIndex = feedIndex - 1;

      if (newFeedIndex === -1) {
        selectFeed(undefined);

        return;
      } else if (newFeedIndex >= 0) {
        selectFeed(categoryFeeds[`${selectedFeedCategory.id}`][newFeedIndex]);

        return;
      }
    }

    const index = feedCategories.findIndex((feedCategory) => {
      return feedCategory.id === selectedFeedCategory?.id;
    });

    const newIndex = index - 1;

    if (newIndex === -1) {
      selectFeedCategory(undefined, undefined);
    } else if (newIndex >= 0) {
      const selectedFeedCategoryInner = feedCategories[newIndex];
      selectFeedCategory(selectedFeedCategoryInner, undefined);

      if (selectedFeedCategoryInner?.expanded) {
        const selectedCategoryFeeds =
          categoryFeeds[`${selectedFeedCategoryInner.id}`];

        if (selectedCategoryFeeds && selectedCategoryFeeds.length > 0) {
          selectFeed(selectedCategoryFeeds[selectedCategoryFeeds.length - 1]);
        }
      }
    }
  }, [
    feedCategories,
    selectedFeedCategory,
    selectFeedCategory,
    categoryFeeds,
    selectedFeed,
    selectFeed,
  ]);

  const getTotalUnreadCount = useCallback(() => {
    return feedCategoryReadStats.reduce(
      (sum, stat) => sum + stat.unreadCount,
      0
    );
  }, [feedCategoryReadStats]);

  const getUnreadCountForFeedCategory = useCallback(
    (feedCategoryId: number | undefined) => {
      const feedCategoryReadStat = feedCategoryReadStats.find(
        (feedCategoryReadStatRecord) => {
          return feedCategoryId === feedCategoryReadStatRecord.id;
        }
      );

      return feedCategoryReadStat?.unreadCount
        ? `${feedCategoryReadStat.unreadCount}`
        : "";
    },
    [feedCategoryReadStats]
  );

  const getUnreadCountForFeed = useCallback(
    (feedId: number | undefined) => {
      const feedReadStat = feedReadStats.find((feedReadStatRecord) => {
        return feedId === feedReadStatRecord.id;
      });

      return feedReadStat?.unreadCount ? `${feedReadStat.unreadCount}` : "";
    },
    [feedReadStats]
  );

  /**
   * Generate prompt text from items
   */
  const generatePromptText = (): string => {
    if (items.length === 0) {
      return "";
    }

    // Calculate column widths
    const idWidth = Math.max(
      3, // "ID" header
      Math.max(...items.map((item) => String(item.id || "").length))
    );
    const feedWidth = Math.max(
      4, // "Feed" header
      Math.max(
        ...items.map((item) => (item.feedTitle || "Unknown Feed").length)
      )
    );

    // Create header
    const header = `${"ID".padEnd(idWidth)}  ${"Feed".padEnd(feedWidth)}  Title`;
    const separator = `${"-".repeat(idWidth)}  ${"-".repeat(feedWidth)}  ${"-".repeat(40)}`;

    // Create rows
    const rows = items.map(
      (item) =>
        `${String(item.id || "").padEnd(idWidth)}  ${(
          item.feedTitle || "Unknown Feed"
        ).padEnd(feedWidth)}  ${item.title}`
    );

    return [header, separator, ...rows].join("\n");
  };

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (scrollDebounceTimer.current) {
        clearTimeout(scrollDebounceTimer.current);
      }

      scrollDebounceTimer.current = window.setTimeout(() => {
        const bottomScrollOffset = 10;

        const scrollTarget = e.target as HTMLDivElement;
        if (
          Math.ceil(scrollTarget.scrollTop + scrollTarget.offsetHeight) >=
          scrollTarget.scrollHeight - bottomScrollOffset
        ) {
          loadMore();
        }

        if (scrollTarget.scrollTop === 0) {
          showItems();
        }
      }, 500);
    },
    [loadMore, showItems]
  );

  // Wrap filter callbacks to also clear any selection state
  const handleToggleUnreadOnly = useCallback(async () => {
    showUnreadOnly();
  }, [showUnreadOnly]);

  const handleToggleBookmarkedOnly = useCallback(async () => {
    showBookmarkedOnly();
  }, [showBookmarkedOnly]);

  return (
    <>
      <UnifiedCategoriesView
        activeNav={activeNav}
        parents={feedCategories}
        getChildren={(feedCategory) =>
          categoryFeeds[`${feedCategory.id}`] || []
        }
        parentKey={(feedCategory) =>
          feedCategory.id ?? `category-${feedCategory.title}`
        }
        childKey={(feed) => feed.id ?? `feed-${feed.title}`}
        allRow={{
          id: "category-all",
          className: !selectedFeedCategory ? "feedcategory-selected" : "",
          label: "All",
          onClick: (e) => selectFeedCategory(undefined, e),
          unreadCount: getTotalUnreadCount(),
          showUnread: () => true,
        }}
        parentRow={{
          id: (feedCategory) => `category-${feedCategory.id}`,
          className: (feedCategory) =>
            feedCategory.id === selectedFeedCategory?.id && !selectedFeed
              ? "feedcategory-selected"
              : "",
          label: (feedCategory) => ` ${feedCategory.title}`,
          title: (feedCategory) =>
            `${feedCategory.title} ${getUnreadCountForFeedCategory(
              feedCategory.id
            )}`,
          onClick: (feedCategory, e) => selectFeedCategory(feedCategory, e),
          unreadCount: (feedCategory) =>
            getUnreadCountForFeedCategory(feedCategory.id),
          showUnread: () => true,
          iconMode: "always",
          isExpanded: (feedCategory) => feedCategory.expanded === true,
        }}
        childRow={{
          id: (categoryFeed) => `feed-${categoryFeed.id}`,
          className: (categoryFeed) =>
            categoryFeed === selectedFeed
              ? "feed-selected category-feed"
              : "category-feed",
          label: (categoryFeed) =>
            categoryFeed.title ? categoryFeed.title : "NO_TITLE",
          title: (categoryFeed) =>
            `${categoryFeed.title} ${getUnreadCountForFeed(categoryFeed.id)}`,
          onClick: (categoryFeed) => selectFeed(categoryFeed),
          unreadCount: (categoryFeed) => getUnreadCountForFeed(categoryFeed.id),
          showUnread: () => true,
        }}
        shouldRenderChildren={(feedCategory) =>
          Boolean(categoryFeeds[`${feedCategory.id}`]) &&
          feedCategory.expanded === true
        }
      />

      <main id="main-content">
        <div id="prompt-panel" ref={promptRef} onScroll={handleScroll}>
          {topMenu.current &&
            ReactDOM.createPortal(
              <>
                <TopNavMenu
                  unreadOnly={unreadOnly}
                  bookmarkedOnly={bookmarkedOnly}
                  onMarkAllRead={() => {}} // No mark all read for raw view
                  onToggleUnreadOnly={handleToggleUnreadOnly}
                  onToggleBookmarkedOnly={handleToggleBookmarkedOnly}
                />
                <button
                  type="button"
                  className="btn"
                  id="copy-prompt"
                  title="Copy prompt to clipboard"
                  onClick={() => {
                    const text = generatePromptText();
                    navigator.clipboard.writeText(text).then(() => {
                      console.log("Prompt copied to clipboard");
                    });
                  }}
                >
                  <i className="bi bi-clipboard"></i>
                </button>
              </>,
              topMenu.current
            )}

          {generatePromptText()}
        </div>
      </main>

      {loadingMore && (
        <div className="loading-toast" role="status" aria-live="polite">
          loading...
        </div>
      )}
    </>
  );
}
