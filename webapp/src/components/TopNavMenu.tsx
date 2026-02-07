import React from "react";

interface TopNavMenuProps {
  unreadOnly: boolean;
  onMarkAllRead: () => void;
  onToggleUnreadOnly: () => void;
}

export default function TopNavMenu({
  unreadOnly,
  onMarkAllRead,
  onToggleUnreadOnly,
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
        <i className={unreadOnly ? "bi bi-filter-circle" : "bi bi-filter-circle-fill"} />
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
    </div>
  );
}
