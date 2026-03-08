import { useReducer, useEffect } from "react";
import { useInput, useApp, useStdout } from "ink";
import DataService from "../api/DataService.js";
import {
  Item,
  FeedCategory,
  ItemCategory,
  View,
  GroupingMode,
  CategoriesEntry,
  CategoryEntry,
  UseTuiNavigationResult,
} from "../types/index.js";
import { ITEM_CATEGORY_RANGES, MODE_ITEMS } from "../constants/config.js";

const ds = DataService.getInstance();

interface NavigationState {
  terminalHeight: number;
  terminalWidth: number;
  view: View;
  groupingMode: GroupingMode;
  categories: CategoriesEntry[];
  items: Item[];
  selectedItem: Item | null;
  selectedCategory: CategoryEntry | null;
  activeIndex: number;
  categoriesIndices: Record<string, number>;
  itemIndices: Record<string, number>;
  loading: boolean;
  scrollOffset: number;
  readerSplitEnabled: boolean;
  readerLatestContent: string | null;
  readerLatestLoading: boolean;
  readerLatestError: string | null;
  readerSummary: string | null;
  readerSummaryLoading: boolean;
  readerSummaryError: string | null;
  readerSummaryPending: boolean;
  unreadOnly: boolean;
  bookmarkedOnly: boolean;
}

type NavigationAction =
  | { type: "setTerminalSize"; terminalHeight: number; terminalWidth: number }
  | { type: "setView"; view: View }
  | { type: "setGroupingMode"; groupingMode: GroupingMode }
  | { type: "setCategories"; categories: CategoriesEntry[] }
  | { type: "setItems"; items: Item[] }
  | { type: "setSelectedItem"; selectedItem: Item | null }
  | { type: "setSelectedCategory"; selectedCategory: CategoryEntry | null }
  | { type: "setActiveIndex"; activeIndex: number }
  | { type: "setCategoriesIndex"; key: string; index: number }
  | { type: "setItemIndex"; key: string; index: number }
  | { type: "setLoading"; loading: boolean }
  | { type: "setScrollOffset"; scrollOffset: number }
  | { type: "setReaderSplitEnabled"; readerSplitEnabled: boolean }
  | { type: "setReaderLatestContent"; readerLatestContent: string | null }
  | { type: "setReaderLatestLoading"; readerLatestLoading: boolean }
  | { type: "setReaderLatestError"; readerLatestError: string | null }
  | { type: "setReaderSummary"; readerSummary: string | null }
  | { type: "setReaderSummaryLoading"; readerSummaryLoading: boolean }
  | { type: "setReaderSummaryError"; readerSummaryError: string | null }
  | { type: "setReaderSummaryPending"; readerSummaryPending: boolean }
  | { type: "setUnreadOnly"; unreadOnly: boolean }
  | { type: "setBookmarkedOnly"; bookmarkedOnly: boolean };

