import React, { useState } from "react";
import DataService from "../service/DataService";
import type {
  ParentCategory,
  CategoryHierarchy,
} from "../utils/categoryHierarchyBuilder";

const ds = DataService.getInstance();

interface ItemCategoriesNavProps {
  activeNav: string;
  parentCategories: ParentCategory[];
  categoryChildren: Map<number, ItemCategory[]>;
  selectedParentCategory?: ParentCategory;
  selectedItemCategory?: ItemCategory;
  selectParentCategory: (
    category: ParentCategory | undefined,
    e?: React.MouseEvent<HTMLButtonElement>
  ) => void;
  selectItemCategory: (category: ItemCategory | undefined, e?: any) => void;
  getTotalUnreadCount: () => number;
  getUnreadCountForParent: (parentId: number) => number;
  getUnreadCountForItemCategory: (categoryId: number | undefined) => number;
}

export default function ItemCategoriesNav({
  activeNav,
  parentCategories,
  categoryChildren,
  selectedParentCategory,
  selectedItemCategory,
  selectParentCategory,
  selectItemCategory,
  getTotalUnreadCount,
  getUnreadCountForParent,
  getUnreadCountForItemCategory,
}: ItemCategoriesNavProps) {
  return (
    <nav
      id="sidebar-menu"
      data-activenav={activeNav === "categories" ? "true" : "false"}
    >
      <ul>
        <li
          className={
            !selectedParentCategory && !selectedItemCategory
              ? "feedcategory-selected"
              : ""
          }
        >
          <button
            id="item-category-all"
            type="button"
            className="btn btn-link text-decoration-none"
            onClick={(e) => {
              selectParentCategory(undefined, e);
              selectItemCategory(undefined);
            }}
          >
            <i className="bi bi-asterisk" /> <span>All</span>
            <span className="menu-marker">{getTotalUnreadCount()}</span>
          </button>
        </li>

        {parentCategories.map((parentCategory) => {
          const childCategories = categoryChildren.get(parentCategory.id) || [];
          const hasChildren = childCategories.length > 0;

          return (
            <div key={parentCategory.id}>
              <li
                className={
                  parentCategory.id === selectedParentCategory?.id &&
                  !selectedItemCategory
                    ? "feedcategory-selected"
                    : ""
                }
              >
                <button
                  id={`item-category-${parentCategory.id}`}
                  type="button"
                  className="btn btn-link text-decoration-none"
                  onClick={(e) => selectParentCategory(parentCategory, e)}
                  title={`${parentCategory.title} ${getUnreadCountForParent(
                    parentCategory.id
                  )}`}
                >
                  {hasChildren ? (
                    parentCategory.expanded ? (
                      <i className="bi bi-chevron-down categoryChevron" />
                    ) : (
                      <i className="bi bi-chevron-right categoryChevron" />
                    )
                  ) : (
                    <span className="categoryChevron" />
                  )}
                  <span>{parentCategory.title}</span>
                  {getUnreadCountForParent(parentCategory.id) > 0 && (
                    <span className="menu-marker">
                      {getUnreadCountForParent(parentCategory.id)}
                    </span>
                  )}
                </button>
              </li>

              {childCategories && parentCategory.expanded
                ? childCategories.map((itemCategory) => {
                    return (
                      <div key={itemCategory.id}>
                        <li
                          className={
                            itemCategory === selectedItemCategory
                              ? "category-feed feedcategory-selected"
                              : "category-feed"
                          }
                        >
                          <button
                            id={`item-category-child-${itemCategory.id}`}
                            type="button"
                            className="btn btn-link text-decoration-none"
                            onClick={() => selectItemCategory(itemCategory)}
                            title={`${itemCategory.title} ${getUnreadCountForItemCategory(
                              itemCategory.id
                            )}`}
                          >
                            <span>{itemCategory.title}</span>
                            {getUnreadCountForItemCategory(itemCategory.id) >
                              0 && (
                              <span className="menu-marker">
                                {getUnreadCountForItemCategory(itemCategory.id)}
                              </span>
                            )}
                          </button>
                        </li>
                      </div>
                    );
                  })
                : ""}
            </div>
          );
        })}
      </ul>
    </nav>
  );
}
