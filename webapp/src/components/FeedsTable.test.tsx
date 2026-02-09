import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import FeedsTable from "./FeedsTable";

test("renders formatted date", async () => {
  const handleRemoveFeed = jest.fn();
  const handleSort = jest.fn();

  const feeds = [
    {
      id: 339,
      title: "All Things Distributed 1",
      url: "http://www.allthingsdistributed.com/",
      feedUrl: "http://www.allthingsdistributed.com/atom.xml",
      feedType: "rss",
      feedCategoryId: 107,
      lastHash: "8a7a8600979e24d437eaeddc389798f2",
      error: 25,
      updateFrequency: 2300778947,
      categoryTitle: "Dev",
    },
  ];

  render(
    <BrowserRouter>
      <FeedsTable
        removeFeed={handleRemoveFeed}
        feeds={feeds}
        sortField={null}
        sortDirection="asc"
        onSort={handleSort}
      />
    </BrowserRouter>
  );

  const renderedFeedEditLink = screen.getByTestId("feed-edit-link");
  const renderedFeedDeleteLink = screen.getByTestId("feed-delete-link");

  expect(renderedFeedEditLink.textContent).toContain(feeds[0].title);

  fireEvent.click(renderedFeedDeleteLink);

  expect(handleRemoveFeed).toHaveBeenCalledTimes(1);
});
