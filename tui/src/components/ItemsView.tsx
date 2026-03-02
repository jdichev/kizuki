import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "./SectionHeader.js";
import { visualTruncate } from "../utils/text.js";
import { formatDateTime } from "../utils/date.js";
import { decode } from "entities";
import { Item } from "../types/index.js";

interface ItemsViewProps {
  title: string;
  items: Item[];
  activeIndex: number;
  scrollOffset: number;
  visibleHeight: number;
  terminalWidth: number;
}

export const ItemsView: React.FC<ItemsViewProps> = ({
  title,
  items,
  activeIndex,
  scrollOffset,
  visibleHeight,
  terminalWidth,
}) => (
  <Box flexDirection="column">
    <SectionHeader title={`Articles: ${title}`} terminalWidth={terminalWidth} />
    {items.length === 0 ? (
      <Text>No items found.</Text>
    ) : (
      items.slice(scrollOffset, scrollOffset + visibleHeight).map((item, i) => {
        const realIdx = i + scrollOffset;
        const isSelected = realIdx === activeIndex;
        const { dateTimeStr } = formatDateTime(item.published);

        const feedWidth = Math.floor(terminalWidth * 0.2);
        const dateWidth = 18;
        const wordsWidth = 8;
        const titleWidth =
          terminalWidth - feedWidth - dateWidth - wordsWidth - 12;

        const row = `${item.read ? " " : "*"} ${visualTruncate(
          decode(item.title),
          titleWidth
        )} │ ${visualTruncate(item.feedTitle || "", feedWidth)} │ ${visualTruncate(
          `${item.latestContentWordCount || 0}w`,
          wordsWidth - 1
        )} │ ${dateTimeStr}`;

        return (
          <Text
            key={item.id}
            backgroundColor={isSelected ? "white" : undefined}
            color={isSelected ? "black" : undefined}
          >
            {row.padEnd(terminalWidth - 4)}
          </Text>
        );
      })
    )}
  </Box>
);
