import { render, screen } from "@testing-library/react";
import UnifiedCategoriesView from "./UnifiedCategoriesView";

type Parent = { id: number; title: string };
type Child = { id: number; title: string };

test("renders all row, parents, and children with preserved structure", () => {
  const parents: Parent[] = [
    { id: 1, title: "Parent A" },
    { id: 2, title: "Parent B" },
  ];

  const childrenByParent = new Map<number, Child[]>([
    [1, [{ id: 11, title: "Child A1" }]],
    [2, [{ id: 21, title: "Child B1" }]],
  ]);

  render(
    <UnifiedCategoriesView
      activeNav="categories"
      parents={parents}
      getChildren={(parent) => childrenByParent.get(parent.id) || []}
      parentKey={(parent) => parent.id}
      childKey={(child) => child.id}
      allRow={{
        id: "all",
        label: "All",
        onClick: jest.fn(),
      }}
      parentRow={{
        id: (parent) => `parent-${parent.id}`,
        label: (parent) => parent.title,
        onClick: jest.fn(),
      }}
      childRow={{
        id: (child) => `child-${child.id}`,
        label: (child) => child.title,
        onClick: jest.fn(),
      }}
      shouldRenderChildren={(parent) => parent.id === 1}
    />
  );

  expect(screen.getByText("All")).toBeTruthy();
  expect(screen.getByText("Parent A")).toBeTruthy();
  expect(screen.getByText("Parent B")).toBeTruthy();
  expect(screen.getByText("Child A1")).toBeTruthy();
  expect(screen.queryByText("Child B1")).toBeNull();
});

test("passes children to parent renderer", () => {
  const parents: Parent[] = [{ id: 1, title: "Parent A" }];
  const childrenByParent = new Map<number, Child[]>([
    [
      1,
      [
        { id: 11, title: "Child A1" },
        { id: 12, title: "Child A2" },
      ],
    ],
  ]);

  const renderParentRow = jest.fn(
    (parent: Parent, children: Child[]) =>
      `${parent.title} (${children.length})`
  );

  render(
    <UnifiedCategoriesView
      activeNav="categories"
      parents={parents}
      getChildren={(parent) => childrenByParent.get(parent.id) || []}
      parentKey={(parent) => parent.id}
      childKey={(child) => child.id}
      allRow={{
        id: "all",
        label: "All",
        onClick: jest.fn(),
      }}
      parentRow={{
        id: (parent) => `parent-${parent.id}`,
        label: (parent) => {
          const children = childrenByParent.get(parent.id) || [];
          return renderParentRow(parent, children);
        },
        onClick: jest.fn(),
      }}
      childRow={{
        id: (child) => `child-${child.id}`,
        label: (child) => child.title,
        onClick: jest.fn(),
      }}
    />
  );

  expect(renderParentRow).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Parent A (2)")).toBeTruthy();
});
