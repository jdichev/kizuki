import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FeedsMain from "./FeedCategoriesMain";
import DataService from "./service/DataService";

jest.mock("./service/DataService", () => {
  const mockDs = {
    getFeedCategories: jest.fn(),
    getFeedCategoryReadStats: jest.fn(),
    getFeedReadStats: jest.fn(),
    getItemsDeferred: jest.fn(),
    getFeeds: jest.fn(),
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
  ds.getFeedCategories.mockReset();
  ds.getFeedCategoryReadStats.mockReset();
  ds.getFeedReadStats.mockReset();
  ds.getItemsDeferred.mockReset();
  ds.getFeeds.mockReset();
  ds.markItemRead.mockReset();
  ds.getItemDeferred.mockReset();
  ds.markItemsRead.mockReset();
});

test("clicking category chevron expands and selects", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  ds.getFeedCategories.mockResolvedValue([
    { id: 1, title: "Tech", expanded: false },
  ]);
  ds.getFeedCategoryReadStats.mockResolvedValue([]);
  ds.getFeedReadStats.mockResolvedValue([]);
  ds.getItemsDeferred.mockResolvedValue([]);
  ds.getFeeds.mockResolvedValue([
    {
      id: 10,
      title: "Feed A",
      url: "https://example.com",
      feedUrl: "https://example.com/rss",
      feedCategoryId: 1,
    },
  ]);
  ds.markItemRead.mockResolvedValue(undefined);
  ds.getItemDeferred.mockResolvedValue(undefined);
  ds.markItemsRead.mockResolvedValue(undefined);

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <FeedsMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  const categoryText = await screen.findByText("Tech");
  const categoryButton = categoryText.closest("button");
  expect(categoryButton).toBeTruthy();

  const chevron = categoryButton?.querySelector(".categoryChevron");
  expect(chevron).toBeTruthy();

  fireEvent.click(chevron as HTMLElement);

  await screen.findByText("Feed A");

  await waitFor(() => {
    const categoryListItem = categoryButton?.closest("li");
    expect(categoryListItem?.classList.contains("feedcategory-selected")).toBe(
      true
    );
  });
});

test("clicking category name selects without expanding", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  ds.getFeedCategories.mockResolvedValue([
    { id: 1, title: "Tech", expanded: false },
  ]);
  ds.getFeedCategoryReadStats.mockResolvedValue([]);
  ds.getFeedReadStats.mockResolvedValue([]);
  ds.getItemsDeferred.mockResolvedValue([]);
  ds.getFeeds.mockResolvedValue([
    {
      id: 10,
      title: "Feed A",
      url: "https://example.com",
      feedUrl: "https://example.com/rss",
      feedCategoryId: 1,
    },
  ]);
  ds.markItemRead.mockResolvedValue(undefined);
  ds.getItemDeferred.mockResolvedValue(undefined);
  ds.markItemsRead.mockResolvedValue(undefined);

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <FeedsMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  const categoryText = await screen.findByText("Tech");
  const categoryButton = categoryText.closest("button");
  expect(categoryButton).toBeTruthy();

  fireEvent.click(categoryButton as HTMLButtonElement);

  await waitFor(() => {
    const categoryListItem = categoryButton?.closest("li");
    expect(categoryListItem?.classList.contains("feedcategory-selected")).toBe(
      true
    );
  });

  expect(ds.getFeeds).not.toHaveBeenCalled();
  expect(screen.queryByText("Feed A")).toBeNull();
});

test("selected item remains visible when list is refreshed with unreadOnly filter in feeds view", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  const mockItems = [
    {
      id: 1,
      title: "Feed Item 1",
      read: 0,
      published: 1000,
      feedTitle: "Feed A",
      url: "https://example.com/1",
    },
    {
      id: 2,
      title: "Feed Item 2",
      read: 0,
      published: 2000,
      feedTitle: "Feed A",
      url: "https://example.com/2",
    },
    {
      id: 3,
      title: "Feed Item 3",
      read: 0,
      published: 3000,
      feedTitle: "Feed A",
      url: "https://example.com/3",
    },
  ];

  // First call returns all items
  ds.getItemsDeferred.mockResolvedValueOnce(mockItems);
  ds.getFeedCategories.mockResolvedValue([
    { id: 1, title: "Tech", expanded: false },
  ]);
  ds.getFeedCategoryReadStats.mockResolvedValue([{ id: 1, unreadCount: 3 }]);
  ds.getFeedReadStats.mockResolvedValue([{ id: 10, unreadCount: 3 }]);
  ds.getFeeds.mockResolvedValue([
    {
      id: 10,
      title: "Feed A",
      url: "https://example.com",
      feedUrl: "https://example.com/rss",
      feedCategoryId: 1,
    },
  ]);
  ds.markItemRead.mockResolvedValue(undefined);
  ds.getItemDeferred.mockResolvedValue({
    ...mockItems[1],
    content: "Content for Feed Item 2",
  });

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  render(
    <MemoryRouter>
      <FeedsMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  // Wait for items to load
  await screen.findByText("Feed Item 1");
  await screen.findByText("Feed Item 2");
  await screen.findByText("Feed Item 3");

  // Click on Feed Item 2 to select it (marks it as read)
  const item2Element = await screen.findByText("Feed Item 2");
  fireEvent.click(item2Element);

  // Wait for the item to be marked as read
  await waitFor(() => {
    expect(ds.markItemRead).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 })
    );
  });

  // Second call returns only unread items (1 and 3, not 2)
  const unreadItems = [mockItems[0], mockItems[2]];
  ds.getItemsDeferred.mockResolvedValueOnce(unreadItems);

  // Trigger list refresh by scrolling to top
  const listPanel = document.getElementById("list-panel");
  if (listPanel) {
    fireEvent.scroll(listPanel, { target: { scrollTop: 0 } });
  }

  // Feed Item 2 should still be visible even though it's not in the unread list
  await waitFor(() => {
    expect(screen.getByText("Feed Item 2")).toBeTruthy();
  });

  // Items 1 and 3 should also be visible
  expect(screen.getByText("Feed Item 1")).toBeTruthy();
  expect(screen.getByText("Feed Item 3")).toBeTruthy();
});

