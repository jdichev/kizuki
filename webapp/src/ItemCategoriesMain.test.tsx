import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ItemCategoriesMain from "./ItemCategoriesMain";
import DataService from "./service/DataService";
import {
  SIDEBAR_MENU_HIDE_REQUEST_EVENT,
  SIDEBAR_MENU_VISIBILITY_EVENT,
  SIDEBAR_VISIBILITY_MODE,
} from "./utils/sidebarMenuVisibility";

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
  ds.getItemsDeferred.mockReset().mockResolvedValue([]);
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

  // Set up the mock to return mockItems for calls with these parameters
  ds.getItemsDeferred
    .mockResolvedValueOnce(mockItems)
    .mockResolvedValueOnce(mockItems); // Also set up second call in case component calls it twice
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

test("unread count badge is not shown when count is zero", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  ds.getItemCategories.mockResolvedValue([
    { id: 1, title: "Category A" },
    { id: 2, title: "Category B" },
  ]);
  ds.getItemCategoryReadStats.mockResolvedValue([
    { id: 1, unreadCount: 0 },
    { id: 2, unreadCount: 5 },
  ]);
  ds.getItemsDeferred.mockResolvedValue([]);

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <ItemCategoriesMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  // Wait for parent category to render (both categories fall into 1-99 range)
  await screen.findByText("General News & Lifestyle");

  //Click on the chevron to expand the parent category
  const parentButton = screen.getByRole("button", {
    name: /General News & Lifestyle/i,
  });
  const chevron = parentButton.querySelector(".categoryChevron");
  if (chevron) {
    fireEvent.click(chevron);
  }

  // Now wait for the child categories to render
  await screen.findByText("Category A");
  await screen.findByText("Category B");

  // Category A has 0 unread, should not show badge for the child
  const categoryAButton = screen.getByRole("button", { name: /Category A/i });
  const categoryAMenuMarker = categoryAButton.querySelector(".menu-marker");
  expect(categoryAMenuMarker).toBeNull();

  // Category B has 5 unread, should show badge with "5"
  const categoryBButton = screen.getByRole("button", { name: /Category B/i });
  const categoryBMenuMarker = categoryBButton.querySelector(".menu-marker");
  expect(categoryBMenuMarker).toBeTruthy();
  expect(categoryBMenuMarker?.textContent).toBe("5");

  // Total unread count (0 + 5 = 5) should be shown for "All"
  const allButton = screen.getByRole("button", { name: /All/i });
  const allMenuMarker = allButton.querySelector(".menu-marker");
  expect(allMenuMarker).toBeTruthy();
  expect(allMenuMarker?.textContent).toBe("5");
});

test("toggles unreadOnly filter and refreshes items with correct parameters", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  const allItems = [
    {
      id: 1,
      title: "Unread Item 1",
      read: 0,
      published: 1000,
      feedTitle: "Feed A",
      url: "https://example.com/1",
    },
    {
      id: 2,
      title: "Read Item 2",
      read: 1,
      published: 2000,
      feedTitle: "Feed A",
      url: "https://example.com/2",
    },
    {
      id: 3,
      title: "Unread Item 3",
      read: 0,
      published: 3000,
      feedTitle: "Feed A",
      url: "https://example.com/3",
    },
  ];

  const unreadItems = [allItems[0], allItems[2]];

  // First call returns all items, subsequent calls return filtered items
  ds.getItemsDeferred
    .mockResolvedValueOnce(allItems)
    .mockResolvedValueOnce(unreadItems);
  ds.getItemCategories.mockResolvedValue([{ id: 1, title: "Category A" }]);
  ds.getItemCategoryReadStats.mockResolvedValue([{ id: 1, unreadCount: 2 }]);

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <ItemCategoriesMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  // Wait for initial items to load
  await screen.findByText("Unread Item 1");
  await screen.findByText("Read Item 2");
  await screen.findByText("Unread Item 3");

  // Verify initial call was made without unreadOnly filter
  expect(ds.getItemsDeferred).toHaveBeenCalledWith(
    expect.objectContaining({
      unreadOnly: false,
    })
  );

  // Find and click the "E" key to toggle unreadOnly filter
  // Since we can't directly trigger the keyboard handler, we'll use the TopNavMenu button
  // For now, let's simulate the keydown event
  fireEvent.keyDown(window, { code: "KeyE" });

  // Wait for the component to refetch items with unreadOnly filter
  await waitFor(() => {
    expect(ds.getItemsDeferred).toHaveBeenCalledWith(
      expect.objectContaining({
        unreadOnly: true,
      })
    );
  });

  // Verify that only unread items are displayed
  expect(screen.getByText("Unread Item 1")).toBeTruthy();
  expect(screen.getByText("Unread Item 3")).toBeTruthy();
  expect(screen.queryByText("Read Item 2")).toBeNull();
});

