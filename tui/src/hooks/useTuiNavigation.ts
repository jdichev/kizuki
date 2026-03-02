import { useState, useEffect } from "react";
import { useInput, useApp, useStdout } from "ink";
import DataService from "../api/DataService.js";
import { Item, FeedCategory, ItemCategory } from "../types/index.js";
import { ITEM_CATEGORY_RANGES, MODE_ITEMS } from "../constants/config.js";

const ds = DataService.getInstance();

export type View = "start" | "sidebar" | "items" | "reader" | "confirm-mark-read" | "confirm-exit";
export type GroupingMode = "feed-categories" | "item-categories";

export function useTuiNavigation() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 80);
  
  const [view, setView] = useState<View>("start");
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("feed-categories");
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [sidebarIndices, setSidebarIndices] = useState<Record<string, number>>({});
  const [itemIndices, setItemIndices] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  const contentHeight = terminalHeight - 4;
  const listVisibleHeight = contentHeight - 2;

  // Auto-scroll logic
  useEffect(() => {
    if (view === "reader") return;
    if (activeIndex < scrollOffset) {
      setScrollOffset(activeIndex);
    } else if (activeIndex >= scrollOffset + listVisibleHeight) {
      setScrollOffset(activeIndex - listVisibleHeight + 1);
    }
  }, [activeIndex, scrollOffset, listVisibleHeight, view]);

  useEffect(() => {
    const onResize = () => {
      setTerminalHeight(stdout.rows);
      setTerminalWidth(stdout.columns);
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const handleSelectMode = async (mode: GroupingMode) => {
    setGroupingMode(mode);
    setLoading(true);
    try {
      let result: any[] = [{ id: -1, title: "All" }];
      if (mode === "feed-categories") {
        const cats = await ds.getFeedCategories();
        const others = cats
          .filter((c) => c.title.toLowerCase() !== "uncategorized")
          .sort((a, b) => Number(a.id) - Number(b.id));
        const uncategorized = cats.filter(
          (c) => c.title.toLowerCase() === "uncategorized"
        );
        result = [...result, ...others, ...uncategorized];
      } else {
        const cats = await ds.getItemCategories();
        const sortedRanges = [...ITEM_CATEGORY_RANGES].sort((a, b) =>
          a.title.localeCompare(b.title)
        );

        for (const range of sortedRanges) {
          const children = cats
            .filter((c) => Number(c.id) >= range.min && Number(c.id) <= range.max)
            .sort((a, b) => Number(a.id) - Number(b.id));

          if (children.length > 0) {
            result.push({ id: `${range.min}-${range.max}`, title: range.title, isHeader: true });
            result.push(...children);
          }
        }

        const uncategorized = cats.filter((c) => c.title.toLowerCase() === "uncategorized");
        if (uncategorized.length > 0) {
          result.push({ id: "0", title: "Uncategorized", isHeader: true });
          result.push(...uncategorized);
        }
      }
      setCategories(result);
      const savedIdx = sidebarIndices[mode] || 0;
      setActiveIndex(Math.min(savedIdx, result.length - 1));
      setScrollOffset(0);
      setView("sidebar");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = async (category: any) => {
    if (!category || category.isHeader) return;
    setSelectedCategory(category);
    setLoading(true);
    try {
      const params: any = { size: 100, unreadOnly: false, bookmarkedOnly: false };
      if (category.id !== -1) {
        if (groupingMode === "feed-categories") params.selectedFeedCategory = category;
        else params.selectedItemCategoryIds = [category.id];
      }
      const categoryItems = await ds.getItems(params);
      setItems(categoryItems);
      const catKey = category.id?.toString() || "all";
      setActiveIndex(itemIndices[catKey] || 0);
      setScrollOffset(0);
      setView("items");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (item: Item) => {
    if (!item) return;
    setLoading(true);
    try {
      const fullItem = await ds.getItem(item.id);
      if (fullItem) {
        setSelectedItem(fullItem);
        setView("reader");
        setScrollOffset(0);
        ds.markItemRead(fullItem);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, read: 1 } : i));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const params: any = groupingMode === "feed-categories" ? { feedCategory: selectedCategory } : { itemCategories: [selectedCategory] };
      await ds.markItemsRead(params);
      const refreshedItems = await ds.getItems({
        size: 100, unreadOnly: false, bookmarkedOnly: false,
        selectedFeedCategory: groupingMode === "feed-categories" ? selectedCategory : undefined,
        selectedItemCategoryIds: groupingMode === "item-categories" ? [selectedCategory.id!] : undefined
      });
      setItems(refreshedItems);
      setView("items");
    } finally {
      setLoading(false);
    }
  };

  useInput((input, key) => {
    if (key.escape) { setView("confirm-exit"); return; }
    if (view === "confirm-exit") {
        if (input === "y" || key.return) exit();
        if (input === "n" || input === "a" || key.leftArrow) setView("start");
        return;
    }
    if (view === "confirm-mark-read") {
        if (input === "y") handleMarkAllRead();
        if (input === "n" || input === "a" || key.leftArrow) setView("items");
        return;
    }

    const list = view === "start" ? MODE_ITEMS : view === "sidebar" ? categories : items;
    
    if (input === "w" || key.upArrow) {
        if (view === "reader") setScrollOffset(prev => Math.max(0, prev - 1));
        else {
            let next = activeIndex - 1;
            while (next >= 0 && list[next]?.isHeader) next--;
            if (next >= 0) {
                setActiveIndex(next);
                if (view === "sidebar") setSidebarIndices(p => ({ ...p, [groupingMode]: next }));
                if (view === "items") setItemIndices(p => ({ ...p, [selectedCategory.id?.toString() || "all"]: next }));
            }
        }
    }
    if (input === "s" || key.downArrow) {
        if (view === "reader") setScrollOffset(prev => prev + 1);
        else {
            let next = activeIndex + 1;
            while (next < list.length && list[next]?.isHeader) next++;
            if (next < list.length) {
                setActiveIndex(next);
                if (view === "sidebar") setSidebarIndices(p => ({ ...p, [groupingMode]: next }));
                if (view === "items") setItemIndices(p => ({ ...p, [selectedCategory.id?.toString() || "all"]: next }));
            }
        }
    }
    if (input === "a" || key.leftArrow) {
        if (view === "reader") { setView("items"); setScrollOffset(0); setActiveIndex(itemIndices[selectedCategory.id?.toString() || "all"] || 0); }
        else if (view === "items") { setView("sidebar"); setScrollOffset(0); setActiveIndex(sidebarIndices[groupingMode] || 0); }
        else if (view === "sidebar") { setView("start"); setScrollOffset(0); setActiveIndex(0); }
    }
    if (input === "d" || key.rightArrow || key.return) {
        if (view === "start") handleSelectMode(MODE_ITEMS[activeIndex].value as any);
        else if (view === "sidebar") handleSelectCategory(categories[activeIndex]);
        else if (view === "items") handleSelectItem(items[activeIndex]);
    }
    if (input === "r") {
        if (view === "sidebar") handleSelectMode(groupingMode);
        else if (view === "items") handleSelectCategory(selectedCategory);
    }
    if (view === "items" && input === "q") setView("confirm-mark-read");
  });

  return {
    terminalHeight, terminalWidth, view, groupingMode, categories, items,
    selectedItem, selectedCategory, activeIndex, scrollOffset, loading,
    contentHeight, listVisibleHeight
  };
}
