import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { FieldValues, useForm } from "react-hook-form";
import DataService from "./service/DataService";

const ds = DataService.getInstance();

export default function FeedEdit() {
  const { feedId } = useParams<{ feedId: string }>();

  const feedIdNum = parseInt(feedId || "0");

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const [feedCategories, setFeedCategories] = useState<FeedCategory[]>([]);

  const [formFeedData, setFormFeedData] = useState<Feed>();

  useEffect(() => {
    const loadFeedCategories = async () => {
      const res = await ds.getFeedCategories();
      res.sort((a, b) => a.title.localeCompare(b.title));
      setFeedCategories(res);
    };

    loadFeedCategories();
  }, []);

  useEffect(() => {
    const loadFormFeedData = async () => {
      const feed = await ds.getFeedById(feedIdNum);

      setFormFeedData(feed);

      setValue("feedUrl", feed?.feedUrl);
      setValue("title", feed?.title);
      setValue("feedCategoryId", feed?.feedCategoryId);
    };

    loadFormFeedData();
  }, [feedId, feedIdNum, setValue]);

  const onSubmit = useCallback(
    async (data: FieldValues) => {
      data.id = feedId;
      data.feedCategoryId = parseInt(data.feedCategoryId);
      data.id = parseInt(data.id);

      await ds.updateFeed(data as Feed);

      navigate("/feeds/list");
    },
    [navigate, feedId]
  );

  return (
    <>
      <nav id="main-sidebar" />

      <main id="main-content">
        <div id="feed-panel">
          <div id="panel-single-column">
            <form onSubmit={handleSubmit(onSubmit)}>
              <h3>
                Edit feed{" "}
                {formFeedData?.title ? formFeedData.title : "NO_TITLE"}
              </h3>
              <div>
                <label htmlFor="feedUrl" className="form-label">
                  Feed URL
                </label>
                <input
                  type="url"
                  className="form-control"
                  id="feedUrl"
                  required
                  {...register("feedUrl")}
                />
                {errors.feedUrl && <p>Feed URL is needed</p>}
              </div>
              <div>
                <label htmlFor="title" className="form-label">
                  Feed Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="title"
                  maxLength={256}
                  {...register("title")}
                />
              </div>
              <div>
                <label htmlFor="feedCategory" className="form-label">
                  Feed Category
                </label>
                <select
                  className="form-select"
                  aria-label="Default select example"
                  id="feedCategoryId"
                  {...register("feedCategoryId")}
                  onChange={(e) => {
                    if (formFeedData) {
                      const newFormFeedData = { ...formFeedData };
                      newFormFeedData.feedCategoryId = parseInt(e.target.value);
                      setFormFeedData(newFormFeedData);
                    }
                  }}
                >
                  {feedCategories.map((feedCategory) => {
                    return (
                      <option key={feedCategory.id} value={feedCategory.id}>
                        {feedCategory.title}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button type="submit" className="btn btn-primary">
                Save
              </button>

              <Link to="/feeds/list" className="btn btn-outline-secondary">
                Back
              </Link>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
