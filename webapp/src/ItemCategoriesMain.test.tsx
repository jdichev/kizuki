import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ItemCategoriesMain from "./ItemCategoriesMain";
import DataService from "./service/DataService";

jest.mock("./service/DataService", () => {
  const mockDs = {
    getItemCategories: jest.fn(),
    getItemCategoryReadStats: jest.fn(),
    getItemsDeferred: jest.fn(),
    markItemRead: jest.fn(),
    getItemDeferred: jest.fn(),
    markItemsRead: jest.fn(),
  };

  return {
    __esModule: true,
    default: {
      getInstance: () => mockDs,
      __mock: mockDs,
    },
  };
});

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    value: jest.fn(),
    writable: true,
  });
});

beforeEach(() => {
  const ds = (DataService as unknown as { __mock: any }).__mock;
  ds.getItemCategories.mockReset();
  ds.getItemCategoryReadStats.mockReset();
  ds.getItemsDeferred.mockReset();
  ds.markItemRead.mockReset();
  ds.getItemDeferred.mockReset();
  ds.markItemsRead.mockReset();
});

test("selected item remains visible when list is refreshed with unreadOnly filter", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  const mockItems = [
    {
      id: 1,
      title: "Item 1",
      read: 0,
      published: 1000,
      feedTitle: "Feed A",
      url: "https://example.com/1",
    },
    {
      id: 2,
      title: "Item 2",
      read: 0,
      published: 2000,
      feedTitle: "Feed A",
      url: "https://example.com/2",
    },
    {
      id: 3,
      title: "Item 3",
      read: 0,
      published: 3000,
      feedTitle: "Feed A",
      url: "https://example.com/3",
    },
  ];

  // First call returns all items
  ds.getItemsDeferred.mockResolvedValueOnce(mockItems);
  ds.getItemCategories.mockResolvedValue([{ id: 1, title: "Category A" }]);
  ds.getItemCategoryReadStats.mockResolvedValue([{ id: 1, unreadCount: 3 }]);
  ds.markItemRead.mockResolvedValue(undefined);
  ds.getItemDeferred.mockResolvedValue({
    ...mockItems[1],
    content: "Content for Item 2",
  });

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <ItemCategoriesMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  // Wait for items to load
  await screen.findByText("Item 1");
  await screen.findByText("Item 2");
  await screen.findByText("Item 3");

  // Click on Item 2 to select it (marks it as read)
  const item2Element = await screen.findByText("Item 2");
  fireEvent.click(item2Element);

  // Wait for the item to be marked as read
  await waitFor(() => {
    expect(ds.markItemRead).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 })
    );
  });

  // Second call returns only unread items (1 and 3, not 2)
  // This simulates what would happen when unreadOnly filter is enabled
  const unreadItems = [mockItems[0], mockItems[2]];
  ds.getItemsDeferred.mockResolvedValueOnce(unreadItems);

  // Trigger list refresh by scrolling to top (which calls showItems again)
  const listPanel = document.getElementById("list-panel");
  if (listPanel) {
    fireEvent.scroll(listPanel, { target: { scrollTop: 0 } });
  }

  // Item 2 should still be visible even though it's not in the unread list
  // because it's the currently selected item
  await waitFor(() => {
    expect(screen.getByText("Item 2")).toBeTruthy();
  });

  // Items 1 and 3 should also be visible
  expect(screen.getByText("Item 1")).toBeTruthy();
  expect(screen.getByText("Item 3")).toBeTruthy();
});
