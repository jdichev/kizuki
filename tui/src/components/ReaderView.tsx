import React from "react";
import { Box, Text } from "ink";
import { decode } from "entities";
import { formatDateTime } from "../utils/date.js";
import { cleanContent, renderMarkdown, terminalLink } from "../utils/text.js";
import { Item } from "../types/index.js";
import { useTheme } from "../hooks/ThemeContext.js";

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
  summaryPending: boolean;
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
  summaryPending,
}) => {
  const { theme } = useTheme();
  const { dateStr } = formatDateTime(item.published);

  // If summary is available or any relevant loading/pending/error state exists, show the right pane
  const currentSummaryRaw = summary || item.summary || "";
  const showSummaryPane =
    Boolean(currentSummaryRaw) ||
    summaryLoading ||
    summaryPending ||
    latestLoading ||
    summaryError ||
    latestError;

  // Always use 50% of terminal width for consistent layout
  const paneWidth = Math.floor(terminalWidth / 2) - 2;

  // Prioritize the retrieved latest content
  const displayContentRaw =
    latestContent || item.latest_content || item.content || "";
  const displayContent = renderMarkdown(displayContentRaw, paneWidth);
  const summaryContent = currentSummaryRaw
    ? renderMarkdown(currentSummaryRaw, paneWidth)
    : "";

  const headerHeight = item.url ? 3 : 2;
  const visibleHeight = Math.max(1, contentHeight - headerHeight - 2); // Adjusted for header, margin, and footer

  const contentLines = displayContent.split("\n");
  const summaryLines = summaryContent.split("\n");

  const maxLines = Math.max(contentLines.length, summaryLines.length);

  // Reserve space for "Retrieving..." message if showing
  const contentHeaderHeight =
    latestLoading && !latestContent && !item.latest_content ? 2 : 0;
  // Reserve space for "Summary" label
  const summaryHeaderHeight = 1;

  const visibleContentLines = contentLines.slice(
    scrollOffset,
    scrollOffset + (visibleHeight - contentHeaderHeight)
  );
  const visibleSummaryLines = summaryLines.slice(
    scrollOffset,
    scrollOffset + (visibleHeight - summaryHeaderHeight)
  );

  return (
    <Box flexDirection="column" width="100%" height={contentHeight}>
      <Box paddingX={1} flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={theme.colors.readerTitleFg}>
            {decode(item.title)}
          </Text>
          {item.bookmarked === 1 && (
            <Text bold color={theme.colors.readerBookmarkFg}>
              [BOOKMARKED]
            </Text>
          )}
        </Box>
        <Box justifyContent="space-between">
          <Text dimColor>
            {item.feedTitle} │ {dateStr}
          </Text>
        </Box>
        {item.url && (
          <Text dimColor>
            URL:{" "}
            <Text color={theme.colors.readerLinkFg} underline>
              {terminalLink(item.url, item.url)}
            </Text>
          </Text>
        )}
      </Box>

      <Box
        marginTop={1}
        height={visibleHeight}
        paddingX={1}
        flexDirection="row"
      >
        {/* Main Content Pane */}
        <Box flexDirection="column" width={paneWidth}>
          {latestLoading && !latestContent && !item.latest_content && (
            <Box marginBottom={1}>
              <Text color={theme.colors.readerStatusFg} italic>
                Automatically retrieving latest content...
              </Text>
            </Box>
          )}
          {latestError && (
            <Box marginBottom={1}>
              <Text color={theme.colors.readerErrorFg}>⚠ {latestError}</Text>
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
              <Text bold color={theme.colors.readerSummaryLabelFg}>Summary</Text>
              {summaryPending && !currentSummaryRaw && (
                <Text color="gray" italic>[AI Summary will start in 1s...]</Text>
              )}
              {latestLoading && !currentSummaryRaw && (
                <Text color={theme.colors.readerStatusFg} bold>[RETRIEVING LATEST...]</Text>
              )}
              {summaryLoading && !latestLoading && !currentSummaryRaw && (
                <Text color={theme.colors.readerSummaryLabelFg} bold>[SUMMARIZING...]</Text>
              )}
              {!summaryPending && !latestLoading && !summaryLoading && !currentSummaryRaw && summaryError && (
                <Text color={theme.colors.readerErrorFg}>⚠ {summaryError}</Text>
              )}
              {currentSummaryRaw && (
                <Text>{visibleSummaryLines.join("\n")}</Text>
              )}
            </Box>
          </>
        )}
      </Box>

      <Box height={1} marginTop={0} paddingX={1} justifyContent="space-between">
        <Box>
          <Text dimColor>
            {scrollOffset > 0 ? `↑ ${scrollOffset} lines` : ""}
          </Text>
        </Box>
        <Text dimColor>
          Line {scrollOffset + 1} of {maxLines} | {item.latestContentWordCount || 0} words
        </Text>
      </Box>
    </Box>
  );
};
