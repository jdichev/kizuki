import React from "react";

interface TopNavOptionsMenuProps {
  onSummarize: () => void;
  onRetrieveLatest: () => void;
  isLoadingSummary: boolean;
  isLoadingContent: boolean;
}

export default function TopNavOptionsMenu({
  onSummarize,
  onRetrieveLatest,
  isLoadingSummary,
  isLoadingContent,
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
    </div>
  );
}
