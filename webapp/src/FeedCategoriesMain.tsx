import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import DataService from "./service/DataService";
import Article from "./components/Article";
import ItemsTable from "./components/ItemsTable";
import CategoriesMain from "./components/CategoriesMain";
import TopNavMenu from "./components/TopNavMenu";
import { useFilterState } from "./hooks/useFilterState";
import { ensureSelectedItemInList } from "./utils/itemListUtils";

const ds = DataService.getInstance();

export default function FeedsMain({ topMenu, topOptions }: HomeProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState<Item[]>([]);

  const [feedCategories, setFeedCategories] = useState<FeedCategory[]>([]);

  const [feedReadStats, setFeedReadStats] = useState<FeedReadStat[]>([]);

  const [feedCategoryReadStats, setFeedCategoryReadStats] = useState<
    FeedCategoryReadStat[]
  >([]);

  const [size, setSize] = useState<number>(50);

  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const {
    unreadOnly,
    bookmarkedOnly,
    showUnreadOnly,
    showBookmarkedOnly,
    clearFilters,
  } = useFilterState();

  const loadingStartedAt = useRef<number | null>(null);
  const loadingHideTimer = useRef<number | null>(null);
  const scrollDebounceTimer = useRef<number | null>(null);
  const initializedFromUrl = useRef(false);

  const [selectedFeedCategory, setSelectedFeedCategory] =
    useState<FeedCategory>();

  const [selectedFeed, setSelectedFeed] = useState<Feed>();

  const [article, setArticle] = useState<Item>();

  const [selectedItem, setSelectedItem] = useState<Item>();

  const [categoryFeeds, setCategoryFeeds] = useState<{
    [key: string]: Feed[];
  }>({});

  const [activeNav, setActiveNav] = useState<string>("categories");

  const listRef = useRef<HTMLDivElement>(null);

  const articleRef = useRef<HTMLDivElement>(null);

  const updateUrlForSelection = useCallback(
    (categoryId?: number, feedId?: number) => {
      const params = new URLSearchParams(location.search);

      console.log("updateUrlForSelection called with:", { categoryId, feedId });

      if (categoryId !== undefined) {
        params.set("category", `${categoryId}`);
      } else {
        params.delete("category");
      }

      if (feedId !== undefined) {
        params.set("feed", `${feedId}`);
      } else {
        params.delete("feed");
      }

      const search = params.toString();
      const nextUrl = `${location.pathname}${search ? `?${search}` : ""}`;
      const currentUrl = `${location.pathname}${location.search}`;

      console.log("updateUrlForSelection result:", { nextUrl, currentUrl });

      if (nextUrl !== currentUrl) {
        navigate(nextUrl, { replace: true });
      }
    },
    [location.pathname, location.search, navigate]
  );

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
          .getItemsDeferred({ size, unreadOnly, bookmarkedOnly, selectedFeed })
          .catch((e) => {
            console.error("Error fetching items for feed:", e);
            return undefined;
          });
      } else {
        res = await ds
          .getItemsDeferred({
            size,
            unreadOnly,
            bookmarkedOnly,
            selectedFeedCategory,
          })
          .catch((e) => {
            console.error("Error fetching items:", e);
            return undefined;
          });
      }

      if (res && Array.isArray(res)) {
        // Ensure selected item remains visible when unreadOnly filter is active
        const itemsWithSelected = ensureSelectedItemInList(
          res,
          selectedItem,
          unreadOnly
        );

        setItems(itemsWithSelected);
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
    if (initializedFromUrl.current || feedCategories.length === 0) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const categoryId = params.get("category")
      ? Number(params.get("category"))
      : undefined;
    const feedId = params.get("feed") ? Number(params.get("feed")) : undefined;

    if (categoryId === undefined && !feedId) {
      initializedFromUrl.current = true;
      return;
    }

    if (categoryId !== undefined) {
      const targetCategory = feedCategories.find((c) => c.id === categoryId);

      if (targetCategory) {
        setSelectedFeedCategory(targetCategory);
        setSize(50);
        setArticle(undefined);
        setSelectedItem(undefined);
        clearFilters();
        setActiveNav("categories");

        if (feedId) {
          setFeedCategories((prev) =>
            prev.map((c) => ({
              ...c,
              expanded: c.id === categoryId,
            }))
          );
          // Load feeds and stats for the selected category when a specific feed is specified
          const loadCategoryData = async () => {
            const feedIdStr = `${targetCategory.id}`;

            if (!categoryFeeds[feedIdStr]) {
              const feeds = await ds.getFeeds({
                selectedFeedCategory: targetCategory,
              });

              const sortedFeeds = feeds.sort((a, b) =>
                a.title.localeCompare(b.title)
              );

              setCategoryFeeds((prev) => {
                const next = { ...prev };
                next[feedIdStr] = sortedFeeds;
                return next;
              });
            }

            await updateFeedReadStats();
          };

          loadCategoryData();
        } else {
          // Load feeds for the selected category when no specific feed is specified
          const loadCategoryData = async () => {
            const feedIdStr = `${targetCategory.id}`;

            if (!categoryFeeds[feedIdStr]) {
              const feeds = await ds.getFeeds({
                selectedFeedCategory: targetCategory,
              });

              const sortedFeeds = feeds.sort((a, b) =>
                a.title.localeCompare(b.title)
              );

              setCategoryFeeds((prev) => {
                const next = { ...prev };
                next[feedIdStr] = sortedFeeds;
                return next;
              });
            }

            await updateFeedReadStats();
          };

          loadCategoryData();
        }
      }
    }

    initializedFromUrl.current = true;
  }, [
    feedCategories,
    location.search,
    clearFilters,
    categoryFeeds,
    updateFeedReadStats,
  ]);

  useEffect(() => {
    if (!selectedFeedCategory || !initializedFromUrl.current) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const feedId = params.get("feed") ? Number(params.get("feed")) : undefined;

    if (!feedId) {
      return;
    }

    const loadFeedsAndSelect = async () => {
      const feedIdStr = `${selectedFeedCategory.id}`;

      if (!categoryFeeds[feedIdStr]) {
        const feeds = await ds.getFeeds({
          selectedFeedCategory: selectedFeedCategory,
        });

        const sortedFeeds = feeds.sort((a, b) =>
          a.title.localeCompare(b.title)
        );

        setCategoryFeeds((prev) => {
          const next = { ...prev };
          next[feedIdStr] = sortedFeeds;
          return next;
        });

        const targetFeed = sortedFeeds.find((f) => f.id === feedId);
        if (targetFeed) {
          setSelectedFeed(targetFeed);
        }
      } else {
        const targetFeed = categoryFeeds[feedIdStr].find(
          (f) => f.id === feedId
        );
        if (targetFeed) {
          setSelectedFeed(targetFeed);
        }
      }

      await updateFeedReadStats();
    };

    loadFeedsAndSelect();
  }, [
    selectedFeedCategory,
    location.search,
    categoryFeeds,
    updateFeedReadStats,
  ]);

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
        e.preventDefault();
        if (activeNav === "categories") {
          selectPrevFeedOrCategory();
        } else if (activeNav === "items") {
          selectPreviousItem();
        }
      }

      if (["KeyS", "KeyJ", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
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
        handleToggleUnreadOnly();
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
    clearFilters();
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
    clearFilters,
  ]);

  const loadCategoryFeeds = useCallback(
    async (feedCategory: FeedCategory | undefined) => {
      if (!feedCategory?.id) {
        return [] as Feed[];
      }

      const feedIdStr = `${feedCategory.id}`;

      if (categoryFeeds[feedIdStr]) {
        return categoryFeeds[feedIdStr];
      }

      const feeds = await ds.getFeeds({
        selectedFeedCategory: feedCategory,
      });

      const sortedFeeds = feeds.sort((a, b) => a.title.localeCompare(b.title));

      setCategoryFeeds((prev) => {
        const next = { ...prev };

        next[feedIdStr] = sortedFeeds;

        return next;
      });

      return sortedFeeds;
    },
    [categoryFeeds]
  );
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
        await updateFeedReadStats();
      }

      // Normal selection logic
      setSelectedFeed(undefined);
      setSize(50);
      setSelectedFeedCategory(feedCategory);
      setArticle(undefined);
      setSelectedItem(undefined);
      listRef.current?.scrollTo(0, 0);
      setActiveNav("categories");

      clearFilters();
      updateUrlForSelection(feedCategory?.id, undefined);
      document
        .getElementById(`category-${feedCategory ? feedCategory.id : "all"}`)
        ?.focus();
    },
    [
      loadCategoryFeeds,
      setFeedCategories,
      updateFeedReadStats,
      updateUrlForSelection,
      clearFilters,
    ]
  );

  /**
   * Select a feed
   */
  const selectFeed = useCallback(
    (feed: Feed | undefined) => {
      const nextFeed = feed;
      const nextCategoryId =
        nextFeed?.feedCategoryId ?? selectedFeedCategory?.id;

      setSize(50);
      setSelectedFeed(nextFeed);
      clearFilters();
      setActiveNav("categories");
      listRef.current?.scrollTo(0, 0);
      updateUrlForSelection(nextCategoryId, nextFeed?.id);
      document.getElementById(`feed-${nextFeed?.id}`)?.focus();
    },
    [selectedFeedCategory?.id, setSize, updateUrlForSelection, clearFilters]
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

  // Wrap filter callbacks to also clear article/item selection
  const handleToggleUnreadOnly = useCallback(async () => {
    setArticle(undefined);
    setSelectedItem(undefined);
    showUnreadOnly();
  }, [showUnreadOnly]);

  const handleToggleBookmarkedOnly = useCallback(async () => {
    setArticle(undefined);
    setSelectedItem(undefined);
    showBookmarkedOnly();
  }, [showBookmarkedOnly]);

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
              <TopNavMenu
                unreadOnly={unreadOnly}
                bookmarkedOnly={bookmarkedOnly}
                onMarkAllRead={markItemsRead}
                onToggleUnreadOnly={handleToggleUnreadOnly}
                onToggleBookmarkedOnly={handleToggleBookmarkedOnly}
              />,
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
            topOptions={topOptions}
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