function navigationReducer(
  state: NavigationState,
  action: NavigationAction
): NavigationState {
  switch (action.type) {
    case "setTerminalSize":
      return {
        ...state,
        terminalHeight: action.terminalHeight,
        terminalWidth: action.terminalWidth,
      };
    case "setView":
      return { ...state, view: action.view };
    case "setGroupingMode":
      return { ...state, groupingMode: action.groupingMode };
    case "setCategories":
      return { ...state, categories: action.categories };
    case "setItems":
      return { ...state, items: action.items };
    case "setSelectedItem":
      return { ...state, selectedItem: action.selectedItem };
    case "setSelectedCategory":
      return { ...state, selectedCategory: action.selectedCategory };
    case "setActiveIndex":
      return { ...state, activeIndex: action.activeIndex };
    case "setCategoriesIndex":
      return {
        ...state,
        categoriesIndices: {
          ...state.categoriesIndices,
          [action.key]: action.index,
        },
      };
    case "setItemIndex":
      return {
        ...state,
        itemIndices: { ...state.itemIndices, [action.key]: action.index },
      };
    case "setLoading":
      return { ...state, loading: action.loading };
    case "setScrollOffset":
      return { ...state, scrollOffset: action.scrollOffset };
    case "setReaderSplitEnabled":
      return { ...state, readerSplitEnabled: action.readerSplitEnabled };
    case "setReaderLatestContent":
      return { ...state, readerLatestContent: action.readerLatestContent };
    case "setReaderLatestLoading":
      return { ...state, readerLatestLoading: action.readerLatestLoading };
    case "setReaderLatestError":
      return { ...state, readerLatestError: action.readerLatestError };
    case "setReaderSummary":
      return { ...state, readerSummary: action.readerSummary };
    case "setReaderSummaryLoading":
      return { ...state, readerSummaryLoading: action.readerSummaryLoading };
    case "setReaderSummaryError":
      return { ...state, readerSummaryError: action.readerSummaryError };
    case "setReaderSummaryPending":
      return { ...state, readerSummaryPending: action.readerSummaryPending };
    case "setUnreadOnly":
      return { ...state, unreadOnly: action.unreadOnly };
    case "setBookmarkedOnly":
      return { ...state, bookmarkedOnly: action.bookmarkedOnly };
    default:
      return state;
  }
}

function isCategoriesHeader(entry: CategoriesEntry | undefined): entry is any {
  return Boolean(entry && entry.isHeader);
}

function getCategoryKey(category: CategoryEntry | null): string {
  if (!category) return "all";
  return category.id?.toString() || "all";
}

type TuiStateController = {
  terminalHeight: number;
  terminalWidth: number;
  view: View;
  groupingMode: GroupingMode;
  categories: CategoriesEntry[];
  items: Item[];
  selectedItem: Item | null;
  selectedCategory: CategoryEntry | null;
  activeIndex: number;
  scrollOffset: number;
  loading: boolean;
  contentHeight: number;
  listVisibleHeight: number;
  readerSplitEnabled: boolean;
  readerLatestContent: string | null;
  readerLatestLoading: boolean;
  readerLatestError: string | null;
  readerSummary: string | null;
  readerSummaryLoading: boolean;
  readerSummaryError: string | null;
  readerSummaryPending: boolean;
  unreadOnly: boolean;
  bookmarkedOnly: boolean;
  dispatch: React.Dispatch<NavigationAction>;
  setView: (nextView: View) => void;
  handleMarkAllRead: () => void;
  moveListSelection: (delta: number) => void;
  handleBackNavigation: () => void;
  handleForwardNavigation: () => void;
  handleReload: () => void;
  handleToggleUnreadOnly: () => void;
  handleToggleBookmarkedOnly: () => void;
  toggleItemBookmark: (item: Item) => void;
  handleSummarize: (itemOverride?: Item) => Promise<void>;
};

