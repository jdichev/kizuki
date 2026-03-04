import React from "react";
import { Box, Text } from "ink";
import { decode } from "entities";
import { formatDateTime } from "../utils/date.js";
import { cleanContent, renderMarkdown, terminalLink } from "../utils/text.js";
import { Item } from "../types/index.js";

interface ReaderViewProps {
  item: Item;
  scrollOffset: number;
  contentHeight: number;
  terminalWidth: number;
  splitEnabled: boolean;
  latestContent: string | null;
  latestLoading: boolean;
  latestError: string | null;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  item,
  scrollOffset,
  contentHeight,
  terminalWidth,
  splitEnabled,
  latestContent,
  latestLoading,
  latestError,
}) => {
  const { dateStr } = formatDateTime(item.published);

  // Set the reading pane width to 80 characters (or terminal width - 2 if smaller)
  const paneWidth = Math.min(80, terminalWidth - 2);

  // Prioritize the retrieved latest content (either from state or from the item itself)
  const displayContentRaw = latestContent || item.latest_content || item.content || "";
  const displayContent = renderMarkdown(displayContentRaw, paneWidth);

  const visibleHeight = Math.max(1, contentHeight - 4); // Adjusted for footer

  const lines = displayContent.split("\n");
  const visibleLines = lines.slice(
    scrollOffset,
    scrollOffset + visibleHeight
  );

  return (
    <Box flexDirection="column" width="100%" height={contentHeight}>
      <Box paddingX={1} flexDirection="column">
        <Text bold color="yellow">
          {decode(item.title)}
        </Text>
        <Box justifyContent="space-between">
          <Text dimColor>
            {item.feedTitle} │ {dateStr}
          </Text>
          <Box>
            {latestLoading && (
              <Text color="cyan" bold>
                [RETRIEVING LATEST...] 
              </Text>
            )}
            <Text dimColor>
              I: Refetch Latest
            </Text>
          </Box>
        </Box>
        {item.url && (
          <Text dimColor>
            URL: <Text color="cyan" underline>{terminalLink(item.url, item.url)}</Text>
          </Text>
        )}
      </Box>

      <Box marginTop={1} height={visibleHeight} paddingX={1} justifyContent="flex-start">
        <Box flexDirection="column" width={paneWidth}>
          {latestLoading && !latestContent && !item.latest_content && (
            <Box marginBottom={1}>
              <Text color="cyan" italic>
                Automatically retrieving latest content...
              </Text>
            </Box>
          )}
          <Text>{visibleLines.join("\n")}</Text>
        </Box>
      </Box>

      <Box height={1} marginTop={0} paddingX={1} justifyContent="space-between">
        <Box>
          {latestLoading ? (
            <Text color="cyan" bold>
              ⌛ Loading better content...
            </Text>
          ) : latestError ? (
            <Text color="red">⚠ {latestError}</Text>
          ) : (
            <Text dimColor>
              {scrollOffset > 0 ? `↑ ${scrollOffset} lines` : ""}
            </Text>
          )}
        </Box>
        <Text dimColor>
          Line {scrollOffset + 1} of {lines.length} | {item.latestContentWordCount || 0} words
        </Text>
      </Box>
    </Box>
  );
};
