import React from "react";

interface TopNavMenuProps {
  unreadOnly: boolean;
  bookmarkedOnly: boolean;
  onMarkAllRead: () => void;
  onToggleUnreadOnly: () => void;
  onToggleBookmarkedOnly: () => void;
}

export default function TopNavMenu({
  unreadOnly,
  bookmarkedOnly,
  onMarkAllRead,
  onToggleUnreadOnly,
  onToggleBookmarkedOnly,
}: TopNavMenuProps) {
  return (
    <div className="top-nav-icon-buttons">
      <button
        type="button"
        className="top-nav-icon-btn"
        id="unread-only"
        title={
          unreadOnly
            ? "Showing unread only (click to show all)"
            : "Show unread only"
        }
        onClick={onToggleUnreadOnly}
        aria-label="Toggle unread only filter"
        aria-pressed={unreadOnly}
      >
        <i
          className={
            unreadOnly ? "bi bi-filter-circle-fill" : "bi bi-filter-circle"
          }
        />
      </button>

      <button
        type="button"
        className="top-nav-icon-btn"
        id="items-check-all-read-x"
        title="Mark all as read"
        onClick={onMarkAllRead}
        aria-label="Mark all items as read"
      >
        <i className="bi bi-check2-circle" />
      </button>

      <button
        type="button"
        className="top-nav-icon-btn"
        id="items-bookmark-filter"
        title={
          bookmarkedOnly
            ? "Showing bookmarked only (click to show all)"
            : "Show bookmarked only"
        }
        onClick={onToggleBookmarkedOnly}
        aria-label="Toggle bookmarked only filter"
        aria-pressed={bookmarkedOnly}
      >
        <i
          className={bookmarkedOnly ? "bi bi-bookmark-fill" : "bi bi-bookmark"}
        />
      </button>
    </div>
  );
}