function useTuiState(stdout: NodeJS.WriteStream): TuiStateController {
  const [state, dispatch] = useReducer(navigationReducer, {
    terminalHeight: stdout.rows || 24,
    terminalWidth: stdout.columns || 80,
    view: "help",
    groupingMode: "feed-categories",
    categories: [],
    items: [],
    selectedItem: null,
    selectedCategory: null,
    activeIndex: 0,
    categoriesIndices: {},
    itemIndices: {},
    loading: false,
    scrollOffset: 0,
    readerSplitEnabled: false,
    readerLatestContent: null,
    readerLatestLoading: false,
    readerLatestError: null,
    readerSummary: null,
    readerSummaryLoading: false,
    readerSummaryError: null,
    readerSummaryPending: false,
    unreadOnly: false,
    bookmarkedOnly: false,
  });

  const {
    terminalHeight,
    terminalWidth,
    view,
    groupingMode,
    categories,
    items,
    selectedItem,
    selectedCategory,
    activeIndex,
    categoriesIndices,
    itemIndices,
    loading,
    scrollOffset,
    readerSplitEnabled,
    readerLatestContent,
    readerLatestLoading,
    readerLatestError,
    readerSummary,
    readerSummaryLoading,
    readerSummaryError,
    readerSummaryPending,
    unreadOnly,
    bookmarkedOnly,
  } = state;

  const contentHeight = terminalHeight - 4;
  const listVisibleHeight = contentHeight - 2;

  // Auto-scroll logic
  useEffect(() => {
    if (view === "reader") return;
    if (activeIndex < scrollOffset) {
      dispatch({ type: "setScrollOffset", scrollOffset: activeIndex });
    } else if (activeIndex >= scrollOffset + listVisibleHeight) {
      dispatch({
        type: "setScrollOffset",
        scrollOffset: activeIndex - listVisibleHeight + 1,
      });
    }
  }, [activeIndex, scrollOffset, listVisibleHeight, view]);

  const handleSummarize = async (itemOverride?: Item) => {
    const targetItem = itemOverride || selectedItem;

    // Only skip if manually triggered (no override) and not in reader view
    if (!itemOverride && view !== "reader") {
      return;
    }

    if (!targetItem) return;

    // Skip if summary already exists
    if (targetItem.summary) return;

    const currentContent =
      readerLatestContent ||
      targetItem.latest_content ||
      targetItem.content ||
      "";

    dispatch({ type: "setReaderSummaryLoading", readerSummaryLoading: true });
    dispatch({ type: "setReaderSummaryError", readerSummaryError: null });

    try {
      const summaryData = await ds.summarize(
        currentContent,
        targetItem.url,
        "markdown"
      );

      if (summaryData.skipped) {
        throw new Error(
          summaryData.message ||
            summaryData.reason ||
            "Summarization skipped by server prerequisites"
        );
      }

      const summary = summaryData.summary || "";

      if (!summary) {
        throw new Error("Failed to generate summary");
      }

      dispatch({ type: "setReaderSummary", readerSummary: summary });

      // Update selectedItem with summary
      const updatedSelectedItem: Item = {
        ...targetItem,
        summary: summary,
      };
      dispatch({ type: "setSelectedItem", selectedItem: updatedSelectedItem });

      // Update items list
      dispatch({
        type: "setItems",
        items: items.map((item) =>
          item.id === targetItem.id ? { ...item, summary: summary } : item
        ),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to summarize article";
      dispatch({ type: "setReaderSummaryError", readerSummaryError: message });
    } finally {
      dispatch({
        type: "setReaderSummaryLoading",
        readerSummaryLoading: false,
      });
    }
  };

  // Auto-summarize effect removed - summarization is now manual only.

  useEffect(() => {
    const onResize = () => {
      dispatch({
        type: "setTerminalSize",
        terminalHeight: stdout.rows,
        terminalWidth: stdout.columns,
      });
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
      stdout.write("\x1b[2J\x1b[0f");
    };
  }, [stdout]);

  const refreshReadStats = async (
    mode: GroupingMode,
    currentCats: CategoriesEntry[]
  ) => {
    try {
      const stats =
        mode === "feed-categories"
          ? await ds.getFeedCategoryReadStats()
          : await ds.getItemCategoryReadStats();

      const totalUnread = stats.reduce((sum, s) => sum + s.unreadCount, 0);

      dispatch({
        type: "setCategories",
        categories: currentCats.map((entry) => {
          if (isCategoriesHeader(entry)) return entry;
          const cat = entry as CategoryEntry;
          if (cat.id === -1) return { ...cat, unreadCount: totalUnread };
          const stat = stats.find((s) => Number(s.id) === Number(cat.id));
          return {
            ...cat,
            unreadCount: stat?.unreadCount || 0,
          };
        }),
      });
    } catch (e) {
      // ignore
    }
  };

  const handleSelectMode = async (mode: GroupingMode) => {
    dispatch({ type: "setGroupingMode", groupingMode: mode });
    dispatch({ type: "setLoading", loading: true });
    try {
      let result: CategoriesEntry[] = [
        { id: -1, title: "All", isHeader: false },
      ];
      if (mode === "feed-categories") {
        const cats = await ds.getFeedCategories();
        const others: CategoryEntry[] = cats
          .filter((c) => c.title.toLowerCase() !== "uncategorized")
          .map((c) => ({ id: c.id!, title: c.title, isHeader: false as const }))
          .sort((a, b) => Number(a.id) - Number(b.id));
        const uncategorized: CategoryEntry[] = cats
          .filter((c) => c.title.toLowerCase() === "uncategorized")
          .map((c) => ({
            id: c.id!,
            title: c.title,
            isHeader: false as const,
          }));
        result = [...result, ...others, ...uncategorized];
      } else {
        const cats = await ds.getItemCategories();
        const sortedRanges = [...ITEM_CATEGORY_RANGES].sort((a, b) =>
          a.title.localeCompare(b.title)
        );

        for (const range of sortedRanges) {
          const children: CategoryEntry[] = cats
            .filter(
              (c) => Number(c.id) >= range.min && Number(c.id) <= range.max
            )
            .map((c) => ({
              id: c.id!,
              title: c.title,
              isHeader: false as const,
            }))
            .sort((a, b) => Number(a.id) - Number(b.id));

          if (children.length > 0) {
            result.push({
              id: `${range.min}-${range.max}`,
              title: range.title,
              isHeader: true,
            });
            result.push(...children);
          }
        }

        const uncategorized: CategoryEntry[] = cats
          .filter((c) => c.title.toLowerCase() === "uncategorized")
          .map((c) => ({
            id: c.id!,
            title: c.title,
            isHeader: false as const,
          }));
        if (uncategorized.length > 0) {
          result.push({ id: "0", title: "Uncategorized", isHeader: true });
          result.push(...uncategorized);
        }
      }
      dispatch({ type: "setCategories", categories: result });
      await refreshReadStats(mode, result);

      const savedIdx = categoriesIndices[mode] || 0;
      dispatch({
        type: "setActiveIndex",
        activeIndex: Math.min(savedIdx, result.length - 1),
      });
      dispatch({ type: "setScrollOffset", scrollOffset: 0 });
      dispatch({ type: "setView", view: "categories" });
    } finally {
      dispatch({ type: "setLoading", loading: false });
    }
  };

  const handleSelectCategory = async (
    category: CategoriesEntry | undefined,
    unreadOnlyOverride?: boolean,
    bookmarkedOnlyOverride?: boolean
  ) => {
    if (!category || isCategoriesHeader(category)) return;
    const cat = category as CategoryEntry;
    dispatch({ type: "setSelectedCategory", selectedCategory: cat });
    dispatch({ type: "setLoading", loading: true });
    try {
      const params: {
        size: number;
        unreadOnly: boolean;
        bookmarkedOnly: boolean;
        selectedFeedCategory?: FeedCategory;
        selectedItemCategoryIds?: number[];
      } = {
        size: 100,
        unreadOnly: unreadOnlyOverride ?? unreadOnly,
        bookmarkedOnly: bookmarkedOnlyOverride ?? bookmarkedOnly,
      };
      if (cat.id !== -1) {
        if (groupingMode === "feed-categories") {
          params.selectedFeedCategory = {
            id: Number(cat.id),
            title: cat.title,
          } as FeedCategory;
        } else if (typeof cat.id === "number") {
          params.selectedItemCategoryIds = [cat.id];
        }
      }
      const categoryItems = await ds.getItems(params);
      dispatch({ type: "setItems", items: categoryItems });
      const catKey = cat.id?.toString() || "all";
      dispatch({
        type: "setActiveIndex",
        activeIndex: itemIndices[catKey] || 0,
      });
      dispatch({ type: "setScrollOffset", scrollOffset: 0 });
      dispatch({ type: "setView", view: "items" });
    } finally {
      dispatch({ type: "setLoading", loading: false });
    }
  };

  const handleSelectItem = async (item: Item) => {
    if (!item) return;
    dispatch({ type: "setLoading", loading: true });
    try {
      const fullItem = await ds.getItem(item.id);
      if (fullItem) {
        dispatch({ type: "setSelectedItem", selectedItem: fullItem });
        dispatch({ type: "setView", view: "reader" });
        dispatch({ type: "setScrollOffset", scrollOffset: 0 });
        dispatch({ type: "setReaderSplitEnabled", readerSplitEnabled: false });
        dispatch({ type: "setReaderLatestContent", readerLatestContent: null });
        dispatch({ type: "setReaderLatestError", readerLatestError: null });
        dispatch({
          type: "setReaderLatestLoading",
          readerLatestLoading: false,
        });

        // If summary exists, show it immediately
        dispatch({
          type: "setReaderSummary",
          readerSummary: fullItem.summary || null,
        });
        dispatch({
          type: "setReaderSummaryLoading",
          readerSummaryLoading: false,
        });
        dispatch({ type: "setReaderSummaryError", readerSummaryError: null });

        ds.markItemRead(fullItem);
        dispatch({
          type: "setItems",
          items: items.map((i) => (i.id === item.id ? { ...i, read: 1 } : i)),
        });
        refreshReadStats(groupingMode, categories);
      }
    } finally {
      dispatch({ type: "setLoading", loading: false });
    }
  };

  const toggleItemBookmark = async (item: Item) => {
    if (!item) return;
    try {
      const result = await ds.toggleItemBookmark(item);
      const newBookmarked = result.bookmarked;

      // Update items list
      dispatch({
        type: "setItems",
        items: items.map((i) =>
          i.id === item.id ? { ...i, bookmarked: newBookmarked } : i
        ),
      });

      // Update selected item if it's the one being bookmarked
      if (selectedItem && selectedItem.id === item.id) {
        dispatch({
          type: "setSelectedItem",
          selectedItem: { ...selectedItem, bookmarked: newBookmarked },
        });
      }
    } catch (e) {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!selectedCategory) return;
    dispatch({ type: "setLoading", loading: true });
    try {
      const params =
        groupingMode === "feed-categories"
          ? {
              feedCategory: {
                id: Number(selectedCategory.id),
                title: selectedCategory.title,
              } as FeedCategory,
            }
          : {
              itemCategories: [
                {
                  id: Number(selectedCategory.id),
                  title: selectedCategory.title,
                } as ItemCategory,
              ],
            };
      await ds.markItemsRead(params);
      const refreshedItems = await ds.getItems({
        size: 100,
        unreadOnly: unreadOnly,
        bookmarkedOnly: bookmarkedOnly,
        selectedFeedCategory:
          groupingMode === "feed-categories"
            ? ({
                id: Number(selectedCategory.id),
                title: selectedCategory.title,
              } as FeedCategory)
            : undefined,
        selectedItemCategoryIds:
          groupingMode === "item-categories" &&
          typeof selectedCategory.id === "number"
            ? [selectedCategory.id]
            : undefined,
      });
      dispatch({ type: "setItems", items: refreshedItems });
      await refreshReadStats(groupingMode, categories);
      dispatch({ type: "setView", view: "items" });
    } finally {
      dispatch({ type: "setLoading", loading: false });
    }
  };

  const moveListSelection = (delta: number) => {
    if (view === "reader") {
      const nextOffset = Math.max(0, scrollOffset + delta);
      dispatch({ type: "setScrollOffset", scrollOffset: nextOffset });
      return;
    }

    const listLength =
      view === "start"
        ? MODE_ITEMS.length
        : view === "categories"
          ? categories.length
          : items.length;

    if (listLength === 0) return;

    // 1. Calculate the new logical active index
    let next = activeIndex + delta;
    next = Math.max(0, Math.min(listLength - 1, next));

    // 2. Categories-specific jump logic (skip headers)
    if (view === "categories") {
      const step = delta > 0 ? 1 : -1;
      while (
        next >= 0 &&
        next < listLength &&
        isCategoriesHeader(categories[next])
      ) {
        next += step;
      }
      if (
        next < 0 ||
        next >= listLength ||
        isCategoriesHeader(categories[next])
      ) {
        // Fallback to first non-header
        const first = categories.findIndex((c) => !isCategoriesHeader(c));
        next = first !== -1 ? first : activeIndex;
      }
    }

    dispatch({ type: "setActiveIndex", activeIndex: next });

    // 3. Update scroll position
    if (Math.abs(delta) > 1) {
      // PAGING: Attempt to center the new index
      const halfPage = Math.floor(listVisibleHeight / 2);
      let newScroll = next - halfPage;
      // Clamp scroll to ensure we don't show empty space at bottom
      const maxScroll = Math.max(0, listLength - listVisibleHeight);
      newScroll = Math.max(0, Math.min(maxScroll, newScroll));
      dispatch({ type: "setScrollOffset", scrollOffset: newScroll });
    } else {
      // SINGLE STEP: Scroll only if selection moves off-screen
      if (next < scrollOffset) {
        dispatch({ type: "setScrollOffset", scrollOffset: next });
      } else if (next >= scrollOffset + listVisibleHeight) {
        dispatch({
          type: "setScrollOffset",
          scrollOffset: next - listVisibleHeight + 1,
        });
      }
    }

    // 4. Persist index
    if (view === "categories") {
      dispatch({ type: "setCategoriesIndex", key: groupingMode, index: next });
    }
    if (view === "items") {
      dispatch({
        type: "setItemIndex",
        key: getCategoryKey(selectedCategory),
        index: next,
      });
    }
  };

  const handleBackNavigation = () => {
    if (view === "reader") {
      dispatch({ type: "setView", view: "items" });
      dispatch({ type: "setScrollOffset", scrollOffset: 0 });
      dispatch({
        type: "setActiveIndex",
        activeIndex: itemIndices[getCategoryKey(selectedCategory)] || 0,
      });
      return;
    }

    if (view === "items") {
      dispatch({ type: "setView", view: "categories" });
      dispatch({ type: "setScrollOffset", scrollOffset: 0 });
      dispatch({
        type: "setActiveIndex",
        activeIndex: categoriesIndices[groupingMode] || 0,
      });
      return;
    }

    if (view === "categories") {
      dispatch({ type: "setView", view: "start" });
      dispatch({ type: "setScrollOffset", scrollOffset: 0 });
      dispatch({ type: "setActiveIndex", activeIndex: 0 });
    }
  };

  const handleForwardNavigation = () => {
    if (view === "start") {
      const modeItem = MODE_ITEMS[activeIndex];
      if (modeItem) {
        handleSelectMode(modeItem.value as GroupingMode);
      }
      return;
    }

    if (view === "categories") {
      const category = categories[activeIndex];
      if (category) {
        handleSelectCategory(category);
      }
      return;
    }

    if (view === "items") {
      const item = items[activeIndex];
      if (item) {
        handleSelectItem(item);
      }
    }
  };

  const handleReload = () => {
    if (view === "categories") {
      handleSelectMode(groupingMode);
      return;
    }

    if (view === "items") {
      handleSelectCategory(selectedCategory || undefined);
    }
  };

  const handleToggleUnreadOnly = () => {
    const nextUnreadOnly = !unreadOnly;
    dispatch({ type: "setUnreadOnly", unreadOnly: nextUnreadOnly });
    if (nextUnreadOnly) {
      dispatch({ type: "setBookmarkedOnly", bookmarkedOnly: false });
    }

    // If we are in items view, we need to refresh the list
    if (view === "items") {
      handleSelectCategory(
        selectedCategory || undefined,
        nextUnreadOnly,
        nextUnreadOnly ? false : bookmarkedOnly
      );
    }
  };

  const handleToggleBookmarkedOnly = () => {
    const nextBookmarkedOnly = !bookmarkedOnly;
    dispatch({ type: "setBookmarkedOnly", bookmarkedOnly: nextBookmarkedOnly });
    if (nextBookmarkedOnly) {
      dispatch({ type: "setUnreadOnly", unreadOnly: false });
    }

    // If we are in items view, we need to refresh the list
    if (view === "items") {
      handleSelectCategory(
        selectedCategory || undefined,
        nextBookmarkedOnly ? false : unreadOnly,
        nextBookmarkedOnly
      );
    }
  };

  const setView = (nextView: View) => {
    dispatch({ type: "setView", view: nextView });
  };

  return {
    terminalHeight,
    terminalWidth,
    view,
    groupingMode,
    categories,
    items,
    selectedItem,
    selectedCategory,
    activeIndex,
    scrollOffset,
    loading,
    contentHeight,
    listVisibleHeight,
    readerSplitEnabled,
    readerLatestContent,
    readerLatestLoading,
    readerLatestError,
    readerSummary,
    readerSummaryLoading,
    readerSummaryError,
    readerSummaryPending,
    unreadOnly,
    bookmarkedOnly,
    dispatch,
    setView,
    handleMarkAllRead,
    moveListSelection,
    handleBackNavigation,
    handleForwardNavigation,
    handleReload,
    handleToggleUnreadOnly,
    handleToggleBookmarkedOnly,
    toggleItemBookmark,
    handleSummarize,
  };
}

function useTuiInput(
  exit: () => void,
  dispatch: React.Dispatch<NavigationAction>,
  {
    view,
    setView,
    handleMarkAllRead,
    moveListSelection,
    handleBackNavigation,
    handleForwardNavigation,
    handleReload,
    handleToggleUnreadOnly,
    handleToggleBookmarkedOnly,
    toggleItemBookmark,
    handleSummarize,
    listVisibleHeight,
    items,
    activeIndex,
    selectedItem,
  }: Pick<
    TuiStateController,
    | "view"
    | "setView"
    | "handleMarkAllRead"
    | "moveListSelection"
    | "handleBackNavigation"
    | "handleForwardNavigation"
    | "handleReload"
    | "handleToggleUnreadOnly"
    | "handleToggleBookmarkedOnly"
    | "toggleItemBookmark"
    | "handleSummarize"
    | "listVisibleHeight"
    | "items"
    | "activeIndex"
    | "selectedItem"
  >
) {
  useInput((input, key) => {
    const normalizedInput = input.toLowerCase();
    const isUnreadOnlyShortcut = view === "items" && normalizedInput === "e";
    const isBookmarkedOnlyShortcut = view === "items" && normalizedInput === "b";
    const isBookmarkShortcut = (view === "items" || view === "reader") && normalizedInput === "f";
    const isSummarizeShortcut = view === "reader" && normalizedInput === "o";

    if (isUnreadOnlyShortcut) {
      handleToggleUnreadOnly();
      return;
    }

    if (isBookmarkedOnlyShortcut) {
      handleToggleBookmarkedOnly();
      return;
    }

    if (isBookmarkShortcut) {
      if (view === "items") {
        const item = items[activeIndex];
        if (item) {
          toggleItemBookmark(item);
        }
      } else if (view === "reader" && selectedItem) {
        toggleItemBookmark(selectedItem);
      }
      return;
    }

    if (isSummarizeShortcut) {
      if (selectedItem) {
        handleSummarize(selectedItem);
      }
      return;
    }

    if (view === "help") {
      setView("start");
      return;
    }
    if (key.escape) {
      setView("confirm-exit");
      return;
    }
    if (view === "confirm-exit") {
      if (input === "y" || key.return) {
        exit();
        return;
      }
      if (input === "n" || input === "a" || key.leftArrow) {
        setView("start");
        // Reset activeIndex to 0 to avoid out-of-bounds on MODE_ITEMS
        dispatch({ type: "setActiveIndex", activeIndex: 0 });
      }
      return;
    }
    if (view === "confirm-mark-read") {
      if (input === "y" || key.return) {
        handleMarkAllRead();
        return;
      }
      if (input === "n" || input === "a" || key.leftArrow) {
        setView("items");
        // Active index should be restored from itemIndices in handleSelectCategory,
        // but let's ensure it's safe here or at least handled in handleForward
      }
      return;
    }

    const isUp = input === "w" || key.upArrow;
    const isDown = input === "s" || key.downArrow;
    const isPageUp = (input === "u" && key.ctrl) || key.pageUp;
    const isPageDown = (input === "d" && key.ctrl) || key.pageDown;
    const isBack = input === "a" || key.leftArrow;
    const isForward = input === "d" || key.rightArrow || key.return;
    const isReload = input === "r";
    const isHelp = input === "?" || input === "h";
    const isMarkReadConfirm = view === "items" && input === "q";

    if (isHelp) {
      setView("help");
      return;
    }

    if (isUp) {
      moveListSelection(-1);
      return;
    }

    if (isDown) {
      moveListSelection(1);
      return;
    }

    if (isPageUp) {
      moveListSelection(-listVisibleHeight);
      return;
    }

    if (isPageDown) {
      moveListSelection(listVisibleHeight);
      return;
    }

    if (isBack) {
      handleBackNavigation();
      return;
    }

    if (isForward) {
      handleForwardNavigation();
      return;
    }

    if (isReload) {
      handleReload();
      return;
    }

    if (isMarkReadConfirm) {
      setView("confirm-mark-read");
    }
  });
}

export function useTuiNavigation() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const state = useTuiState(stdout);

  useTuiInput(exit, state.dispatch, {
    view: state.view,
    setView: state.setView,
    handleMarkAllRead: state.handleMarkAllRead,
    moveListSelection: state.moveListSelection,
    handleBackNavigation: state.handleBackNavigation,
    handleForwardNavigation: state.handleForwardNavigation,
    handleReload: state.handleReload,
    handleToggleUnreadOnly: state.handleToggleUnreadOnly,
    handleToggleBookmarkedOnly: state.handleToggleBookmarkedOnly,
    toggleItemBookmark: state.toggleItemBookmark,
    handleSummarize: state.handleSummarize,
    listVisibleHeight: state.listVisibleHeight,
    items: state.items,
    activeIndex: state.activeIndex,
    selectedItem: state.selectedItem,
  });

  const result: UseTuiNavigationResult = {
    terminalHeight: state.terminalHeight,
    terminalWidth: state.terminalWidth,
    view: state.view,
    groupingMode: state.groupingMode,
    categories: state.categories,
    items: state.items,
    selectedItem: state.selectedItem,
    selectedCategory: state.selectedCategory,
    activeIndex: state.activeIndex,
    scrollOffset: state.scrollOffset,
    loading: state.loading,
    contentHeight: state.contentHeight,
    listVisibleHeight: state.listVisibleHeight,
    readerSplitEnabled: state.readerSplitEnabled,
    readerLatestContent: state.readerLatestContent,
    readerLatestLoading: state.readerLatestLoading,
    readerLatestError: state.readerLatestError,
    readerSummary: state.readerSummary,
    readerSummaryLoading: state.readerSummaryLoading,
    readerSummaryError: state.readerSummaryError,
    readerSummaryPending: state.readerSummaryPending,
    unreadOnly: state.unreadOnly,
    bookmarkedOnly: state.bookmarkedOnly,
    setView: state.setView,
    toggleItemBookmark: state.toggleItemBookmark,
    handleToggleBookmarkedOnly: state.handleToggleBookmarkedOnly,
    handleToggleUnreadOnly: state.handleToggleUnreadOnly,
    handleSummarize: state.handleSummarize,
  };

  return result;
}