test("marks items as read with all child categories when parent category is selected", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  const parentCategory = {
    id: 0,
    title: "General News & Lifestyle",
    expanded: false,
  };

  const childCategories = [
    { id: 1, title: "Politics & Government" },
    { id: 2, title: "Business & Finance" },
    { id: 3, title: "Science & Environment" },
  ];

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
      feedTitle: "Feed B",
      url: "https://example.com/2",
    },
  ];

  ds.getItemCategories.mockResolvedValue([...childCategories]);
  ds.getItemCategoryReadStats.mockResolvedValue([
    { id: 1, unreadCount: 2 },
    { id: 2, unreadCount: 1 },
    { id: 3, unreadCount: 0 },
  ]);
  ds.getItemsDeferred.mockResolvedValue(mockItems);
  ds.markItemsRead.mockResolvedValue({});

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <ItemCategoriesMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  // Wait for parent category to render
  await screen.findByText("General News & Lifestyle");

  // Click on the parent category to select it and expand it
  const parentButton = screen.getByRole("button", {
    name: /General News & Lifestyle/i,
  });
  const chevron = parentButton.querySelector(".categoryChevron");
  if (chevron) {
    fireEvent.click(chevron);
  }

  // Wait for child categories to render
  await screen.findByText("Politics & Government");
  await screen.findByText("Business & Finance");
  await screen.findByText("Science & Environment");

  // Wait for items to load
  await screen.findByText("Item 1");
  await screen.findByText("Item 2");

  // Press "Q" to mark all items as read (for the selected parent category)
  fireEvent.keyDown(window, { code: "KeyQ" });

  // Verify markItemsRead was called with array of all child categories
  await waitFor(() => {
    expect(ds.markItemsRead).toHaveBeenCalledWith(
      expect.objectContaining({
        itemCategories: expect.arrayContaining([
          expect.objectContaining({ id: 1, title: "Politics & Government" }),
          expect.objectContaining({ id: 2, title: "Business & Finance" }),
          expect.objectContaining({ id: 3, title: "Science & Environment" }),
        ]),
      })
    );
  });

  // Verify items are marked as read locally
  expect(ds.markItemsRead).toHaveBeenCalledTimes(1);
});

test("does not navigate to items with right arrow while items are loading", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  const loadedItems = [
    {
      id: 1,
      title: "Item 1",
      read: 0,
      published: 1000,
      feedTitle: "Feed A",
      url: "https://example.com/1",
    },
  ];

  let resolvePendingItems: ((items: unknown[]) => void) | undefined;
  const pendingItemsPromise = new Promise<unknown[]>((resolve) => {
    resolvePendingItems = resolve;
  });

  ds.getItemCategories.mockResolvedValue([{ id: 1, title: "Category A" }]);
  ds.getItemCategoryReadStats.mockResolvedValue([{ id: 1, unreadCount: 1 }]);
  ds.getItemsDeferred.mockResolvedValue(loadedItems);
  ds.markItemRead.mockResolvedValue(undefined);
  ds.getItemDeferred.mockResolvedValue(undefined);
  ds.markItemsRead.mockResolvedValue(undefined);

  const dispatchSpy = jest.spyOn(window, "dispatchEvent");

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <ItemCategoriesMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  await screen.findByText("Item 1");

  const callCountBeforeRefresh = ds.getItemsDeferred.mock.calls.length;
  ds.getItemsDeferred.mockImplementationOnce(() => pendingItemsPromise);

  fireEvent.keyDown(window, { code: "KeyE" });

  await waitFor(() => {
    expect(ds.getItemsDeferred.mock.calls.length).toBeGreaterThan(
      callCountBeforeRefresh
    );
  });

  fireEvent.keyDown(window, { code: "ArrowRight" });

  const temporaryClearCalls = dispatchSpy.mock.calls.filter(([event]) => {
    if (!(event instanceof CustomEvent)) {
      return false;
    }

    return (
      event.type === SIDEBAR_MENU_VISIBILITY_EVENT &&
      event.detail?.mode === SIDEBAR_VISIBILITY_MODE.temporaryClear
    );
  });

  expect(temporaryClearCalls.length).toBe(0);

  dispatchSpy.mockRestore();
});

test("selects first item when sidebar hide-request is triggered with sidebar focus", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  ds.getItemCategories.mockResolvedValue([{ id: 1, title: "Category A" }]);
  ds.getItemCategoryReadStats.mockResolvedValue([{ id: 1, unreadCount: 1 }]);
  ds.getItemsDeferred.mockResolvedValue([
    {
      id: 1,
      title: "Item 1",
      read: 1,
      published: 1000,
      feedTitle: "Feed A",
      url: "https://example.com/1",
    },
  ]);
  ds.markItemRead.mockResolvedValue(undefined);
  ds.getItemDeferred.mockResolvedValue(undefined);
  ds.markItemsRead.mockResolvedValue(undefined);

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <ItemCategoriesMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  await screen.findByText("Item 1");

  const categoryAllButton = document.getElementById("item-category-all");
  expect(categoryAllButton).toBeTruthy();
  (categoryAllButton as HTMLButtonElement).focus();
  expect(document.activeElement).toBe(categoryAllButton);

  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(SIDEBAR_MENU_HIDE_REQUEST_EVENT, {
        detail: { shouldSelectFirstItem: true },
      })
    );
  });

  await waitFor(() => {
    expect(document.activeElement?.id).toBe("item-1");
  });
});
