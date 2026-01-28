import React, { useState, useEffect, useRef } from "react";
import "../styles/TopNavMenu.css";

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
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleMarkAllRead = () => {
    onMarkAllRead();
    setIsOpen(false);
  };

  const handleToggleUnreadOnly = () => {
    onToggleUnreadOnly();
    setIsOpen(false);
  };

  const handleToggleMenu = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom,
        left: rect.left,
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="top-nav-menu-wrapper" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-sm top-nav-menu-toggle"
        title="Menu"
        onClick={handleToggleMenu}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <i className="bi bi-list" />
      </button>

      {isOpen && (
        <div
          className="top-nav-menu-dropdown"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
          }}
        >
          <button
            type="button"
            className="top-nav-menu-item"
            id="unread-only"
            title="Show unread only"
            onClick={handleToggleUnreadOnly}
          >
            <span className="menu-item-icon">
              {unreadOnly && <i className="bi bi-check-lg" />}
            </span>
            <span className="menu-item-label">Show unread only</span>
          </button>

          <button
            type="button"
            className="top-nav-menu-item"
            id="items-check-all-read-x"
            title="Mark all as read"
            onClick={handleMarkAllRead}
          >
            <span className="menu-item-icon" />
            <span className="menu-item-label">Mark all as read</span>
          </button>
        </div>
      )}
    </div>
  );
}
