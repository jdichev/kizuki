import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "./SectionHeader.js";
import { GroupingMode, SidebarEntry } from "../types/index.js";

interface SidebarViewProps {
  groupingMode: GroupingMode;
  categories: SidebarEntry[];
  activeIndex: number;
  scrollOffset: number;
  visibleHeight: number;
  terminalWidth: number;
}

export const SidebarView: React.FC<SidebarViewProps> = ({
  groupingMode,
  categories,
  activeIndex,
  scrollOffset,
  visibleHeight,
  terminalWidth,
}) => (
  <Box flexDirection="column">
    <SectionHeader
      title={
        groupingMode === "feed-categories"
          ? "Feed Categories"
          : "Item Categories"
      }
      terminalWidth={terminalWidth}
    />
    {categories
      .slice(scrollOffset, scrollOffset + visibleHeight)
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

        const idStr =
          c.id === -1 ? "all".padStart(7) : String(c.id).padStart(7);

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
);
