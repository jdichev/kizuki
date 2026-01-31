import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import DataService from "./service/DataService";
import Article from "./components/Article";
import ItemsTable from "./components/ItemsTable";
import ItemCategoriesNav from "./components/ItemCategoriesNav";
import TopNavMenu from "./components/TopNavMenu";

const ds = DataService.getInstance();

export default function ItemCategoriesMain({ topMenu }: HomeProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [itemCategories, setItemCategories] = useState<ItemCategory[]>([]);
  const [itemCategoryReadStats, setItemCategoryReadStats] = useState<
    ItemCategoryReadStat[]
  >([]);
  const [size, setSize] = useState<number>(50);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [selectedItemCategory, setSelectedItemCategory] =
    useState<ItemCategory>();
  const [article, setArticle] = useState<Item>();
  const [selectedItem, setSelectedItem] = useState<Item>();
  const [activeNav, setActiveNav] = useState<string>("categories");

  const loadingStartedAt = useRef<number | null>(null);
  const loadingHideTimer = useRef<number | null>(null);
  const scrollDebounceTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  const showItemCategories = useCallback(async () => {
    const res = await ds.getItemCategories();
    res.sort((a, b) => a.title.localeCompare(b.title));
    setItemCategories(res);
  }, []);

  const updateItemCategoryReadStats = useCallback(async () => {
    const res = await ds.getItemCategoryReadStats();
    setItemCategoryReadStats(res);
  }, []);

  const showItems = useCallback(async () => {
    let res;

    try {
      res = await ds
        .getItemsDeferred({
          size,
          unreadOnly,
          selectedItemCategory,
        })
        .catch((e) => {
          console.error("Error fetching items:", e);
          return undefined;
        });

      if (unreadOnly) {
        setActiveNav("categories");
        setSelectedItem(undefined);
      }

      if (res && Array.isArray(res)) {
        setItems(res);
        updateItemCategoryReadStats();
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
  }, [size, selectedItemCategory, unreadOnly, updateItemCategoryReadStats]);

  useEffect(() => {
    showItems();
  }, [size, showItems]);

  useEffect(() => {
    showItemCategories();
    updateItemCategoryReadStats();
  }, [showItemCategories, updateItemCategoryReadStats]);

  useEffect(() => {
    const updatesInterval = setInterval(() => {
      updateItemCategoryReadStats();
    }, 6e4);

    return () => {
      clearInterval(updatesInterval);
    };
  }, [updateItemCategoryReadStats]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code === "Enter") {
        visitSite();
      }

      if (["KeyW", "KeyK", "ArrowUp"].includes(e.code)) {
        e.preventDefault();
        if (activeNav === "categories") {
          selectPrevItemCategory();
        } else if (activeNav === "items") {
          selectPreviousItem();
        }
      }

      if (["KeyS", "KeyJ", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
        if (activeNav === "categories") {
          selectNextItemCategory();
        } else if (activeNav === "items") {
          selectNextItem();
        }
      }

      if (["KeyA", "KeyH", "ArrowLeft"].includes(e.code)) {
        if (activeNav === "items") {
          setActiveNav("categories");
          document
            .getElementById(
              `item-category-${selectedItemCategory ? selectedItemCategory.id : "all"}`
            )
            ?.focus();
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
              item.focus();
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

  const selectItem = useCallback(
    async (e: Event | undefined, item: Item) => {
      e?.preventDefault();

      setSelectedItem(item);
      setActiveNav("items");
      document.getElementById(`item-${item.id}`)?.focus();

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

        await updateItemCategoryReadStats();
      }

      if (article?.id !== item.id) {
        setArticle({ ...item, content: "Loading..." });
      }
      const newArticle = await ds.getItemDeferred(item.id);
      setArticle(newArticle);
    },
    [article, updateItemCategoryReadStats]
  );

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
        itemCategory: selectedItemCategory,
      })
      .catch((reason) => {
        console.error(reason);
      });

    await updateItemCategoryReadStats();
  }, [selectedItemCategory, updateItemCategoryReadStats]);

  const selectItemCategory = useCallback(
    (
      itemCategory: ItemCategory | undefined,
      _e: React.MouseEvent<HTMLButtonElement, MouseEvent> | undefined
    ) => {
      setSize(50);
      setSelectedItemCategory(itemCategory);
      setArticle(undefined);
      setSelectedItem(undefined);
      listRef.current?.scrollTo(0, 0);
      setActiveNav("categories");
      setUnreadOnly(false);
      document
        .getElementById(
          `item-category-${itemCategory ? itemCategory.id : "all"}`
        )
        ?.focus();
    },
    []
  );

  const selectNextItemCategory = useCallback(() => {
    const index = itemCategories.findIndex((itemCategory) => {
      return itemCategory.id === selectedItemCategory?.id;
    });

    const newIndex = index + 1;

    if (newIndex < itemCategories.length) {
      selectItemCategory(itemCategories[newIndex], undefined);
    }
  }, [itemCategories, selectedItemCategory, selectItemCategory]);

  const selectPrevItemCategory = useCallback(() => {
    const index = itemCategories.findIndex((itemCategory) => {
      return itemCategory.id === selectedItemCategory?.id;
    });

    const newIndex = index - 1;

    if (newIndex === -1) {
      selectItemCategory(undefined, undefined);
    } else if (newIndex >= 0) {
      selectItemCategory(itemCategories[newIndex], undefined);
    }
  }, [itemCategories, selectedItemCategory, selectItemCategory]);

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

  const showUnreadOnly = useCallback(async () => {
    setArticle(undefined);
    setSelectedItem(undefined);
    setUnreadOnly(!unreadOnly);
  }, [unreadOnly]);

  const getUnreadCountForItemCategory = useCallback(
    (itemCategoryId: number | undefined) => {
      const itemCategoryReadStat = itemCategoryReadStats.find(
        (itemCategoryReadStatRecord) => {
          return itemCategoryId === itemCategoryReadStatRecord.id;
        }
      );

      return itemCategoryReadStat?.unreadCount
        ? `${itemCategoryReadStat.unreadCount}`
        : "";
    },
    [itemCategoryReadStats]
  );

  const getTotalUnreadCount = useCallback(() => {
    const totalItemCategoryStat = itemCategoryReadStats.reduce(
      (acc, currentItemCategoryReadStat) => {
        return acc + currentItemCategoryReadStat.unreadCount;
      },
      0
    );

    return totalItemCategoryStat > 0 ? `${totalItemCategoryStat}` : "";
  }, [itemCategoryReadStats]);

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
      <ItemCategoriesNav
        activeNav={activeNav}
        itemCategories={itemCategories}
        selectedItemCategory={selectedItemCategory}
        selectItemCategory={selectItemCategory}
        getTotalUnreadCount={getTotalUnreadCount}
        getUnreadCountForItemCategory={getUnreadCountForItemCategory}
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
                onMarkAllRead={markItemsRead}
                onToggleUnreadOnly={showUnreadOnly}
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
            selectedItemCategory={selectedItemCategory}
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
