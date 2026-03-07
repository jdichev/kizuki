import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "./SectionHeader.js";
import { GroupingMode, CategoriesEntry, CategoryEntry } from "../types/index.js";
import { visualTruncate } from "../utils/text.js";
import { Scrollbar } from "./Scrollbar.js";

interface CategoriesViewProps {
  groupingMode: GroupingMode;
  categories: CategoriesEntry[];
  activeIndex: number;
  scrollOffset: number;
  visibleHeight: number;
  terminalWidth: number;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  groupingMode,
  categories,
  activeIndex,
  scrollOffset,
  visibleHeight,
  terminalWidth,
}) => (
  <Box flexDirection="column" width="100%">
    <SectionHeader
      title={
        groupingMode === "feed-categories"
          ? "Feed Categories"
          : "Item Categories"
      }
      terminalWidth={terminalWidth}
    />
    <Box flexDirection="row">
      <Box flexDirection="column" flexGrow={1}>
        {categories
          .slice(scrollOffset, scrollOffset + visibleHeight)
          .map((entry, i) => {
            const realIdx = i + scrollOffset;
            const isSelected = realIdx === activeIndex;

            if (entry.isHeader) {
              const rangeId = String(entry.id).padStart(7);
              return (
                <Text key={`h-${realIdx}`} bold color="magenta">
                  {`  ${rangeId} │ ${entry.title.toUpperCase()}`.padEnd(
                    terminalWidth - 6
                  )}
                </Text>
              );
            }

            const cat = entry as CategoryEntry;
            const idStr =
              cat.id === -1 ? "all".padStart(7) : String(cat.id).padStart(7);
            const unreadStr =
              cat.unreadCount && cat.unreadCount > 0
                ? String(cat.unreadCount)
                : "";

            const titleWidth = terminalWidth - 27;
            const row = `  ${idStr} │ ${visualTruncate(cat.title, titleWidth)} │ ${unreadStr.padStart(
              6
            )}`;

            return (
              <Text
                key={realIdx}
                backgroundColor={isSelected ? "yellowBright" : undefined}
                color={isSelected ? "black" : undefined}
              >
                {row.padEnd(terminalWidth - 6)}
              </Text>
            );
          })}
      </Box>
      <Scrollbar
        scrollOffset={scrollOffset}
        visibleHeight={visibleHeight}
        totalItems={categories.length}
      />
    </Box>
  </Box>
);
