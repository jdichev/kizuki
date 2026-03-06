import React from "react";
import { Box, Text } from "ink";
import { useTuiNavigation } from "./hooks/useTuiNavigation.js";
import type { UseTuiNavigationResult } from "./types/index.js";
import { Header } from "./components/Header.js";
import { Footer } from "./components/Footer.js";
import { SectionHeader } from "./components/SectionHeader.js";
import { SidebarView } from "./components/SidebarView.js";
import { ItemsView } from "./components/ItemsView.js";
import { ReaderView } from "./components/ReaderView.js";
import { ConfirmationDialog } from "./components/ConfirmationDialog.js";
import { HelpDialog } from "./components/HelpDialog.js";
import { MODE_ITEMS } from "./constants/config.js";

export default function App() {
  const navigation: UseTuiNavigationResult = useTuiNavigation();
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
  } = navigation;

  const renderBreadcrumbs = () => {
    const parts = ["KIZUKI"];
    if (view !== "start" && view !== "help")
      parts.push(
        groupingMode === "feed-categories" ? "FEEDS" : "AI CATEGORIES"
      );
    if (
      selectedCategory &&
      (view === "items" || view === "reader" || view === "confirm-mark-read")
    )
      parts.push(selectedCategory.title.toUpperCase());
    if (selectedItem && view === "reader") {
      const t = selectedItem.title;
      parts.push(
        t.substring(0, 30).toUpperCase() + (t.length > 30 ? "..." : "")
      );
    }
    return parts.join(" › ");
  };

  return (
    <Box flexDirection="column" height={terminalHeight} paddingX={1}>
      <Header breadcrumbs={renderBreadcrumbs()} terminalWidth={terminalWidth} />

      <Box flexGrow={1} marginTop={1} flexDirection="column">
        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <>
            {view === "help" && (
              <HelpDialog
                width={Math.max(40, Math.floor(terminalWidth * 0.6))}
                height={Math.max(12, Math.floor(contentHeight * 0.6))}
                onClose={() => navigation.setView("start")}
              />
            )}

            {view === "start" && (
              <Box flexDirection="column">
                <SectionHeader
                  title="Choose Browsing Mode"
                  terminalWidth={terminalWidth}
                />
                {MODE_ITEMS.map((m, i) => (
                  <Text
                    key={m.value}
                    backgroundColor={i === activeIndex ? "white" : undefined}
                    color={i === activeIndex ? "black" : undefined}
                  >
                    {`${i === activeIndex ? "▶" : " "} ${m.title}`.padEnd(
                      terminalWidth - 4
                    )}
                  </Text>
                ))}
              </Box>
            )}

            {view === "sidebar" && (
              <SidebarView
                groupingMode={groupingMode}
                categories={categories}
                activeIndex={activeIndex}
                scrollOffset={scrollOffset}
                visibleHeight={listVisibleHeight}
                terminalWidth={terminalWidth}
              />
            )}

            {view === "items" && (
              <ItemsView
                title={selectedCategory?.title || "All"}
                items={items}
                activeIndex={activeIndex}
                scrollOffset={scrollOffset}
                visibleHeight={listVisibleHeight}
                terminalWidth={terminalWidth}
                unreadOnly={unreadOnly}
              />
            )}

            {view === "reader" && selectedItem && (
              <ReaderView
                item={selectedItem}
                scrollOffset={scrollOffset}
                contentHeight={contentHeight}
                terminalWidth={terminalWidth}
                splitEnabled={readerSplitEnabled}
                latestContent={readerLatestContent}
                latestLoading={readerLatestLoading}
                latestError={readerLatestError}
                summary={readerSummary}
                summaryLoading={readerSummaryLoading}
                summaryError={readerSummaryError}
                summaryPending={readerSummaryPending}
              />
            )}

            {view === "confirm-mark-read" && (
              <ConfirmationDialog
                title={`Mark all in "${selectedCategory?.title}" as read?`}
                borderColor="red"
                width={Math.max(40, Math.floor(terminalWidth * 0.5))}
                height={Math.max(8, Math.floor(contentHeight * 0.5))}
              />
            )}

            {view === "confirm-exit" && (
              <ConfirmationDialog
                title="Exit Kizuki?"
                borderColor="yellow"
                width={Math.max(40, Math.floor(terminalWidth * 0.5))}
                height={Math.max(8, Math.floor(contentHeight * 0.5))}
              />
            )}
          </>
        )}
      </Box>

      <Footer terminalWidth={terminalWidth} view={view} />
    </Box>
  );
}
