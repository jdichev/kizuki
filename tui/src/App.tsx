import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import SelectInput from "ink-select-input";
import DataService from "./api/DataService.js";
import { Feed, FeedCategory, Item, ItemCategory } from "./types/index.js";
import { decode } from "entities";
import stringWidth from "string-width";

const ds = DataService.getInstance();

type View =
  | "start"
  | "sidebar"
  | "items"
  | "reader"
  | "confirm-mark-read"
  | "confirm-exit";
type GroupingMode = "feed-categories" | "item-categories";

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 80);
  const [view, setView] = useState<View>("start");
  const [groupingMode, setGroupingMode] =
    useState<GroupingMode>("feed-categories");
  const [categories, setCategories] = useState<(FeedCategory | ItemCategory)[]>(
    []
  );
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<
    FeedCategory | ItemCategory | null
  >(null);
  const [modeIndex, setModeIndex] = useState(0);
  const [sidebarIndices, setSidebarIndices] = useState<Record<string, number>>(
    {}
  );
  const [itemIndices, setItemIndices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  const modeItems = [
    { label: "Feed Categories", value: "feed-categories" },
    { label: "Item Categories (AI)", value: "item-categories" },
  ];

  const sidebarItems = categories.map((c: any) => ({
    label: c.title,
    value: c.id?.toString() || "",
  }));

  const articleItems = items.map((i: Item) => {
    const dateStr = new Date(
      i.published > 10000000000
        ? (i.published as number)
        : (i.published as number) * 1000
    ).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const labelData = JSON.stringify({
      title: decode(i.title),
      feed: i.feedTitle || "",
      date: dateStr,
      read: i.read === 1,
      words: i.latestContentWordCount || 0,
    });

    return {
      label: labelData,
      value: i.id?.toString() || "",
    };
  });

  // Update terminal dimensions on resize
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

  const handleSelectMode = async (item: { value: string }) => {
    const mode = item.value as GroupingMode;
    setGroupingMode(mode);
    setLoading(true);
    try {
      let cats: (FeedCategory | ItemCategory)[] = [];
      if (mode === "feed-categories") {
        cats = await ds.getFeedCategories();
      } else {
        cats = await ds.getItemCategories();
      }

      // 1. Virtual 'All' category at the start
      const allVirtual = { id: -1, title: "All" };

      // 2. Filter out 'Uncategorized' to move it to the end
      const others = cats.filter(
        (c) => c.title.toLowerCase() !== "uncategorized"
      );
      const uncategorized = cats.filter(
        (c) => c.title.toLowerCase() === "uncategorized"
      );

      setCategories([allVirtual, ...others, ...uncategorized]);
      setView("sidebar");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = async (item: { value: string }) => {
    const categoryId = parseInt(item.value);
    const category = categories.find((c: any) => c.id === categoryId) || null;
    setSelectedCategory(category);
    setLoading(true);
    try {
      const params: any = {
        size: 100,
        unreadOnly: false,
        bookmarkedOnly: false,
      };

      // Handle virtual 'All' category (id: -1)
      if (categoryId !== -1) {
        if (groupingMode === "feed-categories") {
          params.selectedFeedCategory = category;
        } else {
          params.selectedItemCategoryIds = category ? [category.id] : undefined;
        }
      }

      const categoryItems = await ds.getItems(params);
      setItems(categoryItems);
    } finally {
      setLoading(false);
      setView("items");
    }
  };
  const handleSelectItem = async (item: { value: string }) => {
    const itemId = parseInt(item.value);
    setLoading(true);
    try {
      const fullItem = await ds.getItem(itemId);
      if (fullItem) {
        setSelectedItem(fullItem);
        setView("reader");
        setScrollOffset(0);
        ds.markItemRead(fullItem);
        setItems((prevItems) =>
          prevItems.map((i) => (i.id === itemId ? { ...i, read: 1 } : i))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const params: any = {};
      if (groupingMode === "feed-categories") {
        params.feedCategory = selectedCategory;
      } else {
        params.itemCategories = [selectedCategory];
      }
      await ds.markItemsRead(params);
      const refreshedItems = await ds.getItems({
        size: 100,
        unreadOnly: false,
        bookmarkedOnly: false,
        selectedFeedCategory:
          groupingMode === "feed-categories"
            ? (selectedCategory as FeedCategory)
            : undefined,
        selectedItemCategoryIds:
          groupingMode === "item-categories"
            ? [selectedCategory.id!]
            : undefined,
      });
      setItems(refreshedItems);
    } finally {
      setLoading(false);
      setView("items");
    }
  };

  // Keyboard navigation
  useInput((input: string, key: any) => {
    if (key.escape) {
      setView("confirm-exit");
      return;
    }

    if (view === "confirm-exit") {
      if (input === "y" || key.return) exit();
      if (input === "n" || input === "a" || key.leftArrow) setView("start");
      return;
    }

    // WASD Support: Map W to Up, S to Down, A to Back, D to Select
    if (input === "a" || key.leftArrow) {
      if (view === "reader") {
        setView("items");
        setScrollOffset(0);
      } else if (view === "items") setView("sidebar");
      else if (view === "sidebar") setView("start");
      else if (view === "confirm-mark-read") setView("items");
    }

    if (input === "d" || key.rightArrow) {
      if (view === "start") handleSelectMode(modeItems[modeIndex]);
      else if (view === "sidebar" && sidebarItems.length > 0)
        handleSelectCategory(sidebarItems[sidebarIndices[groupingMode] || 0]);
      else if (view === "items" && articleItems.length > 0) {
        const catKey = selectedCategory?.id?.toString() || "all";
        handleSelectItem(articleItems[itemIndices[catKey] || 0]);
      }
    }

    // Manual Scroll for Reader (WASD)
    if (view === "reader") {
      if (input === "w" || key.upArrow)
        setScrollOffset(Math.max(0, scrollOffset - 1));
      if (input === "s" || key.downArrow) setScrollOffset(scrollOffset + 1);
    }

    if (view === "items" && input === "q") {
      setView("confirm-mark-read");
    }

    if (view === "confirm-mark-read") {
      if (input === "y") handleMarkAllRead();
      if (input === "n") setView("items");
    }
  });

  const contentHeight = terminalHeight - 4;
  const dialogWidth = Math.max(40, Math.floor(terminalWidth * 0.5));
  const dialogHeight = Math.max(8, Math.floor(contentHeight * 0.5));

  const renderBreadcrumbs = () => {
    const parts: string[] = ["KIZUKI"];

    if (view !== "start") {
      const modeLabel =
        groupingMode === "feed-categories" ? "FEEDS" : "AI CATEGORIES";
      parts.push(modeLabel);
    }

    if (
      selectedCategory &&
      (view === "items" || view === "reader" || view === "confirm-mark-read")
    ) {
      parts.push((selectedCategory as any).title.toUpperCase());
    }

    if (selectedItem && view === "reader") {
      parts.push(
        `${selectedItem.title.substring(0, 30).toUpperCase()}${selectedItem.title.length > 30 ? "..." : ""}`
      );
    }

    return parts.join(" › ");
  };

  const renderReader = () => {
    if (!selectedItem) return null;

    const timestamp =
      selectedItem.published && selectedItem.published > 10000000000
        ? (selectedItem.published as number)
        : (selectedItem.published as number) * 1000;

    const dateStr = new Date(timestamp).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const wrapWidth = Math.min(80, terminalWidth - 6);
    const content = cleanContent(selectedItem.content || "");
    const lines = wordWrap(content, wrapWidth);
    const visibleLines = lines.slice(
      scrollOffset,
      scrollOffset + contentHeight - 2
    );

    return (
      <Box flexDirection="column" width="100%">
        <Text color="yellow" bold>
          {decode(selectedItem.title)}
        </Text>
        <Box>
          <Text dimColor>
            {selectedItem.feedTitle} │ {dateStr}
          </Text>
        </Box>
        <Box
          marginTop={1}
          height={contentHeight - 2}
          width={wrapWidth}
        >
          <Text>{visibleLines.join("\n")}</Text>
        </Box>
        <Text dimColor>
          Line {scrollOffset + 1} to{" "}
          {Math.min(scrollOffset + contentHeight - 2, lines.length)} of{" "}
          {lines.length} (WASD to scroll)
        </Text>
      </Box>
    );
  };

  const renderSectionHeader = (title: string) => (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        {title}
      </Text>
      <Text color="cyan">{"─".repeat(Math.max(1, terminalWidth - 2))}</Text>
    </Box>
  );

  const TableItem = ({
    label,
    isSelected,
  }: {
    label: string;
    isSelected?: boolean;
  }) => {
    try {
      const data = JSON.parse(label);
      const readMarker = data.read ? " " : "*";

      const feedWidth = Math.floor(terminalWidth * 0.2);
      const dateWidth = 12;
      const wordsWidth = 8;
      const titleWidth =
        terminalWidth - feedWidth - dateWidth - wordsWidth - 11;

      const bgColor = isSelected ? "white" : undefined;
      const fgColor = isSelected ? "black" : undefined;

      const rowText = `${readMarker} ${visualTruncate(data.title, titleWidth - 2)} │ ${visualTruncate(data.feed, feedWidth - 2)} │ ${visualTruncate(`${data.words}w`, wordsWidth - 1)} │ ${data.date}`;

      return (
        <Box flexDirection="row" width={terminalWidth - 4}>
          <Text backgroundColor={bgColor} color={fgColor}>
            {rowText.padEnd(terminalWidth - 4)}
          </Text>
        </Box>
      );
    } catch {
      return <Text>{label}</Text>;
    }
  };

  return (
    <Box flexDirection="column" height={terminalHeight} paddingX={1}>
      <Box height={1} width="100%">
        <Text backgroundColor="green" color="white">
          {visualTruncate(
            ` ${renderBreadcrumbs()}`,
            Math.max(1, terminalWidth - 2)
          )}
        </Text>
      </Box>

      <Box flexGrow={1} marginTop={1} minHeight={contentHeight - 2}>
        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <>
            {view === "start" && (
              <Box flexDirection="column">
                {renderSectionHeader("Choose Browsing Mode")}
                <SelectInput
                  isFocused={true}
                  items={modeItems}
                  onSelect={handleSelectMode}
                  initialIndex={modeIndex}
                  onHighlight={(item) => {
                    const idx = modeItems.findIndex(
                      (i) => i.value === item.value
                    );
                    if (idx !== -1) setModeIndex(idx);
                  }}
                />
              </Box>
            )}

            {view === "sidebar" && (
              <Box flexDirection="column">
                {renderSectionHeader(
                  groupingMode === "feed-categories"
                    ? "Feed Categories"
                    : "Item Categories"
                )}
                <SelectInput
                  isFocused={true}
                  items={sidebarItems}
                  onSelect={handleSelectCategory}
                  initialIndex={sidebarIndices[groupingMode] || 0}
                  onHighlight={(item) => {
                    const idx = sidebarItems.findIndex(
                      (i) => i.value === item.value
                    );
                    if (idx !== -1) {
                      setSidebarIndices((prev) => ({
                        ...prev,
                        [groupingMode]: idx,
                      }));
                    }
                  }}
                />
              </Box>
            )}

            {view === "items" && (
              <Box flexDirection="column">
                {renderSectionHeader(
                  `Articles: ${selectedCategory?.title || "All"}`
                )}
                {items.length === 0 ? (
                  <Text>No items found.</Text>
                ) : (
                  <SelectInput
                    isFocused={true}
                    items={articleItems}
                    onSelect={handleSelectItem}
                    limit={contentHeight - 2}
                    initialIndex={
                      itemIndices[selectedCategory?.id?.toString() || "all"] ||
                      0
                    }
                    itemComponent={TableItem}
                    onHighlight={(item) => {
                      const idx = articleItems.findIndex(
                        (i) => i.value === item.value
                      );
                      if (idx !== -1) {
                        const catKey =
                          selectedCategory?.id?.toString() || "all";
                        setItemIndices((prev) => ({ ...prev, [catKey]: idx }));
                      }
                    }}
                  />
                )}
              </Box>
            )}

            {view === "reader" && renderReader()}

            {view === "confirm-mark-read" && (
              <Box
                flexGrow={1}
                width="100%"
                justifyContent="center"
                alignItems="center"
              >
                <Box
                  flexDirection="column"
                  borderStyle="double"
                  borderColor="red"
                  padding={1}
                  alignItems="center"
                  justifyContent="center"
                  width={dialogWidth}
                  minHeight={dialogHeight}
                >
                  <Text bold color="red">
                    Mark all articles in "{selectedCategory?.title}" as read?
                  </Text>
                  <Box marginTop={1}>
                    <Text>[Y]es / [N]o</Text>
                  </Box>
                </Box>
              </Box>
            )}

            {view === "confirm-exit" && (
              <Box
                flexGrow={1}
                width="100%"
                justifyContent="center"
                alignItems="center"
              >
                <Box
                  flexDirection="column"
                  borderStyle="double"
                  borderColor="yellow"
                  padding={1}
                  alignItems="center"
                  justifyContent="center"
                  width={dialogWidth}
                  minHeight={dialogHeight}
                >
                  <Text bold color="yellow">
                    Exit Kizuki?
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
          {`WASD/Arrows: Navigate | Q: Mark Read | Esc: Exit `.padEnd(
            terminalWidth - 7
          )}
        </Text>
      </Box>
    </Box>
  );
}

function visualTruncate(str: string, width: number): string {
  const currentWidth = stringWidth(str);
  if (currentWidth <= width) {
    return str + " ".repeat(width - currentWidth);
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const segments = segmenter.segment(str.replace(/\s+/g, " ").trim());

  let result = "";
  let w = 0;

  for (const { segment } of segments) {
    const charWidth = stringWidth(segment);
    if (w + charWidth > width) {
      break;
    }
    result += segment;
    w += charWidth;
  }

  return result + " ".repeat(Math.max(0, width - w));
}

function cleanContent(html: string | undefined): string {
  if (!html) return "No content available.";
  return decode(html.replace(/<[^>]*>?/gm, ""))
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .join("\n\n");
}

function wordWrap(text: string, width: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = "";
    const words = paragraph.split(" ");

    for (const word of words) {
      if ((currentLine + word).length > width) {
        if (currentLine.length > 0) lines.push(currentLine.trim());
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    }
    if (currentLine.length > 0) lines.push(currentLine.trim());
  }
  return lines;
}
