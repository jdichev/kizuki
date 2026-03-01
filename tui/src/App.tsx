import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import SelectInput from "ink-select-input";
import DataService from "./api/DataService.js";
import { Feed, FeedCategory, Item, ItemCategory } from "./types/index.js";
import { decode } from "entities";
import stringWidth from "string-width";

const ds = DataService.getInstance();

type View = "start" | "sidebar" | "items" | "reader" | "confirm-mark-read" | "confirm-exit";
type GroupingMode = "feed-categories" | "item-categories";

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 80);
  const [view, setView] = useState<View>("start");
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("feed-categories");
  const [categories, setCategories] = useState<(FeedCategory | ItemCategory)[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FeedCategory | ItemCategory | null>(null);
  const [modeIndex, setModeIndex] = useState(0);
  const [sidebarIndex, setSidebarIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  const modeItems = [
    { label: "Feed Categories", value: "feed-categories" },
    { label: "Item Categories (AI)", value: "item-categories" }
  ];

  const sidebarItems = categories.map((c: any) => ({
    label: c.title,
    value: c.id?.toString() || ""
  }));

  const articleItems = items.map((i: Item) => {
    const readMarker = i.read ? " " : "*";
    const dateStr = new Date(
      i.published > 10000000000 ? (i.published as number) : (i.published as number) * 1000
    ).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const feedWidth = Math.floor(terminalWidth * 0.2);
    const dateWidth = 10;
    const titleWidth = terminalWidth - feedWidth - dateWidth - 12;

    const title = visualTruncate(readMarker + " " + i.title, titleWidth);
    const feed = visualTruncate(i.feedTitle || "", feedWidth);
    const date = visualTruncate(dateStr, dateWidth);

    return {
      label: `${title} │ ${feed} │ ${date}`,
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
      if (mode === "feed-categories") {
        const cats = await ds.getFeedCategories();
        setCategories(cats);
      } else {
        const cats = await ds.getItemCategories();
        setCategories(cats);
      }
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
        
        if (groupingMode === "feed-categories") {
            params.selectedFeedCategory = category;
        } else {
            params.selectedItemCategoryIds = category ? [category.id] : undefined;
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
        // Mark as read in background
        ds.markItemRead(fullItem);
        // Update local state so it's reflected when going back
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
          // Refresh list
          const refreshedItems = await ds.getItems({
              size: 100,
              unreadOnly: false,
              bookmarkedOnly: false,
              selectedFeedCategory: groupingMode === "feed-categories" ? selectedCategory as FeedCategory : undefined,
              selectedItemCategoryIds: groupingMode === "item-categories" ? [selectedCategory.id!] : undefined
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

    if (input === "a" || key.leftArrow) {
      if (view === "reader") {
          setView("items");
          setScrollOffset(0);
      }
      else if (view === "items") setView("sidebar");
      else if (view === "sidebar") setView("start");
      else if (view === "confirm-mark-read") setView("items");
    }

    if (input === "d" || key.rightArrow) {
        if (view === "start") handleSelectMode(modeItems[modeIndex]);
        else if (view === "sidebar") handleSelectCategory(sidebarItems[sidebarIndex]);
        else if (view === "items") handleSelectItem(articleItems[itemIndex]);
    }

    if (input === "w" || key.upArrow) {
      if (view === "reader") {
        setScrollOffset(Math.max(0, scrollOffset - 1));
      } else if (view === "start") {
        setModeIndex((prev) => Math.max(0, prev - 1));
      } else if (view === "sidebar") {
        setSidebarIndex((prev) => Math.max(0, prev - 1));
      } else if (view === "items") {
        setItemIndex((prev) => Math.max(0, prev - 1));
      }
    }

    if (input === "s" || key.downArrow) {
      if (view === "reader") {
        setScrollOffset((prev) => prev + 1);
      } else if (view === "start") {
        setModeIndex((prev) => Math.min(modeItems.length - 1, prev + 1));
      } else if (view === "sidebar") {
        setSidebarIndex((prev) => Math.min(sidebarItems.length - 1, prev + 1));
      } else if (view === "items") {
        setItemIndex((prev) => Math.min(articleItems.length - 1, prev + 1));
      }
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

  const renderBreadcrumbs = () => {
    const parts = [];
    parts.push(
      <Text key="root" bold color="white">
        KIZUKI
      </Text>
    );

    if (view !== "start") {
      const modeLabel =
        groupingMode === "feed-categories" ? "FEEDS" : "AI CATEGORIES";
      parts.push(<Text key="sep1"> › </Text>);
      parts.push(
        <Text key="mode" bold color="white">
          {modeLabel}
        </Text>
      );
    }

    if (
      selectedCategory &&
      (view === "items" || view === "reader" || view === "confirm-mark-read")
    ) {
      parts.push(<Text key="sep2"> › </Text>);
      parts.push(
        <Text key="cat" bold color="white">
          {(selectedCategory as any).title.toUpperCase()}
        </Text>
      );
    }

    if (selectedItem && view === "reader") {
      parts.push(<Text key="sep3"> › </Text>);
      parts.push(
        <Text key="item" bold color="white">
          {selectedItem.title.substring(0, 30).toUpperCase()}
          {selectedItem.title.length > 30 ? "..." : ""}
        </Text>
      );
    }

    return parts;
  };

  const renderReader = () => {
    if (!selectedItem) return null;
    
    const wrapWidth = Math.min(80, terminalWidth - 6);
    const content = cleanContent(selectedItem.content || "");
    const lines = wordWrap(content, wrapWidth);
    const visibleLines = lines.slice(scrollOffset, scrollOffset + contentHeight);

    return (
      <Box flexDirection="column" width="100%">
        <Text color="yellow" bold>{selectedItem.title}</Text>
        <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1} height={contentHeight} width={wrapWidth + 4}>
            <Text>{visibleLines.join("\n")}</Text>
        </Box>
        <Text dimColor>
            Line {scrollOffset + 1} to {Math.min(scrollOffset + contentHeight, lines.length)} of {lines.length} (WASD to scroll)
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" height={terminalHeight} paddingX={1}>
      <Box height={1} width="100%">
        <Text backgroundColor="green" color="white">
          {" "}
          {renderBreadcrumbs()}
          {" ".repeat(terminalWidth)}
        </Text>
      </Box>

      <Box flexGrow={1} marginTop={1} minHeight={contentHeight - 2}>

        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <>
            {view === "start" && (
              <Box flexDirection="column">
                <Text color="cyan" bold underline>Choose Browsing Mode</Text>
                <SelectInput 
                    isFocused={false}
                    key={`mode-${modeIndex}`}
                    items={modeItems} 
                    onSelect={handleSelectMode} 
                    initialIndex={modeIndex}
                    onHighlight={(item) => {
                        const idx = modeItems.findIndex(i => i.value === item.value);
                        if (idx !== -1) setModeIndex(idx);
                    }}
                />
              </Box>
            )}

            {view === "sidebar" && (
              <Box flexDirection="column">
                <Text color="cyan" bold underline>{groupingMode === "feed-categories" ? "Feed Categories" : "Item Categories"}</Text>
                <SelectInput 
                  isFocused={false}
                  key={`sidebar-${sidebarIndex}`}
                  items={sidebarItems} 
                  onSelect={handleSelectCategory} 
                  initialIndex={sidebarIndex}
                  onHighlight={(item) => {
                    const idx = sidebarItems.findIndex(i => i.value === item.value);
                    if (idx !== -1) setSidebarIndex(idx);
                  }}
                />
              </Box>
            )}

            {view === "items" && (
              <Box flexDirection="column">
                <Text color="cyan" bold underline>
                  Articles: {selectedCategory?.title || "All"}
                </Text>
                {items.length === 0 ? (
                  <Text>No items found.</Text>
                ) : (
                  <SelectInput 
                    isFocused={false}
                    key={`items-${itemIndex}`}
                    items={articleItems} 
                    onSelect={handleSelectItem} 
                    limit={contentHeight - 2}
                    initialIndex={itemIndex}
                    onHighlight={(item) => {
                      const idx = articleItems.findIndex(i => i.value === item.value);
                      if (idx !== -1) setItemIndex(idx);
                    }}
                  />
                )}
              </Box>
            )}

            {view === "reader" && renderReader()}

            {view === "confirm-mark-read" && (
                <Box flexDirection="column" borderStyle="double" borderColor="red" padding={1} alignItems="center">
                    <Text bold color="red">Mark all articles in "{selectedCategory?.title}" as read?</Text>
                    <Box marginTop={1}>
                        <Text>[Y]es / [N]o</Text>
                    </Box>
                </Box>
            )}

            {view === "confirm-exit" && (
                <Box flexDirection="column" borderStyle="double" borderColor="yellow" padding={1} alignItems="center">
                    <Text bold color="yellow">Exit Kizuki?</Text>
                    <Box marginTop={1}>
                        <Text bold>[Y]es</Text>
                        <Text> / [N]o</Text>
                    </Box>
                </Box>
            )}
          </>
        )}
      </Box>
      
      <Box height={1} width="100%">
        <Text backgroundColor="blue" color="white">
          <Text bold> keys: </Text>
          {`WASD/Arrows: Navigate | Q: Mark Read | Esc: Exit `.padEnd(terminalWidth - 7)}
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

  let result = "";
  let w = 0;
  for (const char of str) {
    const charWidth = stringWidth(char);
    if (w + charWidth > width - 1) {
      // Leave space for ellipsis or just cut
      break;
    }
    result += char;
    w += charWidth;
  }
  return result + " ".repeat(width - w);
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
