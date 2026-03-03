import React from "react";
import { Box, Text } from "ink";
import { decode } from "entities";
import { formatDateTime } from "../utils/date.js";
import { cleanContent, terminalLink } from "../utils/text.js";
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

  const baseContent = cleanContent(item.content || "");
  const preferredContent = cleanContent(
    item.latest_content || item.content || ""
  );
  const loadedLatest = cleanContent(latestContent || item.latest_content || "");

  const leftContent = splitEnabled ? baseContent : preferredContent;
  const rightContent = loadedLatest;
  const visibleHeight = Math.max(1, contentHeight - 3);

  const leftLines = leftContent.split("\n");
  const leftVisibleLines = leftLines.slice(
    scrollOffset,
    scrollOffset + visibleHeight
  );

  const rightLines = rightContent.split("\n");
  const rightVisibleLines = rightLines.slice(
    scrollOffset,
    scrollOffset + visibleHeight
  );

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
      {item.url && (
        <Box marginTop={0}>
          <Text>
            URL:{" "}
            <Text color="cyan" underline>
              {terminalLink(item.url, item.url)}
            </Text>
          </Text>
        </Box>
      )}

      {!splitEnabled && (
        <>
          <Box marginTop={1} height={visibleHeight}>
            <Text>{leftVisibleLines.join("\n")}</Text>
          </Box>
          <Text dimColor>{`Line ${scrollOffset + 1} to ${Math.min(
            scrollOffset + visibleHeight,
            leftLines.length
          )} of ${leftLines.length} (WASD to scroll | I: Fetch latest)`}</Text>
        </>
      )}

      {splitEnabled && (
        <>
          <Box marginTop={1} flexDirection="row" height={visibleHeight}>
            <Box
              flexGrow={1}
              width={Math.max(20, Math.floor(terminalWidth / 2) - 2)}
            >
              <Box flexDirection="column">
                <Text bold>Original Content</Text>
                <Text>{leftVisibleLines.join("\n")}</Text>
              </Box>
            </Box>

            <Box marginX={1}>
              <Text dimColor>│</Text>
            </Box>

            <Box
              flexGrow={1}
              width={Math.max(20, Math.floor(terminalWidth / 2) - 2)}
            >
              <Box flexDirection="column">
                <Text bold color="cyan">
                  Retrieved Latest
                </Text>
                {latestLoading && rightContent.length === 0 && (
                  <Text dimColor>Retrieving latest content...</Text>
                )}
                {!latestLoading && latestError && rightContent.length === 0 && (
                  <Text color="red">{latestError}</Text>
                )}
                {rightContent.length > 0 && (
                  <Text>{rightVisibleLines.join("\n")}</Text>
                )}
              </Box>
            </Box>
          </Box>
          <Text dimColor>{`Line ${scrollOffset + 1} to ${Math.min(
            scrollOffset + visibleHeight,
            Math.max(leftLines.length, rightLines.length)
          )} (WASD to scroll | I: Refresh latest)`}</Text>
        </>
      )}
    </Box>
  );
};
