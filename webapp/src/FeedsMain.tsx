import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import DataService from "./service/DataService";
import Article from "./components/Article";
import ItemsTable from "./components/ItemsTable";
import CategoriesMain from "./components/CategoriesMain";

const ds = DataService.getInstance();

export default function FeedsMain({ topMenu }: HomeProps) {
  const [items, setItems] = useState<Item[]>([]);

  const [feedCategories, setFeedCategories] = useState<FeedCategory[]>([]);

  const [feedReadStats, setFeedReadStats] = useState<FeedReadStat[]>([]);

  const [feedCategoryReadStats, setFeedCategoryReadStats] = useState<
    FeedCategoryReadStat[]
  >([]);

  const [size, setSize] = useState<number>(50);

  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const loadingStartedAt = useRef<number | null>(null);
  const loadingHideTimer = useRef<number | null>(null);

  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);

  const [selectedFeedCategory, setSelectedFeedCategory] =
    useState<FeedCategory>();

  const [selectedFeed, setSelectedFeed] = useState<Feed>();

  const [article, setArticle] = useState<Item>();

  const [selectedItem, setSelectedItem] = useState<Item>();

  const [categoryFeeds, setCategoryFeeds] = useState<{
    [key: string]: FeedCategory[];
  }>({});

  const [activeNav, setActiveNav] = useState<string>("categories");

  const listRef = useRef<HTMLDivElement>(null);

  const articleRef = useRef<HTMLDivElement>(null);

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
      if (selectedFeed) {
        res = await ds
          .getItemsDeferred({ size, unreadOnly, selectedFeed })
          .catch((e) => {
            console.error('Error fetching items for feed:', e);
            return undefined;
          });
      } else {
        res = await ds
          .getItemsDeferred({
            size,
            unreadOnly,
            selectedFeedCategory,
          })
          .catch((e) => {
            console.error('Error fetching items:', e);
            return undefined;
          });
      }

      if (unreadOnly) {
        setActiveNav("categories");
        setSelectedItem(undefined);
      }

      if (res && Array.isArray(res)) {
        setItems(res);
        updateFeedCategoryReadStats();
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
    unreadOnly,
    updateFeedCategoryReadStats,
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
      if (e.code === "Enter") {
        visitSite();
      }

      if (["KeyW", "KeyK", "ArrowUp"].includes(e.code)) {
        if (activeNav === "categories") {
          selectPrevFeedOrCategory();
        } else if (activeNav === "items") {
          selectPreviousItem();
        }
      }

      if (["KeyS", "KeyJ", "ArrowDown"].includes(e.code)) {
        if (activeNav === "categories") {
          selectNextFeedOrCategory();
        } else if (activeNav === "items") {
          selectNextItem();
        }
      }

      if (["KeyA", "KeyH", "ArrowLeft"].includes(e.code)) {
        if (activeNav === "items") {
          setActiveNav("categories");

          if (selectedFeed) {
            document.getElementById(`feed-${selectedFeed.id}`)?.focus();
          } else {
            document
              .getElementById(
                `category-${
                  selectedFeedCategory ? selectedFeedCategory.id : "all"
                }`
              )
              ?.focus();
          }
        } else {
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
      }

      if (["KeyD", "KeyL", "ArrowRight"].includes(e.code)) {
        if (items.length === 0) {
          return;
        }

        if (activeNav === "categories") {
          setActiveNav("items");
          if (!article) {
            selectNextItem();
          } else {
            const item = document.getElementById(`item-${article.id}`);
            if (item) {
              document.getElementById(`item-${article.id}`)?.focus();
            } else {
              selectItem(undefined, items[0]);
            }
          }
        }
      }

      if (e.code === "KeyQ") {
        markItemsRead();
        setArticle(undefined);
        setActiveNav("categories");
      }

      if (e.code === "KeyE") {
        setActiveNav("categories");
        showUnreadOnly();
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
    };
  }, []);

  /**
   * Select item
   */
  const selectItem = useCallback(
    async (e: Event | undefined, item: Item) => {
      e?.preventDefault();

      setSelectedItem(item);

      setActiveNav("items");

      document.getElementById(`item-${item.id}`)?.focus();

      // articleRef.current?.scrollTo(0, 0);

      if (item.read === 0) {
        setItems((prevItems) => {
          const nextItems = prevItems.map((prevItem) => {
            if (prevItem === item) {
              prevItem.read = 1;
            }

            return prevItem;
          });

          return nextItems;
        });

        await ds.markItemRead(item).catch((reason) => {
          console.error(reason);
        });

        await updateFeedCategoryReadStats();

        updateFeedReadStats();
      }

      if (article?.id !== item.id) {
        setArticle({ ...item, content: "Loading..." });
      }
      const newArticle = await ds.getItemDeferred(item.id);
      setArticle(newArticle);
    },
    [article, updateFeedCategoryReadStats, updateFeedReadStats]
  );

  /**
   * Mark items as read. If filtered, only the ones matching
   * the filter wll be marked as read
   */
  const markItemsRead = useCallback(async () => {
    setUnreadOnly(false);
    setItems((prevItems) => {
      const nextItems = prevItems.map((prevItem) => {
        prevItem.read = 1;

        return prevItem;
      });

      return nextItems;
    });

    await ds
      .markItemsRead({
        feedCategory: selectedFeedCategory,
        feed: selectedFeed,
      })
      .catch((reason) => {
        console.error(reason);
      });

    await updateFeedCategoryReadStats();
    await updateFeedReadStats();
  }, [
    selectedFeedCategory,
    selectedFeed,
    updateFeedCategoryReadStats,
    updateFeedReadStats,
  ]);

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
      setSelectedFeed(undefined);
      setSize(50);
      setSelectedFeedCategory(feedCategory);
      setArticle(undefined);
      setSelectedItem(undefined);
      listRef.current?.scrollTo(0, 0);
      setActiveNav("categories");

      setUnreadOnly(false);
      document
        .getElementById(`category-${feedCategory ? feedCategory.id : "all"}`)
        ?.focus();

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
        await updateFeedReadStats();
      }
    },
    [loadCategoryFeeds, setFeedCategories, updateFeedReadStats]
  );

  /**
   * Select a feed
   */
  const selectFeed = useCallback(
    (feed: FeedCategory | undefined) => {
      setSize(50);
      setSelectedFeed(feed as Feed);
      setUnreadOnly(false);
      listRef.current?.scrollTo(0, 0);
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

        selectFeed(selectedCategoryFeeds[selectedCategoryFeeds.length - 1]);
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

  const selectNextItem = useCallback(() => {
    const index = items.findIndex((item) => {
      return item.id === selectedItem?.id;
    });

    const newIndex = index + 1;

    if (newIndex < items.length) {
      selectItem(undefined, items[newIndex]);
    }
  }, [items, selectItem, selectedItem]);

  const selectPreviousItem = useCallback(() => {
    const index = items.findIndex((item) => {
      return item.id === article?.id;
    });

    const newIndex = index - 1;

    if (newIndex >= 0) {
      selectItem(undefined, items[newIndex]);
    }
  }, [article, items, selectItem]);

  const visitSite = useCallback(() => {
    article && window.open(article.url, "", "noopener,noreferrer");
  }, [article]);

  /**
   * Show unread only
   */
  const showUnreadOnly = useCallback(async () => {
    setArticle(undefined);
    setSelectedItem(undefined);
    setUnreadOnly(!unreadOnly);
  }, [unreadOnly]);

  /**
   * Get the unread counts for category with unread items
   * @param feedCategoryId
   */
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

  /**
   * Get the unread counts for feed with unread items
   * @param feedId
   */
  const getUnreadCountForFeed = useCallback(
    (feedId: number | undefined) => {
      const feedReadStat = feedReadStats.find((feedReadStatRecord) => {
        return feedId === feedReadStatRecord.id;
      });

      return feedReadStat ? `${feedReadStat.unreadCount}` : "";
    },
    [feedReadStats]
  );

  const getTotalUnreadCount = useCallback(() => {
    const totalFeedStat = feedCategoryReadStats.reduce(
      (acc, currentFeedCategoryReadStat) => {
        return acc + currentFeedCategoryReadStat.unreadCount;
      },
      0
    );

    return totalFeedStat > 0 ? `${totalFeedStat}` : "";
  }, [feedCategoryReadStats]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const bottomScrollOffset = 5;

      if (
        Math.ceil(e.currentTarget.scrollTop + e.currentTarget.offsetHeight) >=
        e.currentTarget.scrollHeight - bottomScrollOffset
      ) {
        loadMore();
      }

      if (e.currentTarget.scrollTop === 0) {
        showItems();
      }
    },
    [loadMore, showItems]
  );

  return (
    <>
      <CategoriesMain
        activeNav={activeNav}
        feedCategories={feedCategories}
        categoryFeeds={categoryFeeds}
        selectedFeedCategory={selectedFeedCategory}
        selectFeedCategory={selectFeedCategory}
        selectedFeed={selectedFeed}
        selectFeed={selectFeed}
        getTotalUnreadCount={getTotalUnreadCount}
        getUnreadCountForFeedCategory={getUnreadCountForFeedCategory}
        getUnreadCountForFeed={getUnreadCountForFeed}
      />

      <main id="main-content">
        <div
          id="list-panel"
          ref={listRef}
          onScroll={handleScroll}
          data-activenav={activeNav === "items" ? "true" : "false"}
        >
          {topMenu.current &&
            ReactDOM.createPortal(
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  id="items-check-all-read-x"
                  title="Mark all read"
                  onClick={() => markItemsRead()}
                >
                  <i className="bi bi-check2-circle" />
                </button>

                <button
                  type="button"
                  className="btn btn-sm"
                  id="unread-only"
                  onClick={() => showUnreadOnly()}
                >
                  {unreadOnly ? (
                    <i className="bi bi-circle-fill" />
                  ) : (
                    <i className="bi bi-circle" />
                  )}
                </button>
              </>,
              topMenu.current
            )}

          <ItemsTable
            items={items}
            selectedItem={selectedItem}
            selectItem={selectItem}
          />
        </div>

        <div id="content-panel" ref={articleRef}>
          <Article
            article={article}
            selectedFeedCategory={selectedFeedCategory}
            selectedFeed={selectedFeed}
          />
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
