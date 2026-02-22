import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FieldValues, useForm } from "react-hook-form";
import DataService from "./service/DataService";
import FeedsTable from "./components/FeedsTable";

const ds = DataService.getInstance();

export default function Feeds({ topMenu }: FeedsProps) {
  const [feeds, setFeeds] = useState<Feed[]>([]);

  const { register, handleSubmit } = useForm();

  const [feedCategories, setFeedCategories] = useState<FeedCategory[]>([]);

  const [selectedFeedCategory, setSelectedFeedCategory] =
    useState<FeedCategory>();

  const loadFeedCategories = useCallback(async () => {
    const res = await ds.getFeedCategories();

    res.sort((a, b) => a.title.localeCompare(b.title));

    setFeedCategories(res);
  }, []);

  useEffect(() => {
    loadFeedCategories();
  }, [loadFeedCategories]);

  const showFeeds = useCallback(async () => {
    const res = await ds.getFeeds({ selectedFeedCategory });

    setFeeds(res);
  }, [selectedFeedCategory]);

  useEffect(() => {
    showFeeds();
  }, [showFeeds]);

  const removeFeed = useCallback(
    async (feedId: number) => {
      await ds.removeFeed(feedId);

      showFeeds();
    },
    [showFeeds]
  );

  const selectFeedCategory = useCallback(
    (feedCategory: FeedCategory | undefined) => {
      setSelectedFeedCategory(feedCategory);
    },
    []
  );

  // const inputRef = register({ required: true });
  // const inputSearchRef = register();

  const onFeedSearch = useCallback((data: FieldValues) => {
    setFeeds((prev) => {
      return prev.map((feed) => {
        if (
          data.feedSearchTerm !== "" &&
          feed.title
            .toLowerCase()
            .indexOf(data.feedSearchTerm.toLowerCase()) === -1 &&
          feed.url &&
          feed.url.toLowerCase().indexOf(data.feedSearchTerm.toLowerCase()) ===
            -1
        ) {
          feed.hidden = true;
        } else {
          feed.hidden = false;
        }
        return feed;
      });
    });
  }, []);

  const [sortField, setSortField] = useState<"name" | "items" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback(
    (field: "name" | "items") => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField]
  );

  const sortedFeeds = useMemo(() => {
    if (!sortField) return feeds;

    const sorted = [...feeds].sort((a, b) => {
      let compareValue = 0;

      if (sortField === "name") {
        const aTitle = (a.title || "").toLowerCase();
        const bTitle = (b.title || "").toLowerCase();
        compareValue = aTitle.localeCompare(bTitle);
      } else if (sortField === "items") {
        compareValue = (a.itemsCount || 0) - (b.itemsCount || 0);
      }

      return sortDirection === "asc" ? compareValue : -compareValue;
    });

    return sorted;
  }, [feeds, sortField, sortDirection]);

  return (
    <>
      <nav id="main-sidebar">
        <ul>
          <li className={!selectedFeedCategory ? "feedcategory-selected" : ""}>
            <button
              type="button"
              className="btn btn-link text-decoration-none"
              onClick={() => selectFeedCategory(undefined)}
              tabIndex={0}
            >
              <small>All</small>
            </button>
          </li>
          {feedCategories.map((feedCategory) => {
            return (
              <li
                key={feedCategory.id}
                className={
                  feedCategory.id === selectedFeedCategory?.id
                    ? "feedcategory-selected"
                    : ""
                }
              >
                <button
                  type="button"
                  className="btn btn-link text-decoration-none"
                  onClick={() => selectFeedCategory(feedCategory)}
                  tabIndex={0}
                >
                  <span>{feedCategory.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main id="main-content">
        <div id="table-panel">
          <form onSubmit={handleSubmit(onFeedSearch)}>
            <div>
              <input
                type="text"
                className="form-control input"
                {...register("feedSearchTerm")}
                id="feedSearchTerm"
                placeholder="Search by feed name"
              />
            </div>
          </form>

          <FeedsTable
            feeds={sortedFeeds}
            removeFeed={removeFeed}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </div>
      </main>
    </>
  );
}
