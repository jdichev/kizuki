import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import SelectInput from "ink-select-input";
import DataService from "./api/DataService.js";
import { Feed, FeedCategory, Item, ItemCategory } from "./types/index.js";
import { decode } from "entities";

const ds = DataService.getInstance();

type View = "start" | "sidebar" | "items" | "reader" | "confirm-mark-read";
type GroupingMode = "feed-categories" | "item-categories";

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
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

  const articleItems = items.map((i: Item) => ({
    label: `${i.read ? " " : "*"} ${i.title}`,
    value: i.id?.toString() || ""
  }));

  // Update terminal height on resize
  useEffect(() => {
    const onResize = () => setTerminalHeight(stdout.rows);
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
        ds.markItemRead(fullItem);
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
    if (key.escape) exit();

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

  const contentHeight = terminalHeight - 8;

  const renderBreadcrumbs = () => {
    const parts = [<Text key="root">Forest</Text>];

    if (view !== "start") {
      const modeLabel = groupingMode === "feed-categories" ? "Feeds" : "AI Categories";
      parts.push(<Text key="sep1"> › </Text>);
      parts.push(<Text key="mode" color="cyan">{modeLabel}</Text>);
    }

    if (selectedCategory && (view === "items" || view === "reader" || view === "confirm-mark-read")) {
      parts.push(<Text key="sep2"> › </Text>);
      parts.push(<Text key="cat" color="cyan">{(selectedCategory as any).title}</Text>);
    }

    if (selectedItem && view === "reader") {
      parts.push(<Text key="sep3"> › </Text>);
      parts.push(
        <Text key="item" color="yellow" bold>
          {selectedItem.title.substring(0, 30)}
          {selectedItem.title.length > 30 ? "..." : ""}
        </Text>
      );
    }

    return (
      <Box paddingX={1} marginBottom={1}>
        {parts}
      </Box>
    );
  };

  const renderReader = () => {
    if (!selectedItem) return null;
    const lines = cleanContent(selectedItem.content || "").split("\n");
    const visibleLines = lines.slice(scrollOffset, scrollOffset + contentHeight);

    return (
      <Box flexDirection="column" width="100%">
        <Text color="yellow" bold>{selectedItem.title}</Text>
        <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1} height={contentHeight} width="100%">
            <Text>{visibleLines.join("\n")}</Text>
        </Box>
        <Text dimColor>
            Line {scrollOffset + 1} to {Math.min(scrollOffset + contentHeight, lines.length)} of {lines.length} (Arrows to scroll)
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" height={terminalHeight} paddingX={1}>
      <Box borderStyle="round" borderColor="green" paddingX={1} height={3}>
        <Text bold color="green">Forest TUI</Text>
        <Box marginLeft={2}>
            <Text dimColor> | {view.toUpperCase()} | 'esc' to exit</Text>
        </Box>
      </Box>

      {renderBreadcrumbs()}

      <Box flexGrow={1} marginTop={0} minHeight={contentHeight - 2}>
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
          </>
        )}
      </Box>
      
      <Box borderStyle="single" borderColor="gray" height={3} paddingX={1}>
        <Text dimColor>A/Left: Back | D/Right: Select | Q: Mark Read | Esc: Exit</Text>
      </Box>
    </Box>
  );
}

function cleanContent(html: string | undefined): string {
  if (!html) return "No content available.";
  return decode(html.replace(/<[^>]*>?/gm, ""))
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .join("\n\n");
}
