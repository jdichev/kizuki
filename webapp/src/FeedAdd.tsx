import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FieldValues, useForm } from "react-hook-form";
import DataService from "./service/DataService";

const ds = DataService.getInstance();

export default function FeedAdd() {
  const navigate = useNavigate();

  const { register, handleSubmit, getValues } = useForm();

  const [feedCategories, setFeedCategories] = useState<FeedCategory[]>([]);

  const [formFeedData, setFormFeedData] = useState<Feed[]>([]);

  const [checkedFeeds, setCheckedFeeds] = useState<string[]>([]);

  const [initialFormError, setInitialFormError] = useState(false);

  useEffect(() => {
    const loadFeedCategories = async () => {
      const res = await ds.getFeedCategories();
      res.sort((a, b) => a.title.localeCompare(b.title));
      setFeedCategories(res);
    };

    loadFeedCategories();
  }, []);

  const onSubmitFirstStep = useCallback(async (data: FieldValues) => {
    const inputFieldInitial = document.getElementById("feedUrlInitial");
    inputFieldInitial?.setAttribute("disabled", "disabled");

    const submitInitial = document.getElementById("feedSubmitInitial");
    if (submitInitial) {
      submitInitial.innerText = "Loading...";
    }
    submitInitial?.setAttribute("disabled", "disabled");

    const feeds = await ds.checkFeed(data.feedUrlInitial);
    if (submitInitial) {
      submitInitial.innerText = "Go";
    }
    submitInitial?.removeAttribute("disabled");
    inputFieldInitial?.removeAttribute("disabled");

    if (feeds.length === 0) {
      setInitialFormError(true);
      setFormFeedData([]);
      setCheckedFeeds([]);
    } else {
      setInitialFormError(false);
      setFormFeedData(feeds);
      const feedUrlsToCheck = feeds.map((feed) => {
        return feed.feedUrl;
      });
      const checkedFeedsRes = await ds.checkFeedUrls(feedUrlsToCheck);
      setCheckedFeeds(checkedFeedsRes);
    }
  }, []);

  const onSubmitSecondStep = useCallback(
    async (index: number) => {
      const data = getValues();

      await ds.addFeed({
        feedUrl: data[`feedUrl-${index}`],
        url: data[`url-${index}`],
        title: data[`title-${index}`],
        feedCategoryId: parseInt(data[`feedCategory-${index}`]),
        autoSummarize:
          data[`autoSummarize-${index}`] === "inherit"
            ? null
            : Number(data[`autoSummarize-${index}`])
              ? 1
              : 0,
      });

      setCheckedFeeds((prev) => {
        const next: string[] = [...prev];
        next.push(data[`feedUrl-${index}`]);

        return next;
      });

      if (formFeedData.length === checkedFeeds.length + 1) {
        navigate("/feeds/list");
      }
    },
    [getValues, navigate, checkedFeeds, formFeedData]
  );

  return (
    <>
      <nav id="main-sidebar" data-activenav="true">
        <ul>
          <li className="feed-selected">
            <button type="button" className="btn btn-link text-decoration-none">
              <i className="bi bi-plus-square" />
              <span>Add feed</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="btn btn-link text-decoration-none"
              onClick={() => navigate("/feeds/opml")}
            >
              <i className="bi bi-file-earmark-arrow-up" />
              <span>OPML</span>
            </button>
          </li>
        </ul>
      </nav>

      <main id="main-content">
        <div id="feed-panel">
          <div id="panel-single-column">
            <form onSubmit={handleSubmit(onSubmitFirstStep)}>
              <h3>Add new feed</h3>

              <div>
                <label htmlFor="feedUrlInitial" className="form-label">
                  Enter site URL, feed URL, or blogger/site name
                </label>

                <input
                  // placeholder="E.g. http://example.com or http://example.com/feed.rss"
                  className="form-control input"
                  id="feedUrlInitial"
                  required
                  {...register("feedUrlInitial")}
                />

                {initialFormError && (
                  <p>
                    Feed not found. Try a direct URL or a more specific
                    blogger/site name.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                id="feedSubmitInitial"
              >
                Go
              </button>

              <Link to="/feeds/list" className="btn btn-outline-secondary">
                Back
              </Link>
            </form>

            <div>
              {formFeedData.map((feedData, i) => {
                const feedUrl = (feedData.feedUrl || "").trim();
                const siteUrl = (feedData.url || "").trim();
                const hasSiteUrl = siteUrl.length > 0;
                const isDifferentTarget = hasSiteUrl && siteUrl !== feedUrl;

                return (
                  <form
                    key={feedData.feedUrl}
                    // onSubmit={handleSubmit(onSubmitSecondStep)}
                  >
                    <div>
                      <h1>{feedData.title}</h1>
                      <div
                        className="text-muted"
                        style={{ wordBreak: "break-all" }}
                      >
                        <strong>Feed URL:</strong> {feedUrl}
                      </div>
                      <div
                        className="text-muted"
                        style={{ wordBreak: "break-all" }}
                      >
                        <strong>Site URL:</strong>{" "}
                        {hasSiteUrl ? siteUrl : "(not available)"}
                      </div>
                      {isDifferentTarget && (
                        <div className="text-warning-emphasis">
                          Subscribing to a different feed target than the site
                          URL.
                        </div>
                      )}
                      {!isDifferentTarget && hasSiteUrl && (
                        <div className="text-muted">
                          Feed URL and site URL are the same.
                        </div>
                      )}
                      <div>
                        <input
                          type="hidden"
                          {...register(`title-${i}`)}
                          value={feedData.title}
                        />
                        <input
                          type="hidden"
                          {...register(`url-${i}`)}
                          value={feedData.url}
                        />
                        <input
                          type="hidden"
                          {...register(`feedUrl-${i}`)}
                          value={feedData.feedUrl}
                        />
                        <select
                          className="form-select"
                          {...register(`feedCategory-${i}`)}
                        >
                          {feedCategories.map((feedCategory) => {
                            return (
                              <option
                                key={feedCategory.id}
                                value={feedCategory.id}
                              >
                                {feedCategory.title}
                              </option>
                            );
                          })}
                        </select>
                        <select
                          className="form-select mt-2"
                          {...register(`autoSummarize-${i}`)}
                          defaultValue="inherit"
                        >
                          <option value="inherit">
                            Auto summarize: Inherit category
                          </option>
                          <option value="1">Auto summarize: Enabled</option>
                          <option value="0">Auto summarize: Disabled</option>
                        </select>
                      </div>
                      <div>
                        {checkedFeeds.includes(feedData.feedUrl) ? (
                          <div>Added</div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              onSubmitSecondStep(i);
                            }}
                            type="submit"
                            className="btn btn-primary"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
