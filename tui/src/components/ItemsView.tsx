import React from "react";
import { Box, Text } from "ink";
import { SectionHeader } from "./SectionHeader.js";
import { visualTruncate } from "../utils/text.js";
import { formatDateTime } from "../utils/date.js";
import { decode } from "entities";
import { Scrollbar } from "./Scrollbar.js";
import { useTheme } from "../hooks/ThemeContext.js";

const VIDEO_LABEL = process.env.TERM === "dumb" ? "V" : "▶";

interface ItemsViewProps {
  title: string;
  items: any[];
  activeIndex: number;
  scrollOffset: number;
  visibleHeight: number;
  terminalWidth: number;
  unreadOnly: boolean;
  bookmarkedOnly: boolean;
}

export const ItemsView: React.FC<ItemsViewProps> = ({
  title,
  items,
  activeIndex,
  scrollOffset,
  visibleHeight,
  terminalWidth,
  unreadOnly,
  bookmarkedOnly,
}) => {
  const { theme } = useTheme();

  return (
    <Box flexDirection="column" width="100%">
      <SectionHeader
        title={`${unreadOnly ? "[UNREAD ONLY] " : ""}${
          bookmarkedOnly ? "[BOOKMARKED ONLY] " : ""
        }Articles: ${title}`}
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
                  terminalWidth - feedWidth - dateWidth - wordsWidth - 18;

                const isVideo =
                  item.url?.includes("youtube.com") ||
                  item.url?.includes("youtu.be");
                const wordsLabel = isVideo
                  ? VIDEO_LABEL
                  : `${item.latestContentWordCount || 0}w`;

                const bookmarkLabel = item.bookmarked ? "[B]" : "   ";

                const row = `${item.read ? " " : "*"} ${bookmarkLabel} ${visualTruncate(
                  decode(item.title),
                  titleWidth,
                  true
                )} │ ${visualTruncate(item.feedTitle || "", feedWidth, true)} │ ${visualTruncate(
                  wordsLabel,
                  wordsWidth - 1
                )} │ ${dateTimeStr}`;

                return (
                  <Text
                    key={item.id}
                    backgroundColor={
                      isSelected ? theme.colors.listSelectionBg : undefined
                    }
                    color={
                      isSelected ? theme.colors.listSelectionFg : undefined
                    }
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
};
