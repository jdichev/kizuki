import React from "react";

interface TopNavOptionsMenuProps {
  onSummarize: () => void;
  onRetrieveLatest: () => void;
  onBookmark: () => void;
  onToggleSpeech: () => void;
  isLoadingSummary: boolean;
  isLoadingContent: boolean;
  isBookmarking: boolean;
  isBookmarked: boolean;
  isSpeaking: boolean;
}

export default function TopNavOptionsMenu({
  onSummarize,
  onRetrieveLatest,
  onBookmark,
  onToggleSpeech,
  isLoadingSummary,
  isLoadingContent,
  isBookmarking,
  isBookmarked,
  isSpeaking,
}: TopNavOptionsMenuProps) {
  return (
    <div className="top-nav-icon-buttons">
      <button
        type="button"
        className="top-nav-icon-btn"
        title={isLoadingSummary ? "Summarizing..." : "Summarize article"}
        onClick={onSummarize}
        disabled={isLoadingSummary}
        aria-label="Summarize article"
      >
        <i
          className={
            isLoadingSummary ? "bi bi-hourglass-split" : "bi bi-card-text"
          }
        />
      </button>

      <button
        type="button"
        className="top-nav-icon-btn"
        title={isLoadingContent ? "Retrieving..." : "Retrieve latest content"}
        onClick={onRetrieveLatest}
        disabled={isLoadingContent}
        aria-label="Retrieve latest content"
      >
        <i
          className={
            isLoadingContent ? "bi bi-hourglass-split" : "bi bi-cloud-download"
          }
        />
      </button>

      <button
        type="button"
        className="top-nav-icon-btn"
        title={
          isBookmarked ? "Bookmarked (click to remove)" : "Bookmark article"
        }
        onClick={onBookmark}
        disabled={isBookmarking}
        aria-label="Bookmark article"
        aria-pressed={isBookmarked}
      >
        <i
          className={
            isBookmarking
              ? "bi bi-hourglass-split"
              : isBookmarked
                ? "bi bi-bookmark-fill"
                : "bi bi-bookmark"
          }
        />
      </button>

      <button
        type="button"
        className="top-nav-icon-btn"
        title={isSpeaking ? "Stop reading" : "Read article"}
        onClick={onToggleSpeech}
        aria-label={isSpeaking ? "Stop reading" : "Read article"}
        aria-pressed={isSpeaking}
      >
        <i className={isSpeaking ? "bi bi-stop-fill" : "bi bi-volume-up"} />
      </button>
    </div>
  );
}
