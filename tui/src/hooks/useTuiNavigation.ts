import { useReducer, useEffect } from "react";
import { useInput, useApp, useStdout } from "ink";
import DataService from "../api/DataService.js";
import {
  Item,
  FeedCategory,
  ItemCategory,
  View,
  GroupingMode,
  SidebarEntry,
  SidebarCategory,
  UseTuiNavigationResult,
} from "../types/index.js";
import { ITEM_CATEGORY_RANGES, MODE_ITEMS } from "../constants/config.js";

const ds = DataService.getInstance();

interface NavigationState {
  terminalHeight: number;
  terminalWidth: number;
  view: View;
  groupingMode: GroupingMode;
  categories: SidebarEntry[];
  items: Item[];
  selectedItem: Item | null;
  selectedCategory: SidebarCategory | null;
  activeIndex: number;
  sidebarIndices: Record<string, number>;
  itemIndices: Record<string, number>;
  loading: boolean;
  scrollOffset: number;
}

type NavigationAction =
  | { type: "setTerminalSize"; terminalHeight: number; terminalWidth: number }
  | { type: "setView"; view: View }
  | { type: "setGroupingMode"; groupingMode: GroupingMode }
  | { type: "setCategories"; categories: SidebarEntry[] }
  | { type: "setItems"; items: Item[] }
  | { type: "setSelectedItem"; selectedItem: Item | null }
  | { type: "setSelectedCategory"; selectedCategory: SidebarCategory | null }
  | { type: "setActiveIndex"; activeIndex: number }
  | { type: "setSidebarIndex"; key: string; index: number }
  | { type: "setItemIndex"; key: string; index: number }
  | { type: "setLoading"; loading: boolean }
  | { type: "setScrollOffset"; scrollOffset: number };

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
    case "setSidebarIndex":
      return {
        ...state,
        sidebarIndices: { ...state.sidebarIndices, [action.key]: action.index },
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
    default:
      return state;
  }
}

function isSidebarHeader(entry: SidebarEntry | undefined): entry is any {
  return Boolean(entry && entry.isHeader);
}

function getCategoryKey(category: SidebarCategory | null): string {
  if (!category) return "all";
  return category.id?.toString() || "all";
}

type TuiStateController = {
  terminalHeight: number;
  terminalWidth: number;
  view: View;
  groupingMode: GroupingMode;
  categories: SidebarEntry[];
  items: Item[];
  selectedItem: Item | null;
  selectedCategory: SidebarCategory | null;
  activeIndex: number;
  scrollOffset: number;
  loading: boolean;
  contentHeight: number;
  listVisibleHeight: number;
  setView: (nextView: View) => void;
  handleMarkAllRead: () => void;
  moveListSelection: (delta: -1 | 1) => void;
  handleBackNavigation: () => void;
  handleForwardNavigation: () => void;
  handleReload: () => void;
};

