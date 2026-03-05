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
  summary: string | null;
  summaryLoading: boolean;
  summaryError: string | null;
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
  summary,
  summaryLoading,
  summaryError,
}) => {
  const { dateStr } = formatDateTime(item.published);

  // If summary is available or currently loading, show the right pane
  const currentSummaryRaw = summary || item.summary || "";
  const showSummaryPane = Boolean(currentSummaryRaw) || summaryLoading;

  // Always use 50% of terminal width for consistent layout
  const paneWidth = Math.floor(terminalWidth / 2) - 2;

  // Prioritize the retrieved latest content
  const displayContentRaw = latestContent || item.latest_content || item.content || "";
  const displayContent = renderMarkdown(displayContentRaw, paneWidth);
  const summaryContent = currentSummaryRaw ? renderMarkdown(currentSummaryRaw, paneWidth) : "";

  const visibleHeight = Math.max(1, contentHeight - 4); // Adjusted for footer

  const contentLines = displayContent.split("\n");
  const summaryLines = summaryContent.split("\n");

  const maxLines = Math.max(contentLines.length, summaryLines.length);

  const visibleContentLines = contentLines.slice(
    scrollOffset,
    scrollOffset + visibleHeight
  );
  const visibleSummaryLines = summaryLines.slice(
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
              I: Refetch | O: Summarize
            </Text>
          </Box>
        </Box>
        {item.url && (
          <Text dimColor>
            URL: <Text color="cyan" underline>{terminalLink(item.url, item.url)}</Text>
          </Text>
        )}
      </Box>

      <Box marginTop={1} height={visibleHeight} paddingX={1} flexDirection="row">
        {/* Main Content Pane */}
        <Box flexDirection="column" width={paneWidth}>
          {latestLoading && !latestContent && !item.latest_content && (
            <Box marginBottom={1}>
              <Text color="cyan" italic>
                Automatically retrieving latest content...
              </Text>
            </Box>
          )}
          <Text>{visibleContentLines.join("\n")}</Text>
        </Box>

        {/* Summary Pane */}
        {showSummaryPane && (
          <>
            <Box marginX={1}>
              <Text dimColor>│</Text>
            </Box>
            <Box flexDirection="column" width={paneWidth}>
              <Text bold color="green">Summary</Text>
              {summaryLoading && !currentSummaryRaw ? (
                <Text color="green" bold>[SUMMARIZING...]</Text>
              ) : (
                <Text>{visibleSummaryLines.join("\n")}</Text>
              )}
            </Box>
          </>
        )}
      </Box>

      <Box height={1} marginTop={0} paddingX={1} justifyContent="space-between">
        <Box>
          {latestLoading ? (
            <Text color="cyan" bold>⌛ Loading content...</Text>
          ) : latestError ? (
            <Text color="red">⚠ {latestError}</Text>
          ) : summaryError ? (
            <Text color="red">⚠ {summaryError}</Text>
          ) : (
            <Box>
              <Text dimColor>
                {scrollOffset > 0 ? `↑ ${scrollOffset} lines` : ""}
              </Text>
              <Text dimColor> │ I: Refetch | O: Summarize</Text>
            </Box>
          )}
        </Box>
        <Text dimColor>
          Line {scrollOffset + 1} of {maxLines} | {item.latestContentWordCount || 0} words
        </Text>
      </Box>
    </Box>
  );
};