test("feed unread counts are loaded when entering from deeplink with feedId", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  ds.getFeedCategories.mockResolvedValue([
    { id: 1, title: "Tech", expanded: false },
  ]);
  ds.getFeedCategoryReadStats.mockResolvedValue([{ id: 1, unreadCount: 5 }]);
  ds.getFeedReadStats.mockResolvedValue([
    { id: 10, unreadCount: 3 },
    { id: 11, unreadCount: 2 },
  ]);
  ds.getItemsDeferred.mockResolvedValue([]);
  ds.getFeeds.mockResolvedValue([
    {
      id: 10,
      title: "Feed A",
      url: "https://example.com/a",
      feedUrl: "https://example.com/a/rss",
      feedCategoryId: 1,
    },
    {
      id: 11,
      title: "Feed B",
      url: "https://example.com/b",
      feedUrl: "https://example.com/b/rss",
      feedCategoryId: 1,
    },
  ]);
  ds.markItemRead.mockResolvedValue(undefined);
  ds.getItemDeferred.mockResolvedValue(undefined);
  ds.markItemsRead.mockResolvedValue(undefined);

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  // Render with deeplink specifying category 1 and feed 10
  render(
    <MemoryRouter initialEntries={["/?category=1&feed=10"]}>
      <FeedsMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  // Wait for feeds to load
  await screen.findByText("Feed A");
  await screen.findByText("Feed B");

  // Verify that getFeedReadStats was called to load individual feed counts
  await waitFor(() => {
    expect(ds.getFeedReadStats).toHaveBeenCalled();
  });

  // Verify that getFeeds was called for the category
  expect(ds.getFeeds).toHaveBeenCalledWith(
    expect.objectContaining({
      selectedFeedCategory: expect.objectContaining({ id: 1, title: "Tech" }),
    })
  );
});

test("feed unread counts are loaded and displayed when entering from deeplink with only categoryId", async () => {
  const ds = (DataService as unknown as { __mock: any }).__mock;

  ds.getFeedCategories.mockResolvedValue([
    { id: 1, title: "Tech", expanded: false },
  ]);
  ds.getFeedCategoryReadStats.mockResolvedValue([{ id: 1, unreadCount: 5 }]);
  ds.getFeedReadStats.mockResolvedValue([
    { id: 10, unreadCount: 3 },
    { id: 11, unreadCount: 1 },
  ]);
  ds.getItemsDeferred.mockResolvedValue([]);
  ds.getFeeds.mockResolvedValue([
    {
      id: 10,
      title: "Feed A",
      url: "https://example.com/a",
      feedUrl: "https://example.com/a/rss",
      feedCategoryId: 1,
    },
    {
      id: 11,
      title: "Feed B",
      url: "https://example.com/b",
      feedUrl: "https://example.com/b/rss",
      feedCategoryId: 1,
    },
  ]);
  ds.markItemRead.mockResolvedValue(undefined);
  ds.getItemDeferred.mockResolvedValue(undefined);
  ds.markItemsRead.mockResolvedValue(undefined);

  const topMenu = React.createRef<HTMLDivElement>();
  const topOptions = React.createRef<HTMLDivElement>();

  // Render with deeplink specifying only category 1 (no feedId)
  render(
    <MemoryRouter initialEntries={["/?category=1"]}>
      <FeedsMain topMenu={topMenu} topOptions={topOptions} />
    </MemoryRouter>
  );

  // Wait for category to be selected
  await screen.findByText("Tech");

  // Verify that getFeedReadStats was called to load individual feed counts
  // even though the category is not expanded on screen yet
  await waitFor(() => {
    expect(ds.getFeedReadStats).toHaveBeenCalled();
  });

  // Verify that getFeeds was called for the category
  expect(ds.getFeeds).toHaveBeenCalledWith(
    expect.objectContaining({
      selectedFeedCategory: expect.objectContaining({ id: 1, title: "Tech" }),
    })
  );
});
