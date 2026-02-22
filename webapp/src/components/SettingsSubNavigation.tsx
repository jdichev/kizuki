import React from "react";
import { useNavigate } from "react-router-dom";

type SettingsSubNavigationSection =
  | "settings"
  | "item-categories"
  | "feed-categories";

interface SettingsSubNavigationProps {
  activeSection: SettingsSubNavigationSection;
}

export default function SettingsSubNavigation({
  activeSection,
}: SettingsSubNavigationProps) {
  const navigate = useNavigate();

  return (
    <nav id="main-sidebar" data-activenav="true">
      <ul>
        <li className={activeSection === "settings" ? "feed-selected" : ""}>
          <button
            type="button"
            className="btn btn-link text-decoration-none"
            onClick={() => navigate("/settings")}
          >
            <i className="bi bi-gear-fill" /> <span>Settings</span>
          </button>
        </li>

        <li
          className={activeSection === "item-categories" ? "feed-selected" : ""}
        >
          <button
            type="button"
            className="btn btn-link text-decoration-none"
            onClick={() => navigate("/item-categories/list")}
          >
            <i className="bi bi-tags" /> <span>Item Categories</span>
          </button>
        </li>

        <li
          className={activeSection === "feed-categories" ? "feed-selected" : ""}
        >
          <button
            type="button"
            className="btn btn-link text-decoration-none"
            onClick={() => navigate("/feed-categories/list")}
          >
            <i className="bi bi-bookmarks" /> <span>Feed Categories</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
