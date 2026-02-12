import React, { useState } from "react";
import DataService from "../service/DataService";

const ds = DataService.getInstance();

interface ItemCategoriesNavProps {
  activeNav: string;
  itemCategories: ItemCategory[];
  selectedItemCategory?: ItemCategory;
  selectItemCategory: (category: ItemCategory | undefined, e?: any) => void;
  getTotalUnreadCount: () => number;
  getUnreadCountForItemCategory: (categoryId: number | undefined) => number;
}

export default function ItemCategoriesNav({
  activeNav,
  itemCategories,
  selectedItemCategory,
  selectItemCategory,
  getTotalUnreadCount,
  getUnreadCountForItemCategory,
}: ItemCategoriesNavProps) {
  return (
    <>
      <nav
        id="sidebar-menu"
        data-activenav={activeNav === "categories" ? "true" : "false"}
      >
        <ul>
          <li className={!selectedItemCategory ? "feedcategory-selected" : ""}>
            <button
              id="item-category-all"
              type="button"
              className="btn btn-link text-decoration-none"
              onClick={(e) => selectItemCategory(undefined, e)}
            >
              <i className="bi bi-asterisk" /> <span>All</span>
              <span className="menu-marker">{getTotalUnreadCount()}</span>
            </button>
          </li>

          {itemCategories.map((itemCategory) => {
            return (
              <li
                key={itemCategory.id}
                className={
                  itemCategory.id === selectedItemCategory?.id
                    ? "feedcategory-selected"
                    : ""
                }
              >
                <button
                  id={`item-category-${itemCategory.id}`}
                  type="button"
                  className="btn btn-link text-decoration-none w-100"
                  onClick={(e) => selectItemCategory(itemCategory, e)}
                  title={`${itemCategory.title} ${getUnreadCountForItemCategory(
                    itemCategory.id
                  )}`}
                >
                  {/* <i className="bi bi-tag" /> */}
                  <span> {itemCategory.title}</span>
                  <span className="menu-marker">
                    {getUnreadCountForItemCategory(itemCategory.id)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
