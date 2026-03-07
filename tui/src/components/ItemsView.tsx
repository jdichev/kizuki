import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "./SectionHeader.js";
import { visualTruncate } from "../utils/text.js";
import { formatDateTime } from "../utils/date.js";
import { decode } from "entities";
import { Scrollbar } from "./Scrollbar.js";

interface ItemsViewProps {
  title: string;
  items: any[];
  activeIndex: number;
  scrollOffset: number;
  visibleHeight: number;
  terminalWidth: number;
  unreadOnly: boolean;
}

export const ItemsView: React.FC<ItemsViewProps> = ({
  title,
  items,
  activeIndex,
  scrollOffset,
  visibleHeight,
  terminalWidth,
  unreadOnly,
}) => (
  <Box flexDirection="column" width="100%">
    <SectionHeader
      title={`${unreadOnly ? "[UNREAD ONLY] " : ""}Articles: ${title}`}
      terminalWidth={terminalWidth}
    />
    <Box flexDirection="row">
      <Box flexDirection="column" flexGrow={1}>
        {items.length === 0 ? (
          <Text>No items found.</Text>
        ) : (
          items
            .slice(scrollOffset, scrollOffset + visibleHeight)
            .map((item, i) => {
              const realIdx = i + scrollOffset;
              const isSelected = realIdx === activeIndex;
              const { dateTimeStr } = formatDateTime(item.published);

              const feedWidth = Math.floor(terminalWidth * 0.2);
              const dateWidth = 18;
              const wordsWidth = 8;
              const titleWidth =
                terminalWidth - feedWidth - dateWidth - wordsWidth - 14;

              const isVideo =
                item.url?.includes("youtube.com") ||
                item.url?.includes("youtu.be");
              const wordsLabel = isVideo
                ? "vid"
                : `${item.latestContentWordCount || 0}w`;

              const row = `${item.read ? " " : "*"} ${visualTruncate(
                decode(item.title),
                titleWidth
              )} │ ${visualTruncate(item.feedTitle || "", feedWidth)} │ ${visualTruncate(
                wordsLabel,
                wordsWidth - 1
              )} │ ${dateTimeStr}`;

              return (
                <Text
                  key={item.id}
                  backgroundColor={isSelected ? "yellowBright" : undefined}
                  color={isSelected ? "black" : undefined}
                >
                  {row.padEnd(terminalWidth - 6)}
                </Text>
              );
            })
        )}
      </Box>
      <Scrollbar
        scrollOffset={scrollOffset}
        visibleHeight={visibleHeight}
        totalItems={items.length}
      />
    </Box>
  </Box>
);
