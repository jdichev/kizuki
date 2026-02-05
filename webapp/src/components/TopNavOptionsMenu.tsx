import React, { useEffect, useRef, useState } from "react";

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
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

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

  const handleSummarizeClick = () => {
    onSummarize();
    setIsOpen(false);
  };

  const handleRetrieveClick = () => {
    onRetrieveLatest();
    setIsOpen(false);
  };

  return (
    <div className="top-nav-menu-wrapper" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-sm top-nav-menu-toggle"
        title="Article options"
        onClick={handleToggleMenu}
        aria-label="Toggle article options"
        aria-expanded={isOpen}
      >
        <i className="bi bi-three-dots-vertical" />
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
            title="Summarize article"
            onClick={handleSummarizeClick}
            disabled={isLoadingSummary}
          >
            <span className="menu-item-icon">
              <i className="bi bi-card-text" />
            </span>
            <span className="menu-item-label">
              {isLoadingSummary ? "Summarizing..." : "Summarize article"}
            </span>
          </button>

          <button
            type="button"
            className="top-nav-menu-item"
            title="Retrieve latest content"
            onClick={handleRetrieveClick}
            disabled={isLoadingContent}
          >
            <span className="menu-item-icon">
              <i className="bi bi-cloud-download" />
            </span>
            <span className="menu-item-label">
              {isLoadingContent ? "Retrieving..." : "Retrieve latest"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
