import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import DataService from "./api/DataService.js";
import { Feed, FeedCategory, Item, ItemCategory } from "./types/index.js";
import { decode } from "entities";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";

const ds = DataService.getInstance();

type View = "start" | "sidebar" | "items" | "reader" | "confirm-mark-read" | "confirm-exit";
type GroupingMode = "feed-categories" | "item-categories";

const ITEM_CATEGORY_RANGES = [
  { min: 100, max: 199, title: "AI & Data Science" },
  { min: 200, max: 299, title: "Software Engineering" },
  { min: 300, max: 499, title: "Infrastructure & Security" },
  { min: 500, max: 699, title: "Hardware & Consumer Tech" },
  { min: 1, max: 99, title: "General News & Lifestyle" },
];

export default function App() {
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

  const modeItems = useMemo(() => [
    { title: "Feed Categories", value: "feed-categories" },
    { title: "Item Categories (AI)", value: "item-categories" },
  ], []);

  const contentHeight = terminalHeight - 4;
  const listVisibleHeight = contentHeight - 2;

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
      stdout.write("\x1b[2J\x1b[0f");
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
            .filter((c) => {
              const cid = Number(c.id);
              return cid >= range.min && cid <= range.max;
            })
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

        const uncategorized = cats.filter(
          (c) => c.title.toLowerCase() === "uncategorized"
        );
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

    const list = view === "start" ? modeItems : view === "sidebar" ? categories : items;
    
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
        if (view === "start") handleSelectMode(modeItems[activeIndex].value as any);
        else if (view === "sidebar") handleSelectCategory(categories[activeIndex]);
        else if (view === "items") handleSelectItem(items[activeIndex]);
    }
    if (input === "r") {
        if (view === "sidebar") handleSelectMode(groupingMode);
        else if (view === "items") handleSelectCategory(selectedCategory);
    }
    if (view === "items" && input === "q") setView("confirm-mark-read");
  });

  const dialogWidth = Math.max(40, Math.floor(terminalWidth * 0.5));
  const dialogHeight = Math.max(8, Math.floor(contentHeight * 0.5));

  const renderReader = () => {
    if (!selectedItem) return null;
    const timestamp = selectedItem.published && selectedItem.published > 10000000000 ? (selectedItem.published as number) : (selectedItem.published as number) * 1000;
    const dateStr = new Date(timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    const wrapWidth = Math.min(80, terminalWidth - 6);
    const useMarkdown = !!selectedItem.latest_content;
    const content = cleanContent(selectedItem.latest_content || selectedItem.content || "", useMarkdown);
    const wrappedContent = wrapAnsi(content, wrapWidth, { hard: true });
    const lines = wrappedContent.split("\n");
    const visibleLines = lines.slice(scrollOffset, scrollOffset + contentHeight - 2);

    return (
      <Box flexDirection="column" width="100%">
        <Text color="yellow" bold>{decode(selectedItem.title)}</Text>
        <Box><Text dimColor>{selectedItem.feedTitle} │ {dateStr}</Text></Box>
        <Box marginTop={1} height={contentHeight - 2} width={wrapWidth}><Text>{visibleLines.join("\n")}</Text></Box>
        <Text dimColor>{`Line ${scrollOffset + 1} to ${Math.min(scrollOffset + contentHeight - 2, lines.length)} of ${lines.length} (WASD to scroll)`}</Text>
      </Box>
    );
  };

  const renderSectionHeader = (title: string) => (
    <Box flexDirection="column">
      <Text color="cyan" bold>{title}</Text>
      <Text color="cyan">{"─".repeat(Math.max(1, terminalWidth - 2))}</Text>
    </Box>
  );

  return (
    <Box flexDirection="column" height={terminalHeight} paddingX={1}>
      <Box height={1} width="100%">
        <Text backgroundColor="green" color="white">{visualTruncate(` ${renderBreadcrumbs()}`, terminalWidth - 2)}</Text>
      </Box>

      <Box flexGrow={1} marginTop={1} flexDirection="column">
        {loading ? <Text>Loading...</Text> : (
          <>
            {view === "start" && (
              <Box flexDirection="column">
                {renderSectionHeader("Choose Browsing Mode")}
                {modeItems.map((m, i) => (
                  <Text key={m.value} backgroundColor={i === activeIndex ? "white" : undefined} color={i === activeIndex ? "black" : undefined}>
                    {`${i === activeIndex ? "▶" : " "} ${m.title}`.padEnd(terminalWidth - 4)}
                  </Text>
                ))}
              </Box>
            )}

            {view === "sidebar" && (
              <Box flexDirection="column">
                {renderSectionHeader(
                  groupingMode === "feed-categories"
                    ? "Feed Categories"
                    : "Item Categories"
                )}
                {categories
                  .slice(scrollOffset, scrollOffset + listVisibleHeight)
                  .map((c, i) => {
                    const realIdx = i + scrollOffset;
                    const isSelected = realIdx === activeIndex;

                    if (c.isHeader) {
                      const rangeId = String(c.id).padStart(7);
                      return (
                        <Text key={`h-${realIdx}`} bold color="magenta">
                          {`  ${rangeId} │ ${c.title.toUpperCase()}`.padEnd(
                            terminalWidth - 4
                          )}
                        </Text>
                      );
                    }

                    const idStr = c.id === -1 ? "all" : String(c.id).padStart(7);
                    const row = `${isSelected ? "▶" : " "} ${idStr} │ ${c.title}`;
                    return (
                      <Text
                        key={realIdx}
                        backgroundColor={isSelected ? "white" : undefined}
                        color={isSelected ? "black" : undefined}
                      >
                        {row.padEnd(terminalWidth - 4)}
                      </Text>
                    );
                  })}
              </Box>
            )}

            {view === "items" && (
              <Box flexDirection="column">
                {renderSectionHeader(`Articles: ${selectedCategory?.title || "All"}`)}
                {items.length === 0 ? <Text>No items found.</Text> : (
                  items.slice(scrollOffset, scrollOffset + listVisibleHeight).map((item, i) => {
                    const realIdx = i + scrollOffset;
                    const isSelected = realIdx === activeIndex;
                    const timestamp = item.published > 10000000000 ? item.published : item.published * 1000;
                    const dateStr = new Date(timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
                    const timeStr = new Date(timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                    const feedWidth = Math.floor(terminalWidth * 0.2), dateWidth = 18, wordsWidth = 8, titleWidth = terminalWidth - feedWidth - dateWidth - wordsWidth - 12;
                    const row = `${item.read ? " " : "*"} ${visualTruncate(decode(item.title), titleWidth)} │ ${visualTruncate(item.feedTitle || "", feedWidth)} │ ${visualTruncate(`${item.latestContentWordCount || 0}w`, wordsWidth - 1)} │ ${dateStr} ${timeStr}`;
                    return (
                      <Text key={item.id} backgroundColor={isSelected ? "white" : undefined} color={isSelected ? "black" : undefined}>
                        {row.padEnd(terminalWidth - 4)}
                      </Text>
                    );
                  })
                )}
              </Box>
            )}

            {view === "reader" && renderReader()}

            {(view === "confirm-mark-read" || view === "confirm-exit") && (
              <Box flexGrow={1} justifyContent="center" alignItems="center">
                <Box
                  flexDirection="column"
                  borderStyle="double"
                  borderColor={view === "confirm-exit" ? "yellow" : "red"}
                  padding={1}
                  alignItems="center"
                  justifyContent="center"
                  width={dialogWidth}
                  minHeight={dialogHeight}
                >
                  <Text bold color={view === "confirm-exit" ? "yellow" : "red"}>
                    {view === "confirm-exit"
                      ? "Exit Kizuki?"
                      : `Mark all in "${selectedCategory?.title}" as read?`}
                  </Text>
                  <Box marginTop={1}>
                    <Text bold>[Y]es</Text>
                    <Text> / [N]o</Text>
                  </Box>
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>

      <Box height={1} width="100%">
        <Text backgroundColor="blue" color="white">
          <Text bold> keys: </Text>
          {`WASD/Arrows: Navigate | R: Reload | Q: Mark Read | Esc: Exit `.padEnd(terminalWidth - 7)}
        </Text>
      </Box>
    </Box>
  );

  function renderBreadcrumbs() {
    const parts = ["KIZUKI"];
    if (view !== "start") parts.push(groupingMode === "feed-categories" ? "FEEDS" : "AI CATEGORIES");
    if (selectedCategory && (view === "items" || view === "reader" || view === "confirm-mark-read")) parts.push(selectedCategory.title.toUpperCase());
    if (selectedItem && view === "reader") {
        const t = decode(selectedItem.title);
        parts.push(t.substring(0, 30).toUpperCase() + (t.length > 30 ? "..." : ""));
    }
    return parts.join(" › ");
  }
}

function visualTruncate(str: string, width: number): string {
  if (stringWidth(str) <= width) return str + " ".repeat(width - stringWidth(str));
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let result = "", w = 0;
  for (const { segment } of segmenter.segment(str.replace(/\s+/g, " ").trim())) {
    const sw = stringWidth(segment);
    if (w + sw > width) break;
    result += segment; w += sw;
  }
  return result + " ".repeat(Math.max(0, width - w));
}

function cleanContent(html: string | undefined, isMarkdown: boolean = false): string {
  if (!html) return "No content available.";
  if (isMarkdown) return html;
  return decode(html.replace(/<[^>]*>?/gm, "")).split("\n").map(l => l.trim()).filter(l => l.length > 0).join("\n\n");
}
