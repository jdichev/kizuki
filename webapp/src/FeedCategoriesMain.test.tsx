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
