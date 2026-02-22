import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { FieldValues, useForm } from "react-hook-form";
import DataService from "./service/DataService";
import SettingsSubNavigation from "./components/SettingsSubNavigation";

const ds = DataService.getInstance();

export default function FeedCategoryEdit() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const isNew = !categoryId;
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();

  const [formFeedCategoryData, setFormFeedCategoryData] =
    useState<FeedCategory>();

  useEffect(() => {
    const loadFormFeedCategoryData = async () => {
      if (isNew) {
        setFormFeedCategoryData({ title: "", text: "" });
      } else {
        const categoryIdNum = parseInt(categoryId || "0", 10);
        const feedCategories = await ds.getFeedCategories();
        const feedCategory = feedCategories.find(
          (category) => category.id === categoryIdNum
        );

        if (feedCategory) {
          setFormFeedCategoryData(feedCategory);
          setValue("title", feedCategory.title);
          setValue("text", feedCategory.text);
        }
      }
    };

    loadFormFeedCategoryData();
  }, [categoryId, isNew, setValue]);

  const onSubmit = useCallback(
    async (data: FieldValues) => {
      const feedCategory: FeedCategory = {
        id: isNew ? undefined : parseInt(categoryId || "0", 10),
        title: data.title,
        text: data.text,
      };

      if (isNew) {
        await ds.addFeedCategory(feedCategory);
      } else {
        await ds.updateFeedCategory(feedCategory);
      }

      navigate("/feed-categories/list");
    },
    [navigate, categoryId, isNew]
  );

  return (
    <>
      <SettingsSubNavigation activeSection="feed-categories" />

      <main id="main-content">
        <div id="feed-panel">
          <div id="panel-single-column">
            <form onSubmit={handleSubmit(onSubmit)}>
              <h3>
                {isNew ? "New " : "Edit "}
                Category{" "}
                {formFeedCategoryData?.title
                  ? `- ${formFeedCategoryData.title}`
                  : ""}
              </h3>
              <div>
                <label htmlFor="title" className="form-label">
                  Category Title
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="title"
                  maxLength={256}
                  required
                  {...register("title")}
                />
                {errors.title && <p>Title is required</p>}
              </div>
              <div>
                <label htmlFor="text" className="form-label">
                  Description
                </label>
                <textarea
                  className="form-control"
                  id="text"
                  rows={4}
                  {...register("text")}
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Save
              </button>

              <Link
                to="/feed-categories/list"
                className="btn btn-outline-secondary"
              >
                Back
              </Link>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
