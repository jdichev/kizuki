import React from "react";
import { Box, Text } from "ink";
import { decode } from "entities";
import { formatDateTime } from "../utils/date.js";
import { cleanContent } from "../utils/text.js";

interface ReaderViewProps {
  item: any;
  scrollOffset: number;
  contentHeight: number;
  terminalWidth: number;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  item,
  scrollOffset,
  contentHeight,
}) => {
  const { dateStr } = formatDateTime(item.published);
  
  // 1. Get raw content (prefer latest_content if available)
  const rawContent = cleanContent(item.latest_content || item.content || "");
  
  // 2. Split into lines for scrolling
  const lines = rawContent.split("\n");
  const visibleLines = lines.slice(scrollOffset, scrollOffset + contentHeight - 2);

  return (
    <Box flexDirection="column" width="100%">
      <Text color="yellow" bold>
        {decode(item.title)}
      </Text>
      <Box>
        <Text dimColor>
          {item.feedTitle} │ {dateStr}
        </Text>
      </Box>
      <Box marginTop={1} height={contentHeight - 2}>
        <Text>{visibleLines.join("\n")}</Text>
      </Box>
      <Text dimColor>{`Line ${scrollOffset + 1} to ${Math.min(
        scrollOffset + contentHeight - 2,
        lines.length
      )} of ${lines.length} (WASD to scroll)`}</Text>
    </Box>
  );
};
