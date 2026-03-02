import React from "react";
import { Box, Text } from "ink";
import wrapAnsi from "wrap-ansi";
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
  terminalWidth,
}) => {
  const { dateStr } = formatDateTime(item.published);
  const wrapWidth = Math.min(80, terminalWidth - 6);
  const useMarkdown = !!item.latest_content;
  const content = cleanContent(item.latest_content || item.content || "", useMarkdown);
  const wrappedContent = wrapAnsi(content, wrapWidth, { hard: true });
  const lines = wrappedContent.split("\n");
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
      <Box marginTop={1} height={contentHeight - 2} width={wrapWidth}>
        <Text>{visibleLines.join("\n")}</Text>
      </Box>
      <Text dimColor>{`Line ${scrollOffset + 1} to ${Math.min(
        scrollOffset + contentHeight - 2,
        lines.length
      )} of ${lines.length} (WASD to scroll)`}</Text>
    </Box>
  );
};