function useTuiState(stdout: NodeJS.WriteStream): TuiStateController {
  const [state, dispatch] = useReducer(navigationReducer, {
    terminalHeight: stdout.rows || 24,
    terminalWidth: stdout.columns || 80,
    view: "start",
    groupingMode: "feed-categories",
    categories: [],
    items: [],
    selectedItem: null,
    selectedCategory: null,
    activeIndex: 0,
    sidebarIndices: {},
    itemIndices: {},
    loading: false,
    scrollOffset: 0,
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
    sidebarIndices,
    itemIndices,
    loading,
    scrollOffset,
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
    currentCats: SidebarEntry[]
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
          if (isSidebarHeader(entry)) return entry;
          const cat = entry as SidebarCategory;
          if (cat.id === -1)
            return { ...cat, unreadCount: totalUnread };
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
      let result: SidebarEntry[] = [{ id: -1, title: "All", isHeader: false }];
      if (mode === "feed-categories") {
        const cats = await ds.getFeedCategories();
        const others: SidebarCategory[] = cats
          .filter((c) => c.title.toLowerCase() !== "uncategorized")
          .map((c) => ({ id: c.id!, title: c.title, isHeader: false as const }))
          .sort((a, b) => Number(a.id) - Number(b.id));
        const uncategorized: SidebarCategory[] = cats
          .filter((c) => c.title.toLowerCase() === "uncategorized")
          .map((c) => ({ id: c.id!, title: c.title, isHeader: false as const }));
        result = [...result, ...others, ...uncategorized];
      } else {
        const cats = await ds.getItemCategories();
        const sortedRanges = [...ITEM_CATEGORY_RANGES].sort((a, b) =>
          a.title.localeCompare(b.title)
        );

        for (const range of sortedRanges) {
          const children: SidebarCategory[] = cats
            .filter(
              (c) => Number(c.id) >= range.min && Number(c.id) <= range.max
            )
            .map((c) => ({ id: c.id!, title: c.title, isHeader: false as const }))
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

        const uncategorized: SidebarCategory[] = cats
          .filter((c) => c.title.toLowerCase() === "uncategorized")
          .map((c) => ({ id: c.id!, title: c.title, isHeader: false as const }));
        if (uncategorized.length > 0) {
          result.push({ id: "0", title: "Uncategorized", isHeader: true });
          result.push(...uncategorized);
        }
      }
      dispatch({ type: "setCategories", categories: result });
      await refreshReadStats(mode, result);

      const savedIdx = sidebarIndices[mode] || 0;
      dispatch({
        type: "setActiveIndex",
        activeIndex: Math.min(savedIdx, result.length - 1),
      });
      dispatch({ type: "setScrollOffset", scrollOffset: 0 });
      dispatch({ type: "setView", view: "sidebar" });
    } finally {
      dispatch({ type: "setLoading", loading: false });
    }
  };

  const handleSelectCategory = async (category: SidebarEntry | undefined) => {
    if (!category || isSidebarHeader(category)) return;
    const cat = category as SidebarCategory;
    dispatch({ type: "setSelectedCategory", selectedCategory: cat });
    dispatch({ type: "setLoading", loading: true });
    try {
      const params: {
        size: number;
        unreadOnly: boolean;
        bookmarkedOnly: boolean;
        selectedFeedCategory?: FeedCategory;
        selectedItemCategoryIds?: number[];
      } = { size: 100, unreadOnly: false, bookmarkedOnly: false };
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

  const handleMarkAllRead = async () => {
    if (!selectedCategory) return;
    dispatch({ type: "setLoading", loading: true });
    try {
      const params =
        groupingMode === "feed-categories"
          ? { feedCategory: { id: Number(selectedCategory.id), title: selectedCategory.title } as FeedCategory }
          : { itemCategories: [{ id: Number(selectedCategory.id), title: selectedCategory.title } as ItemCategory] };
      await ds.markItemsRead(params);
      const refreshedItems = await ds.getItems({
        size: 100,
        unreadOnly: false,
        bookmarkedOnly: false,
        selectedFeedCategory:
          groupingMode === "feed-categories" ? ({ id: Number(selectedCategory.id), title: selectedCategory.title } as FeedCategory) : undefined,
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

  const moveListSelection = (delta: -1 | 1) => {
    if (view === "reader") {
      const nextOffset =
        delta < 0 ? Math.max(0, scrollOffset - 1) : scrollOffset + 1;
      dispatch({ type: "setScrollOffset", scrollOffset: nextOffset });
      return;
    }

    const listLength =
      view === "start"
        ? MODE_ITEMS.length
        : view === "sidebar"
          ? categories.length
          : items.length;
    let next = activeIndex + delta;

    if (view === "sidebar") {
      while (
        next >= 0 &&
        next < listLength &&
        isSidebarHeader(categories[next])
      ) {
        next += delta;
      }
    }

    if (next < 0 || next >= listLength) {
      return;
    }

    dispatch({ type: "setActiveIndex", activeIndex: next });

    if (view === "sidebar") {
      dispatch({ type: "setSidebarIndex", key: groupingMode, index: next });
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
      dispatch({ type: "setView", view: "sidebar" });
      dispatch({ type: "setScrollOffset", scrollOffset: 0 });
      dispatch({
        type: "setActiveIndex",
        activeIndex: sidebarIndices[groupingMode] || 0,
      });
      return;
    }

    if (view === "sidebar") {
      dispatch({ type: "setView", view: "start" });
      dispatch({ type: "setScrollOffset", scrollOffset: 0 });
      dispatch({ type: "setActiveIndex", activeIndex: 0 });
    }
  };

  const handleForwardNavigation = () => {
    if (view === "start") {
      handleSelectMode(MODE_ITEMS[activeIndex].value as GroupingMode);
      return;
    }

    if (view === "sidebar") {
      handleSelectCategory(categories[activeIndex]);
      return;
    }

    if (view === "items") {
      handleSelectItem(items[activeIndex]);
    }
  };

  const handleReload = () => {
    if (view === "sidebar") {
      handleSelectMode(groupingMode);
      return;
    }

    if (view === "items") {
      handleSelectCategory(selectedCategory || undefined);
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
    setView,
    handleMarkAllRead,
    moveListSelection,
    handleBackNavigation,
    handleForwardNavigation,
    handleReload,
  };
}

function useTuiInput(
  exit: () => void,
  {
    view,
    setView,
    handleMarkAllRead,
    moveListSelection,
    handleBackNavigation,
    handleForwardNavigation,
    handleReload,
  }: Pick<
    TuiStateController,
    | "view"
    | "setView"
    | "handleMarkAllRead"
    | "moveListSelection"
    | "handleBackNavigation"
    | "handleForwardNavigation"
    | "handleReload"
  >
) {
  useInput((input, key) => {
    if (key.escape) {
      setView("confirm-exit");
      return;
    }
    if (view === "confirm-exit") {
      if (input === "y" || key.return) exit();
      if (input === "n" || input === "a" || key.leftArrow) {
        setView("start");
      }
      return;
    }
    if (view === "confirm-mark-read") {
      if (input === "y") handleMarkAllRead();
      if (input === "n" || input === "a" || key.leftArrow) {
        setView("items");
      }
      return;
    }

    const isUp = input === "w" || key.upArrow;
    const isDown = input === "s" || key.downArrow;
    const isBack = input === "a" || key.leftArrow;
    const isForward = input === "d" || key.rightArrow || key.return;
    const isReload = input === "r";
    const isMarkReadConfirm = view === "items" && input === "q";

    if (isUp) {
      moveListSelection(-1);
      return;
    }

    if (isDown) {
      moveListSelection(1);
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

  useTuiInput(exit, {
    view: state.view,
    setView: state.setView,
    handleMarkAllRead: state.handleMarkAllRead,
    moveListSelection: state.moveListSelection,
    handleBackNavigation: state.handleBackNavigation,
    handleForwardNavigation: state.handleForwardNavigation,
    handleReload: state.handleReload,
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
  };

  return result;
}
