import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SettingsSubNavigation from "./components/SettingsSubNavigation";
import App from "./App";

jest.mock("./Home", () => () => <div>HomeView</div>);
jest.mock("./FeedCategoriesMain", () => () => (
  <div>FeedCategoriesMainView</div>
));
jest.mock("./ItemCategoriesMain", () => () => (
  <div>ItemCategoriesMainView</div>
));
jest.mock("./FeedsList", () => () => <div>FeedsListView</div>);
jest.mock("./FeedAdd", () => () => <div>FeedAddView</div>);
jest.mock("./FeedOpmlOps", () => () => <div>FeedOpmlOpsView</div>);
jest.mock("./FeedEdit", () => () => <div>FeedEditView</div>);
jest.mock("./ItemCategoryEdit", () => () => <div>ItemCategoryEditView</div>);
jest.mock("./ItemCategoryList", () => () => <div>ItemCategoryListView</div>);
jest.mock("./FeedCategoryList", () => () => <div>FeedCategoryListView</div>);
jest.mock("./FeedCategoryEdit", () => () => <div>FeedCategoryEditView</div>);
jest.mock("./Settings", () => () => <div>SettingsView</div>);
jest.mock("./ItemsSearch", () => () => <div>ItemsSearchView</div>);
jest.mock("./hooks/useSidebarDivider", () => ({
  useSidebarDivider: () => React.createRef<HTMLDivElement>(),
}));

test("settings sub-navigation shows all three entries and navigates", async () => {
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <SettingsSubNavigation activeSection="settings" />

      <Routes>
        <Route path="/settings" element={<div>SettingsPage</div>} />
        <Route
          path="/item-categories/list"
          element={<div>ItemCategoriesPage</div>}
        />
        <Route
          path="/feed-categories/list"
          element={<div>FeedCategoriesPage</div>}
        />
      </Routes>
    </MemoryRouter>
  );

  const settingsButton = screen.getByRole("button", { name: /settings/i });
  const itemCategoriesButton = screen.getByRole("button", {
    name: /item categories/i,
  });
  const feedCategoriesButton = screen.getByRole("button", {
    name: /feed categories/i,
  });

  expect(settingsButton).toBeTruthy();
  expect(itemCategoriesButton).toBeTruthy();
  expect(feedCategoriesButton).toBeTruthy();

  expect(
    settingsButton.closest("li")?.classList.contains("feed-selected")
  ).toBe(true);

  fireEvent.click(feedCategoriesButton);

  await screen.findByText("FeedCategoriesPage");
});

test("app routes to feed categories list management view", async () => {
  window.location.hash = "#/feed-categories/list";

  render(<App />);

  await screen.findByText("FeedCategoryListView");
});
