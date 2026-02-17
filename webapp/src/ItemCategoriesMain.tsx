import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import DataService from "./service/DataService";
import Article from "./components/Article";
import ItemsTable from "./components/ItemsTable";
import UnifiedCategoriesView from "./components/UnifiedCategoriesView";
import TopNavMenu from "./components/TopNavMenu";
import { useFilterState } from "./hooks/useFilterState";
import { ensureSelectedItemInList } from "./utils/itemListUtils";
import {
  buildCategoryHierarchy,
  getUnreadCountForParent,
  getParentRangeForCategoryId,
  type ParentCategory,
} from "./utils/categoryHierarchyBuilder";

const ds = DataService.getInstance();

export default function ItemCategoriesMain({ topMenu, topOptions }: HomeProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [items, setItems] = useState<Item[]>([]);
  const [parentCategories, setParentCategories] = useState<ParentCategory[]>(
    []
  );
  const [categoryChildren, setCategoryChildren] = useState<
    Map<number, ItemCategory[]>
  >(new Map());
  const [itemCategoryReadStats, setItemCategoryReadStats] = useState<
    ItemCategoryReadStat[]
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
  const [selectedParentCategory, setSelectedParentCategory] =
    useState<ParentCategory>();
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
  const initializedFromUrl = useRef<boolean>(false);

  const updateUrlForSelection = useCallback(
    (categoryId?: number) => {
      const params = new URLSearchParams(location.search);

      if (categoryId !== undefined) {
        params.set("category", `${categoryId}`);
      } else {
        params.delete("category");
      }

      const search = params.toString();
      const nextUrl = `${location.pathname}${search ? `?${search}` : ""}`;
      const currentUrl = `${location.pathname}${location.search}`;

      if (nextUrl !== currentUrl) {
        navigate(nextUrl, { replace: true });
      }
    },
    [location.pathname, location.search, navigate]
  );

  const showItemCategories = useCallback(async () => {
    const res = await ds.getItemCategories();
    const hierarchy = buildCategoryHierarchy(res);
    setParentCategories(hierarchy.parentCategories);
    setCategoryChildren(hierarchy.childrenByParent);
  }, []);

  const updateItemCategoryReadStats = useCallback(async () => {
    const res = await ds.getItemCategoryReadStats();
    setItemCategoryReadStats(res);
  }, []);

  const showItems = useCallback(async () => {
    let res;

    try {
      // Collect category IDs: either the selected child category or all children of selected parent
      let selectedItemCategoryIds: number[] | undefined;

      if (selectedItemCategory) {
        selectedItemCategoryIds = [selectedItemCategory.id!];
      } else if (selectedParentCategory) {
        // When parent is selected, get all its children
        const childCategories =
          categoryChildren.get(selectedParentCategory.id) || [];
        if (childCategories.length > 0) {
          selectedItemCategoryIds = childCategories
            .map((cat) => cat.id)
            .filter((id) => id !== undefined) as number[];
        }
      }

      res = await ds
        .getItemsDeferred({
          size,
          unreadOnly,
          bookmarkedOnly,
          selectedItemCategoryIds,
        })
        .catch((e) => {
          console.error("Error fetching items:", e);
          return undefined;
        });

      if (res && Array.isArray(res)) {
        // Ensure selected item remains visible when unreadOnly filter is active
        const itemsWithSelected = ensureSelectedItemInList(
          res,
          selectedItem,
          unreadOnly
        );

        setItems(itemsWithSelected);
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
  }, [
    size,
    selectedItemCategory,
    selectedParentCategory,
    categoryChildren,
    unreadOnly,
    bookmarkedOnly,
    updateItemCategoryReadStats,
  ]);

  useEffect(() => {
    showItems();
  }, [size, showItems]);

  useEffect(() => {
    showItemCategories();
    updateItemCategoryReadStats();
  }, [showItemCategories, updateItemCategoryReadStats]);

  useEffect(() => {
    if (initializedFromUrl.current || parentCategories.length === 0) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const categoryIdStr = params.get("category");

    if (categoryIdStr) {
      const categoryId = parseInt(categoryIdStr, 10);
      if (!isNaN(categoryId)) {
        // Search for the category in all children across all parent categories
        let foundCategory: ItemCategory | undefined;
        for (const [_, children] of categoryChildren) {
          const found = children.find((c) => c.id === categoryId);
          if (found) {
            foundCategory = found;
            break;
          }
        }
        if (foundCategory) {
          setSelectedItemCategory(foundCategory);

          // Find and expand the parent category
          const parentId = getParentRangeForCategoryId(foundCategory.id);
          if (parentId !== undefined) {
            const parentCategory = parentCategories.find(
              (p) => p.id === parentId
            );
            if (parentCategory) {
              // Set the parent as selected and expanded
              const expandedParent = { ...parentCategory, expanded: true };
              setSelectedParentCategory(expandedParent);

              // Update the parentCategories array to mark this parent as expanded
              setParentCategories((prev) =>
                prev.map((p) =>
                  p.id === parentId
                    ? { ...p, expanded: true }
                    : { ...p, expanded: false }
                )
              );
            }
          }
        }
      }
    }

    initializedFromUrl.current = true;
  }, [location.search, parentCategories, categoryChildren]);

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

          // Use setTimeout to ensure DOM is updated before focusing
          setTimeout(() => {
            if (selectedItemCategory) {
              document
                .getElementById(
                  `item-category-child-${selectedItemCategory.id}`
                )
                ?.focus();
            } else {
              document
                .getElementById(
                  `item-category-${
                    selectedParentCategory ? selectedParentCategory.id : "all"
                  }`
                )
                ?.focus();
            }
          }, 0);
        } else {
          // In categories mode - handle expand/collapse with accordion behavior
          if (selectedParentCategory) {
            if (selectedParentCategory.expanded) {
              // Collapse the expanded parent
              setParentCategories((prev) => {
                return prev.map((parent) => {
                  if (parent.id === selectedParentCategory.id) {
                    return { ...parent, expanded: false };
                  }
                  return parent;
                });
              });
              // Update selected parent with collapsed state
              setSelectedParentCategory({
                ...selectedParentCategory,
                expanded: false,
              });
              // Clear child selection when collapsing
              setSelectedItemCategory(undefined);
            } else {
              // Expand the parent and collapse all others (accordion behavior)
              const expandedCategory = {
                ...selectedParentCategory,
                expanded: true,
              };
              setParentCategories((prev) => {
                return prev.map((parent) => {
                  if (parent.id === selectedParentCategory.id) {
                    return expandedCategory;
                  } else {
                    return { ...parent, expanded: false };
                  }
                });
              });
              // Update selected parent with expanded state
              setSelectedParentCategory(expandedCategory);
            }
          }
        }
      }

      if (["KeyD", "KeyL", "ArrowRight"].includes(e.code)) {
        if (activeNav === "categories") {
          // Move to items view
          if (items.length === 0) {
            return;
          }

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
        handleToggleUnreadOnly();
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
    clearFilters();
    setItems((prevItems) => {
      const nextItems = prevItems.map((prevItem) => {
        prevItem.read = 1;
        return prevItem;
      });

      return nextItems;
    });

    // Determine which categories to mark as read
    // If a child category is selected, use it
    // If only a parent category is selected, use all its children
    let categoriesToMark: ItemCategory[] = [];

    if (selectedItemCategory) {
      categoriesToMark = [selectedItemCategory];
    } else if (selectedParentCategory) {
      categoriesToMark = categoryChildren.get(selectedParentCategory.id) || [];
    }

    // Mark all categories' items as read in a single request
    if (categoriesToMark.length > 0) {
      await ds
        .markItemsRead({
          itemCategories: categoriesToMark,
        })
        .catch((reason) => {
          console.error(reason);
        });
    }

    await updateItemCategoryReadStats();
  }, [
    selectedItemCategory,
    selectedParentCategory,
    categoryChildren,
    updateItemCategoryReadStats,
    clearFilters,
  ]);

  const selectParentCategory = useCallback(
    (
      parentCategory: ParentCategory | undefined,
      e: React.MouseEvent<HTMLButtonElement> | undefined
    ) => {
      // If clicking the chevron, toggle expansion and collapse all others
      if (
        e &&
        (e.target as HTMLElement).classList.contains("categoryChevron")
      ) {
        // Create the updated category object with toggled expanded state
        const updatedCategory = parentCategory
          ? { ...parentCategory, expanded: !parentCategory.expanded }
          : undefined;

        setParentCategories((prev) => {
          return prev.map((parent) => {
            if (parent.id === parentCategory?.id) {
              // Return the updated category
              return updatedCategory!;
            } else {
              // Collapse all others
              return { ...parent, expanded: false };
            }
          });
        });
        // Select the updated category when expanding
        setSelectedItemCategory(undefined);
        setSize(50);
        setSelectedParentCategory(updatedCategory);
        setArticle(undefined);
        setSelectedItem(undefined);
        listRef.current?.scrollTo(0, 0);
        setActiveNav("categories");
        return;
      }

      // Normal selection logic
      setSelectedItemCategory(undefined);
      setSize(50);
      setSelectedParentCategory(parentCategory);
      setArticle(undefined);
      setSelectedItem(undefined);
      listRef.current?.scrollTo(0, 0);
      setActiveNav("categories");
      clearFilters();
      document
        .getElementById(
          `item-category-${parentCategory ? parentCategory.id : "all"}`
        )
        ?.focus();
    },
    [clearFilters]
  );

  const selectItemCategory = useCallback(
    (
      itemCategory: ItemCategory | undefined,
      _e: React.MouseEvent<HTMLButtonElement, MouseEvent> | undefined
    ) => {
      setSize(50);
      setSelectedItemCategory(itemCategory);

      // When selecting a child category, find and set its parent
      if (itemCategory) {
        for (const parent of parentCategories) {
          const childCategories = categoryChildren.get(parent.id) || [];
          if (childCategories.some((cat) => cat.id === itemCategory.id)) {
            setSelectedParentCategory(parent);
            break;
          }
        }
      }

      setArticle(undefined);
      setSelectedItem(undefined);
      listRef.current?.scrollTo(0, 0);
      setActiveNav("categories");
      clearFilters();
      updateUrlForSelection(itemCategory?.id);
      setTimeout(() => {
        document
          .getElementById(
            `item-category-child-${itemCategory ? itemCategory.id : "all"}`
          )
          ?.focus();
      }, 0);
    },
    [parentCategories, categoryChildren, updateUrlForSelection, clearFilters]
  );

  const selectNextItemCategory = useCallback(() => {
    // If a parent category is selected and expanded
    if (selectedParentCategory?.expanded) {
      const childCategories =
        categoryChildren.get(selectedParentCategory.id) || [];

      if (selectedItemCategory) {
        // If a child is already selected, move to next child
        const index = childCategories.findIndex(
          (child) => child.id === selectedItemCategory.id
        );
        const newIndex = index + 1;

        if (newIndex < childCategories.length) {
          selectItemCategory(childCategories[newIndex], undefined);
          return;
        }
      } else {
        // If parent is expanded but no child is selected, select first child
        if (childCategories.length > 0) {
          selectItemCategory(childCategories[0], undefined);
          return;
        }
      }
    }

    // Move to next parent category
    const parentIndex = parentCategories.findIndex(
      (parent) => parent.id === selectedParentCategory?.id
    );
    const newParentIndex = parentIndex + 1;

    if (newParentIndex < parentCategories.length) {
      selectParentCategory(parentCategories[newParentIndex], undefined);
    }
  }, [
    parentCategories,
    selectedParentCategory,
    categoryChildren,
    selectedItemCategory,
    selectItemCategory,
    selectParentCategory,
  ]);

  const selectPrevItemCategory = useCallback(() => {
    // If current parent is expanded and there's a selected child
    if (selectedParentCategory?.expanded && selectedItemCategory) {
      const childCategories =
        categoryChildren.get(selectedParentCategory.id) || [];
      const index = childCategories.findIndex(
        (child) => child.id === selectedItemCategory.id
      );
      const newIndex = index - 1;

      if (newIndex === -1) {
        // Move to parent level (deselect child and select parent)
        setSelectedItemCategory(undefined);
        document
          .getElementById(`item-category-${selectedParentCategory.id}`)
          ?.focus();
        return;
      } else if (newIndex >= 0) {
        selectItemCategory(childCategories[newIndex], undefined);
        return;
      }
    }

    // Move to previous parent category
    const parentIndex = parentCategories.findIndex(
      (parent) => parent.id === selectedParentCategory?.id
    );
    const newParentIndex = parentIndex - 1;

    if (newParentIndex === -1) {
      selectParentCategory(undefined, undefined);
    } else if (newParentIndex >= 0) {
      const selectedParentCategoryInner = parentCategories[newParentIndex];
      selectParentCategory(selectedParentCategoryInner, undefined);

      if (selectedParentCategoryInner?.expanded) {
        const selectedChildCategories =
          categoryChildren.get(selectedParentCategoryInner.id) || [];
        if (selectedChildCategories.length > 0) {
          selectItemCategory(
            selectedChildCategories[selectedChildCategories.length - 1],
            undefined
          );
        }
      }
    }
  }, [
    parentCategories,
    selectedParentCategory,
    categoryChildren,
    selectedItemCategory,
    selectItemCategory,
    selectParentCategory,
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

  const getUnreadCountForItemCategory = useCallback(
    (itemCategoryId: number | undefined) => {
      const itemCategoryReadStat = itemCategoryReadStats.find(
        (itemCategoryReadStatRecord) => {
          return itemCategoryId === itemCategoryReadStatRecord.id;
        }
      );

      return itemCategoryReadStat?.unreadCount ?? 0;
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

    return totalItemCategoryStat;
  }, [itemCategoryReadStats]);

  const getUnreadCountForParentCategory = useCallback(
    (parentId: number) => {
      return getUnreadCountForParent(parentId, itemCategoryReadStats);
    },
    [itemCategoryReadStats]
  );

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
      <UnifiedCategoriesView
        activeNav={activeNav}
        parents={parentCategories}
        getChildren={(parent) => categoryChildren.get(parent.id) || []}
        parentKey={(parent) => parent.id}
        childKey={(child) => child.id ?? `item-category-${child.title}`}
        allRow={{
          id: "item-category-all",
          className:
            !selectedParentCategory && !selectedItemCategory
              ? "feedcategory-selected"
              : "",
          label: "All",
          onClick: (e) => {
            selectParentCategory(undefined, e);
            selectItemCategory(undefined, undefined);
          },
          unreadCount: getTotalUnreadCount(),
          showUnread: (count) => Number(count || 0) > 0,
        }}
        parentRow={{
          id: (parentCategory) => `item-category-${parentCategory.id}`,
          className: (parentCategory) =>
            parentCategory.id === selectedParentCategory?.id &&
            !selectedItemCategory
              ? "feedcategory-selected"
              : "",
          label: (parentCategory) => parentCategory.title,
          title: (parentCategory) =>
            `${parentCategory.title} ${getUnreadCountForParentCategory(
              parentCategory.id
            )}`,
          onClick: (parentCategory, e) =>
            selectParentCategory(parentCategory, e),
          unreadCount: (parentCategory) =>
            getUnreadCountForParentCategory(parentCategory.id),
          showUnread: (count) => Number(count || 0) > 0,
          iconMode: "when-children",
          isExpanded: (parentCategory) => parentCategory.expanded === true,
        }}
        childRow={{
          id: (itemCategory) => `item-category-child-${itemCategory.id}`,
          className: (itemCategory) =>
            itemCategory === selectedItemCategory
              ? "category-feed feedcategory-selected"
              : "category-feed",
          label: (itemCategory) => itemCategory.title,
          title: (itemCategory) =>
            `${itemCategory.title} ${getUnreadCountForItemCategory(
              itemCategory.id
            )}`,
          onClick: (itemCategory) =>
            selectItemCategory(itemCategory, undefined),
          unreadCount: (itemCategory) =>
            getUnreadCountForItemCategory(itemCategory.id),
          showUnread: (count) => Number(count || 0) > 0,
        }}
        shouldRenderChildren={(parent) => parent.expanded === true}
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
            selectedItemCategory={selectedItemCategory}
            selectedParentCategory={selectedParentCategory}
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
