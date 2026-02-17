import React from "react";

type RowLabelGetter<T> = (value: T) => React.ReactNode;
type RowTextGetter<T> = (value: T) => string;
type RowNumberGetter<T> = (value: T) => number;
type RowBooleanGetter<T> = (value: T) => boolean;

type AllRowConfig = {
  id: string;
  className?: string;
  label: React.ReactNode;
  title?: string;
  iconClassName?: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  unreadCount?: number | string;
  showUnread?: (count: number | string | undefined) => boolean;
};

type ParentRowConfig<TParent, TChild> = {
  id: (parent: TParent) => string;
  className?: (parent: TParent) => string;
  label: RowLabelGetter<TParent>;
  title?: (parent: TParent) => string;
  onClick: (parent: TParent, e: React.MouseEvent<HTMLButtonElement>) => void;
  unreadCount?: (parent: TParent) => number | string;
  showUnread?: (count: number | string | undefined, parent: TParent) => boolean;
  iconMode?: "always" | "when-children" | "none";
  isExpanded?: RowBooleanGetter<TParent>;
  hasChildren?: (parent: TParent, children: TChild[]) => boolean;
  expandedIconClassName?: string;
  collapsedIconClassName?: string;
  emptyIconClassName?: string;
};

type ChildRowConfig<TParent, TChild> = {
  id: (child: TChild, parent: TParent) => string;
  className?: (child: TChild, parent: TParent) => string;
  label: RowLabelGetter<TChild>;
  title?: (child: TChild, parent: TParent) => string;
  onClick: (
    child: TChild,
    parent: TParent,
    e: React.MouseEvent<HTMLButtonElement>
  ) => void;
  unreadCount?: (child: TChild, parent: TParent) => number | string;
  showUnread?: (
    count: number | string | undefined,
    child: TChild,
    parent: TParent
  ) => boolean;
};

type UnifiedCategoriesViewProps<TParent, TChild> = {
  activeNav: string;
  parents: TParent[];
  getChildren: (parent: TParent) => TChild[];
  parentKey: (parent: TParent) => React.Key;
  childKey: (child: TChild) => React.Key;
  allRow: AllRowConfig;
  parentRow: ParentRowConfig<TParent, TChild>;
  childRow: ChildRowConfig<TParent, TChild>;
  shouldRenderChildren?: (parent: TParent, children: TChild[]) => boolean;
};

const defaultShowUnread = (count: number | string | undefined): boolean => {
  if (typeof count === "number") {
    return count > 0;
  }

  if (typeof count === "string") {
    return count.length > 0;
  }

  return false;
};

export default function UnifiedCategoriesView<TParent, TChild>({
  activeNav,
  parents,
  getChildren,
  parentKey,
  childKey,
  allRow,
  parentRow,
  childRow,
  shouldRenderChildren,
}: UnifiedCategoriesViewProps<TParent, TChild>) {
  const allShowUnread = allRow.showUnread ?? defaultShowUnread;
  const allUnreadCount = allRow.unreadCount;

  return (
    <nav
      id="sidebar-menu"
      data-activenav={activeNav === "categories" ? "true" : "false"}
    >
      <ul>
        <li className={allRow.className || ""}>
          <button
            id={allRow.id}
            type="button"
            className="btn btn-link text-decoration-none"
            onClick={allRow.onClick}
            title={allRow.title}
          >
            <i className={allRow.iconClassName || "bi bi-asterisk"} />
            <span>{allRow.label}</span>
            {allShowUnread(allUnreadCount) && (
              <span className="menu-marker">{allUnreadCount}</span>
            )}
          </button>
        </li>
        {parents.map((parent) => {
          const children = getChildren(parent);
          const showChildren = shouldRenderChildren
            ? shouldRenderChildren(parent, children)
            : children.length > 0;

          const hasChildren = parentRow.hasChildren
            ? parentRow.hasChildren(parent, children)
            : children.length > 0;
          const isExpanded = parentRow.isExpanded
            ? parentRow.isExpanded(parent)
            : false;

          const parentUnreadCount = parentRow.unreadCount
            ? parentRow.unreadCount(parent)
            : undefined;
          const parentShowUnread = parentRow.showUnread ?? defaultShowUnread;

          const iconMode = parentRow.iconMode || "always";
          const showChevron =
            iconMode === "always" ||
            (iconMode === "when-children" && hasChildren);

          return (
            <div key={parentKey(parent)}>
              <li
                className={
                  parentRow.className ? parentRow.className(parent) : ""
                }
              >
                <button
                  id={parentRow.id(parent)}
                  type="button"
                  className="btn btn-link text-decoration-none"
                  onClick={(e) => parentRow.onClick(parent, e)}
                  title={parentRow.title ? parentRow.title(parent) : undefined}
                >
                  {showChevron ? (
                    <i
                      className={
                        isExpanded
                          ? parentRow.expandedIconClassName ||
                            "bi bi-chevron-down categoryChevron"
                          : parentRow.collapsedIconClassName ||
                            "bi bi-chevron-right categoryChevron"
                      }
                    />
                  ) : (
                    <span
                      className={
                        parentRow.emptyIconClassName || "categoryChevron"
                      }
                    />
                  )}
                  <span>{parentRow.label(parent)}</span>
                  {parentShowUnread(parentUnreadCount, parent) && (
                    <span className="menu-marker">{parentUnreadCount}</span>
                  )}
                </button>
              </li>
              {showChildren
                ? children.map((child) => (
                    <div key={childKey(child)}>
                      <li
                        className={
                          childRow.className
                            ? childRow.className(child, parent)
                            : ""
                        }
                      >
                        <button
                          id={childRow.id(child, parent)}
                          type="button"
                          className="btn btn-link text-decoration-none"
                          onClick={(e) => childRow.onClick(child, parent, e)}
                          title={
                            childRow.title
                              ? childRow.title(child, parent)
                              : undefined
                          }
                        >
                          <span>{childRow.label(child)}</span>
                          {(() => {
                            const childUnreadCount = childRow.unreadCount
                              ? childRow.unreadCount(child, parent)
                              : undefined;
                            const childShowUnread =
                              childRow.showUnread ?? defaultShowUnread;

                            if (
                              !childShowUnread(childUnreadCount, child, parent)
                            ) {
                              return null;
                            }

                            return (
                              <span className="menu-marker">
                                {childUnreadCount}
                              </span>
                            );
                          })()}
                        </button>
                      </li>
                    </div>
                  ))
                : ""}
            </div>
          );
        })}
      </ul>
    </nav>
  );
}
